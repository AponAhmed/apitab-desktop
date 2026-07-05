import type { HttpMethod } from '@/types';

/** Text color class for an HTTP method label. */
export function methodColor(method: HttpMethod): string {
  switch (method) {
    case 'GET':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'POST':
      return 'text-amber-600 dark:text-amber-400';
    case 'PUT':
      return 'text-blue-600 dark:text-blue-400';
    case 'PATCH':
      return 'text-violet-600 dark:text-violet-400';
    case 'DELETE':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-slate-500 dark:text-slate-400';
  }
}

/** Color classes for an HTTP status code badge. */
export function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950';
  if (status >= 300 && status < 400) return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950';
  if (status >= 400 && status < 500) return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950';
  if (status >= 500) return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950';
  return 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800';
}

export const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Requested-With',
  'X-API-Key',
];

export const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
  'text/html',
  'application/xml',
  'multipart/form-data',
];
