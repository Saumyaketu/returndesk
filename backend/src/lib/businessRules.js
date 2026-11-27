const { UnprocessableEntityError, ConflictError } = require('./errors');

/**
 * Valid Enums matching Prisma Schema
 */
const REQUEST_STATUS = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
};

const RETURN_REASON = {
  DAMAGED: 'DAMAGED',
  WRONG_ITEM: 'WRONG_ITEM',
  SIZE_ISSUE: 'SIZE_ISSUE',
  NOT_AS_DESCRIBED: 'NOT_AS_DESCRIBED',
  CHANGED_MIND: 'CHANGED_MIND',
};

const RESOLUTION_TYPE = {
  REFUND: 'REFUND',
  REPLACEMENT: 'REPLACEMENT',
  STORE_CREDIT: 'STORE_CREDIT',
};

/**
 * RULE 1: Fixed Status Flow Lifecycle
 * Open -> In Review -> Approved -> Completed
 *                   -> Rejected
 * Rejected and Completed are final.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  [REQUEST_STATUS.OPEN]: [REQUEST_STATUS.IN_REVIEW],
  [REQUEST_STATUS.IN_REVIEW]: [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED],
  [REQUEST_STATUS.APPROVED]: [REQUEST_STATUS.COMPLETED],
  [REQUEST_STATUS.REJECTED]: [], // Terminal state
  [REQUEST_STATUS.COMPLETED]: [], // Terminal state
};

/**
 * Terminal statuses from which no transitions are permitted
 */
const TERMINAL_STATUSES = [REQUEST_STATUS.REJECTED, REQUEST_STATUS.COMPLETED];

/**
 * Decided statuses where customer and item details become locked from edits (Rule 4)
 */
const DECIDED_STATUSES = [
  REQUEST_STATUS.APPROVED,
  REQUEST_STATUS.REJECTED,
  REQUEST_STATUS.COMPLETED,
];

/**
 * Statuses from which a request may be removed from the desk (Rule 5)
 */
const REMOVABLE_STATUSES = [REQUEST_STATUS.OPEN, REQUEST_STATUS.REJECTED];

/**
 * Fields that become locked once a request is decided (Rule 4)
 */
const LOCKED_FIELDS = [
  'customerName',
  'customerEmail',
  'customerPhone',
  'orderId',
  'itemId',
  'itemQuantity',
  'reason',
];

/**
 * Validate a proposed status transition according to Rule 1 and Rule 2
 */
function validateStatusTransition(currentStatus, targetStatus, resolutionPayload = {}) {
  // Check if current status is terminal
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    throw new UnprocessableEntityError(
      `Cannot transition from terminal status '${currentStatus}'. No further status changes are allowed.`,
      'TERMINAL_STATUS_LOCKED',
      { currentStatus, targetStatus }
    );
  }

  // Check if transition is legal
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new UnprocessableEntityError(
      `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions from '${currentStatus}' are: ${allowed.length > 0 ? allowed.join(', ') : 'none'}.`,
      'INVALID_STATUS_TRANSITION',
      { currentStatus, targetStatus, allowedTransitions: allowed }
    );
  }

  // RULE 2: Approval needs a resolution
  if (targetStatus === REQUEST_STATUS.APPROVED) {
    const { resolution, refundAmount } = resolutionPayload;
    validateApprovalResolution(resolution, refundAmount);
  }
}

/**
 * Validate Approval Resolution (Rule 2)
 * - Must have resolution: REFUND, REPLACEMENT, or STORE_CREDIT
 * - If REFUND: refundAmount > 0 is required
 * - If not REFUND: refundAmount must not be set
 */
