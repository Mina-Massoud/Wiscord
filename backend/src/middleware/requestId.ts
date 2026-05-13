import { nanoid } from 'nanoid';
import type { Request, Response, NextFunction } from 'express';

/**
 * Stamps every request with `X-Request-Id` (incoming or generated). pino-http
 * picks it up via the same header so logs and responses correlate.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length > 0 ? incoming : nanoid(12);
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}
