export interface CreateInterventionDto {
  customerId: string;
  addressLabel: string;
  addressLat: number;
  addressLng: number;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
  description?: string;
}

export interface UpdateInterventionDto {
  windowStart?: string;
  windowEnd?: string;
  description?: string;
  internalNotes?: string;
}

export interface AssignTechnicianDto {
  technicianMembershipId: string;
}

export interface InterventionLocationDto {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

export interface ReportDelayDto {
  delayMinutes: number;
  delayReason: string;
}

export interface TransitionAction {
  action: 'en_route' | 'arrived' | 'complete' | 'cancel' | 'stop_route' | 'reschedule';
  reason?: string;
  newScheduledDate?: string;
  newWindowStart?: string;
  newWindowEnd?: string;
}
