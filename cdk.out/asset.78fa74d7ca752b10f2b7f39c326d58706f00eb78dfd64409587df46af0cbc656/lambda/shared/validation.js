"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuoteRequest = exports.isValidDate = exports.isValidZipCode = exports.isValidPhone = exports.isValidEmail = void 0;
const types_1 = require("./types");
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const isValidPhone = (phone) => {
    const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
    return phoneRegex.test(phone);
};
exports.isValidPhone = isValidPhone;
const isValidZipCode = (zipCode) => {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    return zipRegex.test(zipCode);
};
exports.isValidZipCode = isValidZipCode;
const isValidDate = (date) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date))
        return false;
    const parsedDate = new Date(date);
    return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};
exports.isValidDate = isValidDate;
const validateQuoteRequest = (data) => {
    const errors = [];
    if (!data) {
        return { isValid: false, errors: [{ field: 'body', message: 'Request body is required' }] };
    }
    if (!data.personalInfo) {
        errors.push({ field: 'personalInfo', message: 'Personal information is required' });
    }
    else {
        const { personalInfo } = data;
        if (!personalInfo.firstName?.trim()) {
            errors.push({ field: 'personalInfo.firstName', message: 'First name is required' });
        }
        if (!personalInfo.lastName?.trim()) {
            errors.push({ field: 'personalInfo.lastName', message: 'Last name is required' });
        }
        if (!personalInfo.email?.trim()) {
            errors.push({ field: 'personalInfo.email', message: 'Email is required' });
        }
        else if (!(0, exports.isValidEmail)(personalInfo.email)) {
            errors.push({ field: 'personalInfo.email', message: 'Invalid email format' });
        }
        if (!personalInfo.phone?.trim()) {
            errors.push({ field: 'personalInfo.phone', message: 'Phone number is required' });
        }
        else if (!(0, exports.isValidPhone)(personalInfo.phone)) {
            errors.push({ field: 'personalInfo.phone', message: 'Invalid phone number format' });
        }
        if (!personalInfo.dateOfBirth?.trim()) {
            errors.push({ field: 'personalInfo.dateOfBirth', message: 'Date of birth is required' });
        }
        else if (!(0, exports.isValidDate)(personalInfo.dateOfBirth)) {
            errors.push({ field: 'personalInfo.dateOfBirth', message: 'Invalid date format (use YYYY-MM-DD)' });
        }
        if (!personalInfo.address) {
            errors.push({ field: 'personalInfo.address', message: 'Address is required' });
        }
        else {
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
            }
            else if (!(0, exports.isValidZipCode)(address.zipCode)) {
                errors.push({ field: 'personalInfo.address.zipCode', message: 'Invalid ZIP code format' });
            }
        }
    }
    if (!data.coverageDetails) {
        errors.push({ field: 'coverageDetails', message: 'Coverage details are required' });
    }
    else {
        const { coverageDetails } = data;
        if (!coverageDetails.insuranceType) {
            errors.push({ field: 'coverageDetails.insuranceType', message: 'Insurance type is required' });
        }
        else if (!Object.values(types_1.InsuranceType).includes(coverageDetails.insuranceType)) {
            errors.push({
                field: 'coverageDetails.insuranceType',
                message: `Invalid insurance type. Must be one of: ${Object.values(types_1.InsuranceType).join(', ')}`
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
exports.validateQuoteRequest = validateQuoteRequest;
