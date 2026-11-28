const assert = require('assert');
const http = require('http');
const app = require('../src/server');
const prisma = require('../src/lib/prisma');

/**
 * End-to-End HTTP API Rules & Semantics Test Suite
 * 
 * Verifies all 5 Business Rules directly over real HTTP requests:
 * 1. Status Flow Lifecycle State Machine (skips and terminal transitions refused with 422)
 * 2. Approval Resolution Logic (amount > 0 required for refund; forbidden for other resolutions)
 * 3. One Live Request Per Item (active duplicates refused with 409 Conflict)
 * 4. Locked Once Decided (customer/item edits refused with 422; notes allowed)
 * 5. Non-Destructive Removal (only Open or Rejected removable; 404 on fetch; preserved in DB)
 * + Proper HTTP error status codes and machine-readable JSON bodies.
 */

console.log('--- RUNNING END-TO-END HTTP API BUSINESS RULES SUITE ---');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function runE2ETests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  const createdTestIds = [];

  try {
    // ----------------------------------------------------
    // Section 1: Creation & Auto-Reference Generation
    // ----------------------------------------------------
    console.log('\n[E2E 1] Raising Request & Auto-Reference Generation:');

    let testRequest;
    await test('POST /api/requests generates valid human-readable reference and default OPEN status', async () => {
      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Siddharth Varma',
          customerEmail: 'siddharth.v@example.com',
          orderId: 'ORD-E2E-100',
          itemId: 'ITEM-TEST-CHAIR',
          itemQuantity: 1,
          reason: 'DAMAGED',
          initialNote: 'Unboxed with broken armrest.',
        }),
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      testRequest = body.data;
      createdTestIds.push(testRequest.id);

      assert.strictEqual(testRequest.status, 'OPEN');
      assert.strictEqual(testRequest.customerName, 'Siddharth Varma');
      assert.match(testRequest.reference, /^RET-\d{6}-[2-9A-HJ-NP-Z]{5}$/);
      assert.strictEqual(testRequest.notes.length, 1);
      assert.strictEqual(testRequest.notes[0].content, 'Unboxed with broken armrest.');
    });

    // ----------------------------------------------------
    // Section 2: Rule 1 - Fixed Status Flow State Machine
    // ----------------------------------------------------
    console.log('\n[E2E 2] Rule 1 - Lifecycle State Machine:');

    await test('refuses illegal transition OPEN -> COMPLETED (skip) with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'COMPLETED' }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    await test('refuses illegal transition OPEN -> APPROVED (skip) with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'APPROVED',
          resolution: 'REFUND',
          refundAmount: 50,
        }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    await test('allows legal transition OPEN -> IN_REVIEW with 200', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'IN_REVIEW',
          note: 'Agent began inspection.',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.status, 'IN_REVIEW');
    });

    await test('refuses illegal transition IN_REVIEW -> COMPLETED (skip) with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'COMPLETED' }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    // ----------------------------------------------------
    // Section 3: Rule 2 - Approval Needs Resolution
    // ----------------------------------------------------
    console.log('\n[E2E 3] Rule 2 - Approval Resolution Validation:');

    await test('refuses transition to APPROVED without resolution with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'APPROVED' }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'RESOLUTION_REQUIRED');
    });

    await test('refuses APPROVED with REFUND and zero amount with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'APPROVED',
          resolution: 'REFUND',
          refundAmount: 0,
        }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_REFUND_AMOUNT');
    });

    await test('refuses APPROVED with REPLACEMENT when refund amount is provided with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'APPROVED',
          resolution: 'REPLACEMENT',
          refundAmount: 49.99,
        }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'REFUND_AMOUNT_NOT_PERMITTED');
    });

    await test('allows transition to APPROVED with REFUND and positive amount with 200', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'APPROVED',
          resolution: 'REFUND',
          refundAmount: 49.99,
          note: 'Approved full refund.',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.status, 'APPROVED');
      assert.strictEqual(body.data.resolution, 'REFUND');
      assert.strictEqual(Number(body.data.refundAmount), 49.99);
    });

    await test('allows transition APPROVED -> COMPLETED with 200', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'COMPLETED' }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.status, 'COMPLETED');
    });

    await test('refuses transitioning out of terminal status COMPLETED with 422', async () => {
      const res = await fetch(`${baseUrl}/requests/${testRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'OPEN' }),
      });

      assert.strictEqual(res.status, 422);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'TERMINAL_STATUS_LOCKED');
    });

    // ----------------------------------------------------
    // Section 4: Rule 3 - One Live Request Per Item
    // ----------------------------------------------------
    console.log('\n[E2E 4] Rule 3 - Single Live Request Per Order & Item:');

    let activeOrder1;
    await test('allows raising initial return request for order ORD-DUP-99 item ITEM-X', async () => {
      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Kavita Menon',
          customerEmail: 'kavita@example.com',
          orderId: 'ORD-DUP-99',
          itemId: 'ITEM-X',
          itemQuantity: 1,
          reason: 'SIZE_ISSUE',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      activeOrder1 = body.data;
      createdTestIds.push(activeOrder1.id);
    });

    await test('refuses duplicate live request for same item on same order with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Kavita Menon',
          customerEmail: 'kavita@example.com',
          orderId: 'ORD-DUP-99',
          itemId: 'ITEM-X',
          itemQuantity: 1,
          reason: 'DAMAGED',
        }),
      });

      assert.strictEqual(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'ACTIVE_REQUEST_EXISTS');
      assert.strictEqual(body.error.details.existingReference, activeOrder1.reference);
    });

    await test('allows new request for same order & item once previous reaches REJECTED', async () => {
      // 1. Move active request to IN_REVIEW, then REJECTED
      await fetch(`${baseUrl}/requests/${activeOrder1.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
      });

      await fetch(`${baseUrl}/requests/${activeOrder1.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'REJECTED' }),
      });

      // 2. Now creating another request for ORD-DUP-99 + ITEM-X must succeed
      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Kavita Menon',
          customerEmail: 'kavita@example.com',
          orderId: 'ORD-DUP-99',
          itemId: 'ITEM-X',
          itemQuantity: 1,
          reason: 'DAMAGED',
        }),
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      createdTestIds.push(body.data.id);
      assert.notStrictEqual(body.data.id, activeOrder1.id);
    });

    // ----------------------------------------------------
    // Section 5: Rule 4 - Locked Once Decided
    // ----------------------------------------------------
    console.log('\n[E2E 5] Rule 4 - Record Immutability (Locked Once Decided):');

    let lockTestRequest;
    await test('allows editing details while request is OPEN', async () => {
      const createRes = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Original Name',
          customerEmail: 'orig@example.com',
          orderId: 'ORD-LOCK-1',
          itemId: 'ITEM-LOCK',
          itemQuantity: 1,
          reason: 'WRONG_ITEM',
        }),
      });
      const createBody = await createRes.json();
      lockTestRequest = createBody.data;
      createdTestIds.push(lockTestRequest.id);

      const updateRes = await fetch(`${baseUrl}/requests/${lockTestRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Updated Name',
          itemQuantity: 2,
        }),
      });

      assert.strictEqual(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.strictEqual(updateBody.data.customerName, 'Updated Name');
      assert.strictEqual(updateBody.data.itemQuantity, 2);
    });

    await test('refuses editing customer or item details once decided (APPROVED) with 422', async () => {
      // Move to IN_REVIEW, then APPROVED
      await fetch(`${baseUrl}/requests/${lockTestRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
      });
      await fetch(`${baseUrl}/requests/${lockTestRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'APPROVED',
          resolution: 'STORE_CREDIT',
        }),
      });

      // Attempt to edit customerName
      const patchRes = await fetch(`${baseUrl}/requests/${lockTestRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: 'Forbidden Edit' }),
      });

      assert.strictEqual(patchRes.status, 422);
      const patchBody = await patchRes.json();
      assert.strictEqual(patchBody.error.code, 'RECORD_LOCKED');
    });

    await test('notes can still be added to decided (locked) requests with 201', async () => {
      const noteRes = await fetch(`${baseUrl}/requests/${lockTestRequest.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'Support Agent',
          content: 'Added note after request was decided.',
        }),
      });

      assert.strictEqual(noteRes.status, 201);
      const noteBody = await noteRes.json();
      assert.strictEqual(noteBody.data.content, 'Added note after request was decided.');
    });

    // ----------------------------------------------------
    // Section 6: Rule 5 - Non-Destructive Removal
    // ----------------------------------------------------
    console.log('\n[E2E 6] Rule 5 - Non-Destructive Desk Removal:');

    let removalTestRequest;
    await test('refuses removal of IN_REVIEW or APPROVED request with 422', async () => {
      const createRes = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Remove Test',
          customerEmail: 'remove@example.com',
          orderId: 'ORD-REM-1',
          itemId: 'ITEM-REM',
          itemQuantity: 1,
          reason: 'CHANGED_MIND',
        }),
      });
      removalTestRequest = (await createRes.json()).data;
      createdTestIds.push(removalTestRequest.id);

      // Move to IN_REVIEW
      await fetch(`${baseUrl}/requests/${removalTestRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
      });

      // Attempt DELETE while IN_REVIEW
      const delRes = await fetch(`${baseUrl}/requests/${removalTestRequest.id}`, {
        method: 'DELETE',
      });

      assert.strictEqual(delRes.status, 422);
      const delBody = await delRes.json();
      assert.strictEqual(delBody.error.code, 'REMOVAL_NOT_ALLOWED');
    });

    await test('allows removal of REJECTED request with 200 and preserves database record', async () => {
      // Move from IN_REVIEW to REJECTED
      await fetch(`${baseUrl}/requests/${removalTestRequest.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'REJECTED' }),
      });

      // Now DELETE must succeed
      const delRes = await fetch(`${baseUrl}/requests/${removalTestRequest.id}`, {
        method: 'DELETE',
      });

      assert.strictEqual(delRes.status, 200);
      const delBody = await delRes.json();
      assert.strictEqual(delBody.isRemoved, true);

      // Subsequent GET returns 404 (disappears from fetching)
      const getRes = await fetch(`${baseUrl}/requests/${removalTestRequest.id}`);
      assert.strictEqual(getRes.status, 404);

      // Direct PostgreSQL query verifies record is preserved with isRemoved: true
      const dbRecord = await prisma.returnRequest.findUnique({
        where: { id: removalTestRequest.id },
      });
      assert.ok(dbRecord !== null, 'Record must not be deleted from PostgreSQL');
      assert.strictEqual(dbRecord.isRemoved, true);
      assert.ok(dbRecord.removedAt instanceof Date);
    });

    // ----------------------------------------------------
    // Section 7: Server-side Search, Filtering, Sorting, and Pagination
    // ----------------------------------------------------
    console.log('\n[E2E 7] Server-Side Search, Filtering, Sorting, and Paging:');

    await test('GET /api/requests filters by search keyword and status in PostgreSQL', async () => {
      const res = await fetch(`${baseUrl}/requests?search=ORD-E2E-100&status=COMPLETED`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.length >= 1);
      assert.strictEqual(body.data[0].orderId, 'ORD-E2E-100');
      assert.strictEqual(body.data[0].status, 'COMPLETED');
    });

    await test('GET /api/requests returns valid pagination metadata and obeys limits', async () => {
      const res = await fetch(`${baseUrl}/requests?limit=5&page=1`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.pagination.limit, 5);
      assert.strictEqual(body.pagination.page, 1);
      assert.ok(body.pagination.total >= 30);
      assert.ok(body.pagination.totalPages >= 6);
    });
  } finally {
    // Clean up created test records from PostgreSQL
    if (createdTestIds.length > 0) {
      await prisma.note.deleteMany({
        where: { requestId: { in: createdTestIds } },
      });
      await prisma.returnRequest.deleteMany({
        where: { id: { in: createdTestIds } },
      });
    }
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`E2E SUITE RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL END-TO-END BUSINESS RULES & SEMANTICS TESTS PASSED! 🚀\n');
  }
}

runE2ETests()
  .catch((err) => {
    console.error('Fatal E2E test execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
