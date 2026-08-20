import { uuid } from './id';
import type { Environment } from '@/types';

export const ENVIRONMENT_EXPORT_VERSION = 1;

interface EnvironmentExportValue {
  key: string;
  value: string;
  enabled: boolean;
  description: string;
}

export interface EnvironmentExport {
  app: 'apitab';
  type: 'environment';
  version: number;
  exportedAt: number;
  item: {
    id: string;
    name: string;
    values: EnvironmentExportValue[];
    createdAt: number;
    updatedAt: number;
  };
}

export function exportEnvironment(env: Environment): EnvironmentExport {
  return {
    app: 'apitab',
    type: 'environment',
    version: ENVIRONMENT_EXPORT_VERSION,
    exportedAt: Date.now(),
    item: {
      id: env.id,
      name: env.name,
      values: env.variables.map((v) => ({
        key: v.key,
        value: v.value,
        enabled: v.enabled,
        description: v.description ?? '',
      })),
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
    },
  };
}

export interface ParsedEnvironmentExport {
  ok: boolean;
  data?: EnvironmentExport;
  error?: string;
}

export function parseEnvironmentExport(raw: string): ParsedEnvironmentExport {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const obj = json as Partial<EnvironmentExport>;
  if (obj?.app !== 'apitab' || obj.type !== 'environment' || !obj.item || typeof obj.item !== 'object') {
    return { ok: false, error: 'Not a valid ApiTab environment file.' };
  }
  if (typeof obj.item.name !== 'string' || !obj.item.name.trim()) {
    return { ok: false, error: 'Environment file is missing a name.' };
  }
  const rawValues = Array.isArray(obj.item.values) ? obj.item.values : [];
  const values = rawValues.filter(
    (v): v is EnvironmentExportValue =>
      v != null && typeof v.key === 'string' && v.key.trim() !== '' && typeof v.value === 'string',
  );

  return {
    ok: true,
    data: {
      app: 'apitab',
      type: 'environment',
      version: obj.version ?? ENVIRONMENT_EXPORT_VERSION,
      exportedAt: obj.exportedAt ?? Date.now(),
      item: {
        id: obj.item.id || uuid(),
        name: obj.item.name,
        values,
        createdAt: obj.item.createdAt ?? Date.now(),
        updatedAt: obj.item.updatedAt ?? Date.now(),
      },
    },
  };
}

/**
 * Converts a parsed export into a real Environment. Preserves the exported
 * item id (unlike postmanImport.ts's foreign-format imports, which always
 * mint fresh ids) — this is ApiTab's own native format, so re-importing the
 * same file is expected to update the matching environment via
 * environmentStore's mergeImported (upsert-by-id), not pile up duplicates.
 * Each variable still gets a fresh id, since the exchange format has none.
 */
export function exportToEnvironment(data: EnvironmentExport): Environment {
  return {
    id: data.item.id,
    name: data.item.name,
    variables: data.item.values.map((v) => ({
      id: uuid(),
      key: v.key,
      value: v.value,
      enabled: v.enabled ?? true,
      description: v.description || undefined,
    })),
    createdAt: data.item.createdAt,
    updatedAt: Date.now(),
  };
}
