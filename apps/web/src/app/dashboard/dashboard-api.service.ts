import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AssignTechnicianDto,
  CreateCustomerDto,
  CreateInterventionDto,
  InterventionStatus,
  NotificationKind,
  Role,
  TransitionAction,
  UpdateInterventionDto,
} from '@il-arrive/contracts';

const API = '/api';

export interface CustomerRef {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

/** Row returned by GET /interventions and /interventions/today (customer + technician are included). */
export interface InterventionRow {
  id: string;
  customerId: string;
  technicianMembershipId: string | null;
  addressLabel: string;
  addressLat: number | null;
  addressLng: number | null;
  scheduledDate: string;
  windowStart: string;
  windowEnd: string;
  description: string | null;
  internalNotes: string | null;
  status: InterventionStatus;
  delayMinutes: number | null;
  delayReason: string | null;
  cancelledReason: string | null;
  customer?: CustomerRef;
  technician?: { id: string; user: { firstName: string; lastName: string } } | null;
}

export interface TodayGroupResponse {
  status: InterventionStatus;
  interventions: InterventionRow[];
}

export interface InterventionEventDto {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

export interface InterventionDetail {
  intervention: InterventionRow;
  timeline: InterventionEventDto[];
}

export interface ListFilters {
  status?: InterventionStatus;
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MemberDto {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isTechnician: boolean;
}

export interface BusinessDto {
  id: string;
  name: string;
  phone: string;
  brandColor: string | null;
  timezone: string;
  logoUrl: string | null;
  plan: string;
  notificationPrefs: Record<string, unknown> | null;
}

export interface SmsUsageDto {
  quota: number;
  used: number;
  remaining: number;
  periodStart: string;
}

export interface ShareMessageDto {
  text: string;
  link: string;
  smsUri: string;
}

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

/** Thin typed wrapper over the endpoints that exist on the API. No fixtures: failures surface as HTTP errors. */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private http = inject(HttpClient);

  today(): Observable<TodayGroupResponse[]> {
    return this.http.get<TodayGroupResponse[]>(`${API}/interventions/today`);
  }

  list(filters: ListFilters = {}): Observable<InterventionRow[]> {
    let params = new HttpParams().set('take', 100);
    for (const [k, v] of Object.entries(filters)) if (v) params = params.set(k, v);
    return this.http.get<InterventionRow[]>(`${API}/interventions`, { params });
  }

  get(id: string): Observable<InterventionDetail> {
    return this.http.get<InterventionDetail>(`${API}/interventions/${id}`);
  }

  create(dto: CreateInterventionDto): Observable<{ intervention: InterventionRow; trackingLink: { url: string } }> {
    return this.http.post<{ intervention: InterventionRow; trackingLink: { url: string } }>(`${API}/interventions`, dto);
  }

  update(id: string, dto: UpdateInterventionDto): Observable<{ intervention: InterventionRow }> {
    return this.http.patch<{ intervention: InterventionRow }>(`${API}/interventions/${id}`, dto);
  }

  assign(id: string, dto: AssignTechnicianDto): Observable<{ intervention: InterventionRow }> {
    return this.http.patch<{ intervention: InterventionRow }>(`${API}/interventions/${id}/assign`, dto);
  }

  cancel(id: string, reason: string): Observable<unknown> {
    const body: Pick<TransitionAction, 'action' | 'reason'> = { action: 'cancel', reason };
    return this.http.patch(`${API}/interventions/${id}/cancel`, body);
  }

  reschedule(id: string, body: Pick<TransitionAction, 'newScheduledDate' | 'newWindowStart' | 'newWindowEnd'>): Observable<unknown> {
    return this.http.patch(`${API}/interventions/${id}/reschedule`, { action: 'reschedule', ...body });
  }

  regenerateLink(id: string): Observable<{ url: string; expiresAt: string }> {
    return this.http.post<{ url: string; expiresAt: string }>(`${API}/interventions/${id}/tracking-link/regenerate`, {});
  }

  shareMessage(id: string, kind: NotificationKind = 'EN_ROUTE'): Observable<ShareMessageDto> {
    return this.http.get<ShareMessageDto>(`${API}/interventions/${id}/share-message`, { params: { kind } });
  }

  sendSms(id: string, kind: NotificationKind): Observable<unknown> {
    return this.http.post(`${API}/interventions/${id}/notify`, { kind });
  }

  searchCustomers(q: string): Observable<CustomerRef[]> {
    return this.http.get<CustomerRef[]>(`${API}/customers`, { params: { q } });
  }

  createCustomer(dto: CreateCustomerDto): Observable<CustomerRef> {
    return this.http.post<CustomerRef>(`${API}/customers`, dto);
  }

  geoSearch(q: string): Observable<(GeoResult & { score?: number })[]> {
    return this.http.get<(GeoResult & { score?: number })[]>(`${API}/geo/search`, { params: { q } });
  }

  members(): Observable<MemberDto[]> {
    return this.http.get<MemberDto[]>(`${API}/members`);
  }

  invite(email: string, role: Role): Observable<unknown> {
    return this.http.post(`${API}/members/invite`, { email, role });
  }

  /** The API addresses members by userId. */
  setRole(userId: string, role: Role): Observable<unknown> {
    return this.http.patch(`${API}/members/${userId}`, { role });
  }

  removeMember(userId: string): Observable<void> {
    return this.http.delete<void>(`${API}/members/${userId}`);
  }

  business(): Observable<BusinessDto> {
    return this.http.get<BusinessDto>(`${API}/business`);
  }

  updateBusiness(dto: Partial<Pick<BusinessDto, 'name' | 'phone' | 'brandColor' | 'timezone'>>): Observable<BusinessDto> {
    return this.http.patch<BusinessDto>(`${API}/business`, dto);
  }

  smsUsage(): Observable<SmsUsageDto> {
    return this.http.get<SmsUsageDto>(`${API}/business/sms-usage`);
  }
}
