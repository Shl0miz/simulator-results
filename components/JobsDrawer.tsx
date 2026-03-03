// components/JobsDrawer.tsx
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/store/simulationStore';
import { fetchGroupResults, fetchJobResults, fetchJobList, deleteJob, deleteGroup } from '@/lib/apiClient';
import type { JobListItem, EvPowerApiConfig } from '@/lib/apiClient';
import { enrichRows } from '@/lib/compute';
import apiConfigJson from '@/config/api.config.json';
import {
  RefreshCw, ChevronDown, ChevronRight, Loader2, Layers, FileText,
  Trash2, Copy, Check, X,
} from 'lucide-react';
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

const STATUS_CFG: Record<string, { color: string }> = {
  completed: { color: '#22c55e' },
  pending:   { color: '#f59e0b' },
  running:   { color: '#3b82f6' },
  failed:    { color: '#ef4444' },
};

function StatusDot({ status }: { status: string }) {
  const { color } = STATUS_CFG[status] ?? { color: '#686B6D' };
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, display: 'inline-block' }} />;
}

function CopyConfigBtn({ config }: { config?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!config) return null;
  const cfg = config;
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try { navigator.clipboard.writeText(JSON.stringify(JSON.parse(cfg), null, 2)); }
    catch { navigator.clipboard.writeText(cfg); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} title="Copy config" className="opacity-40 hover:opacity-100 transition-opacity" style={{ color: copied ? '#22c55e' : '#B1B3B4', lineHeight: 1 }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

interface GroupedJobs { name: string; jobs: JobListItem[]; completedCount: number; latestCreated: number; }

interface JobsDrawerProps {
  onClose: () => void;
}

export function JobsDrawer({ onClose }: JobsDrawerProps) {
  const router = useRouter();
  const { setRows, setLoading, isLoading, setLoadedUrl, setSourceKey } = useSimulationStore();

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadJobList = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadJobList(); }, [loadJobList]);

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
        latestCreated: Math.max(...groupJobs.map(j => new Date(j.created).getTime())),
      }))
      .sort((a, b) => {
        if (a.name === '__ungrouped__') return 1;
        if (b.name === '__ungrouped__') return -1;
        return b.latestCreated - a.latestCreated;
      });
  }, [jobs]);

  const anyLoading = isLoading || !!loadingKey;

  async function handleLoadSelected() {
    if (selectedGroups.size === 0) return;
    const groupNames = Array.from(selectedGroups);
    const key = groupNames.length === 1 ? `group:${groupNames[0]}` : `groups:${groupNames.join(',')}`;
    setLoadingKey(key);
    setLoading(true);
    try {
      const allResults = await Promise.all(groupNames.map(g => fetchGroupResults(apiConfig, g)));
      const enriched = enrichRows(allResults.flat());
      setRows(enriched);
      const label = groupNames.length === 1 ? `group: ${groupNames[0]}` : `${groupNames.length} groups`;
      setLoadedUrl(label);
      setSourceKey(key);
      const qs = groupNames.length === 1
        ? `?group=${encodeURIComponent(groupNames[0])}`
        : `?groups=${groupNames.map(encodeURIComponent).join(',')}`;
      onClose();
      router.push(`/dashboard${qs}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingKey(null);
    }
  }

  async function handleLoadJob(jobId: string, jobName: string) {
    setLoadingKey(`job:${jobId}`);
    setLoading(true);
    try {
      const raw = await fetchJobResults(apiConfig, jobId);
      const enriched = enrichRows(raw);
      setRows(enriched);
      setLoadedUrl(`job: ${jobName || jobId}`);
      setSourceKey(`job:${jobId}`);
      onClose();
      router.push(`/dashboard?job=${encodeURIComponent(jobId)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLoadingKey(null);
    }
  }

  async function handleDeleteGroup(groupName: string) {
    if (!confirm(`Delete all jobs in group "${groupName}"? This cannot be undone.`)) return;
    setDeletingKey(`group:${groupName}`);
    try {
      await deleteGroup(apiConfig, groupName);
      setJobs(prev => prev.filter(j => (j.group ?? '__ungrouped__') !== groupName));
      setSelectedGroups(prev => { const n = new Set(prev); n.delete(groupName); return n; });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleDeleteJob(jobId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this job? This cannot be undone.')) return;
    setDeletingKey(`job:${jobId}`);
    try {
      await deleteJob(apiConfig, jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingKey(null);
    }
  }

  function toggleSelectGroup(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedGroups(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  }

  function toggleGroup(name: string) {
    setExpandedGroups(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#04040B' }}>
      {/* Drawer top bar */}
      <div
        className="flex items-center justify-between px-4 h-10 shrink-0"
        style={{ borderBottom: '1px solid #44474F' }}
      >
        <div className="flex items-center gap-3">
          <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: '#FAFA2D', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif' }}>
            Change Dataset
          </p>
          {selectedGroups.size > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#FAFA2D18', color: '#FAFA2D', border: '1px solid #FAFA2D44' }}>
              {selectedGroups.size} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobList}
            disabled={listLoading}
            className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-widest uppercase disabled:opacity-50"
            style={{ color: '#686B6D', border: '1px solid #44474F', borderRadius: 2 }}
          >
            <RefreshCw className={cn('w-2.5 h-2.5', listLoading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 text-[9px] tracking-widest uppercase"
            style={{ color: '#686B6D', border: '1px solid #44474F', borderRadius: 2 }}
          >
            <X className="w-2.5 h-2.5" />
            Close
          </button>
        </div>
      </div>

      {/* Scrollable job list */}
      <div className="flex-1 overflow-auto p-3">
        <div className="max-w-2xl mx-auto space-y-2">

          {listError && (
            <div className="px-3 py-2 text-xs rounded" style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444444' }}>
              {listError}
            </div>
          )}

          {listLoading && jobs.length === 0 && (
            <div className="flex items-center justify-center py-10 gap-2" style={{ color: '#686B6D' }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Loading jobs...</span>
            </div>
          )}

          {jobs.length > 0 && (
            <div className="flex gap-3 text-[10px] pb-1" style={{ color: '#686B6D' }}>
              <span>{jobs.length} jobs</span>
              <span style={{ color: '#22c55e' }}>{jobs.filter(j => j.status === 'completed').length} done</span>
              <span style={{ color: '#f59e0b' }}>{jobs.filter(j => j.status === 'pending' || j.status === 'running').length} pending</span>
            </div>
          )}

          {groups.map(group => {
            const isExpanded = expandedGroups.has(group.name);
            const isSelected = selectedGroups.has(group.name);
            const displayName = group.name === '__ungrouped__' ? 'No Group' : group.name;
            const isGroupDeleting = deletingKey === `group:${group.name}`;

            return (
              <div key={group.name} className="overflow-hidden" style={{ border: `1px solid ${isSelected ? '#FAFA2D44' : '#44474F'}`, borderRadius: 3 }}>
                <div
                  className="flex items-center gap-2 px-3 h-9 cursor-pointer select-none"
                  style={{ background: isSelected ? '#111113' : '#0D0E14' }}
                  onClick={() => toggleGroup(group.name)}
                >
                  {group.completedCount > 0 ? (
                    <div
                      className="w-3.5 h-3.5 rounded-sm shrink-0 flex items-center justify-center"
                      style={{ background: isSelected ? '#FAFA2D' : 'transparent', border: `1px solid ${isSelected ? '#FAFA2D' : '#44474F'}` }}
                      onClick={e => toggleSelectGroup(group.name, e)}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5" style={{ color: '#04040B' }} />}
                    </div>
                  ) : <div className="w-3.5 shrink-0" />}
                  <span style={{ color: '#44474F' }}>{isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                  <Layers className="w-3 h-3 shrink-0" style={{ color: isSelected ? '#FAFA2D' : '#686B6D' }} />
                  <span className="flex-1 truncate" style={{ color: isSelected ? '#FAFA2D' : '#EDF0F3', fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif', fontWeight: 300, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {displayName}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: '#44474F' }}>
                    {group.jobs.length}j · {group.completedCount}✓ · {timeAgo(new Date(group.latestCreated).toISOString())}
                  </span>
                  <button
                    disabled={isGroupDeleting || anyLoading}
                    onClick={e => { e.stopPropagation(); handleDeleteGroup(group.name); }}
                    className="opacity-30 hover:opacity-80 transition-opacity shrink-0 disabled:opacity-20"
                    style={{ color: '#ef4444', lineHeight: 1 }}
                  >
                    {isGroupDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>

                {isExpanded && (
                  <div>
                    {group.jobs.map(job => {
                      const jobName = job.name || job.id.slice(0, 8) + '…';
                      const isJobDeleting = deletingKey === `job:${job.id}`;
                      const isJobLoading = loadingKey === `job:${job.id}`;
                      return (
                        <div key={job.id} className="flex items-center gap-2 px-3 h-7" style={{ background: '#080810', borderTop: '1px solid #1A1B22' }}>
                          <div className="w-3.5 shrink-0" />
                          <div className="w-3 shrink-0" />
                          <StatusDot status={job.status} />
                          <span className="flex-1 text-[11px] truncate" style={{ color: '#B1B3B4' }} title={job.name ?? job.id}>{jobName}</span>
                          <span className="text-[10px] shrink-0 tabular-nums" style={{ color: '#44474F' }}>{timeAgo(job.created)}</span>
                          {job.run_duration != null && (
                            <span className="text-[9px] shrink-0" style={{ color: '#44474F' }}>{job.run_duration.toFixed(0)}s</span>
                          )}
                          <CopyConfigBtn config={job.config} />
                          <button
                            disabled={isJobDeleting || anyLoading}
                            onClick={e => handleDeleteJob(job.id, e)}
                            className="opacity-30 hover:opacity-80 transition-opacity shrink-0 disabled:opacity-20"
                            style={{ color: '#ef4444', lineHeight: 1 }}
                          >
                            {isJobDeleting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                          </button>
                          {job.status === 'completed' && (
                            <button
                              disabled={isJobLoading || anyLoading}
                              onClick={() => handleLoadJob(job.id, job.name ?? '')}
                              className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 shrink-0 disabled:opacity-40"
                              style={{ color: '#FAFA2D', border: '1px solid #FAFA2D33', borderRadius: 2 }}
                            >
                              {isJobLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Load'}
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
            <div className="text-center py-10 text-xs" style={{ color: '#44474F' }}>No jobs found.</div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderTop: '1px solid #44474F' }}
      >
        <span className="text-[10px]" style={{ color: '#686B6D' }}>
          {selectedGroups.size > 0 ? `${selectedGroups.size} group${selectedGroups.size > 1 ? 's' : ''} selected` : 'Select groups above'}
        </span>
        <button
          onClick={handleLoadSelected}
          disabled={selectedGroups.size === 0 || anyLoading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] tracking-widest uppercase disabled:opacity-40 transition-all"
          style={{
            background: selectedGroups.size > 0 ? '#FAFA2D' : '#141520',
            color: selectedGroups.size > 0 ? '#04040B' : '#686B6D',
            border: `1px solid ${selectedGroups.size > 0 ? '#FAFA2D' : '#44474F'}`,
            borderRadius: 2,
            fontFamily: 'Mona Sans, Plus Jakarta Sans, sans-serif',
          }}
        >
          {anyLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</> : <>Load {selectedGroups.size > 0 ? selectedGroups.size : ''} Group{selectedGroups.size !== 1 ? 's' : ''}</>}
        </button>
      </div>
    </div>
  );
}
