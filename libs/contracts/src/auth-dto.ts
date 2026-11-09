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
  phone?: string;
  isTechnician?: boolean;
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

export interface AcceptInvitationDto {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}
