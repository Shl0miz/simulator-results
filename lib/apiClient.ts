// lib/apiClient.ts
import type { SimulationResult } from './types';

export interface EvPowerApiConfig {
  baseUrl: string;
  groupEndpoint: string;
  jobEndpoint: string;
  method?: string;
  headers?: Record<string, string>;
  resultsPath?: string;
  fieldMap?: Record<string, string>;
}

interface JobResponse {
  id: string;
  name?: string | null;
  group?: string | null;
  status: string;
  result?: Record<string, unknown>[] | null;
  config?: string | null;
  error?: string | null;
}

/** Apply fieldMap: renames keys in each row according to config */
function applyFieldMap(
  rows: Record<string, unknown>[],
  fieldMap?: Record<string, string>
): Record<string, unknown>[] {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return rows;
  return rows.map(row => {
    const mapped: Record<string, unknown> = { ...row };
    for (const [target, source] of Object.entries(fieldMap)) {
      if (source in row) mapped[target] = row[source];
    }
    return mapped;
  });
}

/** Proxy GET requests through Next.js API route to avoid CORS */
async function proxyFetch(url: string): Promise<unknown> {
  const res = await fetch(`/api/fetch-results?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** Proxy DELETE requests through Next.js API route */
async function proxyDelete(url: string): Promise<void> {
  const res = await fetch(`/api/fetch-results?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete failed ${res.status}: ${body}`);
  }
}

/**
 * Fetch results for a simulation GROUP.
 * Calls GET /simulate/group/{group}?include_result=true
 */
export async function fetchGroupResults(
  config: EvPowerApiConfig,
  group: string
): Promise<SimulationResult[]> {
  const endpoint = config.groupEndpoint.replace('{group}', encodeURIComponent(group));
  const url = `${config.baseUrl}${endpoint}?include_result=true`;
  const data = await proxyFetch(url) as JobResponse[];

  if (!Array.isArray(data)) {
    throw new Error('Group endpoint did not return an array of jobs');
  }

  const allRows: Record<string, unknown>[] = [];
  for (const job of data) {
    if (job.status === 'completed' && Array.isArray(job.result)) {
      allRows.push(...job.result);
    }
  }

  if (allRows.length === 0) {
    const total = data.length;
    const completed = data.filter(j => j.status === 'completed').length;
    throw new Error(
      `No completed results found in group "${group}". ` +
      `${completed}/${total} jobs completed.`
    );
  }

  return applyFieldMap(allRows, config.fieldMap) as SimulationResult[];
}

/**
 * Fetch results for a single simulation JOB.
 * Calls GET /simulate/{jobId}
 */
export async function fetchJobResults(
  config: EvPowerApiConfig,
  jobId: string
): Promise<SimulationResult[]> {
  const endpoint = config.jobEndpoint.replace('{jobId}', encodeURIComponent(jobId));
  const url = `${config.baseUrl}${endpoint}`;
  const data = await proxyFetch(url) as JobResponse;

  if (!data || typeof data !== 'object' || !('status' in data)) {
    throw new Error('Job endpoint did not return a valid job response');
  }

  if (data.status !== 'completed') {
    throw new Error(`Job "${jobId}" is not completed yet (status: ${data.status})`);
  }

  if (!Array.isArray(data.result) || data.result.length === 0) {
    throw new Error(`Job "${jobId}" has no results`);
  }

  return applyFieldMap(data.result, config.fieldMap) as SimulationResult[];
}

export interface JobListItem {
  id: string;
  name?: string | null;
  group?: string | null;
  owner?: string;
  status: string;       // "completed" | "pending" | "failed" | "running"
  created: string;
  updated: string;
  config?: string | null;
  error?: string | null;
  run_duration?: number | null;
}

/**
 * Fetch list of all simulation jobs with config included.
 * GET /simulate?limit=10000&include_config=true
 */
export async function fetchJobList(config: EvPowerApiConfig): Promise<JobListItem[]> {
  const url = `${config.baseUrl}/simulate?limit=10000&include_config=true`;
  const data = await proxyFetch(url);
  if (!Array.isArray(data)) throw new Error('Job list endpoint did not return an array');
  return data as JobListItem[];
}

/** Delete a single job by ID. DELETE /simulate/{jobId} */
export async function deleteJob(config: EvPowerApiConfig, jobId: string): Promise<void> {
  const url = `${config.baseUrl}/simulate/${encodeURIComponent(jobId)}`;
  await proxyDelete(url);
}

/** Delete all jobs in a group. DELETE /simulate/group/{group} */
export async function deleteGroup(config: EvPowerApiConfig, group: string): Promise<void> {
  const url = `${config.baseUrl}/simulate/group/${encodeURIComponent(group)}`;
  await proxyDelete(url);
}

/**
 * Generic fetch from a full URL — auto-detects response shape.
 */
export async function fetchFromUrl(
  url: string,
  fieldMap?: Record<string, string>
): Promise<SimulationResult[]> {
  const data = await proxyFetch(url);

  let rows: Record<string, unknown>[];

  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (first && 'status' in first && 'result' in first) {
      rows = [];
      for (const job of data as JobResponse[]) {
        if (job.status === 'completed' && Array.isArray(job.result)) {
          rows.push(...job.result);
        }
      }
    } else {
      rows = data as Record<string, unknown>[];
    }
  } else if (data && typeof data === 'object' && 'status' in (data as object) && 'result' in (data as object)) {
    const job = data as JobResponse;
    if (!Array.isArray(job.result)) {
      throw new Error('Job has no result array');
    }
    rows = job.result;
  } else {
    throw new Error('Unrecognized API response shape');
  }

  return applyFieldMap(rows, fieldMap) as SimulationResult[];
}
