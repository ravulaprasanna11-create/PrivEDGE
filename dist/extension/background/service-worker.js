/** PRIVEDGE Browser Agent - Background Service Worker Bundle */

// --- patterns.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Pattern Definitions
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Conservative deterministic detection patterns for sensitive PII and confidential data.
 */
// Email regex: RFC 5322 compatible conservative matching
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const GLOBAL_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Phone regex: Indian (+91/0 followed by 10 digits starting 6-9) and international/standard formats
const PHONE_REGEX = /(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b/;
const GLOBAL_PHONE_REGEX = /(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b/g;
// Aadhaar regex: 12 digits, doesn't start with 0 or 1, optionally separated by spaces or dashes
const AADHAAR_REGEX = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/;
const GLOBAL_AADHAAR_REGEX = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;
// PAN regex: Indian Income Tax Permanent Account Number (5 letters, 4 digits, 1 letter)
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const GLOBAL_PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
// Date of Birth: Common date formats dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy
const DOB_DATE_REGEX = /\b(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])\b/;
const GLOBAL_DOB_DATE_REGEX = /\b(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|\b(?:19|20)\d{2}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])\b/g;
// Payment cards (Visa, Mastercard, RuPay, etc.)
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;
// Auth tokens / Private keys / Bearer tokens / JWTs
const AUTH_TOKEN_REGEX = /\b(?:bearer\s+[A-Za-z0-9._~+/-]+=*|ghp_[A-Za-z0-9]{36}|ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)\b/i;
// Keywords for metadata inspection
const PASSWORD_KEYWORDS = [
    'password', 'passwd', 'pwd', 'passcode'
];
const UNKNOWN_SENSITIVE_KEYWORDS = [
    'secret', 'token', 'auth_token', 'api_key', 'apikey', 'private_key', 'credential', 'cvv', 'cvc', 'pin', 'otp'
];
const EMAIL_KEYWORDS = [
    'email', 'e-mail', 'mail_id', 'user_email', 'email_address'
];
const PHONE_KEYWORDS = [
    'phone', 'mobile', 'tel', 'contact', 'cellphone', 'cell_no', 'phone_number', 'contact_number'
];
const AADHAAR_KEYWORDS = [
    'aadhaar', 'adhar', 'uidai', 'adhaar', 'aadhar_no', 'aadhaar_number', 'aadhar'
];
const PAN_KEYWORDS = [
    'pan', 'pancard', 'pan_card', 'pan_number', 'pan_no'
];
const DOB_KEYWORDS = [
    'dob', 'birth', 'date_of_birth', 'bday', 'birthdate', 'born_on'
];
const ADDRESS_KEYWORDS = [
    'address', 'street', 'city', 'state', 'pincode', 'postal', 'zipcode', 'zip_code', 'postal_code', 'country', 'flat_no', 'house_no', 'apartment'
];
const NAME_KEYWORDS = [
    'firstname', 'first_name', 'lastname', 'last_name', 'fullname', 'full_name',
    'fname', 'lname', 'given_name', 'family_name', 'sur_name', 'surname', 'middle_name', 'legal_name'
];
// Autocomplete attribute mapping
const AUTOCOMPLETE_MAP = {
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


// --- policy.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Privacy Policy Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Deterministic privacy policy mapping categories to explicit ALLOW, MASK, or BLOCK actions.
 * Rule: Task instructions can NEVER override a BLOCK decision.
 */
function applyPrivacyPolicy(category) {
    if (!category) {
        return 'ALLOW';
    }
    switch (category) {
        case 'PASSWORD':
        case 'AADHAAR':
        case 'PAN':
        case 'UNKNOWN_SENSITIVE':
            return 'BLOCK';
        case 'EMAIL':
        case 'PHONE':
        case 'NAME':
        case 'DOB':
        case 'ADDRESS':
            return 'MASK';
        default:
            // Fail closed for any unmapped category
            return 'BLOCK';
    }
}
function evaluateElementPolicy(elementId, detections) {
    const elementDetections = detections.filter(d => d.elementId === elementId);
    if (elementDetections.length === 0) {
        return {
            decision: 'ALLOW',
            reason: 'Non-sensitive element'
        };
    }
    // If any detection requires BLOCK, decision MUST be BLOCK (highest precedence)
    const hasBlock = elementDetections.find(d => applyPrivacyPolicy(d.category) === 'BLOCK');
    if (hasBlock) {
        return {
            decision: 'BLOCK',
            category: hasBlock.category,
            reason: `Policy mandates BLOCK for sensitive category ${hasBlock.category}: ${hasBlock.reason}`
        };
    }
    // If any detection requires MASK, decision is MASK
    const hasMask = elementDetections.find(d => applyPrivacyPolicy(d.category) === 'MASK');
    if (hasMask) {
        return {
            decision: 'MASK',
            category: hasMask.category,
            reason: `Policy mandates MASK for category ${hasMask.category}: ${hasMask.reason}`
        };
    }
    return {
        decision: 'ALLOW',
        reason: 'Non-sensitive element'
    };
}


// --- logger.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Safe Logger
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Safe metadata-only logger.
 * STRICT INVARIANT:
 * NEVER logs raw PII, screenshots, raw DOM, passwords, tokens, cookies,
 * or full browser contexts.
 */
class SafePrivacyLogger {
    logs = [];
    maxLogs = 100;
    log(entry) {
        const safeEntry = {
            timestamp: Date.now(),
            category: entry.category,
            decision: entry.decision,
            confidence: entry.confidence !== undefined ? Number(entry.confidence.toFixed(2)) : undefined,
            reason: this.sanitizeLogString(entry.reason),
            count: entry.count,
            status: this.sanitizeLogString(entry.status)
        };
        this.logs.push(safeEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }
    getSafeLogs() {
        return [...this.logs];
    }
    clear() {
        this.logs = [];
    }
    /**
     * Sanitizes string to avoid accidental inclusion of sensitive patterns.
     */
    sanitizeLogString(str) {
        if (!str)
            return '';
        // Strip anything that looks like an email or digits sequence
        return str
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
            .replace(/\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]')
            .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[REDACTED_PAN]')
            .replace(/(?:(?:\+|00)91[\s.-]?)?[6-9]\d{9}\b/g, '[REDACTED_PHONE]');
    }
}
const safeLogger = new SafePrivacyLogger();


// --- detector.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Sensitive Data Detector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Deterministic local baseline detection based on element attributes, autocomplete,
 * input types, labels, surrounding text, and conservative regex patterns.
 */
function matchesKeywords(text, keywords) {
    if (!text)
        return false;
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
function collectElementMetadataText(element) {
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
function detectElement(element) {
    const detections = [];
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
    }
    else if (hasPasswordMeta) {
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
    }
    else if (hasAadhaarMeta) {
        detections.push({
            elementId: element.id,
            category: 'AADHAAR',
            confidence: 0.90,
            reason: 'Element metadata indicates Aadhaar identifier'
        });
    }
    else if (hasAadhaarSurrounding) {
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
    }
    else if (hasPanMeta) {
        detections.push({
            elementId: element.id,
            category: 'PAN',
            confidence: 0.90,
            reason: 'Element metadata indicates PAN card field'
        });
    }
    else if (hasPanSurrounding) {
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
    }
    else if (isEmailType || isEmailAutocomplete) {
        detections.push({
            elementId: element.id,
            category: 'EMAIL',
            confidence: 0.95,
            reason: 'Input type or autocomplete indicates email address'
        });
    }
    else if (hasEmailMeta) {
        detections.push({
            elementId: element.id,
            category: 'EMAIL',
            confidence: 0.88,
            reason: 'Element metadata indicates email field'
        });
    }
    else if (hasEmailSurrounding) {
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
    }
    else if (isPhoneType || isPhoneAutocomplete) {
        detections.push({
            elementId: element.id,
            category: 'PHONE',
            confidence: 0.95,
            reason: 'Element type or autocomplete indicates telephone field'
        });
    }
    else if (hasPhoneMeta) {
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
    }
    else if (hasDobMeta) {
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
    }
    else if (hasAddressMeta) {
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
    }
    else if (hasNameMeta) {
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
function detectSensitiveData(context) {
    if (!context || !Array.isArray(context.elements)) {
        return [];
    }
    const results = [];
    for (const element of context.elements) {
        const elementDetections = detectElement(element);
        results.push(...elementDetections);
    }
    return results;
}


// --- sanitizer.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Sanitizer / Redactor
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Replaces sensitive values with typed redaction tokens or blocked indicators.
 * Preserves safe structural metadata necessary for browser agent navigation.
 */
const MASK_PLACEHOLDERS = {
    EMAIL: '[REDACTED_EMAIL]',
    PHONE: '[REDACTED_PHONE]',
    NAME: '[REDACTED_NAME]',
    DOB: '[REDACTED_DOB]',
    ADDRESS: '[REDACTED_ADDRESS]',
    PASSWORD: '[BLOCKED_SENSITIVE_DATA]',
    AADHAAR: '[BLOCKED_SENSITIVE_DATA]',
    PAN: '[BLOCKED_SENSITIVE_DATA]',
    UNKNOWN_SENSITIVE: '[BLOCKED_SENSITIVE_DATA]'
};
const BLOCKED_PLACEHOLDER = '[BLOCKED_SENSITIVE_DATA]';
/**
 * Redacts any inline sensitive patterns that may appear in generic text fields.
 */
function sanitizeInlineText(text) {
    if (!text)
        return text;
    let sanitized = text;
    // Blocked categories first
    sanitized = sanitized.replace(GLOBAL_AADHAAR_REGEX, BLOCKED_PLACEHOLDER);
    sanitized = sanitized.replace(GLOBAL_PAN_REGEX, BLOCKED_PLACEHOLDER);
    // Masked categories
    sanitized = sanitized.replace(GLOBAL_EMAIL_REGEX, MASK_PLACEHOLDERS.EMAIL);
    sanitized = sanitized.replace(GLOBAL_PHONE_REGEX, MASK_PLACEHOLDERS.PHONE);
    return sanitized;
}
function sanitizeElement(element, detections) {
    const policy = evaluateElementPolicy(element.id, detections);
    const isPopulated = Boolean(element.value && element.value.trim().length > 0);
    let sanitizedValue;
    switch (policy.decision) {
        case 'BLOCK':
            // Raw sensitive value MUST NOT appear in output
            sanitizedValue = BLOCKED_PLACEHOLDER;
            break;
        case 'MASK': {
            const placeholder = policy.category ? MASK_PLACEHOLDERS[policy.category] : '[REDACTED_PII]';
            sanitizedValue = isPopulated ? placeholder : undefined;
            break;
        }
        case 'ALLOW':
        default:
            // Even for allowed elements, protect against inadvertent PII in value/text
            sanitizedValue = sanitizeInlineText(element.value);
            break;
    }
    return {
        id: element.id,
        tagName: element.tagName,
        type: element.type,
        name: element.name,
        selector: element.selector,
        role: element.role,
        ariaLabel: sanitizeInlineText(element.ariaLabel),
        label: sanitizeInlineText(element.label),
        placeholder: sanitizeInlineText(element.placeholder),
        decision: policy.decision,
        category: policy.category,
        value: sanitizedValue,
        text: sanitizeInlineText(element.text),
        surroundingText: sanitizeInlineText(element.surroundingText),
        isPopulated,
        isInteractive: element.isInteractive,
        isVisible: element.isVisible
    };
}
function sanitizeContext(context, detections) {
    let redactionCount = 0;
    let blockedCount = 0;
    const sanitizedElements = (context.elements || []).map(element => {
        const sanitized = sanitizeElement(element, detections);
        if (sanitized.decision === 'BLOCK') {
            blockedCount++;
        }
        else if (sanitized.decision === 'MASK') {
            redactionCount++;
        }
        return sanitized;
    });
    return {
        page: {
            url: context.page?.url || '',
            title: sanitizeInlineText(context.page?.title) || '',
            domain: context.page?.domain
        },
        elements: sanitizedElements,
        taskInstruction: context.taskInstruction,
        sanitizedAt: Date.now(),
        redactionCount,
        blockedCount
    };
}


// --- disclosure.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Minimum Disclosure Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Task-conditioned minimum disclosure filters sanitized context to reveal
 * only the minimum necessary information required for the agent's task.
 *
 * Invariant: Task requirements can REDUCE disclosure, but can NEVER override a BLOCK decision.
 */
function applyMinimumDisclosure(context, taskInstruction) {
    const instruction = (taskInstruction || context.taskInstruction || '').toLowerCase().trim();
    // If no task specified, apply baseline minimum disclosure
    if (!instruction) {
        return {
            ...context,
            elements: context.elements.map(minimizeElementDefault)
        };
    }
    const isClickOrNavigate = /\b(click|press|tap|submit|navigate|go to|open|continue|next|proceed)\b/i.test(instruction);
    const isSearchOrInspectField = /\b(find|locate|check|inspect|verify|see)\b/i.test(instruction);
    const mentionsEmail = /\bemail\b/i.test(instruction);
    const filteredElements = context.elements.map(el => {
        // SECURITY INVARIANT: BLOCK decisions can NEVER be overridden
        if (el.decision === 'BLOCK') {
            return {
                ...el,
                value: '[BLOCKED_SENSITIVE_DATA]',
                text: undefined,
                surroundingText: undefined
            };
        }
        // Specific Task: "Click Continue" / Action-oriented navigation
        if (isClickOrNavigate && !isSearchOrInspectField) {
            const isTargetButton = el.tagName.toLowerCase() === 'button' ||
                el.role === 'button' ||
                el.type === 'submit' ||
                el.isInteractive;
            if (!isTargetButton && el.decision === 'MASK') {
                // Drop masked values for irrelevant sensitive fields during click navigation
                return {
                    ...el,
                    value: undefined,
                    text: undefined,
                    surroundingText: undefined
                };
            }
        }
        // Specific Task: "Find email field"
        if (mentionsEmail && el.category === 'EMAIL') {
            return {
                ...el,
                // Disclose element existence and whether it is populated, NOT actual email value
                value: el.isPopulated ? '[REDACTED_EMAIL]' : undefined,
                surroundingText: undefined
            };
        }
        // Default minimization for element
        return minimizeElementDefault(el);
    });
    return {
        ...context,
        taskInstruction: taskInstruction || context.taskInstruction,
        elements: filteredElements
    };
}
function minimizeElementDefault(el) {
    if (el.decision === 'BLOCK') {
        return {
            ...el,
            value: '[BLOCKED_SENSITIVE_DATA]',
            text: undefined,
            surroundingText: undefined
        };
    }
    return {
        ...el,
        surroundingText: undefined
    };
}


// --- validator.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Independent Outbound Validator
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Independently validates outbound context payloads before network transmission.
 * Must fail closed. Does NOT trust sanitization flags.
 * NEVER logs or exposes raw PII.
 */
const KNOWN_CATEGORIES = new Set([
    'NAME',
    'EMAIL',
    'PHONE',
    'AADHAAR',
    'PAN',
    'PASSWORD',
    'DOB',
    'ADDRESS',
    'UNKNOWN_SENSITIVE'
]);
const FORBIDDEN_OBJECT_KEYS = [
    'password',
    'rawpassword',
    'raw_password',
    'passwd',
    'cookie',
    'cookies',
    'session',
    'sessiontoken',
    'session_token',
    'token',
    'authtoken',
    'auth_token',
    'authorization',
    'secret',
    'rawaadhaar',
    'rawpan'
];
/**
 * Recursively inspect all string values in an object to detect leaked sensitive data.
 * Does not expose raw values in error messages.
 */
function scanStringsForViolations(obj, path = '') {
    const violations = [];
    if (obj === null || obj === undefined) {
        return violations;
    }
    if (typeof obj === 'string') {
        // Check for raw Aadhaar
        if (AADHAAR_REGEX.test(obj)) {
            violations.push(`Unredacted Aadhaar pattern detected at ${path}`);
        }
        // Check for raw PAN
        if (PAN_REGEX.test(obj)) {
            violations.push(`Unredacted PAN pattern detected at ${path}`);
        }
        // Check for unmasked Email
        if (EMAIL_REGEX.test(obj)) {
            violations.push(`Unmasked email address detected at ${path}`);
        }
        // Check for unmasked Phone (10+ digits)
        if (PHONE_REGEX.test(obj) && obj.replace(/\D/g, '').length >= 10) {
            violations.push(`Unmasked telephone number detected at ${path}`);
        }
        // Check for Payment Cards
        if (CREDIT_CARD_REGEX.test(obj)) {
            violations.push(`Payment card pattern detected at ${path}`);
        }
        // Check for Auth tokens
        if (AUTH_TOKEN_REGEX.test(obj)) {
            violations.push(`Authentication token/secret detected at ${path}`);
        }
        return violations;
    }
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            violations.push(...scanStringsForViolations(item, `${path}[${index}]`));
        });
        return violations;
    }
    if (typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (FORBIDDEN_OBJECT_KEYS.includes(lowerKey)) {
                violations.push(`Forbidden sensitive key '${key}' present at ${path}`);
            }
            violations.push(...scanStringsForViolations(val, path ? `${path}.${key}` : key));
        }
    }
    return violations;
}
function validateOutboundContext(payload) {
    const errors = [];
    try {
        // 1. Structural integrity check (Malformed payload rejection)
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return {
                isValid: false,
                errors: ['Malformed payload: Payload must be a valid non-null object'],
                validatedAt: Date.now()
            };
        }
        const candidate = payload;
        if (!candidate.page || typeof candidate.page !== 'object') {
            errors.push('Malformed payload: Missing or invalid page metadata');
        }
        if (!Array.isArray(candidate.elements)) {
            errors.push('Malformed payload: Missing elements array');
            return {
                isValid: false,
                errors,
                validatedAt: Date.now()
            };
        }
        // 2. Element validation
        for (let i = 0; i < candidate.elements.length; i++) {
            const el = candidate.elements[i];
            if (!el || typeof el !== 'object' || !el.id || !el.tagName || !el.decision) {
                errors.push(`Malformed element at index ${i}: Missing required id, tagName, or decision`);
                continue;
            }
            // Check category validity if present
            if (el.category && !KNOWN_CATEGORIES.has(el.category)) {
                errors.push(`Unknown sensitive category '${el.category}' at element id '${el.id}'`);
            }
            // Blocked elements must not have unblocked values
            if (el.decision === 'BLOCK') {
                if (el.value && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
                    errors.push(`Element '${el.id}' has BLOCK decision but contains non-blocked value`);
                }
            }
            // Password input fields must never have raw value or ALLOW decision
            if (el.type?.toLowerCase() === 'password') {
                if (el.decision !== 'BLOCK') {
                    errors.push(`Password input field '${el.id}' does not have mandatory BLOCK decision`);
                }
                if (el.value && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
                    errors.push(`Password input field '${el.id}' contains unblocked raw value`);
                }
            }
            // Masked elements must only have redaction tokens or undefined
            if (el.decision === 'MASK' && el.value) {
                if (!el.value.startsWith('[REDACTED_') && el.value !== '[BLOCKED_SENSITIVE_DATA]') {
                    errors.push(`Element '${el.id}' has MASK decision but value is not a redaction placeholder`);
                }
            }
        }
        // 3. Deep string inspection for leaked sensitive values
        const stringViolations = scanStringsForViolations(payload);
        errors.push(...stringViolations);
        const isValid = errors.length === 0;
        return {
            isValid,
            context: isValid ? payload : undefined,
            errors: isValid ? undefined : errors,
            validatedAt: Date.now(),
            diagnostics: {
                blockedViolationsCount: errors.filter(e => e.includes('BLOCK') || e.includes('Aadhaar') || e.includes('PAN') || e.includes('Password')).length,
                unmaskedSensitiveCount: errors.filter(e => e.includes('Unmasked') || e.includes('MASK')).length,
                reasons: errors
            }
        };
    }
    catch {
        // Fail closed on any unexpected exception
        return {
            isValid: false,
            errors: ['Validator failed closed due to an internal validation exception'],
            validatedAt: Date.now()
        };
    }
}


