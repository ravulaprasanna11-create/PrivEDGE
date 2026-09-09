/**
 * PRIVEDGE Phase 1: Local Privacy Core - Pattern Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Conservative deterministic detection patterns for sensitive PII and confidential data.
 */

// Email regex: RFC 5322 compatible conservative matching
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
export const GLOBAL_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Phone regex: Indian (+91/0 followed by 10 digits starting 6-9) and international/standard formats
export const PHONE_REGEX = /(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b/;
export const GLOBAL_PHONE_REGEX = /(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b/g;

// Aadhaar regex: 12 digits, doesn't start with 0 or 1, optionally separated by spaces or dashes
export const AADHAAR_REGEX = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/;
export const GLOBAL_AADHAAR_REGEX = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;

// PAN regex: Indian Income Tax Permanent Account Number (5 letters, 4 digits, 1 letter)
export const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
export const GLOBAL_PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

// Date of Birth: Common date formats dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy
export const DOB_DATE_REGEX = /\b(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])\b/;
export const GLOBAL_DOB_DATE_REGEX = /\b(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])\b/g;

// Payment cards (Visa, Mastercard, RuPay, etc.)
export const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;

// Auth tokens / Private keys / Bearer tokens / JWTs
export const AUTH_TOKEN_REGEX = /\b(?:bearer\s+[A-Za-z0-9._~+/-]+=*|ghp_[A-Za-z0-9]{36}|ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)\b/i;

// Keywords for metadata inspection
export const PASSWORD_KEYWORDS = [
  'password', 'passwd', 'pwd', 'passcode'
];

export const UNKNOWN_SENSITIVE_KEYWORDS = [
  'secret', 'token', 'auth_token', 'api_key', 'apikey', 'private_key', 'credential', 'cvv', 'cvc', 'pin', 'otp'
];

export const EMAIL_KEYWORDS = [
  'email', 'e-mail', 'mail_id', 'user_email', 'email_address'
];

export const PHONE_KEYWORDS = [
  'phone', 'mobile', 'tel', 'contact', 'cellphone', 'cell_no', 'phone_number', 'contact_number'
];

export const AADHAAR_KEYWORDS = [
  'aadhaar', 'adhar', 'uidai', 'adhaar', 'aadhar_no', 'aadhaar_number', 'aadhar'
];

export const PAN_KEYWORDS = [
  'pan', 'pancard', 'pan_card', 'pan_number', 'pan_no'
];

export const DOB_KEYWORDS = [
  'dob', 'birth', 'date_of_birth', 'bday', 'birthdate', 'born_on'
];

export const ADDRESS_KEYWORDS = [
  'address', 'street', 'city', 'state', 'pincode', 'postal', 'zipcode', 'zip_code', 'postal_code', 'country', 'flat_no', 'house_no', 'apartment'
];

export const NAME_KEYWORDS = [
  'firstname', 'first_name', 'lastname', 'last_name', 'fullname', 'full_name',
  'fname', 'lname', 'given_name', 'family_name', 'sur_name', 'surname', 'middle_name', 'legal_name'
];

// Autocomplete attribute mapping
export const AUTOCOMPLETE_MAP: Record<string, 'EMAIL' | 'PHONE' | 'PASSWORD' | 'DOB' | 'ADDRESS' | 'NAME'> = {
  'email': 'EMAIL',
  'tel': 'PHONE',
  'tel-national': 'PHONE',
  'tel-country-code': 'PHONE',
  'current-password': 'PASSWORD',
  'new-password': 'PASSWORD',
  'bday': 'DOB',
  'bday-day': 'DOB',
  'bday-month': 'DOB',
  'bday-year': 'DOB',
  'street-address': 'ADDRESS',
  'address-line1': 'ADDRESS',
  'address-line2': 'ADDRESS',
  'address-level1': 'ADDRESS',
  'address-level2': 'ADDRESS',
  'postal-code': 'ADDRESS',
  'country': 'ADDRESS',
  'name': 'NAME',
  'given-name': 'NAME',
  'family-name': 'NAME',
  'additional-name': 'NAME'
};
