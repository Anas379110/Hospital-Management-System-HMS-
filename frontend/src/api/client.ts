import i18n from '../i18n/i18n';
import axios, { AxiosError } from 'axios';
import type { ApiErrorShape } from '../types/api';

export const apiClient = axios.create({
  baseURL: '/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    if (error.response?.status === 401) {
      // الجلسة منتهية أو غير صالحة — تسجيل خروج فوري وإعادة توجيه
      localStorage.removeItem('hms_token');
      localStorage.removeItem('hms_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export function isUnknownWriteOutcome(error: unknown): boolean {
  if (!axios.isAxiosError<ApiErrorShape>(error) || !['post', 'put', 'patch', 'delete'].includes(error.config?.method?.toLowerCase() ?? '')) return false;
  if (!error.response) return true;
  // A proxy/server failure can arrive after the application committed.
  const code = error.response.data?.error?.code;
  const atomicBilling = /^\/invoices(?:\/[a-f0-9-]{36}\/(?:items|payments))?$/.test(error.config?.url ?? '');
  return error.response.status >= 500 && !(code === 'DEMO_BUSY' && atomicBilling);
}

/** استخراج رسالة الخطأ الموحدة بأمان — راجع API.md */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isUnknownWriteOutcome(error)) return i18n.t('errors.writeUnknown');
  if (getApiErrorCode(error) === 'DEMO_BUSY' && !isUnknownWriteOutcome(error)) return i18n.t('errors.demoBusy');
  if (axios.isAxiosError<ApiErrorShape>(error) && error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  return fallback;
}

/** استخراج كود الخطأ (لمعالجة منطقية مثل POSSIBLE_DUPLICATE_PATIENT) */
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    return error.response?.data?.error?.code;
  }
  return undefined;
}
