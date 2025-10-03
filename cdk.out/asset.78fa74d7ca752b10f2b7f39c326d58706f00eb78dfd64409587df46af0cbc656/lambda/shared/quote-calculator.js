"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteCalculator = void 0;
const types_1 = require("./types");
class QuoteCalculator {
    static calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    static calculateRiskFactor(age, insuranceType) {
        let riskFactor = 1.0;
        switch (insuranceType) {
            case types_1.InsuranceType.AUTO:
                if (age < 25)
                    riskFactor = 1.5;
                else if (age < 35)
                    riskFactor = 1.2;
                else if (age > 65)
                    riskFactor = 1.3;
                break;
            case types_1.InsuranceType.LIFE:
                if (age > 50)
                    riskFactor = 1.4;
                else if (age > 40)
                    riskFactor = 1.2;
                break;
            case types_1.InsuranceType.HEALTH:
                if (age > 60)
                    riskFactor = 1.6;
                else if (age > 45)
                    riskFactor = 1.3;
                break;
            case types_1.InsuranceType.HOME:
                riskFactor = 1.0;
                break;
        }
        return riskFactor;
    }
    static calculateCoverageFactor(coverageAmount, insuranceType) {
        const baseAmount = insuranceType === types_1.InsuranceType.LIFE ? 100000 : 50000;
        return Math.max(0.5, coverageAmount / baseAmount);
    }
    static calculateDeductibleDiscount(deductible) {
        if (deductible >= 2000)
            return 0.15;
        if (deductible >= 1000)
            return 0.10;
        if (deductible >= 500)
            return 0.05;
        return 0;
    }
    static generateReferenceNumber() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `QT-${timestamp}-${random}`.toUpperCase();
    }
    static calculateQuote(request) {
        const { personalInfo, coverageDetails } = request;
        const age = this.calculateAge(personalInfo.dateOfBirth);
        const baseRate = this.BASE_RATES[coverageDetails.insuranceType];
        const riskFactor = this.calculateRiskFactor(age, coverageDetails.insuranceType);
        const coverageFactor = this.calculateCoverageFactor(coverageDetails.coverageAmount, coverageDetails.insuranceType);
        const basePremium = Math.round(baseRate * riskFactor * coverageFactor);
        const deductibleDiscount = this.calculateDeductibleDiscount(coverageDetails.deductible);
        const discounts = Math.round(basePremium * deductibleDiscount);
        const surcharges = 0;
        const totalPremium = basePremium - discounts + surcharges;
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
            status: types_1.QuoteStatus.ACTIVE,
            expirationDate: expirationDate.toISOString(),
            createdAt: now,
            updatedAt: now
        };
    }
}
exports.QuoteCalculator = QuoteCalculator;
QuoteCalculator.BASE_RATES = {
    [types_1.InsuranceType.AUTO]: 1200,
    [types_1.InsuranceType.HOME]: 800,
    [types_1.InsuranceType.LIFE]: 600,
    [types_1.InsuranceType.HEALTH]: 2400
};
