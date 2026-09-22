export class AuditError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuditError';
    this.code = code;
  }
}
