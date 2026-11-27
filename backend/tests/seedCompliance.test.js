const assert = require('assert');
const { SEED_REQUESTS } = require('../prisma/seed');
const {
  REQUEST_STATUS,
  RETURN_REASON,
  RESOLUTION_TYPE,
  validateApprovalResolution,
  isLiveRequest,
  canBeRemoved,
} = require('../src/lib/businessRules');
const { isValidReference } = require('../src/lib/reference');

console.log('--- RUNNING DATABASE SEED DATA COMPLIANCE TESTS ---');

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

// 1. Minimum count requirement
it('contains at least 30 return requests', () => {
  assert.ok(
    SEED_REQUESTS.length >= 30,
    `Expected at least 30 requests, found ${SEED_REQUESTS.length}`
  );
});

// 2. Status coverage
it('covers every lifecycle status (OPEN, IN_REVIEW, APPROVED, REJECTED, COMPLETED)', () => {
  const presentStatuses = new Set(SEED_REQUESTS.map((r) => r.status));
  Object.values(REQUEST_STATUS).forEach((status) => {
    assert.ok(
      presentStatuses.has(status),
      `Status '${status}' is missing from the seed dataset`
    );
  });
});

// 3. Reason coverage
it('covers every return reason (DAMAGED, WRONG_ITEM, SIZE_ISSUE, NOT_AS_DESCRIBED, CHANGED_MIND)', () => {
  const presentReasons = new Set(SEED_REQUESTS.map((r) => r.reason));
  Object.values(RETURN_REASON).forEach((reason) => {
    assert.ok(
      presentReasons.has(reason),
      `Reason '${reason}' is missing from the seed dataset`
    );
  });
});

// 4. Approval resolution compliance (Rule 2)
it('all APPROVED requests strictly comply with Rule 2 resolution logic', () => {
  const approved = SEED_REQUESTS.filter((r) => r.status === REQUEST_STATUS.APPROVED);
  assert.ok(approved.length >= 3, 'Expected multiple approved requests');

  const resolutionsFound = new Set();
  approved.forEach((req) => {
    resolutionsFound.add(req.resolution);
    assert.doesNotThrow(() => {
      validateApprovalResolution(req.resolution, req.refundAmount);
    });
  });

  Object.values(RESOLUTION_TYPE).forEach((res) => {
    assert.ok(
      resolutionsFound.has(res),
      `Resolution '${res}' missing from approved seed records`
    );
  });
});

// 5. Reference uniqueness & format
it('every request has a unique and valid human-readable reference', () => {
  const refs = new Set();
  SEED_REQUESTS.forEach((req) => {
    assert.ok(
      isValidReference(req.reference),
      `Reference '${req.reference}' does not match standard RET-YYYYMM-XXXXX format`
    );
    assert.strictEqual(
      refs.has(req.reference),
      false,
      `Duplicate reference found: ${req.reference}`
    );
    refs.add(req.reference);
  });
});

// 6. Rule 3: No duplicate live requests per order and item
it('no customer has duplicate live requests for the same item on the same order', () => {
  const liveOrderItems = new Set();
  SEED_REQUESTS.forEach((req) => {
    if (isLiveRequest(req)) {
      const key = `${req.orderId}::${req.itemId}`;
      assert.strictEqual(
        liveOrderItems.has(key),
        false,
        `Duplicate live request found in seed data for order ${req.orderId} and item ${req.itemId}`
      );
      liveOrderItems.add(key);
    }
  });
});

// 7. Rule 5: Non-destructive removal representation
it('includes soft-removed requests adhering to Rule 5 statuses (OPEN or REJECTED)', () => {
  const removed = SEED_REQUESTS.filter((r) => r.isRemoved === true);
  assert.ok(removed.length >= 2, 'Expected soft-removed examples in seed data');
  removed.forEach((req) => {
    assert.ok(
      ['OPEN', 'REJECTED'].includes(req.status),
      `Removed request has invalid status '${req.status}'`
    );
    assert.ok(req.removedAt instanceof Date, 'removedAt date must be set');
  });
});

// 8. Notes presence
it('notes are present across multiple requests with chronological ordering', () => {
  const requestsWithNotes = SEED_REQUESTS.filter((r) => r.notes && r.notes.length > 0);
  assert.ok(
    requestsWithNotes.length >= 10,
    `Expected at least 10 requests with notes, found ${requestsWithNotes.length}`
  );

  requestsWithNotes.forEach((req) => {
    if (req.notes.length > 1) {
      for (let i = 1; i < req.notes.length; i++) {
        assert.ok(
          req.notes[i].createdAt >= req.notes[i - 1].createdAt,
          `Notes for ${req.reference} are not in chronological order`
        );
      }
    }
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL SEED COMPLIANCE TESTS PASSED! 🚀');
}
