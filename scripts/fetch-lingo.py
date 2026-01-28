#!/usr/bin/env python3
"""
Fetch glucose data from Abbott Lingo/LibreView API.

Usage:
  # First time setup - authenticate and save credentials
  python3 scripts/fetch-lingo.py --setup

  # Normal fetch (uses saved credentials)
  python3 scripts/fetch-lingo.py

The script saves data to data/lingo.json
"""

import argparse
import getpass
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

# Regional API endpoints
API_ENDPOINTS = {
    "global": "https://api.libreview.io",
    "eu": "https://api-eu.libreview.io",
    "eu2": "https://api-eu2.libreview.io",
    "us": "https://api-us.libreview.io",
    "ae": "https://api-ae.libreview.io",
    "ap": "https://api-ap.libreview.io",
    "au": "https://api-au.libreview.io",
    "ca": "https://api-ca.libreview.io",
    "de": "https://api-de.libreview.io",
    "fr": "https://api-fr.libreview.io",
    "jp": "https://api-jp.libreview.io",
    "la": "https://api-la.libreview.io",
}

# Default headers for LibreLinkUp API
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "accept-encoding": "gzip",
    "cache-control": "no-cache",
    "connection": "Keep-Alive",
    "product": "llu.android",
    "version": "4.12.0",
}

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
CREDENTIALS_FILE = DATA_DIR / "lingo-credentials.json"
OUTPUT_FILE = DATA_DIR / "lingo.json"


def get_api_url(region: str = "global") -> str:
    """Get the API URL for a region."""
    return API_ENDPOINTS.get(region, API_ENDPOINTS["global"])


def sha256_hash(value: str) -> str:
    """Generate SHA256 hash of a string."""
    return hashlib.sha256(value.encode()).hexdigest()


def login(email: str, password: str, region: str = "global") -> dict:
    """
    Authenticate with LibreView API.
    Returns auth data including token and patient info.
    """
    api_url = get_api_url(region)
    url = f"{api_url}/llu/auth/login"

    payload = {
        "email": email,
        "password": password,
    }

    response = requests.post(url, headers=DEFAULT_HEADERS, json=payload)

    if response.status_code == 200:
        data = response.json()

        # Check if we need to accept terms
        if data.get("data", {}).get("step", {}).get("type") == "tou":
            print("Terms of use acceptance required. Accepting...")
            # Accept terms and retry
            accept_url = f"{api_url}/auth/continue/tou"
            accept_response = requests.post(accept_url, headers=DEFAULT_HEADERS, json=payload)
            if accept_response.status_code == 200:
                data = accept_response.json()

        # Check for redirect to regional endpoint
        if data.get("data", {}).get("redirect"):
            new_region = data["data"]["region"]
            print(f"Redirecting to regional endpoint: {new_region}")
            return login(email, password, new_region)

        return {
            "success": True,
            "token": data.get("data", {}).get("authTicket", {}).get("token"),
            "expires": data.get("data", {}).get("authTicket", {}).get("expires"),
            "user": data.get("data", {}).get("user", {}),
            "region": region,
        }
    else:
        return {
            "success": False,
            "error": f"Login failed: {response.status_code} - {response.text}",
        }


def get_connections(token: str, region: str = "global") -> list:
    """Get connected patients/devices."""
    api_url = get_api_url(region)
    url = f"{api_url}/llu/connections"

    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {token}",
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        return data.get("data", [])
    else:
        print(f"Failed to get connections: {response.status_code}")
        return []


def get_glucose_graph(token: str, patient_id: str, region: str = "global") -> dict:
    """Get glucose graph data for a patient."""
    api_url = get_api_url(region)
    url = f"{api_url}/llu/connections/{patient_id}/graph"

    account_id = sha256_hash(patient_id)

    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {token}",
        "Account-Id": account_id,
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to get glucose data: {response.status_code}")
        return {}


def parse_glucose_measurement(measurement: dict) -> dict:
    """Parse a glucose measurement into a standardized format."""
    # Value can be in different units
    value_mg = measurement.get("ValueInMgPerDl") or measurement.get("Value")

    # Convert mmol/L to mg/dL if needed (multiply by 18)
    if measurement.get("GlucoseUnits") == 1:  # mmol/L
        value_mg = round(measurement.get("Value", 0) * 18, 1)

    timestamp = measurement.get("Timestamp") or measurement.get("FactoryTimestamp")

    return {
        "timestamp": timestamp,
        "value": value_mg,  # Always in mg/dL
        "trend": measurement.get("TrendArrow"),
        "trendMessage": measurement.get("TrendMessage"),
        "isHigh": measurement.get("isHigh", False),
        "isLow": measurement.get("isLow", False),
        "color": measurement.get("MeasurementColor"),
    }


