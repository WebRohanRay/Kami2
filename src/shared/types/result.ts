import { AppError } from '../errors/AppError';

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; appError?: AppError };
