import { UserRole } from './Common';

export interface UserPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  language: string;
  timezone: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  preferences: UserPreferences;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  profile: UserProfile;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  updatedAt: Date;
}

export interface UserRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  preferences?: Partial<UserPreferences>;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  userId: string;
  role: UserRole;
}