export type AppErrorCode =
  | 'auth/session-expired'
  | 'network/offline'
  | 'validation/invalid-input'
  | 'security/forbidden'
  | 'storage/upload-failed'
  | 'sync/conflict'
  | 'unknown';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly context?: Record<string, any>;

  constructor(code: AppErrorCode, message: string, context?: Record<string, any>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;

    // Correct prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
