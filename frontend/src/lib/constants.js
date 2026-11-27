/**
 * Domain constants, styling dictionaries, and business rule helpers for ReturnDesk UI.
 */

export const REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
};

export const STATUS_CONFIG = {
  [REQUEST_STATUS.OPEN]: {
    label: 'Open',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20',
    dotClass: 'bg-blue-500',
    description: 'Fresh request awaiting support agent review',
  },
  [REQUEST_STATUS.IN_REVIEW]: {
    label: 'In Review',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/20',
    dotClass: 'bg-amber-500',
    description: 'Actively being reviewed and verified by support',
  },
  [REQUEST_STATUS.APPROVED]: {
    label: 'Approved',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
    dotClass: 'bg-emerald-500',
    description: 'Approved with specified resolution',
  },
  [REQUEST_STATUS.REJECTED]: {
    label: 'Rejected',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20',
    dotClass: 'bg-rose-500',
    description: 'Closed without resolution (terminal)',
  },
  [REQUEST_STATUS.COMPLETED]: {
    label: 'Completed',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-600/20',
    dotClass: 'bg-purple-500',
    description: 'Resolution fulfilled and closed (terminal)',
  },
};

export const RETURN_REASONS = {
  DAMAGED: { label: 'Damaged' },
  WRONG_ITEM: { label: 'Wrong Item' },
  SIZE_ISSUE: { label: 'Size Issue' },
  NOT_AS_DESCRIBED: { label: 'Not As Described' },
  CHANGED_MIND: { label: 'Changed Mind' },
};

export const RESOLUTION_TYPES = {
  REFUND: { label: 'Refund' },
  REPLACEMENT: { label: 'Replacement' },
  STORE_CREDIT: { label: 'Store Credit' },
};

/**
 * Rule 1: Legal lifecycle transitions
 * Used to ensure only legal actions are offered in the UI.
 */
export const ALLOWED_TRANSITIONS = {
  [REQUEST_STATUS.OPEN]: [REQUEST_STATUS.IN_REVIEW],
  [REQUEST_STATUS.IN_REVIEW]: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED],
  [REQUEST_STATUS.APPROVED]: [REQUEST_STATUS.COMPLETED],
  [REQUEST_STATUS.REJECTED]: [],
  [REQUEST_STATUS.COMPLETED]: [],
};

/**
 * Rule 4: Records in these statuses cannot edit customer or item details
 */
export const DECIDED_STATUSES = [
  REQUEST_STATUS.APPROVED,
  REQUEST_STATUS.REJECTED,
  REQUEST_STATUS.COMPLETED,
];

export function isRecordLocked(status) {
  return DECIDED_STATUSES.includes(status);
}

/**
 * Rule 5: Only requests in Open or Rejected may be removed from the desk
 */
export const REMOVABLE_STATUSES = [REQUEST_STATUS.OPEN, REQUEST_STATUS.REJECTED];

export function canRemoveRequest(status) {
  return REMOVABLE_STATUSES.includes(status);
}

export function isTerminalStatus(status) {
  return [REQUEST_STATUS.REJECTED, REQUEST_STATUS.COMPLETED].includes(status);
}
