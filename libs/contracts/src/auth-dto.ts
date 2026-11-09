export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface RequestPasswordResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface InviteMemberDto {
  email: string;
  role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
}

export interface MeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
}

export interface MeMembership {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  brandColor: string | null;
  plan: string;
  role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN';
  isTechnician: boolean;
  onboardingCompleted: boolean;
}

export interface MeResponse {
  user: MeUser;
  memberships: MeMembership[];
  activeBusinessId: string;
  activeMembership: MeMembership;
}

export interface LoginResponse {
  user: MeUser;
  memberships: MeMembership[];
  activeBusinessId: string;
}

export interface RegisterResponse {
  user: MeUser;
  memberships: MeMembership[];
  activeBusinessId: string;
}
