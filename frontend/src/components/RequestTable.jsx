'use client';

import React from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Package,
  Calendar,
  AlertCircle,
  Inbox,
  RotateCcw,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { RETURN_REASONS } from '../lib/constants';

/**
 * RequestTable Component
 * 
 * Requirements handled:
 * - Status must be immediately readable at a glance.
 * - Loading, empty and error states must all be handled.
 * - An empty result set should say so rather than render a blank table.
 * - The interface must be usable down to 375px width.
 * - Server-side sorting triggers on column headers.
 */
export default function RequestTable({
  requests = [],
  loading = false,
  error = null,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onSort,
  onSelectRequest,
  onRetry,
  onResetFilters,
}) {
  // Sort indicator helper
  const renderSortIcon = (column) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
    );
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // 1. Error State
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-8 shadow-xs text-center my-6">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-rose-900 mb-1">Failed to load return requests</h3>
        <p className="text-sm text-rose-700 max-w-md mx-auto mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Loading State (Skeleton Rows)
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Desktop Skeleton */}
        <div className="hidden md:block">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-4">
            <span className="col-span-2">Reference</span>
            <span className="col-span-3">Customer</span>
            <span className="col-span-3">Order & Item</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2 text-right">Created</span>
          </div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="px-6 py-4 grid grid-cols-12 gap-4 items-center animate-pulse">
                <div className="col-span-2 h-4 bg-slate-200 rounded w-28" />
                <div className="col-span-3 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-36" />
                  <div className="h-3 bg-slate-100 rounded w-24" />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded w-32" />
                  <div className="h-3 bg-slate-100 rounded w-28" />
                </div>
                <div className="col-span-2 h-6 bg-slate-200 rounded-full w-24" />
                <div className="col-span-2 h-4 bg-slate-200 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Skeleton */}
        <div className="md:hidden divide-y divide-slate-100 p-4 space-y-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="p-4 rounded-lg border border-slate-100 space-y-3 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-200 rounded w-28" />
                <div className="h-5 bg-slate-200 rounded-full w-20" />
              </div>
              <div className="h-4 bg-slate-200 rounded w-40" />
              <div className="h-3 bg-slate-100 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. Empty State
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs my-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <Inbox className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">No return requests found</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
          No records matched your search keyword or selected filters. Try broadening your criteria.
        </p>
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Search & Filters</span>
          </button>
        )}
      </div>
    );
  }

  // 4. Data Table (Desktop + Mobile Responsive)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm divide-y divide-slate-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              {/* Reference */}
              <th scope="col" className="px-6 py-3.5">
                <button
                  onClick={() => onSort('reference')}
                  type="button"
                  className="group flex items-center gap-1.5 hover:text-slate-900 transition font-semibold"
                >
                  <span>Reference</span>
                  {renderSortIcon('reference')}
                </button>
              </th>

              {/* Customer */}
              <th scope="col" className="px-6 py-3.5">
                <button
                  onClick={() => onSort('customerName')}
                  type="button"
                  className="group flex items-center gap-1.5 hover:text-slate-900 transition font-semibold"
                >
                  <span>Customer</span>
                  {renderSortIcon('customerName')}
                </button>
              </th>

              {/* Order & Item */}
              <th scope="col" className="px-6 py-3.5">
                <button
                  onClick={() => onSort('orderId')}
                  type="button"
                  className="group flex items-center gap-1.5 hover:text-slate-900 transition font-semibold"
                >
                  <span>Order & Item</span>
                  {renderSortIcon('orderId')}
                </button>
              </th>

              {/* Reason */}
              <th scope="col" className="px-6 py-3.5">
                <button
                  onClick={() => onSort('reason')}
                  type="button"
                  className="group flex items-center gap-1.5 hover:text-slate-900 transition font-semibold"
                >
                  <span>Reason</span>
                  {renderSortIcon('reason')}
                </button>
              </th>

              {/* Status */}
              <th scope="col" className="px-6 py-3.5">
                <button
                  onClick={() => onSort('status')}
                  type="button"
                  className="group flex items-center gap-1.5 hover:text-slate-900 transition font-semibold"
                >
                  <span>Status</span>
                  {renderSortIcon('status')}
                </button>
              </th>

              {/* Date */}
              <th scope="col" className="px-6 py-3.5 text-right">
                <button
                  onClick={() => onSort('createdAt')}
                  type="button"
                  className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-semibold ml-auto"
                >
                  <span>Created</span>
                  {renderSortIcon('createdAt')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {requests.map((request) => (
              <tr
                key={request.id}
                onClick={() => onSelectRequest && onSelectRequest(request)}
                className="hover:bg-slate-50/80 transition cursor-pointer group"
              >
                {/* Reference & Notes badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-900 group-hover:text-indigo-600 transition">
                      {request.reference}
                    </span>
                    {request._count?.notes > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md"
                        title={`${request._count.notes} internal notes recorded`}
                      >
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        <span>{request._count.notes}</span>
                      </span>
                    )}
                  </div>
                </td>

                {/* Customer */}
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{request.customerName}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[180px]">
                    {request.customerEmail}
                  </div>
                </td>

                {/* Order & Item */}
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-slate-900 font-semibold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span>{request.orderId}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {request.itemId} &bull; Qty: {request.itemQuantity}
                  </div>
                </td>

                {/* Reason */}
                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                  <span className="inline-block px-2 py-1 rounded bg-slate-100 font-medium">
                    {RETURN_REASONS[request.reason]?.label || request.reason}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={request.status} />
                  {request.resolution && (
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      Res: {request.resolution}
                      {request.refundAmount && ` ($${Number(request.refundAmount).toFixed(2)})`}
                    </div>
                  )}
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-slate-500">
                  {formatDate(request.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< 768px down to 375px) */}
      <div className="md:hidden divide-y divide-slate-100">
        {requests.map((request) => (
          <div
            key={request.id}
            onClick={() => onSelectRequest && onSelectRequest(request)}
            className="p-4 active:bg-slate-50 transition cursor-pointer space-y-2.5"
          >
            {/* Top row: Reference + Status */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-slate-900 text-sm">
                {request.reference}
              </span>
              <StatusBadge status={request.status} />
            </div>

            {/* Middle row: Customer info */}
            <div>
              <div className="text-sm font-medium text-slate-900">{request.customerName}</div>
              <div className="text-xs text-slate-500">{request.customerEmail}</div>
            </div>

            {/* Bottom row: Order ID, reason, date */}
            <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1 font-mono">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                <span>{request.orderId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                  {RETURN_REASONS[request.reason]?.label || request.reason}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {formatDate(request.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
