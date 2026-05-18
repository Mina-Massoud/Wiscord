/**
 * Typed application errors. Express's error middleware reads `status` and
 * `code` to decide the response shape. Unknown errors always 500.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /** Optional structured payload returned alongside the error
   *  envelope. Use for machine-readable context the frontend needs
   *  to render a precise error UI (e.g. quota_exceeded sending
   *  {limit, used, resetAt} so the upgrade prompt can show
   *  countdown + actual numbers without an extra round trip). */
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string): AppError =>
  new AppError(400, code, message);
export const unauthorized = (message = 'Not authenticated'): AppError =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'Forbidden'): AppError =>
  new AppError(403, 'forbidden', message);
export const notFound = (resource = 'resource'): AppError =>
  new AppError(404, 'not_found', `${resource} not found`);
export const conflict = (code: string, message: string): AppError =>
  new AppError(409, code, message);
export const tooMany = (message = 'Too many requests'): AppError =>
  new AppError(429, 'too_many_requests', message);
export const serverError = (message = 'Unexpected server error'): AppError =>
  new AppError(500, 'server_error', message);
