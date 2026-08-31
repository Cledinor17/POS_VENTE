import { ApiError } from "./api";

type ErrorBody = { message?: unknown };

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === "object") {
      const body = error.body as ErrorBody;
      if (typeof body.message === "string" && body.message.length > 0) return body.message;
    }
    return error.message || fallback;
  }

  if (error instanceof TypeError) return fallback;

  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}