def fetch_all_glucose_data(token: str, patient_id: str, region: str = "global") -> dict:
    """Fetch all available glucose data."""
    graph_data = get_glucose_graph(token, patient_id, region)

    if not graph_data:
        return {}

    connection = graph_data.get("data", {}).get("connection", {})
    graph_readings = graph_data.get("data", {}).get("graphData", [])

    # Current reading
    current = None
    current_measurement = connection.get("glucoseMeasurement") or connection.get("glucoseItem")
    if current_measurement:
        current = parse_glucose_measurement(current_measurement)

    # Historical readings (last 12-24 hours typically)
    history = []
    for reading in graph_readings:
        parsed = parse_glucose_measurement(reading)
        if parsed.get("value"):
            history.append(parsed)

    # Sort history by timestamp
    history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # Calculate statistics
    if history:
        values = [h["value"] for h in history if h.get("value")]
        stats = {
            "average": round(sum(values) / len(values), 1) if values else None,
            "min": min(values) if values else None,
            "max": max(values) if values else None,
            "count": len(values),
            "inRange": sum(1 for v in values if 70 <= v <= 140),
            "high": sum(1 for v in values if v > 140),
            "low": sum(1 for v in values if v < 70),
        }
    else:
        stats = {}

    # Sensor info
    sensor = connection.get("sensor", {})

    return {
        "current": current,
        "history": history,
        "stats": stats,
        "sensor": {
            "serialNumber": sensor.get("sn"),
            "status": sensor.get("a"),  # Active status
            "startDate": sensor.get("pt"),  # Placement time
        },
        "patient": {
            "id": connection.get("patientId"),
            "firstName": connection.get("firstName"),
            "lastName": connection.get("lastName"),
        },
        "fetchedAt": datetime.now().isoformat(),
    }


def setup_credentials():
    """Interactive setup to save credentials."""
    print("\n=== Lingo/LibreView Setup ===\n")
    print("This will save your LibreLinkUp credentials for automatic fetching.")
    print("Note: Your password will be stored in plain text in data/lingo-credentials.json")
    print("Make sure to keep this file secure.\n")

    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")

    print("\nAvailable regions:")
    for key in API_ENDPOINTS.keys():
        print(f"  - {key}")
    region = input("\nRegion (default: global): ").strip() or "global"

    if region not in API_ENDPOINTS:
        print(f"Invalid region. Using 'global'.")
        region = "global"

    print("\nAuthenticating...")
    auth_result = login(email, password, region)

    if not auth_result.get("success"):
        print(f"\nError: {auth_result.get('error')}")
        sys.exit(1)

    # Get actual region after potential redirect
    actual_region = auth_result.get("region", region)

    # Save credentials
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    credentials = {
        "email": email,
        "password": password,
        "region": actual_region,
    }

    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=2)

    print(f"\nCredentials saved to {CREDENTIALS_FILE}")
    print(f"Region: {actual_region}")

    # Also fetch data now
    return fetch_and_save(email, password, actual_region)


def load_credentials() -> dict:
    """Load saved credentials."""
    if not CREDENTIALS_FILE.exists():
        return {}

    with open(CREDENTIALS_FILE, "r") as f:
        return json.load(f)


def fetch_and_save(email: str, password: str, region: str) -> bool:
    """Fetch glucose data and save to file."""
    print("Logging in...")
    auth_result = login(email, password, region)

    if not auth_result.get("success"):
        print(f"Login failed: {auth_result.get('error')}")
        return False

    token = auth_result["token"]
    actual_region = auth_result.get("region", region)

    print("Getting connections...")
    connections = get_connections(token, actual_region)

    if not connections:
        print("No connected devices found.")
        print("Make sure you have set up sharing in the Lingo/LibreLink app.")
        return False

    # Use first connection (usually the main user)
    connection = connections[0]
    patient_id = connection.get("patientId")

    print(f"Found patient: {connection.get('firstName')} {connection.get('lastName')}")
    print("Fetching glucose data...")

    glucose_data = fetch_all_glucose_data(token, patient_id, actual_region)

    if not glucose_data:
        print("No glucose data available.")
        return False

    # Save to file
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(glucose_data, f, indent=2)

    print(f"\nData saved to {OUTPUT_FILE}")

    # Print summary
    if glucose_data.get("current"):
        current = glucose_data["current"]
        print(f"\nCurrent glucose: {current.get('value')} mg/dL")
        if current.get("trendMessage"):
            print(f"Trend: {current.get('trendMessage')}")

    if glucose_data.get("stats"):
        stats = glucose_data["stats"]
        print(f"\nLast {stats.get('count', 0)} readings:")
        print(f"  Average: {stats.get('average')} mg/dL")
        print(f"  Range: {stats.get('min')} - {stats.get('max')} mg/dL")
        print(f"  In range (70-140): {stats.get('inRange', 0)} readings")

    return True


def main():
    parser = argparse.ArgumentParser(description="Fetch Lingo/LibreView glucose data")
    parser.add_argument("--setup", action="store_true", help="Set up credentials interactively")
    args = parser.parse_args()

    if args.setup:
        success = setup_credentials()
        sys.exit(0 if success else 1)

    # Load saved credentials
    credentials = load_credentials()

    if not credentials:
        print("No saved credentials found.")
        print("Run with --setup to configure: python3 scripts/fetch-lingo.py --setup")
        sys.exit(1)

    success = fetch_and_save(
        credentials["email"],
        credentials["password"],
        credentials.get("region", "global"),
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
