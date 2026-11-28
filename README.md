# ReturnDesk

Returns operations desk for customer support agents to process returns, track resolutions, and manage audit notes.

---

## 1. Setup Steps

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **PostgreSQL**: Local PostgreSQL 14+, Docker, or cloud PostgreSQL (Neon, Supabase)

### Project Structure
ReturnDesk is organized as two decoupled services:
* `backend/`: Express.js REST API with Prisma ORM and PostgreSQL.
* `frontend/`: Next.js (App Router) client with Tailwind CSS.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Saumyaketu/returndesk.git
cd returndesk
```

---

### Step 2: Backend Setup
1. Navigate to `backend/` and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Open `backend/.env` and update `DATABASE_URL` with your PostgreSQL credentials:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/returndesk?schema=public"
   CORS_ORIGIN="http://localhost:3000"
   ```
   *(If using Docker: `docker run --name returndesk-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=returndesk -p 5432:5432 -d postgres:16`)*

3. Run database migrations:
   ```bash
   npm run db:push
   ```

4. Populate seed data:
   ```bash
   npm run db:seed
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend API runs on **`http://localhost:5000`** (Health check: `http://localhost:5000/api/health`).

---

### Step 3: Frontend Setup
1. Open a new terminal, navigate to `frontend/`, and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Verify `frontend/.env.local`:
   ```env
   API_URL=http://localhost:5000
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```

4. Open the application:
   Navigate to **`http://localhost:3000`** in your browser.

---

## 2. Database Setup

1. Configure your PostgreSQL connection string in `backend/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/returndesk?schema=public"
   ```

2. Push the schema to PostgreSQL:
   ```bash
   cd backend
   npm run db:push
   ```

## 3. How to Run the Seed Script

The seed script creates a realistic working dataset for testing:

```bash
cd backend
npm run db:seed
```

### Seed Dataset Details
* **36 Return Requests**: Spans all 5 lifecycle statuses (`OPEN`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `COMPLETED`) and all 5 return reasons (`DAMAGED`, `WRONG_ITEM`, `SIZE_ISSUE`, `NOT_AS_DESCRIBED`, `CHANGED_MIND`).
* **37 Chronological Notes**: Internal support notes with realistic author names, multi-entry audit trails, and staggered timestamps.
* **Compliance**: All `APPROVED` requests strictly follow resolution rules (refund amounts with `REFUND`, zero amounts with `REPLACEMENT`/`STORE_CREDIT`). Includes soft-removed records adhering to `OPEN`/`REJECTED` removal rules.

---

## 4. Design Decisions and Why

### 1. Decoupled Monorepo (Express API + Next.js Frontend)
* **Decision**: Separate the backend into an independent Node.js Express REST API and the frontend into Next.js.
* **Why**: Ensures strict separation of concerns. The business rules and data persistence layers are pure HTTP endpoints that can be tested independently via direct HTTP calls without browser emulators. It also prevents bundling server database dependencies into the client.

### 2. Centralized Server-Side Business Rules Engine
* **Decision**: All 5 business rules are encapsulated in [`backend/src/lib/businessRules.js`](backend/src/lib/businessRules.js) and executed inside PostgreSQL transactions in [`backend/src/services/requestService.js`](backend/src/services/requestService.js).
* **Why**: Client-side UI validation can be bypassed. Validating on the server ensures data integrity regardless of whether requests originate from the web UI, automated tests, or direct curl commands.
  * **Rule 1 (Status Flow)**: Strict state machine (`OPEN -> IN_REVIEW -> APPROVED/REJECTED -> COMPLETED`). Skips and moves from terminal states return `422 Unprocessable Entity`.
  * **Rule 2 (Approval Resolutions)**: Moving to `APPROVED` requires a resolution. If `REFUND`, `refundAmount > 0` is required. If `REPLACEMENT` or `STORE_CREDIT`, refund amount must be null. Violations return `422`.
  * **Rule 3 (Duplicate Prevention)**: Only one live request allowed per order and item. Checked within a transaction against `(orderId, itemId)`. Duplicates return `409 Conflict` with the existing live reference.
  * **Rule 4 (Record Immutability)**: Once `APPROVED`, `REJECTED`, or `COMPLETED`, customer and item fields are immutable. Edits return `422`. Internal notes can still be appended (`201 Created`).
  * **Rule 5 (Non-Destructive Removal)**: Only `OPEN` or `REJECTED` requests can be removed from the desk (returns `422` otherwise). Removed records set `isRemoved = true` and return `404` on direct lookup while remaining preserved in PostgreSQL.