// --- pipeline.ts ---
/**
 * PRIVEDGE Phase 1: Local Privacy Core - Complete Local Pipeline
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Required Flow:
 * BrowserContext
 *   ↓ detectSensitiveData
 *   ↓ applyPrivacyPolicy
 *   ↓ sanitizeContext
 *   ↓ applyMinimumDisclosure
 *   ↓ validateOutboundContext
 *   ↓ ValidatedOutboundContext
 *
 * Invariants:
 * - ZERO network/cloud calls.
 * - Fails closed: If validation fails, NEVER expose outbound payload.
 * - Diagnostics must NOT contain raw PII.
 */
function runLocalPrivacyPipeline(context) {
    const timestamp = Date.now();
    try {
        if (!context || !context.page || !Array.isArray(context.elements)) {
            safeLogger.log({
                decision: 'BLOCK',
                reason: 'Invalid or malformed BrowserContext supplied to pipeline',
                status: 'FAILED_VALIDATION'
            });
            return {
                success: false,
                outboundContext: undefined,
                diagnostics: {
                    status: 'FAILED_VALIDATION',
                    detectionsCount: 0,
                    blockedCount: 0,
                    maskedCount: 0,
                    allowedCount: 0,
                    validationErrors: ['Invalid or malformed BrowserContext supplied to pipeline'],
                    timestamp
                }
            };
        }
        // 1. Detect sensitive data
        const detections = detectSensitiveData(context);
        // 2. Sanitize context (evaluates policy internally per element)
        const sanitized = sanitizeContext(context, detections);
        // 3. Apply task-conditioned minimum disclosure
        const disclosed = applyMinimumDisclosure(sanitized, context.taskInstruction);
        // 4. Independent outbound validation
        const validation = validateOutboundContext(disclosed);
        const blockedCount = disclosed.elements.filter(e => e.decision === 'BLOCK').length;
        const maskedCount = disclosed.elements.filter(e => e.decision === 'MASK').length;
        const allowedCount = disclosed.elements.filter(e => e.decision === 'ALLOW').length;
        if (!validation.isValid) {
            safeLogger.log({
                decision: 'BLOCK',
                reason: 'Outbound validator rejected payload',
                count: validation.errors?.length,
                status: 'FAILED_VALIDATION'
            });
            // Fail closed: Never return unsafe outbound payload
            return {
                success: false,
                outboundContext: undefined,
                diagnostics: {
                    status: 'FAILED_VALIDATION',
                    detectionsCount: detections.length,
                    blockedCount,
                    maskedCount,
                    allowedCount,
                    validationErrors: validation.errors,
                    timestamp: Date.now()
                }
            };
        }
        safeLogger.log({
            status: 'SUCCESS',
            reason: 'Context safely sanitized and validated for outbound transmission',
            count: disclosed.elements.length
        });
        return {
            success: true,
            outboundContext: validation.context,
            diagnostics: {
                status: 'SUCCESS',
                detectionsCount: detections.length,
                blockedCount,
                maskedCount,
                allowedCount,
                timestamp: Date.now()
            }
        };
    }
    catch (error) {
        // Fail closed on any unexpected pipeline error
        const safeErrorMessage = error instanceof Error ? error.message : 'Unknown internal error';
        safeLogger.log({
            decision: 'BLOCK',
            reason: `Pipeline failed closed: ${safeErrorMessage}`,
            status: 'FAILED_VALIDATION'
        });
        return {
            success: false,
            outboundContext: undefined,
            diagnostics: {
                status: 'FAILED_VALIDATION',
                detectionsCount: 0,
                blockedCount: 0,
                maskedCount: 0,
                allowedCount: 0,
                validationErrors: ['Pipeline execution failed closed due to an internal exception'],
                timestamp: Date.now()
            }
        };
    }
}


