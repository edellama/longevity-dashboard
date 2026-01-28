#!/usr/bin/env python3
"""
Consolidate all health data into a unified format for AI analysis.

This script merges data from:
- Garmin (steps, activities, weight)
- Whoop (recovery, HRV, strain, sleep) - via API cache
- Lingo/CGM (glucose readings)
- Biomarkers (lab results)

Output: data/unified/health_data.json
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import urllib.request
import urllib.error

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
UNIFIED_DIR = DATA_DIR / "unified"
PUBLIC_DIR = PROJECT_ROOT / "public"

# Input files
GARMIN_FILE = PUBLIC_DIR / "garmin_data.json"
LINGO_FILE = DATA_DIR / "lingo.json"

# Output file
OUTPUT_FILE = UNIFIED_DIR / "health_data.json"

# API endpoints (local dev server)
# Try multiple ports in case default is in use
API_PORTS = [3000, 3001, 3002]
API_BASE_URL = None  # Will be set dynamically


def load_json(filepath: Path) -> dict | list | None:
    """Load JSON file if it exists."""
    if filepath.exists():
        try:
            with open(filepath) as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load {filepath}: {e}")
    return None


def find_api_server() -> str | None:
    """Find which port the dev server is running on."""
    for port in API_PORTS:
        url = f"http://localhost:{port}/api/biomarkers"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    print(f"  Found dev server on port {port}")
                    return f"http://localhost:{port}/api"
        except:
            pass
    return None


def fetch_whoop_data() -> dict:
    """Fetch Whoop data from local API (requires dev server running)."""
    whoop_data = {
        "recovery": [],
        "sleep": [],
        "workout": []
    }

    # Calculate date range (last 365 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    start_iso = start_date.strftime("%Y-%m-%dT00:00:00.000Z")
    end_iso = end_date.strftime("%Y-%m-%dT23:59:59.999Z")

    endpoints = ["recovery", "sleep", "workout"]

    for endpoint in endpoints:
        # Whoop API uses ?type= parameter, not separate routes
        url = f"{API_BASE_URL}/whoop?type={endpoint}&start={start_iso}&end={end_iso}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as response:
                data = json.loads(response.read().decode())
                # API returns { records: [...] }
                records = data.get("records", []) if isinstance(data, dict) else data
                whoop_data[endpoint] = records if isinstance(records, list) else []
                print(f"  Whoop {endpoint}: {len(whoop_data[endpoint])} records")
        except urllib.error.HTTPError as e:
            print(f"  Warning: Could not fetch Whoop {endpoint}: HTTP {e.code}")
        except urllib.error.URLError as e:
            print(f"  Warning: Could not fetch Whoop {endpoint}: {e}")
        except Exception as e:
            print(f"  Warning: Error processing Whoop {endpoint}: {e}")

    return whoop_data


def fetch_biomarkers_data() -> dict:
    """Fetch biomarkers data from local API (reads Excel file)."""
    url = f"{API_BASE_URL}/biomarkers"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            categories = data.get("categories", [])
            print(f"  Biomarkers: {len(categories)} categories from Excel")
            return data
    except urllib.error.URLError as e:
        print(f"  Warning: Could not fetch biomarkers: {e}")
    except Exception as e:
        print(f"  Warning: Error processing biomarkers: {e}")
    return {}


def process_whoop_data(whoop: dict) -> dict:
    """Process Whoop data into daily records."""
    daily = defaultdict(lambda: {
        "date": None,
        "whoop": {}
    })

    # Recovery data (contains HRV and recovery score)
    for record in whoop.get("recovery", []):
        created_at = record.get("created_at", "")
        date = created_at[:10] if created_at else None
        if date and record.get("score"):
            score = record["score"]
            daily[date]["date"] = date
            daily[date]["whoop"]["recoveryScore"] = score.get("recovery_score")
            # HRV: convert from milli if needed
            hrv_raw = score.get("hrv_rmssd_milli")
            if hrv_raw is not None:
                # If > 1, it's in ms already; if < 1, it's in seconds
                hrv_ms = hrv_raw if hrv_raw > 1 else hrv_raw * 1000
                daily[date]["whoop"]["hrvMs"] = round(hrv_ms, 1)
            daily[date]["whoop"]["restingHeartRate"] = score.get("resting_heart_rate")

    # Sleep data
    for record in whoop.get("sleep", []):
        created_at = record.get("created_at", "")
        date = created_at[:10] if created_at else None
        if date and record.get("score"):
            score = record["score"]
            stage_summary = score.get("stage_summary", {})
            daily[date]["date"] = date

            # Calculate total sleep from stages
            total_sleep_ms = (
                (stage_summary.get("total_light_sleep_time_milli") or 0) +
                (stage_summary.get("total_slow_wave_sleep_time_milli") or 0) +
                (stage_summary.get("total_rem_sleep_time_milli") or 0)
            )
            if total_sleep_ms > 0:
                daily[date]["whoop"]["sleepHours"] = round(total_sleep_ms / (1000 * 60 * 60), 2)
                daily[date]["whoop"]["deepSleepHours"] = round((stage_summary.get("total_slow_wave_sleep_time_milli") or 0) / (1000 * 60 * 60), 2)
                daily[date]["whoop"]["remSleepHours"] = round((stage_summary.get("total_rem_sleep_time_milli") or 0) / (1000 * 60 * 60), 2)
                daily[date]["whoop"]["lightSleepHours"] = round((stage_summary.get("total_light_sleep_time_milli") or 0) / (1000 * 60 * 60), 2)

            daily[date]["whoop"]["sleepPerformance"] = score.get("sleep_performance_percentage")
            daily[date]["whoop"]["sleepEfficiency"] = score.get("sleep_efficiency_percentage")

    # Workout/Strain data
    for record in whoop.get("workout", []):
        created_at = record.get("created_at", "")
        date = created_at[:10] if created_at else None
        if date and record.get("score"):
            score = record["score"]
            daily[date]["date"] = date
            # Accumulate strain if multiple workouts
            current_strain = daily[date]["whoop"].get("strain", 0)
            new_strain = score.get("strain") or 0
            daily[date]["whoop"]["strain"] = max(current_strain, new_strain)  # Use max strain of the day

    return dict(daily)


def process_garmin_data(garmin: dict) -> dict:
    """Process Garmin data into daily records."""
    daily = defaultdict(lambda: {
        "date": None,
        "garmin": {}
    })

    # Daily summaries (steps, calories, stress, body battery)
    # NOTE: We skip restingHeartRate from Garmin as it's unreliable - using Whoop instead
    for summary in garmin.get("dailySummaries", []):
        date = summary.get("date")
        if date:
            daily[date]["date"] = date
            daily[date]["garmin"]["steps"] = summary.get("steps")
            daily[date]["garmin"]["calories"] = summary.get("calories")
            daily[date]["garmin"]["activeCalories"] = summary.get("activeCalories")
            daily[date]["garmin"]["distance"] = summary.get("distance")
            daily[date]["garmin"]["floors"] = summary.get("floors")
            # Skip restingHeartRate - Garmin data is incorrect (showing 120-150 instead of 50-70)
            daily[date]["garmin"]["averageStress"] = summary.get("averageStress")
            daily[date]["garmin"]["bodyBattery"] = summary.get("bodyBattery")

    # Sleep data
    for sleep in garmin.get("sleepData", []):
        date = sleep.get("date")
        if date:
            daily[date]["date"] = date
            daily[date]["garmin"]["sleepSeconds"] = sleep.get("sleepSeconds")
            daily[date]["garmin"]["deepSleepSeconds"] = sleep.get("deepSleepSeconds")
            daily[date]["garmin"]["lightSleepSeconds"] = sleep.get("lightSleepSeconds")
            daily[date]["garmin"]["remSleepSeconds"] = sleep.get("remSleepSeconds")
            daily[date]["garmin"]["sleepScore"] = sleep.get("sleepScore")

    # Activities
    activities_by_date = defaultdict(list)
    for activity in garmin.get("activities", []):
        date = activity.get("date")
        if date:
            activities_by_date[date].append({
                "name": activity.get("name"),
                "type": activity.get("type"),
                "duration": activity.get("duration"),
                "distance": activity.get("distance"),
                "calories": activity.get("calories"),
                "averageHR": activity.get("averageHR"),
                "maxHR": activity.get("maxHR"),
            })

    for date, acts in activities_by_date.items():
        daily[date]["date"] = date
        daily[date]["garmin"]["activities"] = acts
        daily[date]["garmin"]["activityCount"] = len(acts)
        daily[date]["garmin"]["totalActivityDuration"] = sum(a.get("duration", 0) or 0 for a in acts)
        daily[date]["garmin"]["totalActivityCalories"] = sum(a.get("calories", 0) or 0 for a in acts)

    # Weight
    for weight in garmin.get("weight", []):
        date = weight.get("date")
        if date:
            daily[date]["date"] = date
            daily[date]["garmin"]["weight"] = weight.get("weight")
            daily[date]["garmin"]["bodyFat"] = weight.get("bodyFat")
            daily[date]["garmin"]["muscleMass"] = weight.get("muscleMass")
            daily[date]["garmin"]["bmi"] = weight.get("bmi")

    return dict(daily)


def process_lingo_data(lingo: dict) -> dict:
    """Process Lingo/CGM data into daily records."""
    daily = defaultdict(lambda: {
        "date": None,
        "glucose": {}
    })

    # Group readings by date
    readings_by_date = defaultdict(list)
    for reading in lingo.get("history", []):
        timestamp = reading.get("timestamp", "")
        if timestamp:
            date = timestamp[:10]  # YYYY-MM-DD
            readings_by_date[date].append(reading.get("value"))

    # Calculate daily stats
    for date, values in readings_by_date.items():
        if values:
            daily[date]["date"] = date
            daily[date]["glucose"] = {
                "average": round(sum(values) / len(values), 1),
                "min": min(values),
                "max": max(values),
                "readings": len(values),
                "inRange": sum(1 for v in values if 70 <= v <= 140),
                "timeInRangePercent": round(sum(1 for v in values if 70 <= v <= 140) / len(values) * 100, 1),
            }

    return dict(daily)


def process_biomarkers(biomarkers: dict) -> list:
    """Process biomarkers into a flat list with dates."""
    results = []

    for category in biomarkers.get("categories", []):
        category_name = category.get("name")
        for biomarker in category.get("biomarkers", []):
            biomarker_name = biomarker.get("name")
            unit = biomarker.get("unit")
            optimal_range = biomarker.get("optimalRange", "")

            # Parse optimal range (format: "min-max" or "min - max")
            optimal_min = None
            optimal_max = None
            if optimal_range and "-" in optimal_range:
                try:
                    parts = optimal_range.replace(" ", "").split("-")
                    if len(parts) == 2:
                        optimal_min = float(parts[0]) if parts[0] else None
                        optimal_max = float(parts[1]) if parts[1] else None
                except:
                    pass

            # API returns "measurements" not "results"
            measurements = biomarker.get("measurements", []) or biomarker.get("results", [])
            for measurement in measurements:
                value = measurement.get("value")
                if value is not None:
                    in_range = None
                    if optimal_min is not None and optimal_max is not None:
                        in_range = optimal_min <= value <= optimal_max

                    results.append({
                        "date": measurement.get("date"),
                        "category": category_name,
                        "biomarker": biomarker_name,
                        "value": value,
                        "unit": unit,
                        "optimalRange": optimal_range,
                        "optimalMin": optimal_min,
                        "optimalMax": optimal_max,
                        "inRange": in_range,
                        "provider": measurement.get("provider"),
                    })

    return results


def merge_daily_data(garmin_daily: dict, glucose_daily: dict, whoop_daily: dict) -> list:
    """Merge all daily data into a single list."""
    all_dates = set(garmin_daily.keys()) | set(glucose_daily.keys()) | set(whoop_daily.keys())

    merged = []
    for date in sorted(all_dates):
        record = {
            "date": date,
            "garmin": garmin_daily.get(date, {}).get("garmin", {}),
            "whoop": whoop_daily.get(date, {}).get("whoop", {}),
            "glucose": glucose_daily.get(date, {}).get("glucose", {}),
        }
        merged.append(record)

    return merged


def calculate_correlations(daily_data: list) -> dict:
    """Calculate basic correlations between variables."""
    # Extract paired data points
    steps_sleep = []
    steps_glucose = []
    sleep_glucose = []
    exercise_glucose = []
    sleep_recovery = []
    hrv_sleep = []
    steps_recovery = []

    for record in daily_data:
        garmin = record.get("garmin", {})
        whoop = record.get("whoop", {})
        glucose = record.get("glucose", {})

        steps = garmin.get("steps")
        # Use Whoop sleep data (primary source)
        sleep_hours = whoop.get("sleepHours")
        recovery_score = whoop.get("recoveryScore")
        hrv = whoop.get("hrvMs")
        glucose_avg = glucose.get("average")
        activity_duration = garmin.get("totalActivityDuration")

        if steps and sleep_hours:
            steps_sleep.append((steps, sleep_hours))
        if steps and glucose_avg:
            steps_glucose.append((steps, glucose_avg))
        if sleep_hours and glucose_avg:
            sleep_glucose.append((sleep_hours, glucose_avg))
        if activity_duration and glucose_avg:
            exercise_glucose.append((activity_duration / 60, glucose_avg))  # Convert to minutes
        if sleep_hours and recovery_score:
            sleep_recovery.append((sleep_hours, recovery_score))
        if hrv and sleep_hours:
            hrv_sleep.append((hrv, sleep_hours))
        if steps and recovery_score:
            steps_recovery.append((steps, recovery_score))

    def pearson_correlation(pairs):
        """Calculate Pearson correlation coefficient."""
        if len(pairs) < 3:
            return None
        n = len(pairs)
        x = [p[0] for p in pairs]
        y = [p[1] for p in pairs]

        mean_x = sum(x) / n
        mean_y = sum(y) / n

        numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        denom_x = sum((xi - mean_x) ** 2 for xi in x) ** 0.5
        denom_y = sum((yi - mean_y) ** 2 for yi in y) ** 0.5

        if denom_x == 0 or denom_y == 0:
            return None

        return round(numerator / (denom_x * denom_y), 3)

    return {
        "steps_vs_sleep": {
            "correlation": pearson_correlation(steps_sleep),
            "dataPoints": len(steps_sleep),
            "description": "Correlation between daily steps and sleep duration"
        },
        "steps_vs_glucose": {
            "correlation": pearson_correlation(steps_glucose),
            "dataPoints": len(steps_glucose),
            "description": "Correlation between daily steps and average glucose"
        },
        "sleep_vs_glucose": {
            "correlation": pearson_correlation(sleep_glucose),
            "dataPoints": len(sleep_glucose),
            "description": "Correlation between sleep duration and average glucose"
        },
        "exercise_vs_glucose": {
            "correlation": pearson_correlation(exercise_glucose),
            "dataPoints": len(exercise_glucose),
            "description": "Correlation between exercise duration (minutes) and average glucose"
        },
        "sleep_vs_recovery": {
            "correlation": pearson_correlation(sleep_recovery),
            "dataPoints": len(sleep_recovery),
            "description": "Correlation between sleep duration and Whoop recovery score"
        },
        "hrv_vs_sleep": {
            "correlation": pearson_correlation(hrv_sleep),
            "dataPoints": len(hrv_sleep),
            "description": "Correlation between HRV and sleep duration"
        },
        "steps_vs_recovery": {
            "correlation": pearson_correlation(steps_recovery),
            "dataPoints": len(steps_recovery),
            "description": "Correlation between daily steps and Whoop recovery score"
        },
    }


def generate_summary_stats(daily_data: list, biomarkers: list) -> dict:
    """Generate summary statistics for AI context."""
    # Date range
    dates = [d["date"] for d in daily_data if d.get("date")]

    # Garmin stats (steps)
    steps = [d["garmin"].get("steps") for d in daily_data if d["garmin"].get("steps")]

    # Whoop stats (sleep, HRV, recovery, resting HR)
    sleep_hours = [d["whoop"].get("sleepHours") for d in daily_data if d["whoop"].get("sleepHours")]
    hrv_values = [d["whoop"].get("hrvMs") for d in daily_data if d["whoop"].get("hrvMs")]
    recovery_scores = [d["whoop"].get("recoveryScore") for d in daily_data if d["whoop"].get("recoveryScore")]
    resting_hr = [d["whoop"].get("restingHeartRate") for d in daily_data if d["whoop"].get("restingHeartRate")]
    strain_values = [d["whoop"].get("strain") for d in daily_data if d["whoop"].get("strain")]

    # Glucose stats
    glucose_avgs = [d["glucose"].get("average") for d in daily_data if d["glucose"].get("average")]

    return {
        "dateRange": {
            "start": min(dates) if dates else None,
            "end": max(dates) if dates else None,
            "totalDays": len(dates),
        },
        "steps": {
            "average": round(sum(steps) / len(steps)) if steps else None,
            "min": min(steps) if steps else None,
            "max": max(steps) if steps else None,
            "daysWithData": len(steps),
            "source": "Garmin",
        },
        "sleep": {
            "averageHours": round(sum(sleep_hours) / len(sleep_hours), 1) if sleep_hours else None,
            "minHours": round(min(sleep_hours), 1) if sleep_hours else None,
            "maxHours": round(max(sleep_hours), 1) if sleep_hours else None,
            "daysWithData": len(sleep_hours),
            "source": "Whoop",
        },
        "hrv": {
            "averageMs": round(sum(hrv_values) / len(hrv_values), 1) if hrv_values else None,
            "minMs": round(min(hrv_values), 1) if hrv_values else None,
            "maxMs": round(max(hrv_values), 1) if hrv_values else None,
            "daysWithData": len(hrv_values),
            "source": "Whoop",
        },
        "recovery": {
            "average": round(sum(recovery_scores) / len(recovery_scores), 1) if recovery_scores else None,
            "min": min(recovery_scores) if recovery_scores else None,
            "max": max(recovery_scores) if recovery_scores else None,
            "daysWithData": len(recovery_scores),
            "source": "Whoop",
        },
        "restingHeartRate": {
            "average": round(sum(resting_hr) / len(resting_hr)) if resting_hr else None,
            "min": min(resting_hr) if resting_hr else None,
            "max": max(resting_hr) if resting_hr else None,
            "daysWithData": len(resting_hr),
            "source": "Whoop",
        },
        "strain": {
            "average": round(sum(strain_values) / len(strain_values), 1) if strain_values else None,
            "min": round(min(strain_values), 1) if strain_values else None,
            "max": round(max(strain_values), 1) if strain_values else None,
            "daysWithData": len(strain_values),
            "source": "Whoop",
        },
        "glucose": {
            "averageOfDailyAverages": round(sum(glucose_avgs) / len(glucose_avgs), 1) if glucose_avgs else None,
            "daysWithData": len(glucose_avgs),
            "source": "Lingo CGM",
        },
        "biomarkers": {
            "totalResults": len(biomarkers),
            "categories": list(set(b["category"] for b in biomarkers)),
            "latestDate": max(b["date"] for b in biomarkers) if biomarkers else None,
            "source": "Lab Tests",
        },
    }


def main():
    global API_BASE_URL

    print("Consolidating health data...")
    print("(Make sure 'npm run dev' is running for Whoop data)")
    print()

    # Find the dev server
    print("  Looking for dev server...")
    API_BASE_URL = find_api_server()
    if not API_BASE_URL:
        print("  Warning: Dev server not found. Whoop and biomarker data won't be fetched.")
        print("  Run 'npm run dev' first, then try again.")

    # Load file-based data sources
    garmin = load_json(GARMIN_FILE) or {}
    lingo = load_json(LINGO_FILE) or {}

    print(f"  Garmin: {len(garmin.get('dailySummaries', []))} daily summaries")
    print(f"  Lingo: {len(lingo.get('history', []))} glucose readings")

    # Fetch data from local API (requires dev server running)
    whoop = {}
    biomarkers_raw = {}

    if API_BASE_URL:
        print("  Fetching Whoop data from local API...")
        whoop = fetch_whoop_data()

        print("  Fetching biomarkers from local API...")
        biomarkers_raw = fetch_biomarkers_data()

    # Process each data source
    garmin_daily = process_garmin_data(garmin) if garmin else {}
    whoop_daily = process_whoop_data(whoop) if whoop else {}
    glucose_daily = process_lingo_data(lingo) if lingo else {}
    biomarkers = process_biomarkers(biomarkers_raw) if biomarkers_raw else []

    # Merge daily data
    daily_data = merge_daily_data(garmin_daily, glucose_daily, whoop_daily)

    # Calculate correlations
    correlations = calculate_correlations(daily_data)

    # Generate summary stats
    summary = generate_summary_stats(daily_data, biomarkers)

    # Build final output
    output = {
        "generatedAt": datetime.now().isoformat(),
        "summary": summary,
        "correlations": correlations,
        "dailyData": daily_data,
        "biomarkers": biomarkers,
        "metadata": {
            "sources": {
                "garmin": bool(garmin),
                "whoop": bool(whoop.get("recovery") or whoop.get("sleep")),
                "lingo": bool(lingo),
                "biomarkers": bool(biomarkers_raw),
            },
            "version": "1.0",
        }
    }

    # Save output
    UNIFIED_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Unified data saved to {OUTPUT_FILE}")
    print(f"  - {len(daily_data)} daily records")
    print(f"  - {len(biomarkers)} biomarker results")
    print(f"  - {len([c for c in correlations.values() if c['correlation'] is not None])} correlations calculated")

    # Print some insights
    print("\n📊 Quick Insights:")
    for name, corr in correlations.items():
        if corr["correlation"] is not None:
            strength = "strong" if abs(corr["correlation"]) > 0.5 else "moderate" if abs(corr["correlation"]) > 0.3 else "weak"
            direction = "positive" if corr["correlation"] > 0 else "negative"
            print(f"  {name}: {corr['correlation']} ({strength} {direction}, n={corr['dataPoints']})")


if __name__ == "__main__":
    main()
