'use client';

import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import RequestTable from '../components/RequestTable';
import Pagination from '../components/Pagination';
import RequestDetailModal from '../components/RequestDetailModal';
import StatusTransitionModal from '../components/StatusTransitionModal';
import CreateRequestModal from '../components/CreateRequestModal';
import { useRequests } from '../hooks/useRequests';

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

  const [activeRequestId, setActiveRequestId] = useState(null);
  const [transitioningRequest, setTransitioningRequest] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSelectRequest = (request) => {
    setActiveRequestId(request.id);
  };

  const handleOpenTransition = (request) => {
    setTransitioningRequest(request);
  };

  const handleTransitionSuccess = (updatedRequest) => {
    refetch();
    if (activeRequestId === updatedRequest.id) {
      setActiveRequestId(null);
      setTimeout(() => setActiveRequestId(updatedRequest.id), 50);
    }
  };

  const handleCreateSuccess = (createdRequest) => {
    refetch();
    setActiveRequestId(createdRequest.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation */}
      <Navbar onNewRequest={() => setIsCreateModalOpen(true)} />

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

      {/* Request Detail Drawer / Modal (Working a request) */}
      <RequestDetailModal
        requestId={activeRequestId}
        isOpen={Boolean(activeRequestId)}
        onClose={() => setActiveRequestId(null)}
        onRequestUpdated={refetch}
        onRequestRemoved={() => {
          refetch();
          setActiveRequestId(null);
        }}
        onOpenTransition={handleOpenTransition}
      />

      {/* Status Transition Modal (Rule 1 & Rule 2 Lifecycle State Machine) */}
      <StatusTransitionModal
        request={transitioningRequest}
        isOpen={Boolean(transitioningRequest)}
        onClose={() => setTransitioningRequest(null)}
        onSuccess={handleTransitionSuccess}
      />

      {/* Raise Return Request Modal (Rule 3 Duplicate Check & Auto-Reference) */}
      <CreateRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
