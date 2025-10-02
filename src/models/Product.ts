import { InsuranceType } from './Common';

export interface CoverageOption {
  id: string;
  name: string;
  description: string;
  baseRate: number;
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  required: boolean;
}

export interface RiskFactorDefinition {
  id: string;
  name: string;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  possibleValues?: string[];
  minValue?: number;
  maxValue?: number;
  weight: number;
}

export interface PricingRule {
  id: string;
  name: string;
  condition: string;
  adjustment: number;
  adjustmentType: 'percentage' | 'fixed';
  priority: number;
  description: string;
  isActive: boolean;
}

export interface InsuranceProduct {
  id: string;
  name: string;
  type: InsuranceType;
  description: string;
  coverageOptions: CoverageOption[];
  pricingRules: PricingRule[];
  riskFactors: RiskFactorDefinition[];
  baseRate: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCreateRequest {
  name: string;
  type: InsuranceType;
  description: string;
  baseRate: number;
  coverageOptions: Omit<CoverageOption, 'id'>[];
  riskFactors: Omit<RiskFactorDefinition, 'id'>[];
}

export interface PricingRuleUpdate {
  name?: string;
  condition?: string;
  adjustment?: number;
  adjustmentType?: 'percentage' | 'fixed';
  priority?: number;
  description?: string;
  isActive?: boolean;
}