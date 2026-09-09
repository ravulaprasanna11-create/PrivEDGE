/**
 * PRIVEDGE Phase 2: Browser Extension - Accessibility Context Collector
 * SIH26171: On-device Visual Perception for Light-weight Browser Agents (ISRO)
 * 
 * Lightweight browser-native accessibility context extractor.
 * Helps browser agents understand element semantics and accessible names without heavy dependencies.
 */

import type { AccessibilityContext } from '../shared/types';

/**
 * Derives the associated label text for an element, either via <label for="id">
 * or from an ancestor <label>.
 */
export function findAssociatedLabelText(element: Element): string | undefined {
  const doc = element.ownerDocument;
  if (!doc) return undefined;

  // 1. Check <label for="elementId">
  if (element.id) {
    try {
      const explicitLabel = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (explicitLabel && explicitLabel.textContent) {
        return explicitLabel.textContent.trim();
      }
    } catch {
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
export function resolveIdRefText(element: Element, attrName: string): string | undefined {
  const refIds = element.getAttribute(attrName);
  if (!refIds || !element.ownerDocument) return undefined;

  const parts: string[] = [];
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
export function inferImplicitRole(element: Element): string | undefined {
  const tag = element.tagName.toLowerCase();
  const type = element.getAttribute('type')?.toLowerCase();

  switch (tag) {
    case 'button':
      return 'button';
    case 'a':
      return element.hasAttribute('href') ? 'link' : undefined;
    case 'input':
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
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
export function extractAccessibilityContext(element: Element): AccessibilityContext {
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
    } else {
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