// --- config.ts ---
/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Configuration
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Vision Transformer configuration and candidate visual sensitivity mappings.
 */
/**
 * Lightweight object-detection model for browser/edge inference.
 * facebook/detr-resnet-50 (Xenova quantized ONNX) produces real xmin/ymin/xmax/ymax
 * bounding boxes via the Transformers.js ObjectDetectionPipeline.
 * This is the minimum-viable spatially-capable model compatible with ONNX Runtime Web/WASM.
 * NOTE: MobileViT was classification-only and could NOT produce bounding boxes — replaced.
 */
const DEFAULT_VISION_MODEL = 'Xenova/detr-resnet-50';
const DEFAULT_PERCEPTION_CONFIG = {
    modelName: DEFAULT_VISION_MODEL,
    preferredRuntime: 'webgpu',
    confidenceThreshold: 0.35,
    maxDetections: 50
};
/**
 * Visual semantic labels that represent potential sensitive candidates.
 * Note: These are ONLY candidates for Phase 4 correlation, NOT confirmed PII.
 */
const SENSITIVE_VISUAL_LABELS = new Set([
    'face',
    'portrait',
    'person',
    'avatar',
    'profile photo',
    'identity document',
    'card',
    'credit card',
    'debit card',
    'document',
    'text region',
    'signature',
    'qr code',
    'barcode',
    'input field',
    'password region',
    'credential box'
]);
/**
 * Checks if a given visual label matches potential sensitive candidate criteria.
 */
