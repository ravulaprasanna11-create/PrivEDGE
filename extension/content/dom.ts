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

import type { BrowserContext, BrowserElement } from '../shared/types';
import { extractAccessibilityContext } from './accessibility';

/**
 * Lightweight check for element visibility.
 */
export function isElementVisible(element: HTMLElement, win?: Window): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const activeWin = win || (element.ownerDocument ? element.ownerDocument.defaultView : undefined);

  if (activeWin && typeof activeWin.getComputedStyle === 'function') {
    try {
      const style = activeWin.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch {
      // Ignore computed style errors in test environments
    }
  }

  if (typeof element.getBoundingClientRect === 'function') {
    try {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }
    } catch {
      // Ignore bounding rect failures in test mocks
    }
  }

  return true;
}

/**
 * Generates a stable, concise CSS selector for agent targeting.
 */
export function generateElementSelector(element: Element): string {
  if (element.id) {
    try {
      return `#${CSS.escape(element.id)}`;
    } catch {
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
export function extractSurroundingText(element: Element, maxChars = 120): string | undefined {
  const parent = element.parentElement;
  if (!parent) return undefined;

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
  if (!surrounding) return undefined;

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
export function collectDOMContext(
  doc: Document = (typeof document !== 'undefined' ? document : null) as unknown as Document,
  win: Window = (typeof window !== 'undefined' ? window : null) as unknown as Window
): BrowserContext {
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
  const browserElements: BrowserElement[] = [];

  for (const el of matchedElements) {
    const htmlEl = el as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const type = el.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : undefined);
    const name = el.getAttribute('name') || undefined;
    const rawId = el.id || undefined;
    const placeholder = el.getAttribute('placeholder') || undefined;
    const autocomplete = el.getAttribute('autocomplete') || undefined;

    // Read current input value locally for Phase 1 inspection
    let value: string | undefined;
    if ('value' in htmlEl && typeof (htmlEl as HTMLInputElement).value === 'string') {
      value = (htmlEl as HTMLInputElement).value;
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

    const browserElement: BrowserElement = {
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
      try { htmlEl.setAttribute('data-prv-id', browserElement.id); } catch {}
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
