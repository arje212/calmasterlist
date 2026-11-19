import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack = [];

export function getFocusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true');
}

// Shared behaviour for modal surfaces (Dialog, Sheet):
// Escape closes the top-most modal, Tab is trapped inside, focus moves in on open and returns to the opener on close,
// and the page behind does not scroll. Add data-autofocus to an element to choose where focus lands first.
export function useModal(open, onClose, containerRef) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    stack.push(token);
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = containerRef.current;
    const first = node?.querySelector('[data-autofocus]') || getFocusable(node)[0] || node;
    first?.focus?.({ preventScroll: true });

    const onKeyDown = (event) => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current?.(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      const items = getFocusable(container);
      if (!items.length) { event.preventDefault(); container?.focus(); return; }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      const outside = !container.contains(active);
      if (event.shiftKey && (active === firstItem || outside)) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && (active === lastItem || outside)) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      if (previous && document.contains(previous)) previous.focus?.({ preventScroll: true });
    };
  }, [open, containerRef]);
}