### 3. SQL-Level Filtering, Sorting, and Pagination
* **Decision**: Search queries, status/reason filters, ordering, and pagination (`take`/`skip`) run directly in PostgreSQL via Prisma's `$transaction([count, findMany])`.
* **Why**: Avoids loading the entire database into Node.js memory. PostgreSQL indexes handle text matching and sorting efficiently even as the dataset scales.

### 4. Server-Side API Proxy via Next.js Rewrites
* **Decision**: Frontend makes relative calls to `/api/*`, which Next.js proxies to `API_URL` using server-side rewrites in `next.config.mjs`.
* **Why**: Eliminates public framework prefixes (`NEXT_PUBLIC_`) so the backend URL remains private. Prevents browser CORS complications since the browser only communicates with the frontend origin.

### 5. Unambiguous Reference Format
* **Decision**: References use format `RET-YYYYMM-XXXXX` with characters `23456789ABCDEFGHJKMNPQRSTUVWXYZ`.
* **Why**: Excludes visually confusing characters (`0`, `O`, `1`, `I`, `L`) to reduce support agent misreadings over phone or chat.

---

## 5. What Is Incomplete

The following items were intentionally deferred as beyond the core take-home scope:

1. **User Authentication & Role-Based Access Control (RBAC)**:
   * Current implementation assumes an authenticated support desk session with a default "Support Agent" identity.
   * In a full enterprise environment, JWT/session authentication, agent logins, and granular permissions (e.g. only Support Leads can approve refunds over $500) would be required.

2. **File Attachments / Photo Uploads**:
   * Returns often require customers to provide photos of damaged or incorrect items.
   * File storage (e.g. AWS S3 or Cloudflare R2 presigned URLs) and image previews in the drawer are not implemented.

3. **Real-Time Multi-Agent Sync (WebSockets / SSE)**:
   * If two support agents view the desk simultaneously, updates appear upon refresh, search, or pagination rather than streaming via WebSockets or Server-Sent Events.

4. **Automated Customer Email Notifications**:
   * Transitions (e.g. refund issued, return rejected) log internal timeline notes, but do not trigger outbound emails (e.g. via SendGrid or AWS SES).

5. **Bulk Desk Actions**:
   * Support agents must review and transition requests individually; batch status transitions (e.g. selecting 10 requests to move to `IN_REVIEW`) are not implemented.

---

## 6. Assumptions Made

1. **Definition of a "Live" Request (Rule 3)**:
   * A request is considered active if `status NOT IN ('REJECTED', 'COMPLETED')` and `isRemoved = false`.
   * If a customer's prior return request for an item was `REJECTED`, they are permitted to open a new return request for that same item.

2. **Monetary Storage**:
   * Refund amounts are stored as PostgreSQL `Decimal(10, 2)` instead of floating-point numbers to guarantee exact decimal precision for financial transactions.

3. **Removal Permissions (Rule 5)**:
   * Only requests in `OPEN` (never started) or `REJECTED` (closed without action) may be removed from the desk.
   * Requests currently `IN_REVIEW`, `APPROVED`, or `COMPLETED` represent active financial or logistical workflows and cannot be removed.

4. **Audit Notes Lifecycle**:
   * Notes are append-only audit records. They can be added to any request at any stage (even after the record is locked/completed), but cannot be edited or deleted once posted.

5. **Search Matching**:
   * Global search matches case-insensitively across Reference, Customer Name, Customer Email, and Order ID using PostgreSQL substring queries.

---

## 7. Automated Test Suite (70 Tests)

The backend includes 70 automated tests covering all domain rules, REST routes, seed data, and end-to-end database transactions:

```bash
cd backend
npm test
```

### Test Suite Breakdown
* **`tests/businessRules.test.js` (33 tests)**: Unit tests for state machine transitions, approval resolution rules, duplicate checks, record locking, removal permissions, and reference formatting.
* **`tests/apiRoutes.test.js` (8 tests)**: Route integration tests for HTTP status codes, malformed JSON bodies, validation failures, and 404 JSON error responses.
* **`tests/seedCompliance.test.js` (8 tests)**: Verifies seed data volume (30+), 100% status coverage, 100% reason coverage, resolution validity, and chronological note ordering.
* **`tests/e2eRules.test.js` (21 tests)**: End-to-end HTTP API tests against live PostgreSQL verifying all 5 business rules, HTTP refusal codes (`400`, `404`, `409`, `422`), and soft-delete persistence.
