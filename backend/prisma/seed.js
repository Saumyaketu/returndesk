require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { generateReference } = require('../src/lib/reference');
/**
 * Seed data for ReturnDesk
 * 
 * Requirements:
 * - At least 30 requests (36 included here)
 * - Spread across EVERY status: OPEN, IN_REVIEW, APPROVED, REJECTED, COMPLETED
 * - Spread across EVERY reason: DAMAGED, WRONG_ITEM, SIZE_ISSUE, NOT_AS_DESCRIBED, CHANGED_MIND
 * - Spread across resolutions for APPROVED: REFUND (>0), REPLACEMENT, STORE_CREDIT
 * - Multiple chronological notes on various requests
 * - Rule 5 demonstrated: includes soft-removed requests (isRemoved: true)
 * - Safe for clean execution (clears existing data first)
 */

const RAW_REQUESTS = [
  // ----------------------------------------------------
  // 1. OPEN REQUESTS (Fresh returns awaiting agent review)
  // ----------------------------------------------------
  {
    reference: 'RET-202611-A1091',
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav.sharma@example.com',
    customerPhone: '+91-9876543210',
    orderId: 'ORD-2026-8801',
    itemId: 'ITEM-ORTHO-SEAT-01',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer reported memory foam seat cushion arrived with torn zipper seam.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
    ],
  },
  {
    reference: 'RET-202611-B2042',
    customerName: 'Priya Patel',
    customerEmail: 'priya.patel@example.com',
    customerPhone: '+91-9812345678',
    orderId: 'ORD-2026-8805',
    itemId: 'ITEM-LUMBAR-PRO-02',
    itemQuantity: 1,
    reason: 'SIZE_ISSUE',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer states the lumbar support strap does not fit their high-back executive chair.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    ],
  },
  {
    reference: 'RET-202611-C3015',
    customerName: 'Rohan Mehta',
    customerEmail: 'rohan.mehta@example.com',
    customerPhone: '+91-9723456789',
    orderId: 'ORD-2026-8812',
    itemId: 'ITEM-GEL-INSOLE-L',
    itemQuantity: 2,
    reason: 'WRONG_ITEM',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    notes: [
      {
        author: 'Support Agent',
        content: 'Ordered Size Large gel insoles, received Size Medium in the box.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
    ],
  },
  {
    reference: 'RET-202611-D4099',
    customerName: 'Ananya Iyer',
    customerEmail: 'ananya.iyer@example.com',
    customerPhone: '+91-9634567890',
    orderId: 'ORD-2026-8819',
    itemId: 'ITEM-POSTURE-BRACE-M',
    itemQuantity: 1,
    reason: 'NOT_AS_DESCRIBED',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer noted the posture brace material is stiff neoprene instead of breathable mesh shown online.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      },
    ],
  },
  {
    reference: 'RET-202611-E5023',
    customerName: 'Vikram Verma',
    customerEmail: 'vikram.verma@example.com',
    customerPhone: '+91-9545678901',
    orderId: 'ORD-2026-8824',
    itemId: 'ITEM-TRAVEL-PILLOW-01',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
  {
    reference: 'RET-202611-F6034',
    customerName: 'Sneha Kulkarni',
    customerEmail: 'sneha.k@example.com',
    customerPhone: '+91-9456789012',
    orderId: 'ORD-2026-8830',
    itemId: 'ITEM-COMPRESS-SOCKS-M',
    itemQuantity: 3,
    reason: 'SIZE_ISSUE',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
  },
  {
    reference: 'RET-202611-G7045',
    customerName: 'Kabir Das',
    customerEmail: 'kabir.das@example.com',
    customerPhone: '+91-9367890123',
    orderId: 'ORD-2026-8835',
    itemId: 'ITEM-MASSAGE-BALL-02',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    notes: [
      {
        author: 'Support Agent',
        content: 'Spiky massage ball cracked during initial unboxing inspection.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
      },
    ],
  },
  {
    reference: 'RET-202611-H8056',
    customerName: 'Meera Nambiar',
    customerEmail: 'meera.nambiar@example.com',
    customerPhone: '+91-9278901234',
    orderId: 'ORD-2026-8841',
    itemId: 'ITEM-WRIST-REST-GEL',
    itemQuantity: 1,
    reason: 'WRONG_ITEM',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42),
  },

  // ----------------------------------------------------
  // 2. IN_REVIEW REQUESTS (Agent currently investigating)
  // ----------------------------------------------------
  {
    reference: 'RET-202611-J9067',
    customerName: 'Devendra Joshi',
    customerEmail: 'devendra.j@example.com',
    customerPhone: '+91-9189012345',
    orderId: 'ORD-2026-8750',
    itemId: 'ITEM-ORTHO-SEAT-02',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer reported deep indent in cushion upon opening delivery parcel.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      },
      {
        author: 'Support Agent',
        content: 'Requested photographic evidence of outer box packaging and shipping label.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40),
      },
      {
        author: 'System',
        content: 'Status changed from OPEN to IN_REVIEW.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 38),
      },
    ],
  },
  {
    reference: 'RET-202611-K1078',
    customerName: 'Pooja Reddy',
    customerEmail: 'pooja.reddy@example.com',
    customerPhone: '+91-9090123456',
    orderId: 'ORD-2026-8755',
    itemId: 'ITEM-CERVICAL-PILLOW',
    itemQuantity: 1,
    reason: 'NOT_AS_DESCRIBED',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 54),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer claims contour pillow is much firmer than the medium-soft rating on website.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 54),
      },
      {
        author: 'System',
        content: 'Status changed from OPEN to IN_REVIEW.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 46),
      },
    ],
  },
  {
    reference: 'RET-202611-L2089',
    customerName: 'Tarun Singhania',
    customerEmail: 'tarun.s@example.com',
    customerPhone: '+91-8901234567',
    orderId: 'ORD-2026-8762',
    itemId: 'ITEM-FOOT-ROLLER-WOOD',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60),
    notes: [
      {
        author: 'Support Agent',
        content: 'Wood roller axle is squeaking and has a hairline crack along the central wheel.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60),
      },
      {
        author: 'Warehouse Lead',
        content: 'Checking batch QC logs for batch W-2026-09.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
      },
    ],
  },
  {
    reference: 'RET-202611-M3090',
    customerName: 'Zoya Khan',
    customerEmail: 'zoya.khan@example.com',
    customerPhone: '+91-8812345678',
    orderId: 'ORD-2026-8768',
    itemId: 'ITEM-KNEE-SUPPORT-XL',
    itemQuantity: 2,
    reason: 'SIZE_ISSUE',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer measured circumference correctly but finds XL slips during walking.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
      },
      {
        author: 'Support Agent',
        content: 'Discussing sizing chart calibration with technical team.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50),
      },
    ],
  },
  {
    reference: 'RET-202611-N4011',
    customerName: 'Harish Babu',
    customerEmail: 'harish.babu@example.com',
    customerPhone: '+91-8723456789',
    orderId: 'ORD-2026-8774',
    itemId: 'ITEM-HEATED-BELT-01',
    itemQuantity: 1,
    reason: 'WRONG_ITEM',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 80),
    notes: [
      {
        author: 'Support Agent',
        content: 'Sent USB wired version instead of rechargeable battery model.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 80),
      },
    ],
  },
  {
    reference: 'RET-202611-P5022',
    customerName: 'Divya Nair',
    customerEmail: 'divya.nair@example.com',
    customerPhone: '+91-8634567890',
    orderId: 'ORD-2026-8780',
    itemId: 'ITEM-ACUPRESSURE-MAT',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 88),
  },
  {
    reference: 'RET-202611-Q6033',
    customerName: 'Sanjay Gupta',
    customerEmail: 'sanjay.gupta@example.com',
    customerPhone: '+91-8545678901',
    orderId: 'ORD-2026-8786',
    itemId: 'ITEM-ORTHO-SEAT-01',
    itemQuantity: 1,
    reason: 'NOT_AS_DESCRIBED',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
  },
  {
    reference: 'RET-202611-R7044',
    customerName: 'Geeta Sen',
    customerEmail: 'geeta.sen@example.com',
    customerPhone: '+91-8456789012',
    orderId: 'ORD-2026-8792',
    itemId: 'ITEM-ARCH-SUPPORT-M',
    itemQuantity: 2,
    reason: 'SIZE_ISSUE',
    status: 'IN_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 104),
  },

  // ----------------------------------------------------
  // 3. APPROVED REQUESTS (Approved with resolutions: Refund, Replacement, Store Credit)
  // ----------------------------------------------------
  // Approved with REFUND (refundAmount > 0 required)
  {
    reference: 'RET-202611-S8055',
    customerName: 'Aditya Roy',
    customerEmail: 'aditya.roy@example.com',
    customerPhone: '+91-8367890123',
    orderId: 'ORD-2026-8650',
    itemId: 'ITEM-ORTHO-SEAT-01',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'APPROVED',
    resolution: 'REFUND',
    refundAmount: 49.99,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer submitted clear photo of ruptured foam core upon delivery.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120),
      },
      {
        author: 'Support Agent',
        content: 'Approved full refund of $49.99 back to original payment card.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 90),
      },
    ],
  },
  {
    reference: 'RET-202611-T9066',
    customerName: 'Bhavna Menon',
    customerEmail: 'bhavna.m@example.com',
    customerPhone: '+91-8278901234',
    orderId: 'ORD-2026-8656',
    itemId: 'ITEM-LUMBAR-PRO-02',
    itemQuantity: 2,
    reason: 'WRONG_ITEM',
    status: 'APPROVED',
    resolution: 'REFUND',
    refundAmount: 79.50,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 130),
    notes: [
      {
        author: 'Support Agent',
        content: 'Warehouse mislabeled package; items returned to sender. Approving full refund of $79.50.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 100),
      },
    ],
  },
  {
    reference: 'RET-202611-U1077',
    customerName: 'Farhan Zaidi',
    customerEmail: 'farhan.z@example.com',
    customerPhone: '+91-8189012345',
    orderId: 'ORD-2026-8662',
    itemId: 'ITEM-TRAVEL-PILLOW-01',
    itemQuantity: 1,
    reason: 'NOT_AS_DESCRIBED',
    status: 'APPROVED',
    resolution: 'REFUND',
    refundAmount: 34.00,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 140),
  },
  {
    reference: 'RET-202611-V2088',
    customerName: 'Isha Chakraborty',
    customerEmail: 'isha.c@example.com',
    customerPhone: '+91-8090123456',
    orderId: 'ORD-2026-8668',
    itemId: 'ITEM-COMPRESS-SOCKS-L',
    itemQuantity: 4,
    reason: 'SIZE_ISSUE',
    status: 'APPROVED',
    resolution: 'REFUND',
    refundAmount: 60.00,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 150),
  },

  // Approved with REPLACEMENT (refundAmount must be null)
  {
    reference: 'RET-202611-W3099',
    customerName: 'Kunal Kapoor',
    customerEmail: 'kunal.kapoor@example.com',
    customerPhone: '+91-7901234567',
    orderId: 'ORD-2026-8674',
    itemId: 'ITEM-GEL-INSOLE-M',
    itemQuantity: 1,
    reason: 'WRONG_ITEM',
    status: 'APPROVED',
    resolution: 'REPLACEMENT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 160), // ~6.6 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Received wrong size in box. Customer requested size swap rather than refund.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 160),
      },
      {
        author: 'Support Agent',
        content: 'Replacement SKU ITEM-GEL-INSOLE-L dispatched with expedited courier.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 130),
      },
    ],
  },
  {
    reference: 'RET-202611-X4010',
    customerName: 'Lavanya Swaminathan',
    customerEmail: 'lavanya.s@example.com',
    customerPhone: '+91-7812345678',
    orderId: 'ORD-2026-8680',
    itemId: 'ITEM-POSTURE-BRACE-L',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'APPROVED',
    resolution: 'REPLACEMENT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 170),
    notes: [
      {
        author: 'Support Agent',
        content: 'Velcro strap ripped off on day 2. Approved warranty replacement.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 140),
      },
    ],
  },
  {
    reference: 'RET-202611-Y5021',
    customerName: 'Manish Pandey',
    customerEmail: 'manish.p@example.com',
    customerPhone: '+91-7723456789',
    orderId: 'ORD-2026-8686',
    itemId: 'ITEM-CERVICAL-PILLOW',
    itemQuantity: 1,
    reason: 'SIZE_ISSUE',
    status: 'APPROVED',
    resolution: 'REPLACEMENT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 180),
  },

  // Approved with STORE_CREDIT (refundAmount must be null)
  {
    reference: 'RET-202611-Z6032',
    customerName: 'Nisha Agarwal',
    customerEmail: 'nisha.a@example.com',
    customerPhone: '+91-7634567890',
    orderId: 'ORD-2026-8692',
    itemId: 'ITEM-ACUPRESSURE-MAT',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'APPROVED',
    resolution: 'STORE_CREDIT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 190),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer preferred store credit voucher for future orthopedic cushion purchase.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 190),
      },
      {
        author: 'Support Agent',
        content: 'Store credit code FRIDO-CREDIT-45 issued to customer email.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 170),
      },
    ],
  },
  {
    reference: 'RET-202611-A7043',
    customerName: 'Omkar Deshpande',
    customerEmail: 'omkar.d@example.com',
    customerPhone: '+91-7545678901',
    orderId: 'ORD-2026-8698',
    itemId: 'ITEM-FOOT-ROLLER-WOOD',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'APPROVED',
    resolution: 'STORE_CREDIT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200),
  },

  // ----------------------------------------------------
  // 4. REJECTED REQUESTS (Terminal State - locked once decided)
  // ----------------------------------------------------
  {
    reference: 'RET-202611-B8054',
    customerName: 'Pankaj Vats',
    customerEmail: 'pankaj.v@example.com',
    customerPhone: '+91-7456789012',
    orderId: 'ORD-2026-8510',
    itemId: 'ITEM-ORTHO-SEAT-01',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 220),
    notes: [
      {
        author: 'Support Agent',
        content: 'Return initiated 55 days after delivery. Exceeds standard 30-day return policy.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 220),
      },
      {
        author: 'Support Agent',
        content: 'Request formally rejected per company policy. Notification email dispatched to customer.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 210),
      },
    ],
  },
  {
    reference: 'RET-202611-C9065',
    customerName: 'Ritu Chawla',
    customerEmail: 'ritu.c@example.com',
    customerPhone: '+91-7367890123',
    orderId: 'ORD-2026-8516',
    itemId: 'ITEM-LUMBAR-PRO-02',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 230),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer inspection photos show obvious pet chew marks and liquid burns not covered under manufacturing warranty.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 225),
      },
    ],
  },
  {
    reference: 'RET-202611-D1076',
    customerName: 'Sahil Oberoi',
    customerEmail: 'sahil.o@example.com',
    customerPhone: '+91-7278901234',
    orderId: 'ORD-2026-8522',
    itemId: 'ITEM-COMPRESS-SOCKS-M',
    itemQuantity: 2,
    reason: 'SIZE_ISSUE',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 240),
    notes: [
      {
        author: 'Support Agent',
        content: 'Compression socks have been washed and worn repeatedly for 3 weeks; hygiene policy forbids return.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 235),
      },
    ],
  },
  {
    reference: 'RET-202611-E2087',
    customerName: 'Tanvi Saxena',
    customerEmail: 'tanvi.s@example.com',
    customerPhone: '+91-7189012345',
    orderId: 'ORD-2026-8528',
    itemId: 'ITEM-POSTURE-BRACE-M',
    itemQuantity: 1,
    reason: 'NOT_AS_DESCRIBED',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 250),
  },
  {
    reference: 'RET-202611-F3098',
    customerName: 'Umesh Yadav',
    customerEmail: 'umesh.y@example.com',
    customerPhone: '+91-7090123456',
    orderId: 'ORD-2026-8534',
    itemId: 'ITEM-MASSAGE-BALL-02',
    itemQuantity: 1,
    reason: 'WRONG_ITEM',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 260),
    notes: [
      {
        author: 'Support Agent',
        content: 'Order invoice matches item received exactly; customer misunderstood product variant.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 255),
      },
    ],
  },

  // ----------------------------------------------------
  // 5. COMPLETED REQUESTS (Terminal State - resolution fulfilled)
  // ----------------------------------------------------
  {
    reference: 'RET-202611-G4019',
    customerName: 'Vandana Rao',
    customerEmail: 'vandana.r@example.com',
    customerPhone: '+91-6901234567',
    orderId: 'ORD-2026-8410',
    itemId: 'ITEM-ORTHO-SEAT-01',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'COMPLETED',
    resolution: 'REFUND',
    refundAmount: 49.99,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 300), // ~12.5 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Damaged item return approved for refund.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 290),
      },
      {
        author: 'Accounts Lead',
        content: 'Gateway refund transaction ref #PG-REF-99214 executed successfully. Case closed.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 260),
      },
    ],
  },
  {
    reference: 'RET-202611-H5020',
    customerName: 'Wasim Akram',
    customerEmail: 'wasim.a@example.com',
    customerPhone: '+91-6812345678',
    orderId: 'ORD-2026-8416',
    itemId: 'ITEM-LUMBAR-PRO-02',
    itemQuantity: 1,
    reason: 'WRONG_ITEM',
    status: 'COMPLETED',
    resolution: 'REPLACEMENT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 320),
    notes: [
      {
        author: 'Support Agent',
        content: 'Replacement unit delivered via BlueDart AWB #9982412. Customer confirmed satisfaction.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 280),
      },
    ],
  },
  {
    reference: 'RET-202611-J6031',
    customerName: 'Yamini Ghosh',
    customerEmail: 'yamini.g@example.com',
    customerPhone: '+91-6723456789',
    orderId: 'ORD-2026-8422',
    itemId: 'ITEM-ACUPRESSURE-MAT',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'COMPLETED',
    resolution: 'STORE_CREDIT',
    refundAmount: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 340),
    notes: [
      {
        author: 'Support Agent',
        content: 'Store credit voucher redeemed on Order ORD-2026-8910. Return case finalized.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 310),
      },
    ],
  },
  {
    reference: 'RET-202611-K7042',
    customerName: 'Zubair Siddiqui',
    customerEmail: 'zubair.s@example.com',
    customerPhone: '+91-6634567890',
    orderId: 'ORD-2026-8428',
    itemId: 'ITEM-TRAVEL-PILLOW-01',
    itemQuantity: 2,
    reason: 'SIZE_ISSUE',
    status: 'COMPLETED',
    resolution: 'REFUND',
    refundAmount: 68.00,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 360), // 15 days ago
    notes: [
      {
        author: 'Support Agent',
        content: 'Return pickup completed by logistics team. Refund processed.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 330),
      },
    ],
  },

  // ----------------------------------------------------
  // 6. SOFT-REMOVED REQUESTS (Rule 5: Non-destructive removal)
  // Taken off the desk, invisible to listing, but preserved in PostgreSQL.
  // ----------------------------------------------------
  {
    reference: 'RET-202611-L8053',
    customerName: 'Deepak Chopra',
    customerEmail: 'deepak.c@example.com',
    customerPhone: '+91-6545678901',
    orderId: 'ORD-2026-8310',
    itemId: 'ITEM-WRIST-REST-GEL',
    itemQuantity: 1,
    reason: 'CHANGED_MIND',
    status: 'OPEN',
    isRemoved: true,
    removedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 380),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer called back stating they gifted the item to a colleague and wish to cancel the return.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
      {
        author: 'Support Agent',
        content: 'Taken off the active returns desk per customer request.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
      },
    ],
  },
  {
    reference: 'RET-202611-M9064',
    customerName: 'Gaurav Gill',
    customerEmail: 'gaurav.gill@example.com',
    customerPhone: '+91-6456789012',
    orderId: 'ORD-2026-8316',
    itemId: 'ITEM-CERVICAL-PILLOW',
    itemQuantity: 1,
    reason: 'DAMAGED',
    status: 'REJECTED',
    isRemoved: true,
    removedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 400),
    notes: [
      {
        author: 'Support Agent',
        content: 'Customer attempted return of unauthorized counterfeit pillow bought elsewhere.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
      {
        author: 'Support Agent',
        content: 'Fraudulent request rejected and archived off the desk.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    ],
  },
];

const usedRefs = new Set();
const SEED_REQUESTS = RAW_REQUESTS.map((item) => {
  let ref = generateReference(item.createdAt);
  while (usedRefs.has(ref)) {
    ref = generateReference(item.createdAt);
  }
  usedRefs.add(ref);
  return {
    ...item,
    reference: ref,
  };
});

async function seed() {
  console.log('--- STARTING RETURNDESK DATABASE SEED ---');
  console.log(`Target: ${SEED_REQUESTS.length} return requests with comprehensive note histories...`);

  // 1. Clean existing records (idempotent setup)
  console.log('Cleaning existing records in PostgreSQL...');
  await prisma.note.deleteMany({});
  await prisma.returnRequest.deleteMany({});

  // 2. Insert records sequentially or in batch to preserve relations
  let totalNotes = 0;
  for (const item of SEED_REQUESTS) {
    const { notes, ...requestData } = item;

    const created = await prisma.returnRequest.create({
      data: {
        ...requestData,
        notes: notes && notes.length > 0 ? {
          create: notes,
        } : undefined,
      },
    });

    if (notes && notes.length > 0) {
      totalNotes += notes.length;
    }
  }

  // 3. Status breakdown summary
  const countsByStatus = await prisma.returnRequest.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const countsByReason = await prisma.returnRequest.groupBy({
    by: ['reason'],
    _count: { id: true },
  });

  console.log('\n--- SEED COMPLETE ---');
  console.log(`✓ Inserted ${SEED_REQUESTS.length} return requests.`);
  console.log(`✓ Inserted ${totalNotes} chronological notes.`);
  console.log('\nBreakdown by Status:');
  countsByStatus.forEach((c) => console.log(`  - ${c.status}: ${c._count.id}`));
  console.log('\nBreakdown by Reason:');
  countsByReason.forEach((c) => console.log(`  - ${c.reason}: ${c._count.id}`));
  console.log('\nDatabase is ready for ReturnDesk review! 🚀');
}

// Export seed data for testing and execute when called directly
module.exports = { SEED_REQUESTS, seed };

if (require.main === module) {
  seed()
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