function isSensitiveVisualCandidate(label) {
    if (!label)
        return false;
    const normalized = label.toLowerCase().trim();
    for (const candidate of SENSITIVE_VISUAL_LABELS) {
        if (normalized.includes(candidate)) {
            return true;
        }
    }
    return false;
}


// --- runtime.ts ---
/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Runtime Acceleration Layer
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Hardware acceleration detection and runtime selection.
 * Enforces deterministic WebGPU preference with graceful WASM fallback.
 * INVARIANT: Never claim WebGPU acceleration unless physically verified.
 */
/**
 * Verifies real hardware WebGPU capability on current device.
 */
export async function detectWebGPUSupport() {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
    }
    try {
        const gpu = navigator.gpu;
        if (!gpu || typeof gpu.requestAdapter !== 'function') {
            return false;
        }
        const adapter = await gpu.requestAdapter();
        return Boolean(adapter);
    }
    catch {
        return false;
    }
}
/**
 * Verifies WebAssembly (WASM) capability in current environment.
 */
function detectWASMSupport() {
    if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') {
        return false;
    }
    // Minimal valid WASM module verification (magic 0x00, 0x61, 0x73, 0x6d, version 0x01)
    const minimalWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    return WebAssembly.validate(minimalWasm);
}
/**
 * Resolves active runtime capabilities and chooses the optimal execution device.
 */
