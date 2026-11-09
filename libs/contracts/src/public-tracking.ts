import type { InterventionStatus } from './intervention-status';
import type { LocationStatus, LocationFixStatus } from './location-status';

export interface PublicTrackingProjection {
  businessName: string;
  businessLogoUrl?: string;
  businessPhone: string;
  technicianFirstName: string;
  technicianAvatarUrl?: string;
  status: InterventionStatus;
  interventionDate?: string;
  windowStart: string;
  windowEnd: string;
  addressLabel: string;
  eta?: string;
  etaComputedAt?: string;
  delayMinutes?: number;
  delayReason?: string;
  locationStatus?: LocationStatus;
  location?: {
    lat?: number;
    lng?: number;
    status: LocationFixStatus;
    lastFixAt: string;
  };
  contactPhone: string;
}
