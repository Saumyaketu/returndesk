const assert = require('assert');
const {
  REQUEST_STATUS,
  RESOLUTION_TYPE,
  validateStatusTransition,
  validateApprovalResolution,
  isLiveRequest,
  getActiveDuplicateFilter,
  validateRecordUpdate,
  validateRemoval,
} = require('../src/lib/businessRules');
const { generateReference, isValidReference } = require('../src/lib/reference');
const { AppError, UnprocessableEntityError } = require('../src/lib/errors');

console.log('--- RUNNING BUSINESS RULES & DOMAIN UNIT TESTS ---');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------
// RULE 1: Status Flow Lifecycle
// ----------------------------------------------------
console.log('\n[Rule 1] Status Flow Tests:');

it('allows OPEN -> IN_REVIEW', () => {
  assert.doesNotThrow(() => {
    validateStatusTransition(REQUEST_STATUS.OPEN, REQUEST_STATUS.IN_REVIEW);
  });
});

it('allows IN_REVIEW -> REJECTED', () => {
  assert.doesNotThrow(() => {
    validateStatusTransition(REQUEST_STATUS.IN_REVIEW, REQUEST_STATUS.REJECTED);
  });
});

it('allows IN_REVIEW -> APPROVED with valid resolution', () => {
  assert.doesNotThrow(() => {
    validateStatusTransition(REQUEST_STATUS.IN_REVIEW, REQUEST_STATUS.APPROVED, {
      resolution: RESOLUTION_TYPE.STORE_CREDIT,
    });
  });
});

it('allows APPROVED -> COMPLETED', () => {
  assert.doesNotThrow(() => {
    validateStatusTransition(REQUEST_STATUS.APPROVED, REQUEST_STATUS.COMPLETED);
  });
});

it('refuses illegal transition OPEN -> COMPLETED (skip)', () => {
  assert.throws(
    () => {
      validateStatusTransition(REQUEST_STATUS.OPEN, REQUEST_STATUS.COMPLETED);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'INVALID_STATUS_TRANSITION' && err.statusCode === 422
  );
});

it('refuses illegal transition OPEN -> APPROVED (skip)', () => {
  assert.throws(
    () => {
      validateStatusTransition(REQUEST_STATUS.OPEN, REQUEST_STATUS.APPROVED, {
        resolution: RESOLUTION_TYPE.REFUND,
        refundAmount: 50,
      });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'INVALID_STATUS_TRANSITION'
  );
});

it('refuses moving out of terminal status REJECTED', () => {
  assert.throws(
    () => {
      validateStatusTransition(REQUEST_STATUS.REJECTED, REQUEST_STATUS.OPEN);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'TERMINAL_STATUS_LOCKED'
  );
});

it('refuses moving out of terminal status COMPLETED', () => {
  assert.throws(
    () => {
      validateStatusTransition(REQUEST_STATUS.COMPLETED, REQUEST_STATUS.OPEN);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'TERMINAL_STATUS_LOCKED'
  );
});

// ----------------------------------------------------
// RULE 2: Approval Needs a Resolution
// ----------------------------------------------------
console.log('\n[Rule 2] Approval Resolution Tests:');

it('refuses APPROVED without resolution', () => {
  assert.throws(
    () => {
      validateApprovalResolution(null, null);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'RESOLUTION_REQUIRED'
  );
});

it('accepts APPROVED with REFUND and amount > 0', () => {
  assert.doesNotThrow(() => {
    validateApprovalResolution(RESOLUTION_TYPE.REFUND, 49.99);
  });
});

it('refuses APPROVED with REFUND and amount <= 0', () => {
  assert.throws(
    () => {
      validateApprovalResolution(RESOLUTION_TYPE.REFUND, 0);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'INVALID_REFUND_AMOUNT'
  );
});

it('refuses APPROVED with REFUND and missing amount', () => {
  assert.throws(
    () => {
      validateApprovalResolution(RESOLUTION_TYPE.REFUND, null);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'INVALID_REFUND_AMOUNT'
  );
});

it('accepts APPROVED with REPLACEMENT and no refund amount', () => {
  assert.doesNotThrow(() => {
    validateApprovalResolution(RESOLUTION_TYPE.REPLACEMENT, null);
  });
});

it('refuses APPROVED with REPLACEMENT when refund amount is provided', () => {
  assert.throws(
    () => {
      validateApprovalResolution(RESOLUTION_TYPE.REPLACEMENT, 25.00);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'REFUND_AMOUNT_NOT_PERMITTED'
  );
});

it('accepts APPROVED with STORE_CREDIT and no refund amount', () => {
  assert.doesNotThrow(() => {
    validateApprovalResolution(RESOLUTION_TYPE.STORE_CREDIT, null);
  });
});

it('refuses APPROVED with STORE_CREDIT when refund amount is provided', () => {
  assert.throws(
    () => {
      validateApprovalResolution(RESOLUTION_TYPE.STORE_CREDIT, 100);
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'REFUND_AMOUNT_NOT_PERMITTED'
  );
});

// ----------------------------------------------------
// RULE 3: One Live Request Per Item
// ----------------------------------------------------
console.log('\n[Rule 3] Live Request & Duplicate Filter Tests:');

it('identifies OPEN, IN_REVIEW, APPROVED as live requests', () => {
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.OPEN, isRemoved: false }), true);
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.IN_REVIEW, isRemoved: false }), true);
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.APPROVED, isRemoved: false }), true);
});

