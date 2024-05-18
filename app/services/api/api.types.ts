// Caregiver.ts
export interface NewUser {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface CaregiverPages {
  limit: Number,
  page: Number,
  results: Caregiver[],
  totalPages: Number,
  totalResults: Number,
}

export interface Caregiver {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: 'invited' | 'staff' |'orgAdmin'; 
  org: Org | string | null;
  patients: Patient[]; // Assuming this is the ID of the caregiver  
}

export interface OrgPages {
    limit: Number,
    page: Number,
    results: Org[],
    totalPages: Number,
    totalResults: Number,
}

export interface Org {
  id?: string;
  name: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
  caregivers: Caregiver[];
  patients: Patient[];
}

export interface PatientPages {
  limit: Number,
  page: Number,
  results: Patient[],
  totalPages: Number,
  totalResults: Number,
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

export interface Message {
  id?: string;
  role: string;
  content: string;
}

export interface Conversation {
  id?: string;
  callSid: string;
  patientId: string;
  lineItemId: string | null;
  messages: Message[];
  history: string;
  analyzedData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  startTime: Date;
  endTime: Date;
  duration: number;
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
