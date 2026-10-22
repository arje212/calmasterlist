import React from 'react';

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="h-7 w-7 rounded-full border-2 border-slate-200 border-t-primary animate-spin" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}