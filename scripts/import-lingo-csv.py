#!/usr/bin/env python3
"""
Import glucose data from LibreView CSV export.

To export your data:
1. Go to https://www.libreview.com
2. Log in with your Lingo/LibreLink credentials
3. Go to "Glucose History"
4. Click "Download Glucose Data"
5. Save the CSV file to: data/lingo-export.csv

Usage:
  python3 scripts/import-lingo-csv.py
  python3 scripts/import-lingo-csv.py --file path/to/export.csv
"""

import argparse
import csv
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_CSV = DATA_DIR / "lingo-export.csv"
OUTPUT_FILE = DATA_DIR / "lingo.json"


def parse_timestamp(date_str: str, time_str: str = None) -> str:
    """Parse various date/time formats from LibreView CSV."""
    # Try different formats
    formats_to_try = [
        "%m-%d-%Y %I:%M %p",  # MM-DD-YYYY HH:MM AM/PM
        "%d-%m-%Y %H:%M",     # DD-MM-YYYY HH:MM
        "%Y-%m-%d %H:%M:%S",  # ISO format
        "%Y-%m-%d %H:%M",     # ISO without seconds
        "%m/%d/%Y %I:%M %p",  # MM/DD/YYYY with slashes
        "%d/%m/%Y %H:%M",     # DD/MM/YYYY with slashes
    ]

    # Combine date and time if separate
    if time_str:
        combined = f"{date_str} {time_str}"
    else:
        combined = date_str

    for fmt in formats_to_try:
        try:
            dt = datetime.strptime(combined.strip(), fmt)
            return dt.isoformat()
        except ValueError:
            continue

    # If nothing works, return the original
    print(f"Warning: Could not parse timestamp: {combined}")
    return combined


def parse_glucose_value(value_str: str) -> tuple:
    """Parse glucose value, returning (value_mg_dl, is_high, is_low)."""
    if not value_str or value_str.strip() == "":
        return None, False, False

    value_str = value_str.strip()
    is_high = False
    is_low = False

    # Check for HI/LO indicators
    if value_str.upper() == "HI" or value_str.upper() == "HIGH":
        return 400, True, False  # Use 400 as placeholder for HIGH
    if value_str.upper() == "LO" or value_str.upper() == "LOW":
        return 40, False, True   # Use 40 as placeholder for LOW

    try:
        value = float(value_str)
        # Detect if value is in mmol/L (typically < 35) and convert to mg/dL
        if value < 35:
            value = round(value * 18, 1)
        return value, value > 180, value < 70
    except ValueError:
        return None, False, False


def detect_csv_format(filepath: Path) -> dict:
    """Detect the CSV format and return column mappings."""
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        # Skip header rows that might contain metadata
        lines = f.readlines()

    # Find the header row (usually contains "Glucose" or "Historic Glucose")
    header_row_idx = 0
    for i, line in enumerate(lines):
        if 'glucose' in line.lower() or 'timestamp' in line.lower():
            header_row_idx = i
            break

    # Parse header
    header = lines[header_row_idx].strip().split(',')
    header = [h.strip().strip('"') for h in header]

    # Common column name variations
    column_map = {
        'timestamp': None,
        'date': None,
        'time': None,
        'glucose': None,
        'scan_glucose': None,
        'historic_glucose': None,
    }

    for i, col in enumerate(header):
        col_lower = col.lower()
        if 'timestamp' in col_lower or 'device timestamp' in col_lower:
            column_map['timestamp'] = i
        elif col_lower == 'time':
            column_map['time'] = i
        elif col_lower == 'date':
            column_map['date'] = i
        elif 'historic glucose' in col_lower:
            column_map['historic_glucose'] = i
        elif 'scan glucose' in col_lower:
            column_map['scan_glucose'] = i
        elif col_lower == 'glucose' or 'glucose value' in col_lower:
            column_map['glucose'] = i

    return {
        'header_row': header_row_idx,
        'columns': column_map,
        'header': header,
    }


