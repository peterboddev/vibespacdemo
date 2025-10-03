export declare enum InsuranceType {
    AUTO = "auto",
    HOME = "home",
    LIFE = "life",
    HEALTH = "health",
    BUSINESS = "business"
}
export declare enum UserRole {
    CUSTOMER = "customer",
    AGENT = "agent",
    ADMIN = "admin"
}
export declare enum QuoteStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    EXPIRED = "expired",
    CONVERTED = "converted",
    DECLINED = "declined"
}
export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}
export interface ContactInfo {
    email: string;
    phone?: string;
    preferredContactMethod: 'email' | 'phone';
}
export interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
        requestId: string;
    };
}
//# sourceMappingURL=Common.d.ts.map