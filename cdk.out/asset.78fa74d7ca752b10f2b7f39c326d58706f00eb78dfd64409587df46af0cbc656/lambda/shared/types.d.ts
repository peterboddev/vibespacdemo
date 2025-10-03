import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
export type LambdaHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
export interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
        requestId: string;
    };
}
export interface SuccessResponse<T = any> {
    data: T;
    timestamp: string;
    requestId: string;
}
export declare enum InsuranceType {
    AUTO = "auto",
    HOME = "home",
    LIFE = "life",
    HEALTH = "health"
}
export declare enum QuoteStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    EXPIRED = "expired",
    CONVERTED = "converted"
}
export interface PersonalInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
    };
}
export interface CoverageDetails {
    insuranceType: InsuranceType;
    coverageAmount: number;
    deductible: number;
    additionalOptions?: string[];
}
export interface QuoteRequest {
    personalInfo: PersonalInfo;
    coverageDetails: CoverageDetails;
}
export interface Quote {
    id: string;
    referenceNumber: string;
    personalInfo: PersonalInfo;
    coverageDetails: CoverageDetails;
    premium: {
        basePremium: number;
        discounts: number;
        surcharges: number;
        totalPremium: number;
    };
    status: QuoteStatus;
    expirationDate: string;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=types.d.ts.map