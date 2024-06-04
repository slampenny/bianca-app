// Caregiver.ts
export interface NewUser {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthTokens {
  access: {
    expires: string;
    token: string;
  },
  refresh: {
    expires: string;
    token: string;
  }
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
  org: string | null;
  patients: Patient[]; // Assuming this is the ID of the caregiver  
}

export interface AlertPages {
  limit: Number,
  page: Number,
  results: Alert[],
  totalPages: Number,
  totalResults: Number,
}

export type CreatedModel = 'Patient' | 'Caregiver' | 'Org';
export type AlertVisibility = 'orgAdmin' | 'allCaregivers' | 'assignedCaregivers';
export type AlertImportance = 'low' | 'medium' | 'high';

export interface Alert {
  id?: string;
  message: string;
  importance: AlertImportance;
  createdBy: string; // Assuming this is the ID of the creator
  createdModel: CreatedModel;
  visibility: AlertVisibility;
  readBy: string[]; // Assuming these are the IDs of the caregivers who have read the alert
  relevanceUntil?: Date;
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
  caregivers: string[];
  patients: string[];
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
  org: string | null;
  caregivers: string[]; 
  schedules: Schedule[];
}

export interface Interval {
  day?: number;
  weeks?: number;
}

export interface Schedule {
  id?: string | null | undefined;
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
