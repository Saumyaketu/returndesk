'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Edit2,
  Check,
  Package,
  User,
  Mail,
  Phone,
  Calendar,
  Trash2,
  ArrowRightCircle,
  FileText,
  BadgeDollarSign,
  AlertTriangle,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import NoteTimeline from './NoteTimeline';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  RETURN_REASONS,
  isRecordLocked,
  canRemoveRequest,
  ALLOWED_TRANSITIONS,
} from '../lib/constants';

/**
 * RequestDetailModal Component
 * 
 * Requirements handled:
 * - Working a request: see everything about it, including every note ever written on it, in order.
 * - Rule 4: Locked once decided (Approved, Rejected, Completed cannot edit details; notes still allowed).
 * - Rule 5: Removal (taking off desk only allowed if Open or Rejected; never destroys DB record).
 * - Only actions that are legal in current state may be offered.
 * - Server refusal errors are clearly surfaced.
 * - Fully responsive down to 375px width.
 */
export default function RequestDetailModal({
  requestId,
  isOpen,
  onClose,
  onRequestUpdated,
  onRequestRemoved,
  onOpenTransition,
}) {
  const { showSuccess, showError } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Form edit state
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    itemQuantity: 1,
    reason: '',
  });

  // Fetch full request details with chronological notes
  useEffect(() => {
    if (!isOpen || !requestId) {
      setRequest(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setIsEditing(false);

    api
      .getRequestById(requestId)
      .then((data) => {
        if (!isMounted) return;
        setRequest(data);
        setFormData({
          customerName: data.customerName || '',
          customerEmail: data.customerEmail || '',
          customerPhone: data.customerPhone || '',
          itemQuantity: data.itemQuantity || 1,
          reason: data.reason || '',
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        showError(err, 'Failed to fetch request details');
        onClose();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, requestId, showError, onClose]);

  // Handle ESC key closing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle Note Submission
  const handleAddNote = async ({ content, author }) => {
    if (!request) return;
    setIsSubmittingNote(true);

    try {
      const newNote = await api.addNote(request.id, { content, author });
      setRequest((prev) => ({
        ...prev,
        notes: [...(prev.notes || []), newNote],
        _count: {
          ...prev._count,
          notes: (prev._count?.notes || 0) + 1,
        },
      }));
      showSuccess('Note added to request history.');
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      showError(err, 'Could not add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle Details Edit Submission (Rule 4 enforced)
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!request) return;

    // Rule 4 guard
    if (isRecordLocked(request.status)) {
      showError(
        `Details are locked once decided (${request.status}). Customer and item details can no longer be edited.`,
        'Record Locked (Rule 4)'
      );
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateRequest(request.id, {
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone || null,
        itemQuantity: Number(formData.itemQuantity),
        reason: formData.reason,
      });

      setRequest(updated);
      setIsEditing(false);
      showSuccess('Request details updated successfully.');
      if (onRequestUpdated) onRequestUpdated();
    } catch (err) {
      showError(err, 'Failed to update details');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Rule 5 Removal
  const handleRemove = async () => {
    if (!request) return;

    if (!canRemoveRequest(request.status)) {
      showError(
        `Cannot remove request in '${request.status}' status. Only requests that are Open or Rejected may be taken off the desk.`,
        'Removal Refused (Rule 5)'
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to take request ${request.reference} off the desk?\n\nIt will disappear from the list but remains preserved in the database (Rule 5).`
    );
    if (!confirmed) return;

    setIsRemoving(true);
    try {
      await api.removeRequest(request.id);
      showSuccess(`Request ${request.reference} taken off the desk.`);
      if (onRequestRemoved) onRequestRemoved(request.id);
      onClose();
    } catch (err) {
      showError(err, 'Could not remove request');
    } finally {
      setIsRemoving(false);
    }
  };

  const isLocked = request ? isRecordLocked(request.status) : false;
  const isRemovable = request ? canRemoveRequest(request.status) : false;
  const allowedTransitions = request ? ALLOWED_TRANSITIONS[request.status] || [] : [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex justify-end transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reference-title"
    >
      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white min-h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              id="modal-reference-title"
              className="font-mono text-lg font-bold text-slate-900 tracking-tight"
            >
              {request?.reference || 'Loading...'}
            </span>
            {request && <StatusBadge status={request.status} />}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {loading || !request ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/3" />
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-40 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <>
              {/* Resolution Banner (Rule 2) */}
              {request.resolution && (
                <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                  <BadgeDollarSign className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      Approved Resolution: {request.resolution}
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {request.resolution === 'REFUND' &&
                        `Refund amount: $${Number(request.refundAmount).toFixed(2)}`}
                      {request.resolution === 'REPLACEMENT' &&
                        'Replacement unit approved for dispatch.'}
                      {request.resolution === 'STORE_CREDIT' &&
                        'Store credit voucher issued to customer account.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Rule 4 Immutability Lock Notice */}
              {isLocked && (
                <div className="rounded-lg p-3 bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    <strong>Record Locked:</strong> Customer and item details can no longer be edited once decided ({request.status}). Internal notes may still be added below.
                  </span>
                </div>
              )}

              {/* Customer & Item Details Card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Request Details</span>
                  </h3>

                  {/* Edit Toggle (Disabled if locked per Rule 4) */}
                  {!isLocked && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  /* Edit Form */
                  <form onSubmit={handleSaveDetails} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={formData.customerName}
                          onChange={(e) =>
                            setFormData({ ...formData, customerName: e.target.value })
                          }
                          required
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Customer Email
                        </label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) =>
                            setFormData({ ...formData, customerEmail: e.target.value })
                          }
                          required
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={formData.customerPhone}
                          onChange={(e) =>
                            setFormData({ ...formData, customerPhone: e.target.value })
                          }
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Item Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.itemQuantity}
                          onChange={(e) =>
                            setFormData({ ...formData, itemQuantity: e.target.value })
                          }
                          required
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Return Reason
                        </label>
                        <select
                          value={formData.reason}
                          onChange={(e) =>
                            setFormData({ ...formData, reason: e.target.value })
                          }
                          required
                          className="w-full text-xs p-2 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
                        >
                          {Object.entries(RETURN_REASONS).map(([key, config]) => (
                            <option key={key} value={key}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs font-semibold rounded text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Read-Only Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Customer</span>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{request.customerName}</span>
                      </div>
                      <div className="text-slate-600 flex items-center gap-1.5 mt-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{request.customerEmail}</span>
                      </div>
                      {request.customerPhone && (
                        <div className="text-slate-600 flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{request.customerPhone}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Order & Item</span>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 font-mono">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        <span>{request.orderId}</span>
                      </div>
                      <div className="text-slate-700 font-mono mt-1">
                        {request.itemId} &bull; Qty: {request.itemQuantity}
                      </div>
                      <div className="text-slate-600 mt-1">
                        Reason:{' '}
                        <span className="font-semibold text-slate-800">
                          {RETURN_REASONS[request.reason]?.label || request.reason}
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Created: {new Date(request.createdAt).toLocaleString()}
                      </span>
                      <span>
                        Updated: {new Date(request.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar (Only Legal Actions Offered) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Available Desk Actions
                </h3>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Progress Status Transition Button */}
                  {allowedTransitions.length > 0 && onOpenTransition && (
                    <button
                      onClick={() => onOpenTransition(request)}
                      type="button"
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs cursor-pointer"
                    >
                      <ArrowRightCircle className="w-4 h-4" />
                      <span>Update Status ({allowedTransitions.join(', ')})</span>
                    </button>
                  )}

                  {/* Remove From Desk Button (Rule 5: Only Open or Rejected) */}
                  {isRemovable ? (
                    <button
                      onClick={handleRemove}
                      disabled={isRemoving}
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>{isRemoving ? 'Removing...' : 'Remove from Desk'}</span>
                    </button>
                  ) : (
                    <span
                      className="text-[11px] text-slate-400 flex items-center gap-1 italic"
                      title="Only Open or Rejected requests may be removed from the desk (Rule 5)"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                      Removal not allowed in {request.status} status (Rule 5)
                    </span>
                  )}
                </div>
              </div>

              {/* Chronological Notes Thread */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <NoteTimeline
                  notes={request.notes || []}
                  onAddNote={handleAddNote}
                  isSubmitting={isSubmittingNote}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
