'use client';

import React from 'react';
import { Search, X, RotateCcw, Filter } from 'lucide-react';
import { REQUEST_STATUS, STATUS_CONFIG, RETURN_REASONS } from '../lib/constants';

/**
 * FilterBar Component
 * 
 * Requirement:
 * "They must be able to search by customer, order or reference, narrow the list by status
 * and by reason, sort it, and page through the results... Search, filtering, sorting and
 * paging must all work together, and must all happen on the server."
 * "Search must not fire a request on every keystroke."
 */
export default function FilterBar({
  search,
  setSearch,
  status,
  setStatus,
  reason,
  setReason,
  totalResults = 0,
}) {
  const hasActiveFilters = Boolean(search || status || reason);

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setReason('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs mb-4">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, order or reference (e.g. RET-202611, ORD-8801)..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Status Dropdown */}
          <div className="w-full sm:w-44">
            <label htmlFor="status-filter" className="sr-only">Filter by status</label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="">All Statuses</option>
              {Object.keys(REQUEST_STATUS).map((key) => (
                <option key={key} value={key}>
                  {STATUS_CONFIG[key]?.label || key}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Dropdown */}
          <div className="w-full sm:w-44">
            <label htmlFor="reason-filter" className="sr-only">Filter by reason</label>
            <select
              id="reason-filter"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="">All Reasons</option>
              {Object.entries(RETURN_REASONS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition shrink-0 cursor-pointer"
              title="Reset search and filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Active filters indicators */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Showing <strong className="text-slate-800 font-semibold">{totalResults}</strong> matching requests
          </span>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Search: &ldquo;{search}&rdquo;
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Status: {STATUS_CONFIG[status]?.label || status}
              </span>
            )}
            {reason && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Reason: {RETURN_REASONS[reason]?.label || reason}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
