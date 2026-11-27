'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import RequestTable from '../components/RequestTable';
import Pagination from '../components/Pagination';
import { useRequests } from '../hooks/useRequests';
import { useToast } from '../context/ToastContext';

export default function Home() {
  const {
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
    requests,
    pagination,
    loading,
    error,
    refetch,
  } = useRequests(10);

  const { showInfo } = useToast();
  const [selectedRequest, setSelectedRequest] = useState(null);

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    showInfo(`Opening return request ${request.reference}...`, 'Request Selected');
  };

  const handleNewRequest = () => {
    showInfo('The New Return Request modal will open here (Part 10).', 'Raise Request');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation */}
      <Navbar onNewRequest={handleNewRequest} />

      {/* Main Operations Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome / Desk Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Returns Operations Desk
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, review customer returns, and progress requests through their resolution lifecycle.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <FilterBar
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          reason={reason}
          setReason={setReason}
          totalResults={pagination.total || 0}
        />

        {/* Returns Data Table / Card View */}
        <RequestTable
          requests={requests}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onSelectRequest={handleSelectRequest}
          onRetry={refetch}
          onResetFilters={() => {
            setSearch('');
            setStatus('');
            setReason('');
          }}
        />

        {/* Pagination Bar */}
        <Pagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </main>
    </div>
  );
}
