/**
 * PRIVEDGE Phase 1: Local Privacy Core - Sensitive Data Detector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Deterministic local baseline detection based on element attributes, autocomplete,
 * input types, labels, surrounding text, and conservative regex patterns.
 */

import type { BrowserContext, BrowserElement, DetectionResult } from './types';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  AADHAAR_REGEX,
  PAN_REGEX,
  DOB_DATE_REGEX,
  CREDIT_CARD_REGEX,
  AUTH_TOKEN_REGEX,
  PASSWORD_KEYWORDS,
  UNKNOWN_SENSITIVE_KEYWORDS,
  EMAIL_KEYWORDS,
  PHONE_KEYWORDS,
  AADHAAR_KEYWORDS,
  PAN_KEYWORDS,
  DOB_KEYWORDS,
  ADDRESS_KEYWORDS,
  NAME_KEYWORDS,
  AUTOCOMPLETE_MAP
} from './patterns';

function matchesKeywords(text: string | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/);
  return keywords.some(keyword => {
    if (keyword.includes('_') || keyword.includes('-') || keyword.includes(' ')) {
      const sanitizedKw = keyword.replace(/[-_ ]+/g, '');
      const sanitizedText = normalized.replace(/[-_ ]+/g, '');
      return sanitizedText.includes(sanitizedKw);
    }
    return tokens.includes(keyword.toLowerCase());
  });
}

function collectElementMetadataText(element: BrowserElement): string {
  const parts = [
    element.id,
    element.name,
    element.ariaLabel,
    element.label,
    element.placeholder,
    element.role
  ].filter(Boolean);
  return parts.join(' ');
}

