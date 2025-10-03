export interface ValidationError {
    field: string;
    message: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPhone: (phone: string) => boolean;
export declare const isValidZipCode: (zipCode: string) => boolean;
export declare const isValidDate: (date: string) => boolean;
export declare const validateQuoteRequest: (data: any) => ValidationResult;
//# sourceMappingURL=validation.d.ts.map