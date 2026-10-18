export class UnknownViewerError extends Error {}
export class AuthError extends Error {}
export class TraktError extends Error {
  constructor(status, msg, retryAfter) { super(msg); this.status = status; this.retryAfter = retryAfter; }
}
