import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '../lib/api';
import { useDebounce } from './useDebounce';

/**
 * useRequests Hook
 * 
 * Central state management for the ReturnDesk returns listing view.
 * Handles server-side search (debounced), filtering (status/reason),
 * sorting, pagination, and surfaces loading, empty, and server refusal errors.
 */
export function useRequests(initialLimit = 10) {
  // Query state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  // Response state
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: initialLimit,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Avoid race conditions from concurrent network fetches
  const fetchCountRef = useRef(0);

  const fetchRequests = useCallback(async () => {
    const currentFetchId = ++fetchCountRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await api.getRequests({
        search: debouncedSearch,
        status,
        reason,
        sortBy,
        sortOrder,
        page,
        limit,
      });

      // If a newer fetch was initiated, discard this one
      if (currentFetchId !== fetchCountRef.current) return;

      setRequests(response.data || []);
      setPagination(response.pagination || {
        total: 0,
        page,
        limit,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } catch (err) {
      if (currentFetchId !== fetchCountRef.current) return;
      setError(err instanceof ApiError ? err.message : 'An error occurred while fetching requests.');
      setRequests([]);
    } finally {
      if (currentFetchId === fetchCountRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, status, reason, sortBy, sortOrder, page, limit]);

  // Reset to page 1 whenever filters or search terms change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, reason]);

  // Trigger fetch whenever query parameters update
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Sorting handler helper
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }, [sortBy]);

  return {
    // Search & Filter state
    search,
    setSearch,
    status,
    setStatus,
    reason,
    setReason,
    sortBy,
    sortOrder,
    handleSort,
    page,
    setPage,
    limit,
    setLimit,

    // Data state
    requests,
    pagination,
    loading,
    error,

    // Actions
    refetch: fetchRequests,
  };
}