function validateApprovalResolution(resolution, refundAmount) {
  if (!resolution) {
    throw new UnprocessableEntityError(
      'An approved request requires a resolution of REFUND, REPLACEMENT, or STORE_CREDIT.',
      'RESOLUTION_REQUIRED',
      { allowedResolutions: Object.values(RESOLUTION_TYPE) }
    );
  }

  if (!Object.values(RESOLUTION_TYPE).includes(resolution)) {
    throw new UnprocessableEntityError(
      `Invalid resolution type '${resolution}'. Allowed: ${Object.values(RESOLUTION_TYPE).join(', ')}.`,
      'INVALID_RESOLUTION_TYPE'
    );
  }

  const parsedAmount = refundAmount !== undefined && refundAmount !== null ? Number(refundAmount) : null;

  if (resolution === RESOLUTION_TYPE.REFUND) {
    if (parsedAmount === null || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new UnprocessableEntityError(
        'A refund resolution requires a refund amount greater than zero.',
        'INVALID_REFUND_AMOUNT',
        { refundAmount }
      );
    }
  } else {
    // Resolution is REPLACEMENT or STORE_CREDIT
    if (parsedAmount !== null && parsedAmount > 0) {
      throw new UnprocessableEntityError(
        `A refund amount cannot be recorded for resolution '${resolution}'. Refund amount is only permitted when resolution is REFUND.`,
        'REFUND_AMOUNT_NOT_PERMITTED',
        { resolution, refundAmount }
      );
    }
  }
}

/**
 * RULE 3: One live request per item
 * Checks if a request is considered "live"
 */
function isLiveRequest(request) {
  return !TERMINAL_STATUSES.includes(request.status) && !request.isRemoved;
}

/**
 * Build Prisma where clause to check for existing active duplicate request (Rule 3)
 */
function getActiveDuplicateFilter(orderId, itemId, excludeRequestId = null) {
  const filter = {
    orderId: String(orderId).trim(),
    itemId: String(itemId).trim(),
    status: { notIn: TERMINAL_STATUSES },
    isRemoved: false,
  };

  if (excludeRequestId) {
    filter.id = { not: excludeRequestId };
  }

  return filter;
}

/**
 * RULE 4: Locked once decided
 * Once reached Approved, Rejected, or Completed, customer and item details cannot be edited.
 * Notes can still be added.
 */
function validateRecordUpdate(currentRequest, updatePayload) {
  if (DECIDED_STATUSES.includes(currentRequest.status)) {
    const attemptedFields = Object.keys(updatePayload).filter((field) =>
      LOCKED_FIELDS.includes(field)
    );

    if (attemptedFields.length > 0) {
      throw new UnprocessableEntityError(
        `Request details cannot be edited once decided (status: '${currentRequest.status}'). Attempted to edit locked fields: ${attemptedFields.join(', ')}. Notes may still be added.`,
        'RECORD_LOCKED',
        {
          status: currentRequest.status,
          attemptedFields,
          lockedFields: LOCKED_FIELDS,
        }
      );
    }
  }
}

/**
 * RULE 5: Non-Destructive Removal
 * Only requests that are Open or Rejected may be removed; anything else must be refused.
 */
function validateRemoval(request) {
  if (!REMOVABLE_STATUSES.includes(request.status)) {
    throw new UnprocessableEntityError(
      `Cannot remove request in status '${request.status}'. Only requests that are OPEN or REJECTED may be taken off the desk.`,
      'REMOVAL_NOT_ALLOWED',
      {
        currentStatus: request.status,
        allowedStatuses: REMOVABLE_STATUSES,
      }
    );
  }

  if (request.isRemoved) {
    throw new UnprocessableEntityError(
      'This request has already been removed from the desk.',
      'ALREADY_REMOVED'
    );
  }
}

module.exports = {
  REQUEST_STATUS,
  RETURN_REASON,
  RESOLUTION_TYPE,
  ALLOWED_STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  DECIDED_STATUSES,
  REMOVABLE_STATUSES,
  LOCKED_FIELDS,
  validateStatusTransition,
  validateApprovalResolution,
  isLiveRequest,
  getActiveDuplicateFilter,
  validateRecordUpdate,
  validateRemoval,
};