it('identifies REJECTED and COMPLETED as not live', () => {
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.REJECTED, isRemoved: false }), false);
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.COMPLETED, isRemoved: false }), false);
});

it('identifies soft-removed request as not live', () => {
  assert.strictEqual(isLiveRequest({ status: REQUEST_STATUS.OPEN, isRemoved: true }), false);
});

it('builds correct database query filter for duplicate check', () => {
  const filter = getActiveDuplicateFilter('ORD-1001', 'ITEM-555');
  assert.deepStrictEqual(filter.status, { notIn: ['REJECTED', 'COMPLETED'] });
  assert.strictEqual(filter.isRemoved, false);
  assert.strictEqual(filter.orderId, 'ORD-1001');
  assert.strictEqual(filter.itemId, 'ITEM-555');
});

// ----------------------------------------------------
// RULE 4: Locked Once Decided
// ----------------------------------------------------
console.log('\n[Rule 4] Record Immutability (Locked Once Decided) Tests:');

it('allows editing customer/item fields on OPEN request', () => {
  assert.doesNotThrow(() => {
    validateRecordUpdate({ status: REQUEST_STATUS.OPEN }, { customerName: 'Jane Doe', itemQuantity: 2 });
  });
});

it('allows editing customer/item fields on IN_REVIEW request', () => {
  assert.doesNotThrow(() => {
    validateRecordUpdate({ status: REQUEST_STATUS.IN_REVIEW }, { reason: 'SIZE_ISSUE' });
  });
});

it('refuses editing customer/item fields on APPROVED request', () => {
  assert.throws(
    () => {
      validateRecordUpdate({ status: REQUEST_STATUS.APPROVED }, { customerName: 'New Name' });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'RECORD_LOCKED'
  );
});

it('refuses editing customer/item fields on REJECTED request', () => {
  assert.throws(
    () => {
      validateRecordUpdate({ status: REQUEST_STATUS.REJECTED }, { itemQuantity: 3 });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'RECORD_LOCKED'
  );
});

it('refuses editing customer/item fields on COMPLETED request', () => {
  assert.throws(
    () => {
      validateRecordUpdate({ status: REQUEST_STATUS.COMPLETED }, { orderId: 'ORD-999' });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'RECORD_LOCKED'
  );
});

// ----------------------------------------------------
// RULE 5: Non-Destructive Removal
// ----------------------------------------------------
console.log('\n[Rule 5] Removal Validation Tests:');

it('allows removal of OPEN request', () => {
  assert.doesNotThrow(() => {
    validateRemoval({ status: REQUEST_STATUS.OPEN, isRemoved: false });
  });
});

it('allows removal of REJECTED request', () => {
  assert.doesNotThrow(() => {
    validateRemoval({ status: REQUEST_STATUS.REJECTED, isRemoved: false });
  });
});

it('refuses removal of IN_REVIEW request', () => {
  assert.throws(
    () => {
      validateRemoval({ status: REQUEST_STATUS.IN_REVIEW, isRemoved: false });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'REMOVAL_NOT_ALLOWED'
  );
});

it('refuses removal of APPROVED request', () => {
  assert.throws(
    () => {
      validateRemoval({ status: REQUEST_STATUS.APPROVED, isRemoved: false });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'REMOVAL_NOT_ALLOWED'
  );
});

it('refuses removal of COMPLETED request', () => {
  assert.throws(
    () => {
      validateRemoval({ status: REQUEST_STATUS.COMPLETED, isRemoved: false });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'REMOVAL_NOT_ALLOWED'
  );
});

it('refuses removal if already removed', () => {
  assert.throws(
    () => {
      validateRemoval({ status: REQUEST_STATUS.OPEN, isRemoved: true });
    },
    (err) => err instanceof UnprocessableEntityError && err.code === 'ALREADY_REMOVED'
  );
});

// ----------------------------------------------------
// Reference Generator
// ----------------------------------------------------
console.log('\n[Reference Generator] Format & Uniqueness Tests:');

it('generates references matching human-readable RET-YYYYMM-XXXXX format', () => {
  const ref = generateReference();
  assert.strictEqual(isValidReference(ref), true);
  assert.match(ref, /^RET-\d{6}-[2-9A-HJ-NP-Z]{5}$/);
});

it('generates unique references across 500 samples', () => {
  const set = new Set();
  for (let i = 0; i < 500; i++) {
    const ref = generateReference();
    assert.strictEqual(set.has(ref), false, `Collision detected for ${ref}`);
    set.add(ref);
  }
  assert.strictEqual(set.size, 500);
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL BUSINESS RULES TESTS PASSED SUCCESSFULLY! 🚀');
}
