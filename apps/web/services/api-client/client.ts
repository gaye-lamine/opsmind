import type { ApiResponse } from "@opsmind/shared";

/**
 * OpsMind API Client — typed fetch wrapper for apps/api.
 *
 * Rule §3.2: apps/web ONLY consumes the API — never accesses databases directly.
 * All data flows through this client.
 *
 * Features:
 * - Typed responses via ApiResponse<T> envelope
 * - Automatic error extraction
 * - Request ID propagation
 * - Base URL from environment
 */

const API_BASE_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const envelope = (await response.json()) as ApiResponse<T>;

  if (!envelope.success || !response.ok) {
    throw new ApiClientError(
      envelope.error?.code ?? "UNKNOWN_ERROR",
      envelope.error?.message ?? "An unexpected error occurred",
      response.status
    );
  }

  return envelope.data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "GET", ...options }),

  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),

  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
};
