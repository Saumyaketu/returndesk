'use client';

import React, { useState } from 'react';
import { Send, Clock, User, Shield, MessageSquare } from 'lucide-react';

/**
 * NoteTimeline Component
 * 
 * Requirement:
 * "An agent can open a single request and see everything about it, including every
 * note ever written on it, in order. Notes can be added at any point in a request's
 * life and are never edited or deleted once written."
 */
export default function NoteTimeline({ notes = [], onAddNote, isSubmitting = false }) {
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('Support Agent');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    await onAddNote({ content: content.trim(), author });
    setContent('');
  };

  const formatNoteTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <span>Internal Notes History ({notes.length})</span>
        </h3>
        <span className="text-xs text-slate-400">Append-only audit trail</span>
      </div>

      {/* Chronological Notes List */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {notes.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-2">
            No notes have been added to this return request yet.
          </div>
        ) : (
          notes.map((note) => {
            const isSystem = note.author?.toLowerCase().includes('system');
            return (
              <div key={note.id || note.createdAt} className="relative group">
                {/* Timeline Node Dot */}
                <span
                  className={`absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-white ring-2 ring-slate-100 ${
                    isSystem ? 'bg-slate-400' : 'bg-indigo-600'
                  }`}
                />

                <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/80 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] ${
                        isSystem
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {isSystem ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {note.author || 'Support Agent'}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />
                      {formatNoteTime(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Append New Note Form (Allowed at any point in lifecycle) */}
      <form onSubmit={handleSubmit} className="pt-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <label htmlFor="note-content" className="font-semibold text-slate-700">
            Add a Note
          </label>
          <div className="flex items-center gap-1.5">
            <span>Author:</span>
            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Support Agent">Support Agent</option>
              <option value="Warehouse Lead">Warehouse Lead</option>
              <option value="Accounts Lead">Accounts Lead</option>
            </select>
          </div>
        </div>

        <textarea
          id="note-content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type an internal note or customer interaction record (cannot be edited or deleted once posted)..."
          className="w-full text-sm p-3 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y min-h-[72px] text-slate-900"
          required
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Posting...' : 'Post Note'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
