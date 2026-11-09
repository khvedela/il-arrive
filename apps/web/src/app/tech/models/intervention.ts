import type { InterventionStatus } from '@il-arrive/contracts';

export interface TechIntervention {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  addressLabel: string;
  addressLat: number | null;
  addressLng: number | null;
  lat: number | null;
  lng: number | null;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
  status: InterventionStatus;
  description?: string;
  internalNotes?: string;
  delayMinutes?: number;
  delayReason?: string;
  delayEta?: string;
  technicianName?: string;
}

export interface TechTodayResponse {
  date: string;
  interventions: TechIntervention[];
}

export interface TransitionResult {
  intervention: TechIntervention;
  success: boolean;
}