def import_csv(filepath: Path) -> list:
    """Import glucose readings from LibreView CSV."""
    if not filepath.exists():
        print(f"Error: CSV file not found: {filepath}")
        print("\nTo export your data:")
        print("1. Go to https://www.libreview.com")
        print("2. Log in with your Lingo/LibreLink credentials")
        print("3. Go to 'Glucose History'")
        print("4. Click 'Download Glucose Data'")
        print(f"5. Save the CSV file to: {DEFAULT_CSV}")
        return []

    format_info = detect_csv_format(filepath)
    columns = format_info['columns']
    header_row = format_info['header_row']

    print(f"Detected format: {format_info['header']}")
    print(f"Column mappings: {columns}")

    readings = []

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)

        # Skip to data rows
        for _ in range(header_row + 1):
            next(reader, None)

        for row in reader:
            if not row or len(row) < 2:
                continue

            # Get timestamp
            timestamp = None
            if columns['timestamp'] is not None and columns['timestamp'] < len(row):
                timestamp = parse_timestamp(row[columns['timestamp']])
            elif columns['date'] is not None and columns['date'] < len(row):
                time_val = row[columns['time']] if columns['time'] is not None and columns['time'] < len(row) else ""
                timestamp = parse_timestamp(row[columns['date']], time_val)

            if not timestamp:
                continue

            # Get glucose value - try historic first, then scan, then generic
            value = None
            is_high = False
            is_low = False

            for col_name in ['historic_glucose', 'scan_glucose', 'glucose']:
                col_idx = columns.get(col_name)
                if col_idx is not None and col_idx < len(row) and row[col_idx].strip():
                    value, is_high, is_low = parse_glucose_value(row[col_idx])
                    if value is not None:
                        break

            if value is None:
                continue

            readings.append({
                'timestamp': timestamp,
                'value': value,
                'isHigh': is_high,
                'isLow': is_low,
            })

    # Sort by timestamp (newest first)
    readings.sort(key=lambda x: x['timestamp'], reverse=True)

    return readings


def calculate_stats(readings: list, days: int = None) -> dict:
    """Calculate statistics for readings."""
    if days:
        cutoff = datetime.now() - timedelta(days=days)
        filtered = [r for r in readings if datetime.fromisoformat(r['timestamp']) >= cutoff]
    else:
        filtered = readings

    if not filtered:
        return {}

    values = [r['value'] for r in filtered]

    return {
        'average': round(sum(values) / len(values), 1),
        'min': min(values),
        'max': max(values),
        'count': len(values),
        'inRange': sum(1 for v in values if 70 <= v <= 180),
        'high': sum(1 for v in values if v > 180),
        'low': sum(1 for v in values if v < 70),
    }


def main():
    parser = argparse.ArgumentParser(description="Import Lingo glucose data from LibreView CSV")
    parser.add_argument("--file", "-f", type=Path, default=DEFAULT_CSV,
                        help=f"Path to CSV file (default: {DEFAULT_CSV})")
    args = parser.parse_args()

    print(f"Importing from: {args.file}")

    readings = import_csv(args.file)

    if not readings:
        print("No readings found.")
        return 1

    print(f"\nImported {len(readings)} glucose readings")

    # Get current (most recent) reading
    current = readings[0] if readings else None

    # Calculate overall stats
    stats = calculate_stats(readings)

    # Calculate stats for different time ranges
    stats_7d = calculate_stats(readings, 7)
    stats_30d = calculate_stats(readings, 30)
    stats_90d = calculate_stats(readings, 90)

    # Build output data
    data = {
        'current': current,
        'history': readings,
        'stats': stats,
        'stats7d': stats_7d,
        'stats30d': stats_30d,
        'stats90d': stats_90d,
        'source': 'csv_import',
        'importedAt': datetime.now().isoformat(),
        'fetchedAt': datetime.now().isoformat(),
    }

    # Save to JSON
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Data saved to: {OUTPUT_FILE}")

    # Print summary
    if current:
        print(f"\nMost recent reading: {current['value']} mg/dL ({current['timestamp']})")

    print(f"\nOverall stats ({stats.get('count', 0)} readings):")
    print(f"  Average: {stats.get('average')} mg/dL")
    print(f"  Range: {stats.get('min')} - {stats.get('max')} mg/dL")
    print(f"  Time in range (70-180): {stats.get('inRange', 0)} readings ({round(stats.get('inRange', 0) / max(stats.get('count', 1), 1) * 100)}%)")

    if stats_7d:
        print(f"\nLast 7 days ({stats_7d.get('count', 0)} readings):")
        print(f"  Average: {stats_7d.get('average')} mg/dL")

    return 0


if __name__ == "__main__":
    exit(main())