export function detectElement(element: BrowserElement): DetectionResult[] {
  const detections: DetectionResult[] = [];
  const metadataText = collectElementMetadataText(element);
  const elementVal = element.value?.trim();
  const surrounding = element.surroundingText?.trim();
  const textContent = element.text?.trim();

  // 1. PASSWORD (Input type, autocomplete, or keyword)
  const isPasswordType = element.type?.toLowerCase() === 'password';
  const isPasswordAutocomplete = element.autocomplete === 'current-password' || element.autocomplete === 'new-password';
  const hasPasswordMeta = matchesKeywords(metadataText, PASSWORD_KEYWORDS);

  if (isPasswordType || isPasswordAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'PASSWORD',
      confidence: 1.0,
      reason: isPasswordType ? 'Input type is password' : 'Autocomplete indicates password'
    });
    return detections; // Password takes complete precedence
  } else if (hasPasswordMeta) {
    detections.push({
      elementId: element.id,
      category: 'PASSWORD',
      confidence: 0.95,
      reason: 'Element metadata contains password keyword'
    });
    return detections;
  }

  // 2. AADHAAR (Indian National Identity - 12 digits)
  const isAadhaarVal = elementVal && AADHAAR_REGEX.test(elementVal);
  const hasAadhaarMeta = matchesKeywords(metadataText, AADHAAR_KEYWORDS);
  const hasAadhaarSurrounding = surrounding && AADHAAR_REGEX.test(surrounding);

  if (isAadhaarVal) {
    detections.push({
      elementId: element.id,
      category: 'AADHAAR',
      confidence: 0.98,
      reason: 'Element value matches 12-digit Aadhaar pattern'
    });
  } else if (hasAadhaarMeta) {
    detections.push({
      elementId: element.id,
      category: 'AADHAAR',
      confidence: 0.90,
      reason: 'Element metadata indicates Aadhaar identifier'
    });
  } else if (hasAadhaarSurrounding) {
    detections.push({
      elementId: element.id,
      category: 'AADHAAR',
      confidence: 0.85,
      reason: 'Surrounding text contains Aadhaar-like number'
    });
  }

  // 3. PAN (Permanent Account Number - 10 chars [A-Z]{5}[0-9]{4}[A-Z])
  const isPanVal = elementVal && PAN_REGEX.test(elementVal);
  const hasPanMeta = matchesKeywords(metadataText, PAN_KEYWORDS);
  const hasPanSurrounding = surrounding && PAN_REGEX.test(surrounding);

  if (isPanVal) {
    detections.push({
      elementId: element.id,
      category: 'PAN',
      confidence: 0.98,
      reason: 'Element value matches PAN format'
    });
  } else if (hasPanMeta) {
    detections.push({
      elementId: element.id,
      category: 'PAN',
      confidence: 0.90,
      reason: 'Element metadata indicates PAN card field'
    });
  } else if (hasPanSurrounding) {
    detections.push({
      elementId: element.id,
      category: 'PAN',
      confidence: 0.85,
      reason: 'Surrounding text contains PAN format'
    });
  }

  // 4. EMAIL
  const isEmailType = element.type?.toLowerCase() === 'email';
  const isEmailAutocomplete = element.autocomplete === 'email';
  const isEmailVal = elementVal && EMAIL_REGEX.test(elementVal);
  const hasEmailMeta = matchesKeywords(metadataText, EMAIL_KEYWORDS);
  const hasEmailSurrounding = (surrounding && EMAIL_REGEX.test(surrounding)) || (textContent && EMAIL_REGEX.test(textContent));

  if (isEmailVal) {
    detections.push({
      elementId: element.id,
      category: 'EMAIL',
      confidence: 0.98,
      reason: 'Element value matches valid email address pattern'
    });
  } else if (isEmailType || isEmailAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'EMAIL',
      confidence: 0.95,
      reason: 'Input type or autocomplete indicates email address'
    });
  } else if (hasEmailMeta) {
    detections.push({
      elementId: element.id,
      category: 'EMAIL',
      confidence: 0.88,
      reason: 'Element metadata indicates email field'
    });
  } else if (hasEmailSurrounding) {
    detections.push({
      elementId: element.id,
      category: 'EMAIL',
      confidence: 0.80,
      reason: 'Element text contains email pattern'
    });
  }

  // 5. PHONE
  const isPhoneType = element.type?.toLowerCase() === 'tel';
  const isPhoneAutocomplete = element.autocomplete?.startsWith('tel');
  const isPhoneVal = elementVal && PHONE_REGEX.test(elementVal) && elementVal.replace(/\D/g, '').length >= 10;
  const hasPhoneMeta = matchesKeywords(metadataText, PHONE_KEYWORDS);

  if (isPhoneVal) {
    detections.push({
      elementId: element.id,
      category: 'PHONE',
      confidence: 0.95,
      reason: 'Element value matches phone number pattern'
    });
  } else if (isPhoneType || isPhoneAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'PHONE',
      confidence: 0.95,
      reason: 'Element type or autocomplete indicates telephone field'
    });
  } else if (hasPhoneMeta) {
    detections.push({
      elementId: element.id,
      category: 'PHONE',
      confidence: 0.85,
      reason: 'Element metadata indicates telephone or mobile field'
    });
  }

  // 6. DATE OF BIRTH (DOB)
  const isDobAutocomplete = element.autocomplete?.startsWith('bday');
  const hasDobMeta = matchesKeywords(metadataText, DOB_KEYWORDS);
  const isDobDateVal = elementVal && DOB_DATE_REGEX.test(elementVal);

  if (isDobAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'DOB',
      confidence: 0.95,
      reason: 'Autocomplete specifies birthday'
    });
  } else if (hasDobMeta) {
    detections.push({
      elementId: element.id,
      category: 'DOB',
      confidence: isDobDateVal ? 0.95 : 0.85,
      reason: 'Metadata indicates date of birth'
    });
  }

  // 7. ADDRESS
  const autocompleteCategory = element.autocomplete ? AUTOCOMPLETE_MAP[element.autocomplete] : undefined;
  const isAddressAutocomplete = autocompleteCategory === 'ADDRESS';
  const hasAddressMeta = matchesKeywords(metadataText, ADDRESS_KEYWORDS);

  if (isAddressAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'ADDRESS',
      confidence: 0.95,
      reason: 'Autocomplete indicates physical address'
    });
  } else if (hasAddressMeta) {
    detections.push({
      elementId: element.id,
      category: 'ADDRESS',
      confidence: 0.85,
      reason: 'Element metadata indicates address field'
    });
  }

  // 8. NAME
  const isNameAutocomplete = autocompleteCategory === 'NAME';
  const isInteractiveNonInput = element.tagName.toLowerCase() === 'button' || element.role === 'button';
  const hasNameMeta = !isInteractiveNonInput && matchesKeywords(metadataText, NAME_KEYWORDS);

  if (isNameAutocomplete) {
    detections.push({
      elementId: element.id,
      category: 'NAME',
      confidence: 0.92,
      reason: 'Autocomplete indicates person name'
    });
  } else if (hasNameMeta) {
    detections.push({
      elementId: element.id,
      category: 'NAME',
      confidence: 0.85,
      reason: 'Element metadata indicates person name'
    });
  }

  // 9. UNKNOWN / HIGH-RISK SENSITIVE CONTENT (Credit cards, auth tokens, secret keys)
  const isCreditCard = elementVal && CREDIT_CARD_REGEX.test(elementVal);
  const isAuthToken = (elementVal && AUTH_TOKEN_REGEX.test(elementVal)) || (textContent && AUTH_TOKEN_REGEX.test(textContent));
  const hasUnknownSensitiveMeta = matchesKeywords(metadataText, UNKNOWN_SENSITIVE_KEYWORDS);

  if (isCreditCard || isAuthToken || hasUnknownSensitiveMeta) {
    detections.push({
      elementId: element.id,
      category: 'UNKNOWN_SENSITIVE',
      confidence: 0.95,
      reason: isCreditCard
        ? 'Potential payment card number detected'
        : isAuthToken
        ? 'Potential authentication token/secret detected'
        : 'Element metadata indicates sensitive credential/secret token'
    });
  }

  return detections;
}

export function detectSensitiveData(context: BrowserContext): DetectionResult[] {
  if (!context || !Array.isArray(context.elements)) {
    return [];
  }

  const results: DetectionResult[] = [];
  for (const element of context.elements) {
    const elementDetections = detectElement(element);
    results.push(...elementDetections);
  }

  return results;
}