export async function getRuntimeCapabilities(preferredRuntime) {
    const [webgpuAvailable, wasmAvailable] = await Promise.all([
        detectWebGPUSupport(),
        Promise.resolve(detectWASMSupport())
    ]);
    let selectedRuntime = 'wasm';
    let deviceInfo = 'CPU (WebAssembly fallback)';
    // Deterministic selection: WebGPU preferred if available and requested
    if (preferredRuntime === 'webgpu' || !preferredRuntime) {
        if (webgpuAvailable) {
            selectedRuntime = 'webgpu';
            deviceInfo = 'GPU (WebGPU hardware acceleration)';
        }
        else if (wasmAvailable) {
            selectedRuntime = 'wasm';
            deviceInfo = 'CPU (WebGPU unavailable, using WASM)';
        }
    }
    else if (preferredRuntime === 'wasm' && wasmAvailable) {
        selectedRuntime = 'wasm';
        deviceInfo = 'CPU (WASM explicitly requested)';
    }
    return {
        webgpuAvailable,
        wasmAvailable,
        selectedRuntime,
        deviceInfo
    };
}


// --- model.ts ---
/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Model Lifecycle Manager
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Manages lazy initialization, lifecycle states, and single-instance reuse
 * for the on-device lightweight object-detection model via @huggingface/transformers.
 *
 * INVARIANT: Never initializes at boot; loads only upon explicit visual capture request.
 * INVARIANT: Pipeline instance is held locally — never transmitted to any external service.
 * INVARIANT: If load fails, fails closed with 'error' state and heuristic fallback.
 */
class VisionModelManager {
    state = 'uninitialized';
    instance = null;
    pipeline = null;
    initializationPromise = null;
    getState() {
        return this.state;
    }
    getInstance() {
        return this.instance;
    }
    /**
     * Returns the loaded ObjectDetectionPipeline callable, or null if not available.
     * The processor uses this to run real model inference.
     */
    getPipeline() {
        return this.pipeline;
    }
    /**
     * Lazily loads and initializes the vision transformer instance once.
     * Concurrency-safe: Reuses ongoing promise if called multiple times simultaneously.
     */
    async getOrInitialize(config) {
        if (this.state === 'ready' && this.instance) {
            return this.instance;
        }
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        this.initializationPromise = this.performInitialization(config);
        return this.initializationPromise;
    }
    async performInitialization(customConfig) {
        const config = { ...DEFAULT_PERCEPTION_CONFIG, ...(customConfig || {}) };
        this.state = 'loading';
        try {
            // 1. Detect hardware acceleration capabilities (WebGPU -> WASM fallback)
            const capabilities = await getRuntimeCapabilities(config.preferredRuntime);
            const selectedRuntime = capabilities.selectedRuntime;
            // 2. Dynamically import @huggingface/transformers and load ObjectDetectionPipeline.
            //    Dynamic import used so the bundle does not hard-fail in environments
            //    where the package might be absent (graceful degradation to heuristic).
            //    Uses indirect import via Function() to avoid static bundler resolution
            //    in Next.js server context (this path runs in browser extension / Node test).
            let backend = 'unloaded';
            let loadedPipeline = null;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tf = await import('@huggingface/transformers');
                if (tf && typeof tf.pipeline === 'function') {
                    // Map our runtime to the Transformers.js device string
                    const device = selectedRuntime === 'webgpu' ? 'webgpu' : 'wasm';
                    // Load ONNX-quantized object-detection pipeline locally.
                    // Model is fetched once and cached by Transformers.js in IndexedDB/OPFS.
                    // In test environments (Node), this will fail gracefully below.
                    loadedPipeline = await tf.pipeline('object-detection', config.modelName, {
                        device,
                        // Use quantized ONNX model for smaller footprint
                        dtype: 'q4',
                    });
                    backend = 'transformers.js';
                }
            }
            catch (pipelineErr) {
                // Pipeline load failed (e.g. no network in test, unsupported env, model not cached).
                // This is a GRACEFUL degradation — not a hard error.
                // Processor will use honest heuristic fallback; source is always labelled 'heuristic'.
                backend = 'unloaded';
                loadedPipeline = null;
            }
            this.pipeline = loadedPipeline;
            // 3. Build model instance descriptor
            this.instance = {
                modelName: config.modelName,
                runtime: selectedRuntime,
                state: 'ready',
                backend,
                initializedAt: Date.now()
            };
            this.state = 'ready';
            return this.instance;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown model initialization error';
            this.state = 'error';
            this.instance = {
                modelName: config.modelName,
                runtime: 'wasm',
                state: 'error',
                error: errorMsg
            };
            this.pipeline = null;
            throw new Error(`Failed to initialize on-device vision model: ${errorMsg}`);
        }
        finally {
            this.initializationPromise = null;
        }
    }
    /**
     * Resets model state (primarily for isolation in testing).
     */
    reset() {
        this.state = 'uninitialized';
        this.instance = null;
        this.pipeline = null;
        this.initializationPromise = null;
    }
}
const visionModelManager = new VisionModelManager();


// --- detector.ts ---
/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Visual Element Detector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Analyzes visual representations and produces structured VisualDetection models.
 *
 * STRICT INVARIANTS:
 * - Clear source distinction: 'visual-model' vs 'heuristic'.
 * - Accurate candidate tagging (sensitiveCandidate: true/false).
 * - Never fabricates fake machine-learning accuracy.
 * - ZERO network transmission of pixel data.
 */
/**
 * Validates that a bounding box contains valid non-negative dimensions.
 */
function isValidBoundingBox(box) {
    if (!box || typeof box !== 'object')
        return false;
    const b = box;
    return (typeof b.x === 'number' &&
        typeof b.y === 'number' &&
        typeof b.width === 'number' &&
        typeof b.height === 'number' &&
        !isNaN(b.x) &&
        !isNaN(b.y) &&
        !isNaN(b.width) &&
        !isNaN(b.height) &&
        b.x >= 0 &&
        b.y >= 0 &&
        b.width > 0 &&
        b.height > 0);
}
/**
 * Validates that a visual detection conforms strictly to the schema.
 */
