const prisma = require('../lib/prisma');
const {
  REQUEST_STATUS,
  RETURN_REASON,
  validateStatusTransition,
  getActiveDuplicateFilter,
  validateRecordUpdate,
  validateRemoval,
} = require('../lib/businessRules');
const { generateReference } = require('../lib/reference');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} = require('../lib/errors');

class RequestService {
  /**
   * Create a new return request (Rule 3 duplicate check + unique reference generator)
   */
  async createRequest(data) {
    const {
      customerName,
      customerEmail,
      customerPhone,
      orderId,
      itemId,
      itemQuantity = 1,
      reason,
      initialNote,
    } = data;

    // 1. Basic field validation
    if (!customerName || !String(customerName).trim()) {
      throw new BadRequestError('Customer name is required.', 'CUSTOMER_NAME_REQUIRED');
    }
    if (!customerEmail || !String(customerEmail).trim()) {
      throw new BadRequestError('Customer email is required.', 'CUSTOMER_EMAIL_REQUIRED');
    }
    if (!orderId || !String(orderId).trim()) {
      throw new BadRequestError('Order ID is required.', 'ORDER_ID_REQUIRED');
    }
    if (!itemId || !String(itemId).trim()) {
      throw new BadRequestError('Item ID is required.', 'ITEM_ID_REQUIRED');
    }
    if (!reason || !Object.values(RETURN_REASON).includes(reason)) {
      throw new BadRequestError(
        `Invalid reason '${reason}'. Allowed: ${Object.values(RETURN_REASON).join(', ')}.`,
        'INVALID_REASON'
      );
    }

    const parsedQuantity = parseInt(itemQuantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      throw new BadRequestError(
        'Item quantity must be a positive integer (minimum 1).',
        'INVALID_QUANTITY'
      );
    }

    const cleanOrderId = String(orderId).trim();
    const cleanItemId = String(itemId).trim();
    const cleanEmail = String(customerEmail).trim().toLowerCase();
    const cleanName = String(customerName).trim();
    const cleanPhone = customerPhone ? String(customerPhone).trim() : null;

    // 2. RULE 3: One live request per item
    // A customer cannot have two live requests for the same item on the same order.
    const duplicateFilter = getActiveDuplicateFilter(cleanOrderId, cleanItemId);
    const existingActive = await prisma.returnRequest.findFirst({
      where: duplicateFilter,
    });

    if (existingActive) {
      throw new ConflictError(
        `A live return request (${existingActive.reference}) already exists for item '${cleanItemId}' on order '${cleanOrderId}'. New requests are only permitted once earlier requests reach Rejected or Completed.`,
        'ACTIVE_REQUEST_EXISTS',
        {
          existingReference: existingActive.reference,
          existingStatus: existingActive.status,
          orderId: cleanOrderId,
          itemId: cleanItemId,
        }
      );
    }

    // 3. Generate unique reference with collision retry
    let reference = generateReference();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const collision = await prisma.returnRequest.findUnique({
        where: { reference },
      });
      if (!collision) {
        isUnique = true;
      } else {
        reference = generateReference();
        attempts++;
      }
    }

