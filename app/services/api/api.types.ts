// Caregiver.ts
export interface Caregiver {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: 'invited' | 'staff' |'ordAdmin'; 
  org: Org;
  patients: Patient[]; // Assuming this is the ID of the caregiver  
}

export interface Org {
  id?: string;
  name: string;
  email: string;
  phone: string;
  caregivers: Caregiver[];
  patients: Patient[];
}

export interface Patient {
  id?: string;
  name: string;
  email: string;
  phone: string;
  org: Org;
  caregivers: Caregiver[]; // Assuming this is the ID of the caregiver
  schedules: Schedule[];
}

export interface Interval {
  day?: number;
  weeks?: number;
}

export interface Schedule {
  id?: string;
  patient?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  intervals: Interval[];
  time: string;
  isActive: boolean;
}

/**
 * The options used to configure apisauce.
 */
export interface ApiConfig {
  /**
   * The URL of the api.
   */
  url: string

  /**
   * Milliseconds before we timeout the request.
   */
  timeout: number
}