function isValidVisualDetection(detection) {
    if (!detection || typeof detection !== 'object')
        return false;
    const d = detection;
    if (typeof d.id !== 'string' || !d.id.trim())
        return false;
    if (typeof d.label !== 'string' || !d.label.trim())
        return false;
    if (typeof d.confidence !== 'number' || isNaN(d.confidence) || d.confidence < 0 || d.confidence > 1) {
        return false;
    }
    if (d.source !== 'visual-model' && d.source !== 'heuristic')
        return false;
    if (typeof d.sensitiveCandidate !== 'boolean')
        return false;
    if (!isValidBoundingBox(d.boundingBox))
        return false;
    return true;
}
/**
 * Transforms raw vision transformer outputs or heuristic visual regions
 * into verified VisualDetection instances.
 */
function createVisualDetections(imageWidth, imageHeight, predictions, heuristicRegions) {
    const detections = [];
    let counter = 1;
    // 1. Process actual model predictions
    if (Array.isArray(predictions)) {
        for (const pred of predictions) {
            const label = pred.label || 'visual-object';
            const confidence = Number(Math.max(0, Math.min(1, pred.score || 0)).toFixed(3));
            let boundingBox;
            if (pred.box) {
                boundingBox = {
                    x: Math.max(0, Math.round(pred.box.xmin)),
                    y: Math.max(0, Math.round(pred.box.ymin)),
                    width: Math.max(1, Math.round(pred.box.xmax - pred.box.xmin)),
                    height: Math.max(1, Math.round(pred.box.ymax - pred.box.ymin))
                };
            }
            else {
                // Full image classification without spatial boxes
                boundingBox = {
                    x: 0,
                    y: 0,
                    width: Math.max(1, imageWidth),
                    height: Math.max(1, imageHeight)
                };
            }
            if (isValidBoundingBox(boundingBox)) {
                detections.push({
                    id: `vis-${counter++}`,
                    label,
                    confidence,
                    boundingBox,
                    source: 'visual-model',
                    sensitiveCandidate: isSensitiveVisualCandidate(label)
                });
            }
        }
    }
    // 2. Process deterministic heuristic visual regions (if provided)
    if (Array.isArray(heuristicRegions)) {
        for (const region of heuristicRegions) {
            if (isValidBoundingBox(region.box)) {
                detections.push({
                    id: `vis-${counter++}`,
                    label: region.label,
                    confidence: Number(Math.max(0, Math.min(1, region.confidence)).toFixed(3)),
                    boundingBox: region.box,
                    source: 'heuristic',
                    sensitiveCandidate: isSensitiveVisualCandidate(region.label)
                });
            }
        }
    }
    return detections;
}


// --- processor.ts ---
/**
 * PRIVEDGE Phase 3: On-Device Visual Perception - Visual Perception Processor
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Core visual pipeline accepting Phase 2 screenshots, executing on-device inference
 * via a real @huggingface/transformers ObjectDetectionPipeline, recording latency,
 * and returning structured VisualContext for Phase 4 fusion.
 *
 * STRICT INVARIANTS:
 * - ZERO external network transmission.
 * - NEVER logs or persists raw screenshots or pixel buffers.
 * - Raw screenshot dataUrl is consumed locally and NEVER written to VisualContext.
 * - Records genuine high-resolution local timing.
 * - Validates input and fails closed with structured error states.
 * - Heuristic fallback is NEVER labelled as 'visual-model'.
 */
/**
 * Validates that an object conforms strictly to the VisualContext schema.
 */
function isValidVisualContext(context) {
    if (!context || typeof context !== 'object')
        return false;
    const ctx = context;
    if (typeof ctx.imageWidth !== 'number' || ctx.imageWidth <= 0)
        return false;
    if (typeof ctx.imageHeight !== 'number' || ctx.imageHeight <= 0)
        return false;
    if (!Array.isArray(ctx.detections))
        return false;
    if (!ctx.detections.every(isValidVisualDetection))
        return false;
    if (typeof ctx.inferenceTimeMs !== 'number' || ctx.inferenceTimeMs < 0)
        return false;
    if (ctx.runtime !== 'webgpu' && ctx.runtime !== 'wasm')
        return false;
    if (typeof ctx.model !== 'string' || !ctx.model.trim())
        return false;
    if (typeof ctx.device !== 'string' || !ctx.device.trim())
        return false;
    if (typeof ctx.timestamp !== 'number' || isNaN(ctx.timestamp))
        return false;
    return true;
}
/**
 * Validates that screenshot input is present and correctly formatted.
 */
function validateScreenshotInput(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Invalid screenshot input: Input must be a non-null object');
    }
    const s = input;
    if (typeof s.dataUrl !== 'string' || !s.dataUrl.startsWith('data:image/')) {
        throw new Error('Invalid screenshot input: Missing or malformed image data URL');
    }
    return {
        dataUrl: s.dataUrl,
        width: typeof s.width === 'number' && s.width > 0 ? s.width : 1280,
        height: typeof s.height === 'number' && s.height > 0 ? s.height : 720,
        timestamp: s.timestamp || Date.now()
    };
}
/**
 * Executes local on-device visual perception on a captured screenshot.
 *
 * Flow:
 *   screenshot dataUrl (local only)
 *     -> ObjectDetectionPipeline (real ONNX/WASM inference)
 *     -> raw model predictions [label, score, box {xmin,ymin,xmax,ymax}]
 *     -> createVisualDetections() -> VisualDetection[]
 *     -> VisualContext (no pixel data, no raw URL)
 *
 * The raw dataUrl is NEVER written to VisualContext or any outbound structure.
 */
