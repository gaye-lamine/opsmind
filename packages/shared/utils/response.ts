import { randomUUID } from "crypto";
import type { ApiResponse, ApiError, ResponseMeta, ResponseMetaInput, PaginationMeta } from "../types/api";

/**
 * API response builder utilities.
 * Enforces the standard OpsMind response envelope on all API responses.
 */

export function successResponse<T>(
  data: T,
  meta?: ResponseMetaInput
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: meta?.requestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
      ...(meta?.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
      ...(meta?.pagination !== undefined ? { pagination: meta.pagination } : {}),
    },
  };
}

export function errorResponse(
  error: ApiError,
  meta?: ResponseMetaInput
): ApiResponse<never> {
  return {
    success: false,
    error,
    meta: {
      requestId: meta?.requestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };
}

export function paginatedResponse<T>(
  data: T,
  pagination: PaginationMeta,
  meta?: ResponseMetaInput
): ApiResponse<T> {
  return successResponse(data, { ...meta, pagination });
}

export function buildPagination(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