    // 4. Create request (and optional initial note) within a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.returnRequest.create({
        data: {
          reference,
          customerName: cleanName,
          customerEmail: cleanEmail,
          customerPhone: cleanPhone,
          orderId: cleanOrderId,
          itemId: cleanItemId,
          itemQuantity: parsedQuantity,
          reason,
          status: REQUEST_STATUS.OPEN,
          isRemoved: false,
        },
      });

      if (initialNote && String(initialNote).trim()) {
        await tx.note.create({
          data: {
            requestId: createdRequest.id,
            author: 'Support Agent',
            content: String(initialNote).trim(),
          },
        });
      }

      return createdRequest;
    });

    return this.getRequestById(result.id);
  }

  /**
   * Search, filter, sort, and paginate requests (All executed server-side via PostgreSQL/Prisma)
   */
  async getRequests(queryParams = {}) {
    const {
      search,
      status,
      reason,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = queryParams;

    // Rule 5: Removed requests disappear from list
    const where = {
      isRemoved: false,
    };

    // Filter: Status (supports single or comma-separated)
    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => Object.values(REQUEST_STATUS).includes(s));

      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    // Filter: Reason (supports single or comma-separated)
    if (reason) {
      const reasons = reason
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter((r) => Object.values(RETURN_REASON).includes(r));

      if (reasons.length === 1) {
        where.reason = reasons[0];
      } else if (reasons.length > 1) {
        where.reason = { in: reasons };
      }
    }

    // Search: customer, order, reference (case-insensitive substring)
    if (search && String(search).trim()) {
      const term = String(search).trim();
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { orderId: { contains: term, mode: 'insensitive' } },
        { customerEmail: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Pagination bounds
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Allowed sort columns
    const allowedSortColumns = [
      'createdAt',
      'updatedAt',
      'reference',
      'customerName',
      'orderId',
      'status',
      'reason',
      'itemQuantity',
    ];

    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'createdAt';
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Execute count and query concurrently in PostgreSQL
    const [total, requests] = await prisma.$transaction([
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: { [sortColumn]: direction },
        include: {
          _count: {
            select: { notes: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return {
      data: requests,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };
  }

  /**
   * Fetch single request by ID or Reference with chronological notes
   */
  async getRequestById(idOrReference) {
    const request = await prisma.returnRequest.findFirst({
      where: {
        OR: [{ id: idOrReference }, { reference: idOrReference }],
      },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' }, // Working a request: "notes in order"
        },
      },
    });

    // Rule 5: Removed request can no longer be fetched
    if (!request || request.isRemoved) {
      throw new NotFoundError(
        'Request not found or has been taken off the desk.',
        'REQUEST_NOT_FOUND'
      );
    }

    return request;
  }

  /**
   * Update request customer/item details (Rule 4: locked once decided)
   */
  async updateRequest(id, updateData) {
    const existing = await prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.isRemoved) {
      throw new NotFoundError('Request not found or has been removed.', 'REQUEST_NOT_FOUND');
    }

    // RULE 4: Locked once decided
    validateRecordUpdate(existing, updateData);

    const allowedUpdates = {};

    if (updateData.customerName !== undefined) {
      allowedUpdates.customerName = String(updateData.customerName).trim();
    }
    if (updateData.customerEmail !== undefined) {
      allowedUpdates.customerEmail = String(updateData.customerEmail).trim().toLowerCase();
    }
    if (updateData.customerPhone !== undefined) {
      allowedUpdates.customerPhone = updateData.customerPhone ? String(updateData.customerPhone).trim() : null;
    }
    if (updateData.reason !== undefined) {
      if (!Object.values(RETURN_REASON).includes(updateData.reason)) {
        throw new BadRequestError(`Invalid return reason '${updateData.reason}'.`, 'INVALID_REASON');
      }
      allowedUpdates.reason = updateData.reason;
    }
    if (updateData.itemQuantity !== undefined) {
      const qty = parseInt(updateData.itemQuantity, 10);
      if (isNaN(qty) || qty < 1) {
        throw new BadRequestError('Item quantity must be at least 1.', 'INVALID_QUANTITY');
      }
      allowedUpdates.itemQuantity = qty;
    }

    // If orderId or itemId changed, verify Rule 3 duplicate check
    const newOrderId = updateData.orderId ? String(updateData.orderId).trim() : existing.orderId;
    const newItemId = updateData.itemId ? String(updateData.itemId).trim() : existing.itemId;

    if (newOrderId !== existing.orderId || newItemId !== existing.itemId) {
      const duplicateFilter = getActiveDuplicateFilter(newOrderId, newItemId, existing.id);
      const duplicate = await prisma.returnRequest.findFirst({ where: duplicateFilter });

      if (duplicate) {
        throw new ConflictError(
          `Cannot update request to item '${newItemId}' on order '${newOrderId}' because an active return request (${duplicate.reference}) already exists for this item.`,
          'ACTIVE_REQUEST_EXISTS'
        );
      }
      allowedUpdates.orderId = newOrderId;
      allowedUpdates.itemId = newItemId;
    }

    await prisma.returnRequest.update({
      where: { id },
      data: allowedUpdates,
    });

    return this.getRequestById(id);
  }

  /**
   * Transition request lifecycle status (Rule 1 & Rule 2)
   */
  async transitionStatus(id, { targetStatus, resolution, refundAmount, note }) {
    if (!targetStatus) {
      throw new BadRequestError('targetStatus is required for status transition.', 'TARGET_STATUS_REQUIRED');
    }

    const existing = await prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.isRemoved) {
      throw new NotFoundError('Request not found or has been removed.', 'REQUEST_NOT_FOUND');
    }

    // RULE 1 & RULE 2 validation
    validateStatusTransition(existing.status, targetStatus, { resolution, refundAmount });

    const updateData = {
      status: targetStatus,
    };

    if (targetStatus === REQUEST_STATUS.APPROVED) {
      updateData.resolution = resolution;
      updateData.refundAmount = resolution === 'REFUND' ? Number(refundAmount) : null;
    } else if (targetStatus === REQUEST_STATUS.REJECTED) {
      // Rejection clears any pending resolution/refund
      updateData.resolution = null;
      updateData.refundAmount = null;
    }

    // Execute transition and record audit note in transaction
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id },
        data: updateData,
      });

      const auditText = note && String(note).trim()
        ? `Status changed from ${existing.status} to ${targetStatus}. Note: ${String(note).trim()}`
        : `Status changed from ${existing.status} to ${targetStatus}.`;

      await tx.note.create({
        data: {
          requestId: id,
          author: 'System',
          content: auditText,
        },
      });
    });

    return this.getRequestById(id);
  }

  /**
   * RULE 5: Non-Destructive Removal (Soft-delete)
   */
  async removeRequest(id) {
    const existing = await prisma.returnRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Request not found.', 'REQUEST_NOT_FOUND');
    }

    // RULE 5 check: Only Open or Rejected may be removed
    validateRemoval(existing);

    await prisma.returnRequest.update({
      where: { id },
      data: {
        isRemoved: true,
        removedAt: new Date(),
      },
    });

    return {
      message: 'Request taken off the desk successfully.',
      isRemoved: true,
      reference: existing.reference,
    };
  }

  /**
   * Add a note to a request (Allowed at any point in lifecycle)
   */
  async addNote(idOrReference, { content, author = 'Support Agent' }) {
    if (!content || !String(content).trim()) {
      throw new BadRequestError('Note content cannot be empty.', 'EMPTY_NOTE_CONTENT');
    }

    const request = await prisma.returnRequest.findFirst({
      where: {
        OR: [{ id: idOrReference }, { reference: idOrReference }],
      },
    });

    if (!request || request.isRemoved) {
      throw new NotFoundError('Request not found or has been removed.', 'REQUEST_NOT_FOUND');
    }

    const note = await prisma.note.create({
      data: {
        requestId: request.id,
        author: author && String(author).trim() ? String(author).trim() : 'Support Agent',
        content: String(content).trim(),
      },
    });

    return note;
  }

  /**
   * Get notes for a request in chronological order
   */
  async getNotes(idOrReference) {
    const request = await prisma.returnRequest.findFirst({
      where: {
        OR: [{ id: idOrReference }, { reference: idOrReference }],
      },
    });

    if (!request || request.isRemoved) {
      throw new NotFoundError('Request not found or has been removed.', 'REQUEST_NOT_FOUND');
    }

    const notes = await prisma.note.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
    });

    return notes;
  }
}

module.exports = new RequestService();
