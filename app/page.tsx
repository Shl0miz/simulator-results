// app/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchGroupResults, fetchJobResults, fetchJobList } from '@/lib/apiClient';
import type { JobListItem, EvPowerApiConfig } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfigJson from '@/config/api.config.json';
import { RefreshCw, ChevronDown, ChevronRight, Loader2, Layers, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const apiConfig = apiConfigJson as EvPowerApiConfig;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    completed: { label: 'Done', color: '#22c55e' },
    pending:   { label: 'Pending', color: '#f59e0b' },
    running:   { label: 'Running', color: '#3b82f6' },
    failed:    { label: 'Failed', color: '#ef4444' },
  };
  const { label, color } = cfg[status] ?? { label: status, color: '#6b7280' };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

interface GroupedJobs {
  name: string;
  jobs: JobListItem[];
  completedCount: number;
}

export default function LandingPage() {
  const router = useRouter();
  const { setRows, setLoading, isLoading, setLoadedUrl, setSourceKey } = useSimulationStore();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function loadJobList() {
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchJobList(apiConfig);
      // Sort newest first
      data.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      setJobs(data);
      // Auto-expand all groups that have jobs
      const groups = new Set(data.map(j => j.group ?? '__ungrouped__'));
      setExpandedGroups(groups);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setListLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => { loadJobList(); }, []);

  const groups: GroupedJobs[] = useMemo(() => {
    const map = new Map<string, JobListItem[]>();
    for (const job of jobs) {
      const key = job.group ?? '__ungrouped__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return Array.from(map.entries())
      .map(([name, groupJobs]) => ({
        name,
        jobs: groupJobs,
        completedCount: groupJobs.filter(j => j.status === 'completed').length,
      }))
      .sort((a, b) => {
        if (a.name === '__ungrouped__') return 1;
        if (b.name === '__ungrouped__') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [jobs]);

  async function handleLoadGroup(groupName: string) {
    const key = `group:${groupName}`;
    setLoadingKey(key);
    setLoading(true);
    try {
      const raw = await fetchGroupResults(apiConfig, groupName);
      const enriched = enrichRows(raw);
      setRows(enriched);
      setLoadedUrl(`group: ${groupName}`);
      setSourceKey(`group:${groupName}`);
      router.push(`/dashboard?group=${encodeURIComponent(groupName)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingKey(null);
    }
  }

  async function handleLoadJob(jobId: string, jobName: string) {
    const key = `job:${jobId}`;
    setLoadingKey(key);
    setLoading(true);
    try {
      const raw = await fetchJobResults(apiConfig, jobId);
      const enriched = enrichRows(raw);
      setRows(enriched);
      setLoadedUrl(`job: ${jobName || jobId}`);
      setSourceKey(`job:${jobId}`);
      router.push(`/dashboard?job=${encodeURIComponent(jobId)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingKey(null);
    }
  }

  function toggleGroup(name: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'oklch(0.08 0.02 265)' }}>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between py-2">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sim Results</h1>
            <p className="text-slate-400 text-sm">evPower Simulation Results Viewer</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobList}
            disabled={listLoading}
            className="border-slate-600 text-slate-300 hover:text-white gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', listLoading && 'animate-spin')} />
            {listLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {/* Error */}
        {listError && (
          <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-red-400 text-sm">
            {listError}
          </div>
        )}

        {/* Loading skeleton */}
        {listLoading && jobs.length === 0 && (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading jobs...
          </div>
        )}

        {/* Stats row */}
        {jobs.length > 0 && (
          <div className="flex gap-4 text-xs text-slate-500">
            <span>{jobs.length} jobs total</span>
            <span className="text-green-400">{jobs.filter(j => j.status === 'completed').length} completed</span>
            <span className="text-yellow-400">{jobs.filter(j => j.status === 'pending' || j.status === 'running').length} pending</span>
            <span className="text-red-400">{jobs.filter(j => j.status === 'failed').length} failed</span>
          </div>
        )}

        {/* Groups */}
        {groups.map(group => {
          const isExpanded = expandedGroups.has(group.name);
          const displayName = group.name === '__ungrouped__' ? 'No Group' : group.name;
          const isGroupLoading = loadingKey === `group:${group.name}`;

          return (
            <Card key={group.name} className="border-slate-700 overflow-hidden"
                  style={{ background: 'oklch(0.12 0.025 265)' }}>
              {/* Group header */}
              <CardHeader className="p-0">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                     onClick={() => toggleGroup(group.name)}>
                  <span className="text-slate-500">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="flex-1 font-medium text-white text-sm">{displayName}</span>
                  <span className="text-xs text-slate-500">
                    {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}
                    {group.completedCount > 0 && ` · ${group.completedCount} done`}
                  </span>
                  {group.completedCount > 0 && (
                    <Button
                      size="sm"
                      disabled={isGroupLoading || isLoading}
                      onClick={e => { e.stopPropagation(); handleLoadGroup(group.name); }}
                      className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white shrink-0"
                    >
                      {isGroupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load Group'}
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Jobs list */}
              {isExpanded && (
                <CardContent className="p-0">
                  {group.jobs.map((job, i) => {
                    const jobName = job.name || job.id;
                    const isJobLoading = loadingKey === `job:${job.id}`;
                    return (
                      <div
                        key={job.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 text-sm',
                          i < group.jobs.length - 1 && 'border-b border-slate-800/60',
                          'hover:bg-white/3 transition-colors'
                        )}
                        style={{ background: 'oklch(0.10 0.02 265)' }}
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="flex-1 text-slate-300 truncate" title={jobName}>{jobName}</span>
                        <StatusBadge status={job.status} />
                        <span className="text-xs text-slate-600 w-16 text-right shrink-0">
                          {timeAgo(job.created)}
                        </span>
                        {job.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isJobLoading || isLoading}
                            onClick={() => handleLoadJob(job.id, job.name ?? '')}
                            className="h-6 px-2 text-xs border-slate-600 text-slate-400 hover:text-white shrink-0"
                          >
                            {isJobLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}

        {!listLoading && jobs.length === 0 && !listError && (
          <div className="text-center py-16 text-slate-500">
            No jobs found. Click Refresh to load.
          </div>
        )}
      </div>
    </div>
  );
}
