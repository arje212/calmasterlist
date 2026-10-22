import React from 'react';
import { cn } from '@/lib/utils';
export const InputOTP = ({ value = '', onChange, maxLength = 6, children, ...props }) => <div className="flex" {...props}>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { value, onChange, maxLength }) : child)}</div>;
export const InputOTPGroup = ({ children }) => <div className="flex">{children}</div>;
export const InputOTPSlot = ({ index, value = '', onChange, maxLength }) => <input aria-label={`Digit ${index + 1}`} maxLength={1} value={value[index] || ''} onChange={(event) => { const next = value.split(''); next[index] = event.target.value.slice(-1); onChange(next.join('').slice(0, maxLength)); }} className={cn('h-12 w-10 border-y border-l text-center text-lg first:rounded-l-md last:rounded-r-md last:border-r focus:outline-none focus:ring-2 focus:ring-ring')} />;
