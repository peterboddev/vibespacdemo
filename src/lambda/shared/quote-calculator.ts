import { QuoteRequest, InsuranceType, Quote, QuoteStatus } from './types';

/**
 * Simple quote calculation service
 * This is a basic implementation for demonstration purposes
 */
export class QuoteCalculator {
  /**
   * Base premium rates by insurance type (annual)
   */
  private static readonly BASE_RATES = {
    [InsuranceType.AUTO]: 1200,
    [InsuranceType.HOME]: 800,
    [InsuranceType.LIFE]: 600,
    [InsuranceType.HEALTH]: 2400
  };

  /**
   * Calculate age from date of birth
   */
  private static calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Calculate risk factor based on age and insurance type
   */
  private static calculateRiskFactor(age: number, insuranceType: InsuranceType): number {
    let riskFactor = 1.0;

    switch (insuranceType) {
      case InsuranceType.AUTO:
        if (age < 25) riskFactor = 1.5;
        else if (age < 35) riskFactor = 1.2;
        else if (age > 65) riskFactor = 1.3;
        break;
      
      case InsuranceType.LIFE:
        if (age > 50) riskFactor = 1.4;
        else if (age > 40) riskFactor = 1.2;
        break;
      
      case InsuranceType.HEALTH:
        if (age > 60) riskFactor = 1.6;
        else if (age > 45) riskFactor = 1.3;
        break;
      
      case InsuranceType.HOME:
        // Home insurance risk is less age-dependent
        riskFactor = 1.0;
        break;
    }

    return riskFactor;
  }

  /**
   * Calculate coverage factor based on coverage amount
   */
  private static calculateCoverageFactor(coverageAmount: number, insuranceType: InsuranceType): number {
    const baseAmount = insuranceType === InsuranceType.LIFE ? 100000 : 50000;
    return Math.max(0.5, coverageAmount / baseAmount);
  }

  /**
   * Calculate deductible discount
   */
  private static calculateDeductibleDiscount(deductible: number): number {
    if (deductible >= 2000) return 0.15;
    if (deductible >= 1000) return 0.10;
    if (deductible >= 500) return 0.05;
    return 0;
  }

  /**
   * Generate a unique reference number
   */
  private static generateReferenceNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `QT-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Calculate quote premium and create quote object
   */
  public static calculateQuote(request: QuoteRequest): Quote {
    const { personalInfo, coverageDetails } = request;
    
    // Calculate age
    const age = this.calculateAge(personalInfo.dateOfBirth);
    
    // Get base premium
    const baseRate = this.BASE_RATES[coverageDetails.insuranceType];
    
    // Calculate risk factor
    const riskFactor = this.calculateRiskFactor(age, coverageDetails.insuranceType);
    
    // Calculate coverage factor
    const coverageFactor = this.calculateCoverageFactor(
      coverageDetails.coverageAmount, 
      coverageDetails.insuranceType
    );
    
    // Calculate base premium
    const basePremium = Math.round(baseRate * riskFactor * coverageFactor);
    
    // Calculate discounts
    const deductibleDiscount = this.calculateDeductibleDiscount(coverageDetails.deductible);
    const discounts = Math.round(basePremium * deductibleDiscount);
    
    // Calculate surcharges (simplified - could be based on location, etc.)
    const surcharges = 0;
    
    // Calculate total premium
    const totalPremium = basePremium - discounts + surcharges;
    
    // Create expiration date (30 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    const now = new Date().toISOString();
    
    return {
      id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      referenceNumber: this.generateReferenceNumber(),
      personalInfo,
      coverageDetails,
      premium: {
        basePremium,
        discounts,
        surcharges,
        totalPremium
      },
      status: QuoteStatus.ACTIVE,
      expirationDate: expirationDate.toISOString(),
      createdAt: now,
      updatedAt: now
    };
  }
}