/** PRIVEDGE Browser Agent - Content Script Bundle */
(() => {

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


// --- accessibility.ts ---
/**
 * PRIVEDGE Phase 2: Browser Extension - Accessibility Context Collector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Lightweight browser-native accessibility context extractor.
 * Helps browser agents understand element semantics and accessible names without heavy dependencies.
 */
/**
 * Derives the associated label text for an element, either via <label for="id">
 * or from an ancestor <label>.
 */
function findAssociatedLabelText(element) {
    const doc = element.ownerDocument;
    if (!doc)
        return undefined;
    // 1. Check <label for="elementId">
    if (element.id) {
        try {
            const explicitLabel = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (explicitLabel && explicitLabel.textContent) {
                return explicitLabel.textContent.trim();
            }
        }
        catch {
            // Fallback if selector escape fails
            const labels = doc.getElementsByTagName('label');
            for (let i = 0; i < labels.length; i++) {
                if (labels[i].getAttribute('for') === element.id && labels[i].textContent) {
                    return labels[i].textContent?.trim();
                }
            }
        }
    }
    // 2. Check enclosing ancestor <label>
    const enclosingLabel = element.closest('label');
    if (enclosingLabel && enclosingLabel.textContent) {
        // Clone to remove the input's own text if nested
        const text = enclosingLabel.textContent.trim();
        return text || undefined;
    }
    return undefined;
}
/**
 * Resolves text referenced by ID list (e.g. aria-labelledby or aria-describedby).
 */
function resolveIdRefText(element, attrName) {
    const refIds = element.getAttribute(attrName);
    if (!refIds || !element.ownerDocument)
        return undefined;
    const parts = [];
    const ids = refIds.trim().split(/\s+/);
    for (const id of ids) {
        const refEl = element.ownerDocument.getElementById(id);
        if (refEl && refEl.textContent) {
            parts.push(refEl.textContent.trim());
        }
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
}
/**
 * Infers default implicit accessibility role if explicit role is missing.
 */
function inferImplicitRole(element) {
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    switch (tag) {
        case 'button':
            return 'button';
        case 'a':
            return element.hasAttribute('href') ? 'link' : undefined;
        case 'input':
            if (type === 'button' || type === 'submit' || type === 'reset')
                return 'button';
            if (type === 'checkbox')
                return 'checkbox';
            if (type === 'radio')
                return 'radio';
            return 'textbox';
        case 'textarea':
            return 'textbox';
        case 'select':
            return 'combobox';
        case 'form':
            return 'form';
        case 'nav':
            return 'navigation';
        case 'main':
            return 'main';
        default:
            return undefined;
    }
}
/**
 * Extracts complete accessibility context for a given DOM element.
 */
function extractAccessibilityContext(element) {
    const explicitRole = element.getAttribute('role') || undefined;
    const role = explicitRole || inferImplicitRole(element);
    const ariaLabel = element.getAttribute('aria-label') || undefined;
    const ariaLabelledBy = resolveIdRefText(element, 'aria-labelledby');
    const ariaDescribedBy = resolveIdRefText(element, 'aria-describedby');
    const ariaHidden = element.getAttribute('aria-hidden') === 'true';
    const associatedLabel = findAssociatedLabelText(element);
    // Compute primary accessible name
    let accessibleName = ariaLabel || ariaLabelledBy || associatedLabel;
    if (!accessibleName) {
        const placeholder = element.getAttribute('placeholder');
        const title = element.getAttribute('title');
        const buttonVal = element.getAttribute('value');
        const textContent = element.textContent?.trim();
        if (role === 'button' || element.tagName.toLowerCase() === 'button') {
            accessibleName = buttonVal || textContent || title || placeholder || undefined;
        }
        else {
            accessibleName = placeholder || title || undefined;
        }
    }
    return {
        role,
        ariaLabel,
        ariaLabelledBy,
        ariaDescribedBy,
        ariaHidden,
        associatedLabel,
        accessibleName
    };
}


// --- dom.ts ---
/**
 * PRIVEDGE Phase 2: Browser Extension - DOM Extraction Engine
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Extracts interactive and form context from a webpage into the Phase 1 BrowserContext structure.
 * Assigns stable capture-local identifiers (prv-1, prv-2, ...).
 *
 * STRICT INVARIANTS:
 * - NO collection of cookies, storage, auth tokens, or browser history.
 * - NO full DOM or HTML tree dumping.
 * - Raw sensitive values remain local to the extension pipeline.
 */
/**
 * Lightweight check for element visibility.
 */
function isElementVisible(element, win) {
    if (element.hasAttribute('hidden'))
        return false;
    if (element.getAttribute('aria-hidden') === 'true')
        return false;
    const activeWin = win || (element.ownerDocument ? element.ownerDocument.defaultView : undefined);
    if (activeWin && typeof activeWin.getComputedStyle === 'function') {
        try {
            const style = activeWin.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return false;
            }
        }
        catch {
            // Ignore computed style errors in test environments
        }
    }
    if (typeof element.getBoundingClientRect === 'function') {
        try {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return false;
            }
        }
        catch {
            // Ignore bounding rect failures in test mocks
        }
    }
    return true;
}
/**
 * Generates a stable, concise CSS selector for agent targeting.
 */
function generateElementSelector(element) {
    if (element.id) {
        try {
            return `#${CSS.escape(element.id)}`;
        }
        catch {
            return `#${element.id}`;
        }
    }
    const tag = element.tagName.toLowerCase();
    const name = element.getAttribute('name');
    if (name) {
        return `${tag}[name="${name}"]`;
    }
    const role = element.getAttribute('role');
    if (role) {
        return `${tag}[role="${role}"]`;
    }
    const type = element.getAttribute('type');
    if (type) {
        return `${tag}[type="${type}"]`;
    }
    return tag;
}
/**
 * Extracts concise surrounding text for semantic context.
 */
function extractSurroundingText(element, maxChars = 120) {
    const parent = element.parentElement;
    if (!parent)
        return undefined;
    let surrounding = '';
    // Inspect previous and next sibling text
    const prev = element.previousElementSibling;
    const next = element.nextElementSibling;
    if (prev && prev.textContent) {
        surrounding += prev.textContent.trim() + ' ';
    }
    if (next && next.textContent) {
        surrounding += next.textContent.trim();
    }
    if (!surrounding && parent.textContent) {
        surrounding = parent.textContent.trim();
    }
    surrounding = surrounding.replace(/\s+/g, ' ').trim();
    if (!surrounding)
        return undefined;
    return surrounding.length > maxChars ? surrounding.substring(0, maxChars) + '...' : surrounding;
}
/**
 * Target interactive and form selectors for browser-agent perception.
 */
const INTERACTIVE_SELECTORS = [
    'input:not([type="hidden"])',
    'textarea',
    'select',
    'button',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[tabindex="0"]',
    '[contenteditable="true"]'
].join(', ');
/**
 * Collects structured DOM and accessibility context into a Phase 1 BrowserContext.
 */
function collectDOMContext(doc = (typeof document !== 'undefined' ? document : null), win = (typeof window !== 'undefined' ? window : null)) {
    if (!doc) {
        return {
            page: { url: '', title: '', domain: '' },
            elements: [],
            timestamp: Date.now()
        };
    }
    const url = doc.location?.href || '';
    const title = doc.title || '';
    const domain = doc.location?.hostname || '';
    const matchedElements = doc.querySelectorAll ? Array.from(doc.querySelectorAll(INTERACTIVE_SELECTORS)) : [];
    let counter = 1;
    const browserElements = [];
    for (const el of matchedElements) {
        const htmlEl = el;
        const tagName = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : undefined);
        const name = el.getAttribute('name') || undefined;
        const rawId = el.id || undefined;
        const placeholder = el.getAttribute('placeholder') || undefined;
        const autocomplete = el.getAttribute('autocomplete') || undefined;
        // Read current input value locally for Phase 1 inspection
        let value;
        if ('value' in htmlEl && typeof htmlEl.value === 'string') {
            value = htmlEl.value;
        }
        const isVisible = isElementVisible(htmlEl, win);
        const a11y = extractAccessibilityContext(el);
        const selector = generateElementSelector(el);
        const surroundingText = extractSurroundingText(el);
        // Visible text content
        let text = el.textContent?.trim();
        if (text && text.length > 200) {
            text = text.substring(0, 200) + '...';
        }
        const browserElement = {
            id: `prv-${counter++}`,
            tagName,
            type,
            name,
            selector,
            role: a11y.role,
            ariaLabel: a11y.ariaLabel,
            label: a11y.associatedLabel || a11y.accessibleName,
            placeholder,
            autocomplete,
            value: value || undefined,
            text: text || undefined,
            surroundingText,
            isInteractive: true,
            isVisible
        };
        browserElements.push(browserElement);
        if (typeof htmlEl.setAttribute === 'function') {
            try {
                htmlEl.setAttribute('data-prv-id', browserElement.id);
            }
            catch { }
        }
    }
    return {
        page: {
            url,
            title,
            domain
        },
        elements: browserElements,
        timestamp: Date.now()
    };
}


