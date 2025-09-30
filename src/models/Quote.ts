import { InsuranceType, QuoteStatus, Address, ContactInfo } from './Common';

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  address: Address;
  contactInfo: ContactInfo;
}

export interface CoverageDetails {
  coverageType: string;
  coverageAmount: number;
  deductible: number;
  additionalOptions: string[];
}

export interface RiskFactor {
  name: string;
  value: string | number;
  impact: number;
  description: string;
}

export interface PremiumAdjustment {
  type: 'discount' | 'surcharge';
  amount: number;
  reason: string;
  percentage: boolean;
}

export interface RiskAssessment {
  riskScore: number;
  riskFactors: RiskFactor[];
  adjustments: PremiumAdjustment[];
}

export interface PremiumBreakdown {
  component: string;
  amount: number;
  description: string;
}

export interface PremiumCalculation {
  basePremium: number;
  adjustments: number;
  discounts: number;
  finalPremium: number;
  breakdown: PremiumBreakdown[];
}

export interface Quote {
  id: string;
  referenceNumber: string;
  customerId: string;
  productType: InsuranceType;
  personalInfo: PersonalInfo;
  coverageDetails: CoverageDetails;
  riskAssessment: RiskAssessment;
  premium: PremiumCalculation;
  status: QuoteStatus;
  expirationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteRequest {
  productType: InsuranceType;
  personalInfo: PersonalInfo;
  coverageDetails: CoverageDetails;
}

export interface QuoteSearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  customerName?: string;
  status?: QuoteStatus;
  insuranceType?: InsuranceType;
  agentId?: string;
}