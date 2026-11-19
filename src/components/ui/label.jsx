import React, { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

const CONTROL = 'input:not([type="hidden"]),textarea,select,button[aria-haspopup]';

// If a <Label> has no htmlFor, link it to the control that directly follows it (Input, Textarea, Select trigger).
// This makes clicking the label focus the field and gives screen readers a real field name.
export const Label = React.forwardRef(({ className, htmlFor, ...props }, ref) => {
  const inner = useRef(null);
  const autoId = useId();
  const setRef = (node) => { inner.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; };
  useEffect(() => {
    const el = inner.current;
    if (htmlFor || !el) return;
    let sibling = el.nextElementSibling;
    let target = null;
    for (let hops = 0; sibling && !target && hops < 2; hops += 1) {
      if (sibling.tagName === 'LABEL') break;
      target = sibling.matches(CONTROL) ? sibling : sibling.querySelector(CONTROL);
      sibling = sibling.nextElementSibling;
    }
    if (!target || target.labels?.length || target.hasAttribute('aria-label') || target.hasAttribute('aria-labelledby')) return;
    if (!target.id) target.id = `field-${autoId}`;
    el.htmlFor = target.id;
  });
  return <label ref={setRef} htmlFor={htmlFor} className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />;
});
Label.displayName = 'Label';
