'use client';

import React from 'react';
import { STATUS_CONFIG } from '../lib/constants';

/**
 * StatusBadge Component
 * 
 * Requirement:
 * "Status must be immediately readable at a glance in the list."
 * Features accessible color-coding, border contrast, and status dot indicator.
 */
export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Unknown',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/20',
    dotClass: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs ${config.badgeClass} ${className}`}
      title={config.description || config.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