// --- content.ts ---
/**
 * PRIVEDGE Phase 2: Browser Extension - Content Script Entry Point
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 *
 * Injected into active webpage. Captures DOM and accessibility context on-demand.
 *
 * STRICT INVARIANTS:
 * - Capture occurs ONLY upon explicit extension request (no continuous tracking).
 * - ZERO external network requests.
 * - No data transmitted to third parties or remote endpoints.
 */
function initContentScriptListener() {
    const runtime = typeof chrome !== 'undefined' && chrome.runtime
        ? chrome.runtime
        : typeof browser !== 'undefined' && browser.runtime
            ? browser.runtime
            : null;
    if (!runtime || typeof runtime.onMessage?.addListener !== 'function') {
        return;
    }
    runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!isValidExtensionMessage(message)) {
            sendResponse({ success: false, error: 'Invalid extension message' });
            return false;
        }
        if (message.action === MSG_CAPTURE_CONTEXT) {
            try {
                const context = collectDOMContext(document, window);
                sendResponse({
                    success: true,
                    context,
                    timestamp: Date.now()
                });
            }
            catch (err) {
                sendResponse({
                    success: false,
                    error: 'Failed to extract DOM context from webpage'
                });
            }
            return true; // Keep message channel open for asynchronous response
        }
        if (message.action === MSG_EXECUTE_ACTION) {
            const doc = typeof document !== 'undefined' ? document : undefined;
            const win = typeof window !== 'undefined' ? window : undefined;
            // 1. Local Action Guard gate
            const decision = evaluateActionGuard(message.payload, doc, win);
            if (!decision.approved) {
                sendResponse({
                    success: false,
                    error: decision.reason,
                    decision,
                    timestamp: Date.now(),
                });
                return false;
            }
            // 2. Safe Browser Action Execution
            executeApprovedAction(decision, doc, win)
                .then(result => {
                sendResponse({
                    ...result,
                    decision,
                    timestamp: Date.now(),
                });
            })
                .catch(err => {
                sendResponse({
                    success: false,
                    error: err.message,
                    decision,
                    timestamp: Date.now(),
                });
            });
            return true; // Async response
        }
        return false;
    });
}
// Auto-initialize when loaded in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initContentScriptListener();
}

})();
