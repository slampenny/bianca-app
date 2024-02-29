// User.ts
export interface User {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'caregiver' |'admin'; 
  caregiver: string | null; // Assuming this is the ID of the caregiver
  schedules: Schedule[];
}

export interface Interval {
  day?: number;
  weeks?: number;
}

export interface Schedule {
  id?: string;
  userId?: string | null;
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