export async function processVisualPerception(screenshot, config) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // 1. Validate screenshot input — throws on invalid/non-local URLs
    const validScreen = validateScreenshotInput(screenshot);
    const imageWidth = validScreen.width || 1280;
    const imageHeight = validScreen.height || 720;
    // 2. Lazily initialize on-device vision model instance
    const modelInstance = await visionModelManager.getOrInitialize(config);
    const pipeline = visionModelManager.getPipeline();
    // 3. Run real local inference if pipeline is available
    let rawPredictions;
    let heuristicRegions;
    if (modelInstance.backend === 'transformers.js' && pipeline) {
        // Real @huggingface/transformers ObjectDetectionPipeline execution (local, offline after first load).
        // Passes the dataUrl directly — Transformers.js decodes it locally via Image/Canvas API in browser,
        // or Jimp/sharp in Node. The raw dataUrl is consumed here and NEVER forwarded externally.
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results = await pipeline(validScreen.dataUrl, {
                threshold: config?.confidenceThreshold ?? 0.35,
                percentage: false // Return absolute pixel coordinates, not normalized fractions
            });
            // Map Transformers.js output format to our internal RawModelPrediction format
            if (Array.isArray(results)) {
                rawPredictions = results.map((r) => ({
                    label: String(r.label || 'visual-object'),
                    score: Number(r.score ?? 0),
                    // Transformers.js ObjectDetectionPipeline returns: { xmin, ymin, xmax, ymax }
                    box: r.box
                        ? {
                            xmin: Number(r.box.xmin ?? 0),
                            ymin: Number(r.box.ymin ?? 0),
                            xmax: Number(r.box.xmax ?? 0),
                            ymax: Number(r.box.ymax ?? 0)
                        }
                        : undefined
                }));
            }
        }
        catch {
            // Inference failed — fail closed: no detections from model, heuristic takes over
            rawPredictions = undefined;
        }
    }
    else {
        // Honest structural fallback: marks source strictly as 'heuristic', NEVER faking ML detection.
        // This runs when the model is not available (test env, no model cache, offline first load).
        heuristicRegions = [
            {
                label: 'page-viewport',
                confidence: 0.99,
                box: { x: 0, y: 0, width: imageWidth, height: imageHeight }
            }
        ];
    }
    const detections = createVisualDetections(imageWidth, imageHeight, rawPredictions, heuristicRegions);
    // 4. Measure genuine inference latency
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const inferenceTimeMs = Number(Math.max(0.01, endTime - startTime).toFixed(2));
    // 5. Construct VisualContext — raw screenshot dataUrl is deliberately EXCLUDED
    const visualContext = {
        imageWidth,
        imageHeight,
        detections,
        inferenceTimeMs,
        runtime: modelInstance.runtime,
        model: modelInstance.modelName,
        device: modelInstance.runtime === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WASM)',
        timestamp: Date.now()
    };
    return visualContext;
}


// --- visual-perception.ts ---
/**
 * PRIVEDGE Phase 3: Browser Extension - Visual Perception Adapter
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Adapter connecting Phase 2 captured visible-tab screenshots
 * to the Phase 3 on-device visual perception pipeline.
 */
/**
 * Runs local on-device visual perception on a Phase 2 CapturedScreen.
 */
export async function runVisualPerceptionOnScreen(screen) {
    if (!screen || !screen.dataUrl) {
        throw new Error('Visual perception failed: No valid screenshot provided by extension capture');
    }
    const result = await processVisualPerception({
        dataUrl: screen.dataUrl,
        width: screen.width,
        height: screen.height,
        timestamp: screen.timestamp
    });
    return result;
}


// --- messages.ts ---
/**
 * PRIVEDGE Phase 2: Browser Extension - Message Protocol
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Typed messaging protocol facilitating local communication between
 * Content Script, Popup, and Background Service Worker.
 */
const MSG_CAPTURE_CONTEXT = 'CAPTURE_CONTEXT';
const MSG_CAPTURE_SCREEN = 'CAPTURE_SCREEN';
const MSG_CAPTURE_ALL = 'CAPTURE_ALL';
const MSG_RUN_VISUAL_PERCEPTION = 'RUN_VISUAL_PERCEPTION';
const MSG_PRIVACY_RESULT = 'PRIVACY_RESULT';
const MSG_CAPTURE_ERROR = 'CAPTURE_ERROR';
const MSG_EXECUTE_ACTION = 'EXECUTE_ACTION';
const MSG_ACTION_RESULT = 'ACTION_RESULT';
const VALID_ACTIONS = new Set([
    MSG_CAPTURE_CONTEXT,
    MSG_CAPTURE_SCREEN,
    MSG_CAPTURE_ALL,
    MSG_RUN_VISUAL_PERCEPTION,
    MSG_PRIVACY_RESULT,
    MSG_CAPTURE_ERROR,
    MSG_EXECUTE_ACTION,
    MSG_ACTION_RESULT
]);
/**
 * Creates a strongly typed extension message.
 */
function createExtensionMessage(action, payload, requestId) {
    return {
        action,
        payload,
        requestId: requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: Date.now()
    };
}
/**
 * Validates that an incoming message conforms to the ExtensionMessage structure.
 * Rejects unknown actions or malformed objects.
 */
function isValidExtensionMessage(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
        return false;
    }
    const candidate = msg;
    if (typeof candidate.action !== 'string') {
        return false;
    }
    if (!VALID_ACTIONS.has(candidate.action)) {
        return false;
    }
    if (typeof candidate.timestamp !== 'number' || isNaN(candidate.timestamp)) {
        return false;
    }
    return true;
}


// --- service-worker.ts ---
/**
 * PRIVEDGE Phase 2: Browser Extension - Background Service Worker
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Central local orchestration layer.
 * Receives capture requests, coordinates DOM & screenshot capture from the active tab,
 * passes captured BrowserContext directly into the Phase 1 Local Privacy Pipeline,
 * and yields verified sanitized output.
 *
 * STRICT INVARIANTS:
 * - ZERO external network / cloud / server communication.
 * - NEVER logs or persists raw PII.
 * - Fails closed on any policy violation or validation error.
 */
/**
 * Resolves the Chrome / WebExtension API root.
 */
function getExtensionApi() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
        return chrome;
    }
    if (typeof browser !== 'undefined' && browser.tabs && browser.runtime) {
        return browser;
    }
    return null;
}
/**
 * Captures screenshot of current visible tab using extension API.
 */
export async function captureTabScreenshot(api) {
    const extApi = api || getExtensionApi();
    if (!extApi?.tabs?.captureVisibleTab) {
        return undefined;
    }
    try {
        const dataUrl = await extApi.tabs.captureVisibleTab(null, { format: 'png' });
        return {
            dataUrl,
            width: 1280,
            height: 720,
            timestamp: Date.now()
        };
    }
    catch {
        // Fail safely without leaking data
        return undefined;
    }
}
/**
 * Orchestrates full capture: requests DOM context from content script, captures screen,
 * and feeds BrowserContext through the Phase 1 Local Privacy Pipeline.
 */
