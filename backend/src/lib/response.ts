/**
 * Standard API response envelope. Mirrors the shape documented in the rules:
 * { success, data?, error?, meta? }
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { total: number; page: number; limit: number };
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const ok = <T>(data: T, meta?: ApiSuccess<T>['meta']): ApiSuccess<T> => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
});

export const fail = (code: string, message: string, details?: unknown): ApiFailure => ({
  success: false,
  error: { code, message, ...(details !== undefined ? { details } : {}) },
});
