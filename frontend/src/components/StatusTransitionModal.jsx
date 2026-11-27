'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BadgeDollarSign,
  Repeat,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import {
  REQUEST_STATUS,
  STATUS_CONFIG,
  RESOLUTION_TYPES,
  ALLOWED_TRANSITIONS,
} from '../lib/constants';

/**
 * StatusTransitionModal Component
 * 
 * Requirements handled:
 * - Rule 1: Fixed Status Flow Lifecycle
 *   Open -> In Review -> Approved -> Completed
 *                     -> Rejected
 *   Only legal transitions offered. Terminal states (Rejected, Completed) cannot transition.
 * - Rule 2: Approval Needs a Resolution
 *   Approved requires Refund, Replacement, or Store Credit.
 *   If Refund: amount > 0 is strictly required.
 *   If not Refund: no refund amount may be recorded.
 * - Errors surfaced cleanly to agent without swallowing.
 */
export default function StatusTransitionModal({
  request,
  isOpen,
  onClose,
  onSuccess,
}) {
  const { showSuccess, showError } = useToast();

  const allowedTransitions = request ? ALLOWED_TRANSITIONS[request.status] || [] : [];
  const isTerminal = allowedTransitions.length === 0;

  // Form state
  const [targetStatus, setTargetStatus] = useState('');
  const [resolution, setResolution] = useState('REFUND');
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default target status when request changes
  useEffect(() => {
    if (allowedTransitions.length > 0) {
      setTargetStatus(allowedTransitions[0]);
    } else {
      setTargetStatus('');
    }
    setResolution('REFUND');
    setRefundAmount('');
    setNote('');
  }, [request]);

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

  if (!isOpen || !request) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetStatus || isSubmitting) return;

    // Rule 2 client validation: if Approved with Refund, require amount > 0
    if (targetStatus === REQUEST_STATUS.APPROVED) {
      if (!resolution) {
        showError('Please select a resolution (Refund, Replacement, or Store Credit).', 'Resolution Required (Rule 2)');
        return;
      }

      if (resolution === 'REFUND') {
        const amount = Number(refundAmount);
        if (isNaN(amount) || amount <= 0) {
          showError('A refund resolution requires a refund amount greater than zero.', 'Invalid Refund Amount (Rule 2)');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const updated = await api.transitionStatus(request.id, {
        targetStatus,
        resolution: targetStatus === REQUEST_STATUS.APPROVED ? resolution : undefined,
        refundAmount:
          targetStatus === REQUEST_STATUS.APPROVED && resolution === 'REFUND'
            ? Number(refundAmount)
            : undefined,
        note: note.trim() || undefined,
      });

      showSuccess(`Status progressed to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}.`);
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      showError(err, 'Status Transition Refused');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-modal-title"
    >
      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 id="transition-modal-title" className="text-base font-bold text-slate-900">
              Update Request Status
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Reference: <strong className="text-slate-800">{request.reference}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current Status Row */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Current Status:
            </span>
            <StatusBadge status={request.status} />
          </div>

          {/* Terminal State Warning */}
          {isTerminal ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-sm">Terminal State Reached (Rule 1)</p>
                <p className="leading-relaxed">
                  Requests in <strong>{request.status}</strong> status are finalized. Nothing can move out of them according to the return lifecycle rules.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Target Status Selector (Only Legal Transitions Allowed) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Next Status (Rule 1: Legal Transitions Only)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {allowedTransitions.map((statusKey) => {
                    const isSelected = targetStatus === statusKey;
                    const config = STATUS_CONFIG[statusKey];

                    return (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setTargetStatus(statusKey)}
                        className={`p-3 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm text-slate-900">
                            {config?.label || statusKey}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {config?.description}
                          </div>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RULE 2: Approval Needs a Resolution (Shown when target is APPROVED) */}
              {targetStatus === REQUEST_STATUS.APPROVED && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <BadgeDollarSign className="w-4 h-4 text-emerald-700" />
                    <label className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Approval Resolution (Rule 2 Required)
                    </label>
                  </div>

                  {/* Resolution Types */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Refund */}
                    <button
                      type="button"
                      onClick={() => setResolution('REFUND')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                        resolution === 'REFUND'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <BadgeDollarSign className="w-4 h-4" />
                      <span>Refund</span>
                    </button>

                    {/* Replacement */}
                    <button
                      type="button"
                      onClick={() => setResolution('REPLACEMENT')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                        resolution === 'REPLACEMENT'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Repeat className="w-4 h-4" />
                      <span>Replacement</span>
                    </button>

                    {/* Store Credit */}
                    <button
                      type="button"
                      onClick={() => setResolution('STORE_CREDIT')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition cursor-pointer ${
                        resolution === 'STORE_CREDIT'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>Store Credit</span>
                    </button>
                  </div>

                  {/* Refund Amount Input (Rule 2: >0 required for REFUND; forbidden for others) */}
                  {resolution === 'REFUND' ? (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-semibold text-emerald-950">
                        Refund Amount ($ USD) <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-semibold text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          required
                          className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Rule 2 requires a refund amount greater than zero for refunds.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-800 italic pt-1">
                      Rule 2: No refund amount may be recorded for {resolution.toLowerCase()} resolutions.
                    </p>
                  )}
                </div>
              )}

              {/* Optional Transition Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Audit Log Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Record why this status change was authorized (e.g., QC inspection passed)..."
                  className="w-full text-xs p-3 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            {!isTerminal && (
              <button
                type="submit"
                disabled={isSubmitting || !targetStatus}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition shadow-xs cursor-pointer"
              >
                <span>{isSubmitting ? 'Updating...' : 'Confirm Transition'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
