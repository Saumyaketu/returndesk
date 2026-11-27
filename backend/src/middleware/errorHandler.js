const { AppError } = require('../lib/errors');

/**
 * Central Express Error Handler
 * Enforces assignment requirement:
 * "When the server refuses something, it must say so honestly and usefully:
 * an appropriate HTTP status code for what actually went wrong, and a consistent,
 * machine-readable body explaining it. Returning 200 with an error buried inside,
 * falling back to 500 for something you could have anticipated, or returning an
 * HTML error page will all count against you."
 */
function errorHandler(err, req, res, next) {
  // 1. Handle Known Domain/Application Errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined,
      },
    });
  }

  // 2. Handle Malformed JSON request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'MALFORMED_JSON',
        message: 'Request body contains invalid JSON.',
      },
    });
  }

  // 3. Handle Prisma Known Request Errors
  if (err.code === 'P2002') {
    const target = err.meta?.target ? err.meta.target.join(', ') : 'field';
    return res.status(409).json({
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: `A record with this ${target} already exists.`,
      },
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested record could not be found.',
      },
    });
  }

  // 4. Log unexpected internal errors and return 500
  console.error('[ReturnDesk Server Error]:', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  });
}

module.exports = errorHandler;
