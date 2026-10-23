import { AxiosError } from 'axios';

interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  status?: string;
  code?: number;
  validationErrors?: Record<string, string>;
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred';

  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;

    // Business error
    if (data?.message) return data.message;

    // Validation error
    if (data?.validationErrors) {
      const firstError = Object.values(data.validationErrors)[0];
      if (firstError) return firstError;
    }

    // Standard HTTP errors
    if (error.response?.status === 401) return 'Unauthorized. Please log in again.';
    if (error.response?.status === 403) return 'You do not have permission to perform this action.';
    if (error.response?.status === 404) return 'The requested resource was not found.';
    if (error.response?.status === 500) return 'Server error. Please try again later.';

    // Network error
    if (error.code === 'ERR_NETWORK') return 'Network error. Please check your connection.';

    return error.message || 'Request failed';
  }

  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export function getValidationErrors(
  error: unknown
): Record<string, string> | null {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.validationErrors) return data.validationErrors;
  }
  return null;
}
