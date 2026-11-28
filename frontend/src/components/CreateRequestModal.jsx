'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Package,
  User,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { RETURN_REASONS } from '../lib/constants';

/**
 * CreateRequestModal Component
 * 
 * Requirements handled:
 * - Raising a request: records who the customer is, how to reach them,
 *   which order it relates to, which item and how many units, and return reason.
 * - System-generated reference: agent never types it in.
 * - Rule 3: One live request per item. Duplicate live requests on the same order & item
 *   are rejected by the server (409 Conflict) and clearly explained to the user.
 * - Usable down to 375px width.
 */
export default function CreateRequestModal({ isOpen, onClose, onSuccess }) {
  const { showSuccess, showError } = useToast();

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    orderId: '',
    itemId: '',
    itemQuantity: 1,
    reason: 'DAMAGED',
    initialNote: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        orderId: '',
        itemId: '',
        itemQuantity: 1,
        reason: 'DAMAGED',
        initialNote: '',
      });
      setConflictError(null);
    }
  }, [isOpen]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConflictError(null);
    setIsSubmitting(true);

    try {
      const created = await api.createRequest({
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerPhone: formData.customerPhone.trim() || undefined,
        orderId: formData.orderId.trim(),
        itemId: formData.itemId.trim(),
        itemQuantity: Number(formData.itemQuantity) || 1,
        reason: formData.reason,
        initialNote: formData.initialNote.trim() || undefined,
      });

      showSuccess(`Return request ${created.reference} raised successfully!`);
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACTIVE_REQUEST_EXISTS') {
        setConflictError({
          message: err.message,
          details: err.details,
        });
      } else {
        showError(err, 'Failed to raise return request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
    >
      <div className="relative bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-modal-title" className="text-base font-bold text-slate-900">
                Raise Return Request
              </h3>
              <p className="text-xs text-slate-500">
                Initiate a new return case against an existing customer order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Reference Notice (Brief requirement: system generates unique reference) */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Automated Reference:</strong> A unique, human-readable reference (e.g. <span className="font-mono font-semibold">RET-YYYYMM-XXXXX</span>) will be generated by the system.
            </div>
          </div>

          {/* Conflict Error Notice (Rule 3) */}
          {conflictError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-rose-900">
                  Duplicate Request Refused (Rule 3)
                </p>
                <p className="text-rose-800 leading-relaxed">
                  {conflictError.message}
                </p>
                {conflictError.details?.existingReference && (
                  <p className="text-[11px] text-rose-700 font-mono mt-1">
                    Existing Live Case: {conflictError.details.existingReference} (Status: {conflictError.details.existingStatus})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>Customer Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohan Mehta"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Email <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="customer@example.com"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full pl-8 pr-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    placeholder="+91-9876543210"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full pl-8 pr-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order & Item Information */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>Order & Item Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Order ID <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ORD-2026-8801"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.itemQuantity}
                  onChange={(e) => setFormData({ ...formData, itemQuantity: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item ID / SKU <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITEM-ORTHO-SEAT-01"
                  value={formData.itemId}
                  onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Return Reason (5 Mandatory Choices) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              Reason for Return <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(RETURN_REASONS).map(([key, config]) => {
                const isSelected = formData.reason === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, reason: key })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Initial Note */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Initial Note (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={formData.initialNote}
              onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
              placeholder="Record any details provided by the customer during initial inquiry..."
              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Raising Request...' : 'Raise Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
