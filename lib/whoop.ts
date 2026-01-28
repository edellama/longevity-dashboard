export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    /** HRV RMSSD in milliseconds (e.g. 54.3 = 54.3 ms). Use as-is; do not divide by 1000. */
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopRecoveryResponse {
  records: WhoopRecovery[];
  next_token?: string;
}

export interface WhoopSleep {
  id: string;
  cycle_id: number;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed?: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export interface WhoopSleepResponse {
  records: WhoopSleep[];
  next_token?: string;
}

export interface WhoopWorkout {
  id: string;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  sport_name: string;
  score_state: string;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
    altitude_change_meter?: number;
    zone_durations: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  };
}

export interface WhoopWorkoutResponse {
  records: WhoopWorkout[];
  next_token?: string;
}

export interface WhoopProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export async function fetchRecovery(start?: string, end?: string): Promise<WhoopRecovery[]> {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  
  const response = await fetch(`/api/whoop?type=recovery${params.toString() ? `&${params.toString()}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch recovery data");
  const data: WhoopRecoveryResponse = await response.json();
  return data.records || [];
}

export async function fetchSleep(start?: string, end?: string): Promise<WhoopSleep[]> {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  
  const response = await fetch(`/api/whoop?type=sleep${params.toString() ? `&${params.toString()}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch sleep data");
  const data: WhoopSleepResponse = await response.json();
  return data.records || [];
}

export async function fetchWorkout(start?: string, end?: string): Promise<WhoopWorkout[]> {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  
  const response = await fetch(`/api/whoop?type=workout${params.toString() ? `&${params.toString()}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch workout data");
  const data: WhoopWorkoutResponse = await response.json();
  return data.records || [];
}

export async function fetchProfile(): Promise<WhoopProfile> {
  const response = await fetch("/api/whoop?type=profile");
  if (!response.ok) throw new Error("Failed to fetch profile");
  return response.json();
}
