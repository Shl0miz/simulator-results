// app/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
    completed: { label: 'Done',    color: '#22c55e' },
    pending:   { label: 'Pending', color: '#f59e0b' },
    running:   { label: 'Running', color: '#3b82f6' },
    failed:    { label: 'Failed',  color: '#ef4444' },
  };
  const { label, color } = cfg[status] ?? { label: status, color: '#686B6D' };
  return (
    <span
      className="text-[10px] px-2 py-0.5 tracking-wider uppercase"
      style={{
        backgroundColor: color + '18',
        color,
        border: `1px solid ${color}44`,
        borderRadius: 3,
        fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
      }}
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
      data.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      setJobs(data);
      const groups = new Set(data.map(j => j.group ?? '__ungrouped__'));
      setExpandedGroups(groups);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setListLoading(false);
    }
  }

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
    <div className="min-h-screen p-8" style={{ background: '#04040B' }}>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between pb-4" style={{ borderBottom: '1px solid #44474F' }}>
          <div>
            <p
              className="text-[9px] tracking-[0.25em] uppercase mb-1"
              style={{ color: '#686B6D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}
            >
              evPower
            </p>
            <h1
              className="text-2xl tracking-widest uppercase"
              style={{
                color: '#EDF0F3',
                fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                fontWeight: 300,
                letterSpacing: '0.15em',
              }}
            >
              Sim Results
            </h1>
            <p className="text-xs mt-1" style={{ color: '#686B6D' }}>
              Simulation Results Viewer
            </p>
          </div>
          <button
            onClick={loadJobList}
            disabled={listLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
            style={{
              background: listLoading ? '#141520' : '#FAFA2D',
              color: listLoading ? '#686B6D' : '#04040B',
              border: '1px solid #44474F',
              borderRadius: 3,
              fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
              fontWeight: 400,
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', listLoading && 'animate-spin')} />
            {listLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {listError && (
          <div
            className="px-4 py-3 text-sm rounded"
            style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444444' }}
          >
            {listError}
          </div>
        )}

        {/* Loading */}
        {listLoading && jobs.length === 0 && (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: '#686B6D' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading jobs...</span>
          </div>
        )}

        {/* Stats */}
        {jobs.length > 0 && (
          <div className="flex gap-5 text-xs" style={{ color: '#686B6D' }}>
            <span style={{ color: '#686B6D' }}>{jobs.length} total</span>
            <span style={{ color: '#22c55e' }}>{jobs.filter(j => j.status === 'completed').length} completed</span>
            <span style={{ color: '#f59e0b' }}>{jobs.filter(j => j.status === 'pending' || j.status === 'running').length} pending</span>
            <span style={{ color: '#ef4444' }}>{jobs.filter(j => j.status === 'failed').length} failed</span>
          </div>
        )}

        {/* Groups */}
        {groups.map(group => {
          const isExpanded = expandedGroups.has(group.name);
          const displayName = group.name === '__ungrouped__' ? 'No Group' : group.name;
          const isGroupLoading = loadingKey === `group:${group.name}`;

          return (
            <div key={group.name} className="overflow-hidden" style={{ border: '1px solid #44474F', borderRadius: 4 }}>
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{ background: '#0D0E14' }}
                onClick={() => toggleGroup(group.name)}
              >
                <span style={{ color: '#44474F' }}>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
                <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: '#FAFA2D' }} />
                <span
                  className="flex-1 text-sm tracking-widest uppercase truncate"
                  style={{
                    color: '#EDF0F3',
                    fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                    fontWeight: 300,
                    letterSpacing: '0.08em',
                    fontSize: '0.7rem',
                  }}
                >
                  {displayName}
                </span>
                <span className="text-xs shrink-0" style={{ color: '#686B6D' }}>
                  {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}
                  {group.completedCount > 0 && ` · ${group.completedCount} done`}
                </span>
                {group.completedCount > 0 && (
                  <button
                    disabled={isGroupLoading || isLoading}
                    onClick={e => { e.stopPropagation(); handleLoadGroup(group.name); }}
                    className="flex items-center gap-1.5 px-3 py-1 text-[10px] tracking-widest uppercase shrink-0 transition-opacity disabled:opacity-50"
                    style={{
                      background: '#FAFA2D',
                      color: '#04040B',
                      borderRadius: 2,
                      fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                    }}
                  >
                    {isGroupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load Group'}
                  </button>
                )}
              </div>

              {/* Jobs list */}
              {isExpanded && (
                <div>
                  {group.jobs.map((job, i) => {
                    const jobName = job.name || job.id;
                    const isJobLoading = loadingKey === `job:${job.id}`;
                    return (
                      <div
                        key={job.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5',
                          i < group.jobs.length - 1 && 'border-b'
                        )}
                        style={{
                          background: '#080810',
                          borderColor: '#44474F33',
                        }}
                      >
                        <FileText className="w-3 h-3 shrink-0" style={{ color: '#44474F' }} />
                        <span className="flex-1 text-xs truncate" style={{ color: '#B1B3B4' }} title={jobName}>
                          {jobName}
                        </span>
                        <StatusBadge status={job.status} />
                        <span className="text-[10px] w-14 text-right shrink-0" style={{ color: '#44474F' }}>
                          {timeAgo(job.created)}
                        </span>
                        {job.status === 'completed' && (
                          <button
                            disabled={isJobLoading || isLoading}
                            onClick={() => handleLoadJob(job.id, job.name ?? '')}
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-wider uppercase shrink-0 transition-opacity disabled:opacity-50"
                            style={{
                              background: 'transparent',
                              color: '#FAFA2D',
                              border: '1px solid #FAFA2D44',
                              borderRadius: 2,
                              fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
                            }}
                          >
                            {isJobLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!listLoading && jobs.length === 0 && !listError && (
          <div className="text-center py-16 text-sm" style={{ color: '#44474F' }}>
            No jobs found. Click Refresh to load.
          </div>
        )}
      </div>
    </div>
  );
}
