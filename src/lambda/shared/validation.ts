import { InsuranceType } from './types';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number format (basic US format)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates ZIP code format (US format)
 */
export const isValidZipCode = (zipCode: string): boolean => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

/**
 * Validates date format (YYYY-MM-DD)
 */
export const isValidDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};

/**
 * Validates quote request payload
 */
export const validateQuoteRequest = (data: any): ValidationResult => {
  const errors: ValidationError[] = [];

  // Check if data exists
  if (!data) {
    return { isValid: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }

  // Validate personal info
  if (!data.personalInfo) {
    errors.push({ field: 'personalInfo', message: 'Personal information is required' });
  } else {
    const { personalInfo } = data;

    if (!personalInfo.firstName?.trim()) {
      errors.push({ field: 'personalInfo.firstName', message: 'First name is required' });
    }

    if (!personalInfo.lastName?.trim()) {
      errors.push({ field: 'personalInfo.lastName', message: 'Last name is required' });
    }

    if (!personalInfo.email?.trim()) {
      errors.push({ field: 'personalInfo.email', message: 'Email is required' });
    } else if (!isValidEmail(personalInfo.email)) {
      errors.push({ field: 'personalInfo.email', message: 'Invalid email format' });
    }

    if (!personalInfo.phone?.trim()) {
      errors.push({ field: 'personalInfo.phone', message: 'Phone number is required' });
    } else if (!isValidPhone(personalInfo.phone)) {
      errors.push({ field: 'personalInfo.phone', message: 'Invalid phone number format' });
    }

    if (!personalInfo.dateOfBirth?.trim()) {
      errors.push({ field: 'personalInfo.dateOfBirth', message: 'Date of birth is required' });
    } else if (!isValidDate(personalInfo.dateOfBirth)) {
      errors.push({ field: 'personalInfo.dateOfBirth', message: 'Invalid date format (use YYYY-MM-DD)' });
    }

    // Validate address
    if (!personalInfo.address) {
      errors.push({ field: 'personalInfo.address', message: 'Address is required' });
    } else {
      const { address } = personalInfo;

      if (!address.street?.trim()) {
        errors.push({ field: 'personalInfo.address.street', message: 'Street address is required' });
      }

      if (!address.city?.trim()) {
        errors.push({ field: 'personalInfo.address.city', message: 'City is required' });
      }

      if (!address.state?.trim()) {
        errors.push({ field: 'personalInfo.address.state', message: 'State is required' });
      }

      if (!address.zipCode?.trim()) {
        errors.push({ field: 'personalInfo.address.zipCode', message: 'ZIP code is required' });
      } else if (!isValidZipCode(address.zipCode)) {
        errors.push({ field: 'personalInfo.address.zipCode', message: 'Invalid ZIP code format' });
      }
    }
  }

  // Validate coverage details
  if (!data.coverageDetails) {
    errors.push({ field: 'coverageDetails', message: 'Coverage details are required' });
  } else {
    const { coverageDetails } = data;

    if (!coverageDetails.insuranceType) {
      errors.push({ field: 'coverageDetails.insuranceType', message: 'Insurance type is required' });
    } else if (!Object.values(InsuranceType).includes(coverageDetails.insuranceType)) {
      errors.push({ 
        field: 'coverageDetails.insuranceType', 
        message: `Invalid insurance type. Must be one of: ${Object.values(InsuranceType).join(', ')}` 
      });
    }

    if (typeof coverageDetails.coverageAmount !== 'number' || coverageDetails.coverageAmount <= 0) {
      errors.push({ field: 'coverageDetails.coverageAmount', message: 'Coverage amount must be a positive number' });
    }

    if (typeof coverageDetails.deductible !== 'number' || coverageDetails.deductible < 0) {
      errors.push({ field: 'coverageDetails.deductible', message: 'Deductible must be a non-negative number' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};