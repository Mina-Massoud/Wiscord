import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { fail } from '../lib/response.js';
import { logger } from '../lib/logger.js';

/**
 * Catch-all Express error handler. Must be registered last.
 * Maps AppError, ZodError, and unknown throws into the ApiResponse envelope.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json(fail(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res
      .status(400)
      .json(fail('invalid_input', 'Request validation failed', err.flatten().fieldErrors));
    return;
  }

  const reqId = req.header('x-request-id');
  logger.error({ err, reqId, url: req.url, method: req.method }, 'unhandled error');
  res
    .status(500)
    .json(fail('server_error', 'Unexpected server error. Try again in a moment.'));
}

/**
 * 404 fallback for unknown routes. Mounted after all routers.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json(fail('not_found', 'Route not found'));
}
