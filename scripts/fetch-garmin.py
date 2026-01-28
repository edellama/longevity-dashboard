#!/usr/bin/env python3
"""
Fetch Garmin Connect data and save to JSON for the dashboard.

This script authenticates with Garmin Connect using your credentials
and fetches health/fitness data for the specified date range.

Usage:
  First time: python scripts/fetch-garmin.py --setup
  After setup: python scripts/fetch-garmin.py [--days 30]

The script saves a session token so you don't need to log in every time.
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
import argparse

try:
    from garminconnect import Garmin
except ImportError:
    print("Error: garminconnect not installed. Run: pip install garminconnect")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
TOKEN_DIR = PROJECT_ROOT / ".garmin"
TOKEN_FILE = TOKEN_DIR / "session.json"
OUTPUT_FILE = PROJECT_ROOT / "public" / "garmin_data.json"
ENV_FILE = PROJECT_ROOT / ".env.local"


def get_credentials():
    """Get Garmin credentials from environment or .env.local file."""
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        # Try reading from .env.local
        if ENV_FILE.exists():
            with open(ENV_FILE) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GARMIN_EMAIL="):
                        email = line.split("=", 1)[1].strip().strip('"\'')
                    elif line.startswith("GARMIN_PASSWORD="):
                        password = line.split("=", 1)[1].strip().strip('"\'')

    return email, password


def save_session(garmin):
    """Save Garmin session for reuse."""
    TOKEN_DIR.mkdir(exist_ok=True)
    with open(TOKEN_FILE, "w") as f:
        json.dump(garmin.garth.dumps(), f)
    print(f"[Garmin] Session saved to {TOKEN_FILE}")


def load_session():
    """Load saved Garmin session."""
    if TOKEN_FILE.exists():
        with open(TOKEN_FILE) as f:
            return json.load(f)
    return None


def connect_garmin():
    """Connect to Garmin, using saved session or credentials."""
    # Try loading existing session
    session_data = load_session()
    if session_data:
        try:
            print("[Garmin] Resuming saved session...")
            garmin = Garmin()
            garmin.garth.loads(session_data)
            # Test the session
            garmin.get_user_summary(date.today().isoformat())
            print("[Garmin] Session valid!")
            return garmin
        except Exception as e:
            print(f"[Garmin] Saved session expired: {e}")

    # Login with credentials
    email, password = get_credentials()
    if not email or not password:
        print("\nError: Garmin credentials not found!")
        print("\nPlease add to your .env.local file:")
        print("  GARMIN_EMAIL=your-email@example.com")
        print("  GARMIN_PASSWORD=your-garmin-password")
        print("\nOr set environment variables:")
        print("  export GARMIN_EMAIL=your-email@example.com")
        print("  export GARMIN_PASSWORD=your-garmin-password")
        sys.exit(1)

    print(f"[Garmin] Logging in as {email}...")
    try:
        garmin = Garmin(email, password)
        garmin.login()
        print("[Garmin] Login successful!")
        save_session(garmin)
        return garmin
    except Exception as e:
        print(f"[Garmin] Login failed: {e}")
        sys.exit(1)


def fetch_data(garmin, days=30):
    """Fetch Garmin data for the specified number of days."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    print(f"[Garmin] Fetching data from {start_date} to {end_date}...")

    data = {
        "fetchedAt": datetime.now().isoformat(),
        "dateRange": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "dailySummaries": [],
        "sleepData": [],
        "heartRate": [],
        "activities": [],
        "weight": [],
    }

    # Fetch daily summaries (steps, calories, etc.)
    print("[Garmin] Fetching daily summaries...")
    current = start_date
    while current <= end_date:
        try:
            summary = garmin.get_user_summary(current.isoformat())
            if summary:
                data["dailySummaries"].append({
                    "date": current.isoformat(),
                    "steps": summary.get("totalSteps", 0),
                    "calories": summary.get("totalKilocalories", 0),
                    "activeCalories": summary.get("activeKilocalories", 0),
                    "distance": summary.get("totalDistanceMeters", 0),
                    "floors": summary.get("floorsAscended", 0),
                    "restingHeartRate": summary.get("restingHeartRate"),
                    "minHeartRate": summary.get("minHeartRate"),
                    "maxHeartRate": summary.get("maxHeartRate"),
                    "averageStress": summary.get("averageStressLevel"),
                    "bodyBattery": summary.get("bodyBatteryChargedValue"),
                })
        except Exception as e:
            print(f"  Warning: Could not fetch summary for {current}: {e}")
        current += timedelta(days=1)
    print(f"  Got {len(data['dailySummaries'])} daily summaries")

    # Fetch sleep data
    print("[Garmin] Fetching sleep data...")
    current = start_date
    while current <= end_date:
        try:
            sleep = garmin.get_sleep_data(current.isoformat())
            if sleep and sleep.get("dailySleepDTO"):
                dto = sleep["dailySleepDTO"]
                data["sleepData"].append({
                    "date": current.isoformat(),
                    "sleepSeconds": dto.get("sleepTimeSeconds", 0),
                    "deepSleepSeconds": dto.get("deepSleepSeconds", 0),
                    "lightSleepSeconds": dto.get("lightSleepSeconds", 0),
                    "remSleepSeconds": dto.get("remSleepSeconds", 0),
                    "awakeSleepSeconds": dto.get("awakeSleepSeconds", 0),
                    "sleepScore": dto.get("sleepScores", {}).get("overallScore"),
                })
        except Exception as e:
            print(f"  Warning: Could not fetch sleep for {current}: {e}")
        current += timedelta(days=1)
    print(f"  Got {len(data['sleepData'])} sleep records")

    # Fetch heart rate data
    print("[Garmin] Fetching heart rate data...")
    current = start_date
    while current <= end_date:
        try:
            hr = garmin.get_heart_rates(current.isoformat())
            if hr:
                data["heartRate"].append({
                    "date": current.isoformat(),
                    "restingHeartRate": hr.get("restingHeartRate"),
                    "maxHeartRate": hr.get("maxHeartRateValue"),
                    "minHeartRate": hr.get("minHeartRateValue"),
                })
        except Exception as e:
            print(f"  Warning: Could not fetch HR for {current}: {e}")
        current += timedelta(days=1)
    print(f"  Got {len(data['heartRate'])} heart rate records")

    # Fetch recent activities
    print("[Garmin] Fetching activities...")
    try:
        activities = garmin.get_activities(0, 100)  # Last 100 activities
        for act in activities:
            activity_date = act.get("startTimeLocal", "")[:10]
            if activity_date >= start_date.isoformat():
                activity_type = act.get("activityType", {}).get("typeKey", "")
                data["activities"].append({
                    "date": activity_date,
                    "name": act.get("activityName"),
                    "type": activity_type,
                    "parentType": act.get("activityType", {}).get("parentTypeId"),
                    "duration": act.get("duration"),
                    "distance": act.get("distance"),
                    "calories": act.get("calories"),
                    "activeCalories": act.get("activityCalories"),
                    "averageHR": act.get("averageHR"),
                    "maxHR": act.get("maxHR"),
                    "averageSpeed": act.get("averageSpeed"),
                })
        print(f"  Got {len(data['activities'])} activities")
    except Exception as e:
        print(f"  Warning: Could not fetch activities: {e}")

    # Fetch weight data - try multiple methods
    print("[Garmin] Fetching weight data...")
    try:
        # Method 1: get_weigh_ins (date range)
        print(f"  Calling get_weigh_ins({start_date.isoformat()}, {end_date.isoformat()})...")
        weight_data = garmin.get_weigh_ins(start_date.isoformat(), end_date.isoformat())
        print(f"  get_weigh_ins response type: {type(weight_data)}")
        print(f"  get_weigh_ins response keys: {weight_data.keys() if weight_data and hasattr(weight_data, 'keys') else 'N/A'}")
        print(f"  get_weigh_ins raw response (first 500 chars): {str(weight_data)[:500]}")

        if weight_data:
            # Try different response formats
            weight_list = None
            if weight_data.get("dailyWeightSummaries"):
                weight_list = weight_data["dailyWeightSummaries"]
            elif weight_data.get("dateWeightList"):
                weight_list = weight_data["dateWeightList"]
            elif weight_data.get("weightHistory"):
                weight_list = weight_data["weightHistory"]
            elif isinstance(weight_data, list):
                weight_list = weight_data

            if weight_list:
                for w in weight_list:
                    # Check if weight data is nested inside "latestWeight"
                    weight_entry = w.get("latestWeight") or w

                    # Handle different field names
                    weight_date = w.get("summaryDate") or weight_entry.get("calendarDate") or weight_entry.get("date")
                    weight_val = weight_entry.get("weight") or weight_entry.get("weightInGrams")

                    if weight_date and weight_val:
                        data["weight"].append({
                            "date": weight_date,
                            "weight": weight_val / 1000 if weight_val > 500 else weight_val,  # Convert grams to kg
                            "bmi": weight_entry.get("bmi"),
                            "bodyFat": weight_entry.get("bodyFat") or weight_entry.get("bodyFatPercentage"),
                            "bodyWater": weight_entry.get("bodyWater"),
                            "boneMass": weight_entry.get("boneMass") / 1000 if weight_entry.get("boneMass") else None,
                            "muscleMass": weight_entry.get("muscleMass") / 1000 if weight_entry.get("muscleMass") else None,
                        })

        print(f"  Got {len(data['weight'])} weight records from get_weigh_ins")
    except Exception as e:
        print(f"  Warning: get_weigh_ins failed: {e}")

    # Method 2: Try get_body_composition if no weight found
    if not data["weight"]:
        try:
            print("  Trying get_body_composition...")
            for single_date in [end_date - timedelta(days=i) for i in range(min(days, 30))]:
                try:
                    body = garmin.get_body_composition(single_date.isoformat())
                    if body and body.get("weight"):
                        data["weight"].append({
                            "date": single_date.isoformat(),
                            "weight": body["weight"] / 1000 if body["weight"] > 500 else body["weight"],
                            "bmi": body.get("bmi"),
                            "bodyFat": body.get("bodyFat"),
                            "muscleMass": body.get("muscleMass") / 1000 if body.get("muscleMass") else None,
                        })
                except:
                    pass
            print(f"  Got {len(data['weight'])} weight records from get_body_composition")
        except Exception as e:
            print(f"  Warning: get_body_composition failed: {e}")

    print(f"  Total weight records: {len(data['weight'])}")

    return data


