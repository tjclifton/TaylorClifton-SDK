/**
 * A generic base-class for API-related errors, containing relevant information
 * to the failing request.
 */
export class ApiError extends Error {
  readonly response: Response

  readonly status: number;

  readonly body: unknown;

  /**
   *
   * @param status
   * @param message
   * @param param2
   */
  constructor(
    status: number,
    message: string,
    { response, body }: { response: Response, body: unknown }
  ) {
    super(message);

    this.status = status;
    this.response = response;
    this.body = body;
  }
}

/**
 * Error thrown when an API request is performed too many times.
 */
export class MaxRetriesExceededError extends ApiError {}

/**
 * Error thrown when a request is manually aborted via it's `AbortController`.
 */
export class AbortError extends Error {}

/**
 * Error thrown when a request fails due to network issues.
 */
export class NetworkError extends Error {}

/**
 * Encapsulates all other others.
 */
export class UnknownError extends Error {}

/**
 *
 */
export interface ErrorInfo<T> {
  readonly body: T;
  readonly response: Response;
}
