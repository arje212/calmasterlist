import React from 'react';
import { colorOf, initialsOf } from '@/lib/tasks';

export default function Avatar({ person, size = 26, ring = true }) {
  const label = person?.name || person?.email || 'Unassigned';
  return (
    <span
      title={label}
      className={`inline-flex flex-none items-center justify-center rounded-full font-bold text-white ${ring ? 'border-2 border-white' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: person ? colorOf(person.email) : '#94a3b8' }}
    >
      {person ? initialsOf(label) : '?'}
    </span>
  );
}
