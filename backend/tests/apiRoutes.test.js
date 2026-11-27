const assert = require('assert');
const http = require('http');
const app = require('../src/server');

console.log('--- RUNNING REST API ROUTE INTEGRATION TESTS ---');

let passed = 0;
let failed = 0;

async function it(description, fn) {
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Health check
    await it('GET /api/health returns 200 with JSON payload', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const body = await res.json();
      assert.strictEqual(body.status, 'ok');
    });

    // 2. Undefined route returns 404 JSON, NOT HTML
    await it('GET /api/nonexistent-route returns 404 with machine-readable JSON', async () => {
      const res = await fetch(`${baseUrl}/api/nonexistent-route`);
      assert.strictEqual(res.status, 404);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
    });

    // 3. Malformed JSON body returns 400 JSON
    await it('POST /api/requests with invalid JSON returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json: }',
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'MALFORMED_JSON');
    });

    // 4. Missing required customer name
    await it('POST /api/requests with missing fields returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'CUSTOMER_NAME_REQUIRED');
    });

    // 5. Invalid return reason
    await it('POST /api/requests with invalid reason returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Alice',
          customerEmail: 'alice@example.com',
          orderId: 'ORD-1',
          itemId: 'ITEM-1',
          reason: 'BOGUS_REASON',
        }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_REASON');
    });

    // 6. Invalid item quantity (0 or negative)
    await it('POST /api/requests with itemQuantity < 1 returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Alice',
          customerEmail: 'alice@example.com',
          orderId: 'ORD-1',
          itemId: 'ITEM-1',
          itemQuantity: 0,
          reason: 'DAMAGED',
        }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'INVALID_QUANTITY');
    });

    // 7. Transition without targetStatus
    await it('POST /api/requests/:id/transition without targetStatus returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests/fake-id/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'TARGET_STATUS_REQUIRED');
    });

    // 8. Empty note content
    await it('POST /api/requests/:id/notes with empty content returns 400 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/requests/fake-id/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'EMPTY_NOTE_CONTENT');
    });
  } finally {
    server.close();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL REST API ROUTE INTEGRATION TESTS PASSED! 🚀');
  }
}

runTests();
