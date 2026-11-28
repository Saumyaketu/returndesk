/**
 * Central HTTP API Client for ReturnDesk
 * 
 * Enforces requirement:
 * "When the server refuses an action, the user must be told why. Errors must not be swallowed."
 * 
 * Uses relative '/api' endpoint proxied server-side via Next.js rewrites using private API_URL.
 * Keeps backend URLs private without exposing public framework prefixes (NEXT_PUBLIC_).
 */

const API_BASE_URL = '/api';

export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      'Unable to connect to ReturnDesk backend service. Please verify your backend API URL in .env and check that the service is running.',
      0,
      'NETWORK_DISCONNECTED'
    );
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || `Server returned error (${response.status} ${response.statusText})`;
    const code = data?.error?.code || 'SERVER_ERROR';
    const details = data?.error?.details || null;
    throw new ApiError(message, response.status, code, details);
  }

  return data;
}

export const api = {
  /**
   * Search, filter, sort, and paginate requests
   */
  async getRequests(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.reason) searchParams.set('reason', params.reason);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const queryString = searchParams.toString();
    const endpoint = `/requests${queryString ? `?${queryString}` : ''}`;
    return request(endpoint, { method: 'GET' });
  },

  /**
   * Fetch a single request with chronological notes
   */
  async getRequestById(id) {
    const res = await request(`/requests/${encodeURIComponent(id)}`, { method: 'GET' });
    return res.data;
  },

  /**
   * Create a new return request (Rule 3 duplicate protection)
   */
  async createRequest(payload) {
    const res = await request('/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  /**
   * Update request customer/item details (Rule 4 locked protection)
   */
  async updateRequest(id, payload) {
    const res = await request(`/requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  /**
   * Move request lifecycle status (Rule 1 & Rule 2 protection)
   */
  async transitionStatus(id, { targetStatus, resolution, refundAmount, note }) {
    const res = await request(`/requests/${encodeURIComponent(id)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, resolution, refundAmount, note }),
    });
    return res.data;
  },

  /**
   * Remove request from desk (Rule 5 non-destructive soft delete)
   */
  async removeRequest(id) {
    return request(`/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Add a note to a request
   */
  async addNote(id, { content, author }) {
    const res = await request(`/requests/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, author }),
    });
    return res.data;
  },

  /**
   * Fetch notes for a request in chronological order
   */
  async getNotes(id) {
    const res = await request(`/requests/${encodeURIComponent(id)}/notes`, {
      method: 'GET',
    });
    return res.data;
  },
};