def setup_credentials():
    """Interactive setup for Garmin credentials."""
    print("\n=== Garmin Connect Setup ===\n")

    email = input("Enter your Garmin Connect email: ").strip()
    password = input("Enter your Garmin Connect password: ").strip()

    if not email or not password:
        print("Error: Email and password are required.")
        sys.exit(1)

    # Test the credentials
    print("\nTesting credentials...")
    try:
        garmin = Garmin(email, password)
        garmin.login()
        print("✓ Login successful!")
        save_session(garmin)
    except Exception as e:
        print(f"✗ Login failed: {e}")
        sys.exit(1)

    # Save to .env.local
    print(f"\nSaving credentials to {ENV_FILE}...")

    existing_lines = []
    if ENV_FILE.exists():
        with open(ENV_FILE) as f:
            existing_lines = [
                line for line in f.readlines()
                if not line.startswith("GARMIN_EMAIL=") and not line.startswith("GARMIN_PASSWORD=")
            ]

    with open(ENV_FILE, "w") as f:
        f.writelines(existing_lines)
        if existing_lines and not existing_lines[-1].endswith("\n"):
            f.write("\n")
        f.write(f"GARMIN_EMAIL={email}\n")
        f.write(f"GARMIN_PASSWORD={password}\n")

    print("✓ Credentials saved!")
    print("\nSetup complete! You can now run: python scripts/fetch-garmin.py")


def main():
    parser = argparse.ArgumentParser(description="Fetch Garmin Connect data")
    parser.add_argument("--setup", action="store_true", help="Interactive setup for credentials")
    parser.add_argument("--days", type=int, default=30, help="Number of days to fetch (default: 30)")
    args = parser.parse_args()

    if args.setup:
        setup_credentials()
        return

    # Connect and fetch data
    garmin = connect_garmin()
    data = fetch_data(garmin, args.days)

    # Save to JSON
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\n✓ Data saved to {OUTPUT_FILE}")
    print(f"  - {len(data['dailySummaries'])} daily summaries")
    print(f"  - {len(data['sleepData'])} sleep records")
    print(f"  - {len(data['heartRate'])} heart rate records")
    print(f"  - {len(data['activities'])} activities")
    print(f"  - {len(data['weight'])} weight records")


if __name__ == "__main__":
    main()
