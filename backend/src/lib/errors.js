/**
 * Standard Application Error Hierarchy for ReturnDesk
 * Guarantees consistent, machine-readable HTTP error payloads across the API.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details = null) {
    super(message, 404, code, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict with current state', code = 'CONFLICT', details = null) {
    super(message, 409, code, details);
  }
}

class UnprocessableEntityError extends AppError {
  constructor(message = 'Validation or business rule failure', code = 'UNPROCESSABLE_ENTITY', details = null) {
    super(message, 422, code, details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
};