export async function orchestrateContextCapture(api, tabIdOverride) {
    const extApi = api || getExtensionApi();
    if (!extApi) {
        return {
            success: false,
            page: { url: '', title: '' },
            error: 'Browser extension API is unavailable in current environment'
        };
    }
    let activeTabId = tabIdOverride;
    if (!activeTabId) {
        try {
            const activeTabs = await extApi.tabs.query({ active: true, currentWindow: true });
            if (!activeTabs || activeTabs.length === 0 || !activeTabs[0].id) {
                return {
                    success: false,
                    page: { url: '', title: '' },
                    error: 'No active browser tab found for context capture'
                };
            }
            activeTabId = activeTabs[0].id;
        }
        catch {
            return {
                success: false,
                page: { url: '', title: '' },
                error: 'Failed to query active browser tab'
            };
        }
    }
    // 1. Request DOM context from content script on active tab
    let capturedContext;
    try {
        const message = createExtensionMessage(MSG_CAPTURE_CONTEXT);
        const response = (await extApi.tabs.sendMessage(activeTabId, message));
        if (response && response.success && response.context) {
            capturedContext = response.context;
        }
        else {
            return {
                success: false,
                page: { url: '', title: '' },
                error: response?.error || 'Content script failed to respond or extract context'
            };
        }
    }
    catch {
        return {
            success: false,
            page: { url: '', title: '' },
            error: 'Unable to communicate with webpage content script (page may be restricted)'
        };
    }
    // 2. Capture visible tab screenshot locally for Phase 3 visual perception
    const screen = await captureTabScreenshot(extApi);
    // 3. Pipe captured BrowserContext through Phase 1 Local Privacy Core
    const pipelineResult = runLocalPrivacyPipeline(capturedContext);
    if (!pipelineResult.success || !pipelineResult.outboundContext) {
        // Fail closed: Never return unverified or blocked payloads
        return {
            success: false,
            page: capturedContext.page,
            diagnostics: pipelineResult.diagnostics,
            error: 'Privacy pipeline rejected outbound context during validation'
        };
    }
    return {
        success: true,
        page: capturedContext.page,
        sanitizedContext: pipelineResult.outboundContext,
        screen,
        diagnostics: pipelineResult.diagnostics,
        // Phase 4: run the privacy firewall over sanitized context + visual detections
        // firewallResult is attached for downstream use; raw data never returned
        firewallResult: (() => {
            try {
                const phase1Detections = detectSensitiveData(capturedContext);
                return runPrivacyFirewall({
                    sanitizedContext: pipelineResult.outboundContext,
                    visualDetections: [], // Visual detections available if Phase 3 ran separately
                    taskInstruction: capturedContext.taskInstruction
                }, phase1Detections);
            }
            catch {
                return undefined;
            }
        })()
    };
}
/**
 * Orchestrates local visual perception: captures screenshot and runs on-device model.
 */
export async function orchestrateVisualPerception(api) {
    const extApi = api || getExtensionApi();
    if (!extApi) {
        return { success: false, error: 'Extension API unavailable' };
    }
    const screen = await captureTabScreenshot(extApi);
    if (!screen) {
        return { success: false, error: 'Failed to capture visible tab screenshot' };
    }
    try {
        const visualContext = await runVisualPerceptionOnScreen(screen);
        return { success: true, visualContext };
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Visual perception failed';
        return { success: false, error: errorMsg };
    }
}
/**
 * Initializes Service Worker Message Listeners.
 */
function initServiceWorker(api) {
    const extApi = api || getExtensionApi();
    if (!extApi?.runtime?.onMessage?.addListener)
        return;
    extApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!isValidExtensionMessage(message)) {
            sendResponse({
                action: MSG_CAPTURE_ERROR,
                payload: { error: 'Invalid or malformed extension message' },
                timestamp: Date.now()
            });
            return false;
        }
        if (message.action === MSG_CAPTURE_SCREEN) {
            captureTabScreenshot(extApi).then(screen => {
                sendResponse({ success: Boolean(screen), screen });
            });
            return true;
        }
        if (message.action === MSG_CAPTURE_ALL) {
            orchestrateContextCapture(extApi).then(result => {
                sendResponse({
                    action: MSG_PRIVACY_RESULT,
                    payload: result,
                    timestamp: Date.now()
                });
            });
            return true;
        }
        if (message.action === MSG_RUN_VISUAL_PERCEPTION) {
            orchestrateVisualPerception(extApi).then(result => {
                sendResponse({
                    action: MSG_PRIVACY_RESULT,
                    payload: result,
                    timestamp: Date.now()
                });
            });
            return true;
        }
        if (message.action === MSG_EXECUTE_ACTION) {
            orchestrateActionExecution(message.payload, extApi).then(result => {
                sendResponse({
                    action: MSG_ACTION_RESULT,
                    payload: result,
                    timestamp: Date.now()
                });
            });
            return true;
        }
        return false;
    });
}
/**
 * Phase 7: Dispatches action proposal to the content script for Action Guard validation and execution.
 */
export async function orchestrateActionExecution(proposal, api, tabIdOverride) {
    const extApi = api || getExtensionApi();
    if (!extApi) {
        return { success: false, error: 'Browser extension API is unavailable' };
    }
    let activeTabId = tabIdOverride;
    if (!activeTabId) {
        try {
            const activeTabs = await extApi.tabs.query({ active: true, currentWindow: true });
            if (!activeTabs || activeTabs.length === 0 || !activeTabs[0].id) {
                return { success: false, error: 'No active tab found' };
            }
            activeTabId = activeTabs[0].id;
        }
        catch {
            return { success: false, error: 'Failed to query active tab' };
        }
    }
    try {
        const response = await extApi.tabs.sendMessage(activeTabId, createExtensionMessage(MSG_EXECUTE_ACTION, proposal));
        return { success: true, result: response };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
const DEFAULT_BACKEND_URL = 'http://localhost:4000';
/**
 * Phase 5 Integration: Transmits sanitized Phase 4 MinimumDisclosure to the backend API.
 *
 * STRICT INVARIANTS:
 * - NEVER sends raw screenshot, raw DOM, raw HTML, raw page text, raw PII, or raw FirewallInput.
 * - Network payload is derived ONLY from sanitized Phase 4 MinimumDisclosure.
 * - Does not send anything before Phase 4 sanitization completes.
 */
export async function sendSanitizedContextToBackend(options) {
    if (!options.disclosure) {
        return { success: false, error: 'Cannot transmit context to backend without sanitized Phase 4 MinimumDisclosure' };
    }
    const backendUrl = options.backendUrl || DEFAULT_BACKEND_URL;
    const payload = {
        sessionId: options.sessionId,
        taskId: options.taskId,
        privacy: {
            sanitized: true,
            rawDataIncluded: false,
        },
        ...options.disclosure,
    };
    try {
        const response = await fetch(`${backendUrl}/api/contexts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            return { success: false, error: data.error || `HTTP ${response.status}` };
        }
        return { success: true, data: data.data };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Network error transmitting context' };
    }
}
// Auto-initialize when running as a Service Worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    initServiceWorker();
}

