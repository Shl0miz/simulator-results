// lib/apiClient.ts
import type { ApiConfig, SimulationResult } from './types';

/** Resolve a dot-path string against an object, e.g. "data.results" */
function resolvePath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Apply fieldMap: renames keys in each row according to config */
function applyFieldMap(
  rows: Record<string, unknown>[],
  fieldMap: Record<string, string>
): Record<string, unknown>[] {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return rows;
  return rows.map(row => {
    const mapped: Record<string, unknown> = { ...row };
    for (const [target, source] of Object.entries(fieldMap)) {
      if (source in row) {
        mapped[target] = row[source];
      }
    }
    return mapped;
  });
}

export async function fetchResults(
  config: ApiConfig,
  userUrl?: string
): Promise<SimulationResult[]> {
  const url = userUrl
    ? userUrl
    : `${config.baseUrl}${config.endpoint}`;

  const fullUrl = config.queryParams && Object.keys(config.queryParams).length > 0
    ? `${url}?${new URLSearchParams(config.queryParams)}`
    : url;

  const response = await fetch(`/api/fetch-results?url=${encodeURIComponent(fullUrl)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch results: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const raw = resolvePath(json, config.resultsPath ?? '') as unknown[];

  if (!Array.isArray(raw)) {
    throw new Error('API response does not contain an array at the configured results path');
  }

  const mapped = applyFieldMap(raw as Record<string, unknown>[], config.fieldMap ?? {});
  return mapped as SimulationResult[];
}
