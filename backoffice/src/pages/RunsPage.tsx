import React, { useState, useEffect, useCallback } from 'react';
import { History, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Image, Video, AlertCircle, Loader2, RefreshCw, Copy, Check, Trash2, X, FileCheck, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ValidationRecord {
  scene_id: number;
  kf_type: string;
  attempt: number;
  passed: boolean;
  gemini_score: number;
  gemini_is_same_person: boolean | null;
  gemini_scores: Record<string, { score: number; comment: string }>;
  gemini_major_issues: string[];
  face_result: {
    passed: boolean;
    scores: Record<string, number>;
    cumulative_gap: number;
    reason: string | null;
  } | null;
  failures: string[];
  image_path: string;
  description: string | null;
}

interface ValidationReport {
  total_validations: number;
  total_passed: number;
  total_failures: number;
  pass_rate: number;
  all_validations: ValidationRecord[];
  failures: Array<{
    scene_id: number;
    kf_type: string;
    attempt: number;
    gemini_score: number;
    face_result: {
      passed: boolean;
      scores: Record<string, number>;
      cumulative_gap: number;
      reason: string | null;
    } | null;
    failures: string[];
  }>;
  face_validation: {
    total_validations: number;
    passed: number;
    rejected: number;
    pass_rate: number;
    rejected_details: Array<{
      scene_id: number;
      keyframe_type: string;
      attempt: number;
      scores: Record<string, number>;
      cumulative_gap: number;
      reason: string;
    }>;
    config: {
      threshold: number;
      tolerance: number;
      gemini_min: number;
    };
  } | null;
  costs: {
    tokens_input: number;
    tokens_output: number;
    calls: number;
  };
  config?: {
    global_min_score: number;
    validation_criteria: Record<string, { label: string; min: number; ref: string }>;
    model: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const STORAGE_URL = API_URL.replace('/api/v1', '/storage');

interface Run {
  id: number;
  traceId: string;
  status: 'completed' | 'generating' | 'pending' | 'failed';
  progress: number;
  currentStep: string | null;
  stepMessage: string | null;
  scenarioName: string | null;
  scenesCount: number;
  keyframesCount: number | null;
  duration: number | null;
  videoPath: string | null;
  teaserPath: string | null;
  keyframesZipPath: string | null;
  keyframesPaths: string[] | null;
  isPhotosOnly: boolean;
  subliminalText: string | null;
  costEur: number | null;
  costDetails: Record<string, unknown> | null;
  error: string | null;
  canRetry: boolean;
  createdAt: string;
  completedAt: string | null;
  dream: {
    id: number;
    description: string;
    status: string;
    reject: string[];
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  photos: { path: string; verified: boolean }[];
}

type StatusFilter = '' | 'pending' | 'generating' | 'completed' | 'failed';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'generating', label: 'En cours' },
  { value: 'completed', label: 'Termine' },
  { value: 'failed', label: 'Echec' },
];

// Map currentStep to user-friendly labels
const STEP_LABELS: Record<string, string> = {
  'analyze_character': 'Analyse du personnage',
  'extract_dream_elements': 'Analyse du reve',
  'generate_palette': 'Creation de la palette',
  'generate_scenario': 'Creation du scenario',
  'generate_scenes': 'Elaboration des scenes',
  'generate_keyframes': 'Creation des images',
  'generate_videos': 'Creation des videos',
  'assemble_final': 'Assemblage final',
  'completed': 'Termine',
  'failed': 'Echec',
};

// Map cost keys to user-friendly labels
const COST_LABELS: Record<string, string> = {
  'dream_analyzer': 'Analyse du reve',
  'character_analyzer': 'Analyse du personnage',
  'palette_generator': 'Palette de couleurs',
  'scenario_generator': 'Scenario',
  'image_generator': 'Images',
  'image_validator': 'Validation images',
  'video_generator': 'Videos',
  'video_montage': 'Montage final',
};

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green-500',
  generating: 'bg-blue-500 animate-pulse',
  pending: 'bg-gray-400',
  failed: 'bg-red-500',
};

const STATUS_TEXT: Record<string, string> = {
  completed: 'text-green-700',
  generating: 'text-blue-700',
  pending: 'text-gray-500',
  failed: 'text-red-700',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

function formatDuration(createdAt: string, completedAt: string | null): string {
  if (!completedAt) return '\u2014';
  const diffMs = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  if (diffMs < 0) return '\u2014';
  const totalSec = Math.round(diffMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

function formatUserName(firstName: string, lastName: string): string {
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() + '.' : '';
  return `${firstName} ${lastInitial}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-0.5 text-gray-400 hover:text-gray-600" title="Copier">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function RunsPage() {
  const { fetchWithAuth } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Run | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [validationModal, setValidationModal] = useState<{ run: Run; report: ValidationReport | null; loading: boolean } | null>(null);
  const [v7Modal, setV7Modal] = useState<{ run: Run; data: any; loading: boolean } | null>(null);
  const perPage = 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    fetchRuns();
  }, [fetchWithAuth, page, statusFilter]);

  // Auto-refresh every 5s if enabled and there are generating runs
  useEffect(() => {
    if (!autoRefresh) return;
    const hasGenerating = runs.some(r => r.status === 'generating');
    if (!hasGenerating) return;
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, runs]);

  async function fetchRuns() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
      });
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      const response = await fetchWithAuth(`${API_URL}/admin/runs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const toggleExpand = (id: number) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function deleteRun(run: Run) {
    setDeleting(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/admin/runs/${run.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setRuns(prev => prev.filter(r => r.id !== run.id));
        setTotal(prev => prev - 1);
        setDeleteConfirm(null);
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.message || 'Suppression impossible'}`);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  const fetchValidationReport = useCallback(async (run: Run) => {
    setValidationModal({ run, report: null, loading: true });
    try {
      const response = await fetchWithAuth(`${API_URL}/admin/runs/${run.id}/validation`);
      if (response.ok) {
        const data = await response.json();
        setValidationModal({ run, report: data.validationReport, loading: false });
      } else {
        setValidationModal({ run, report: null, loading: false });
      }
    } catch (err) {
      console.error('Error fetching validation report:', err);
      setValidationModal({ run, report: null, loading: false });
    }
  }, [fetchWithAuth]);

  const fetchV7Scenario = useCallback(async (run: Run) => {
    setV7Modal({ run, data: null, loading: true });
    try {
      const response = await fetchWithAuth(`${API_URL}/admin/runs/${run.id}/scenario-v7`);
      if (response.ok) {
        const data = await response.json();
        setV7Modal({ run, data, loading: false });
      } else {
        setV7Modal({ run, data: null, loading: false });
      }
    } catch (err) {
      console.error('Error fetching v7 scenario:', err);
      setV7Modal({ run, data: null, loading: false });
    }
  }, [fetchWithAuth]);

  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Historique des runs</h1>
            <p className="text-xs text-gray-500">{total} run(s) au total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchRuns}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Rafraichir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status filter bar */}
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleStatusFilter(f.value)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              statusFilter === f.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-6"></th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Date</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Duree</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">User</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Reve</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Scenes</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Status</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-left py-1.5 px-2">Cout</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-center py-1.5 px-2">KF</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-center py-1.5 px-2">Video</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-center py-1.5 px-2">Err</th>
                <th className="text-[11px] uppercase text-gray-400 font-medium text-center py-1.5 px-2">Act</th>
              </tr>
            </thead>
            <tbody className="text-xs leading-[15px] divide-y divide-gray-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-6 text-center text-gray-500 text-sm">
                    Aucun run trouve
                  </td>
                </tr>
              ) : (
                runs.map((run) => {
                  const reveText = run.scenarioName || run.dream?.description || '';
                  const isExpanded = expandedRuns.has(run.id);
                  return (
                    <React.Fragment key={run.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(run.id)}>
                        {/* Expand */}
                        <td className="py-1 px-1 text-gray-400">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </td>
                        {/* Date */}
                        <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                          {formatDate(run.createdAt)}
                        </td>
                        {/* Duree */}
                        <td className="py-1 px-2 text-gray-500 whitespace-nowrap">
                          {formatDuration(run.createdAt, run.completedAt)}
                        </td>
                        {/* User */}
                        <td className="py-1 px-2 font-medium whitespace-nowrap">
                          {run.user ? formatUserName(run.user.firstName, run.user.lastName) : '\u2014'}
                        </td>
                        {/* Reve */}
                        <td className="py-1 px-2 truncate max-w-[200px]" title={reveText}>
                          {reveText ? truncate(reveText, 40) : '\u2014'}
                        </td>
                        {/* Scenes */}
                        <td className="py-1 px-2 text-center">
                          {run.scenesCount || '\u2014'}
                        </td>
                        {/* Status */}
                        <td className="py-1 px-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[run.status] || 'bg-gray-400'}`} />
                            <span className={`${STATUS_TEXT[run.status] || 'text-gray-500'}`}>
                              {run.status === 'generating' && run.currentStep
                                ? `${STEP_LABELS[run.currentStep] || run.currentStep} ${run.progress}%`
                                : run.status === 'completed' ? 'Termine'
                                : run.status === 'failed' ? 'Echec'
                                : run.status === 'pending' ? 'En attente'
                                : run.status}
                            </span>
                          </span>
                        </td>
                        {/* Cout */}
                        <td className="py-1 px-2 whitespace-nowrap">
                          {run.costEur != null ? `${run.costEur.toFixed(2)}\u20AC` : '\u2014'}
                        </td>
                        {/* Keyframes */}
                        <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {run.keyframesZipPath ? (
                            <a
                              href={`${STORAGE_URL}/${run.keyframesZipPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-blue-500 hover:text-blue-700"
                              title="Keyframes"
                            >
                              <Image className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-gray-300">{'\u2014'}</span>
                          )}
                        </td>
                        {/* Video */}
                        <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {run.videoPath ? (
                            <a
                              href={`${STORAGE_URL}/${run.videoPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-blue-500 hover:text-blue-700"
                              title="Video"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-gray-300">{'\u2014'}</span>
                          )}
                        </td>
                        {/* Erreur */}
                        <td className="py-1 px-2 text-center">
                          {run.error ? (
                            <span title={run.error} className="inline-flex text-red-500 cursor-help">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                        </td>
                        {/* Actions */}
                        <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setDeleteConfirm(run)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {/* Expanded details */}
                      {isExpanded && (
                        <tr key={`${run.id}-details`} className="bg-gray-50">
                          <td colSpan={12} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              {/* Left column */}
                              <div className="space-y-2">
                                <div>
                                  <span className="text-gray-400 uppercase text-[10px]">Trace ID</span>
                                  <div className="flex items-center gap-1 font-mono text-gray-700">
                                    {run.traceId}
                                    <CopyButton text={run.traceId} />
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400 uppercase text-[10px]">User</span>
                                  <div className="text-gray-700">
                                    {run.user ? `${run.user.firstName} ${run.user.lastName} (${run.user.email})` : '\u2014'}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400 uppercase text-[10px]">Description du reve</span>
                                  <div className="text-gray-700">{run.dream?.description || '\u2014'}</div>
                                </div>
                                {run.dream?.reject?.length > 0 && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Elements rejetes</span>
                                    <div className="text-gray-700">{run.dream.reject.join(', ')}</div>
                                  </div>
                                )}
                                {run.subliminalText && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Texte subliminal</span>
                                    <div className="text-gray-700">{run.subliminalText}</div>
                                  </div>
                                )}
                              </div>
                              {/* Right column */}
                              <div className="space-y-2">
                                {run.status === 'generating' && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Progression</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 transition-all"
                                          style={{ width: `${run.progress}%` }}
                                        />
                                      </div>
                                      <span className="text-gray-700">{run.progress}%</span>
                                    </div>
                                    {run.currentStep && (
                                      <div className="text-gray-500 mt-1">
                                        Step: {run.currentStep}
                                        {run.stepMessage && ` - ${run.stepMessage}`}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {run.error && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Erreur</span>
                                    <pre className="text-red-600 bg-red-50 p-2 rounded text-[10px] overflow-x-auto max-h-32 whitespace-pre-wrap">
                                      {run.error}
                                    </pre>
                                  </div>
                                )}
                                {run.costDetails && Object.keys(run.costDetails).length > 0 && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Detail des couts</span>
                                    <div className="text-gray-700 text-[11px] mt-1">
                                      {Object.entries(run.costDetails).map(([key, val], i) => (
                                        <div key={key} className={`flex justify-between py-0.5 px-1 ${i % 2 === 0 ? 'bg-gray-100' : ''}`}>
                                          <span>{COST_LABELS[key] || key}</span>
                                          <span className="font-mono">{typeof val === 'number' ? `${val.toFixed(4)} \u20AC` : JSON.stringify(val)}</span>
                                        </div>
                                      ))}
                                      {run.costEur != null && (
                                        <div className="flex justify-between py-0.5 px-1 font-semibold border-t border-gray-300 mt-1">
                                          <span>Total</span>
                                          <span className="font-mono">{run.costEur.toFixed(4)} \u20AC</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {run.photos?.length > 0 && (
                                  <div>
                                    <span className="text-gray-400 uppercase text-[10px]">Photos source ({run.photos.length})</span>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {run.photos.slice(0, 8).map((photo, i) => (
                                        <div key={i} className="relative">
                                          <img
                                            src={`${STORAGE_URL}/${photo.path}`}
                                            alt={`Photo ${i + 1}`}
                                            className="w-10 h-10 object-cover rounded border border-gray-200"
                                          />
                                          {!photo.verified && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white" title="Non verifie" />
                                          )}
                                        </div>
                                      ))}
                                      {run.photos.length > 8 && (
                                        <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-[10px]">
                                          +{run.photos.length - 8}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {run.keyframesPaths && run.keyframesPaths.length > 0 && (
                                  <div className="col-span-2">
                                    <span className="text-gray-400 uppercase text-[10px]">Keyframes generees ({run.keyframesPaths.length})</span>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-2">
                                      {run.keyframesPaths.map((kfPath, i) => (
                                        <button
                                          key={i}
                                          onClick={() => setLightboxImage(`${STORAGE_URL}/${kfPath}`)}
                                          className="block aspect-square overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        >
                                          <img
                                            src={`${STORAGE_URL}/${kfPath}`}
                                            alt={`Keyframe ${i + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Validation report + v7 scenario buttons */}
                                {run.status === 'completed' && (
                                  <div className="col-span-2 flex gap-2">
                                    <button
                                      onClick={() => fetchValidationReport(run)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
                                    >
                                      <FileCheck className="w-4 h-4" />
                                      Rapport de validation
                                    </button>
                                    <button
                                      onClick={() => fetchV7Scenario(run)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                      Dialogue v7
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <p className="text-xs text-gray-500">
            {total} run(s)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmer la suppression</h3>
            <p className="text-gray-600 text-sm mb-1">
              Etes-vous sur de vouloir supprimer ce run ?
            </p>
            <p className="text-gray-500 text-xs mb-4">
              <strong>ID:</strong> {deleteConfirm.traceId}<br />
              <strong>User:</strong> {deleteConfirm.user ? `${deleteConfirm.user.firstName} ${deleteConfirm.user.lastName}` : '\u2014'}<br />
              <strong>Reve:</strong> {truncate(deleteConfirm.dream?.description || '', 60)}
            </p>
            <p className="text-red-600 text-xs mb-4">
              Cette action supprimera egalement tous les fichiers associes (videos, keyframes).
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                onClick={() => deleteRun(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg flex items-center gap-2"
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for keyframes */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setLightboxImage(null)}>
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Keyframe"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Validation report modal */}
      {validationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setValidationModal(null)}>
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-purple-600" />
                Rapport de validation - {validationModal.run.traceId}
              </h3>
              <button
                onClick={() => setValidationModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationModal.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : validationModal.report ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-900">{validationModal.report.total_validations || 0}</p>
                    <p className="text-xs text-blue-600">Validations totales</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700">{validationModal.report.total_passed || 0}</p>
                    <p className="text-xs text-green-600">Reussies</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-700">{validationModal.report.total_failures || 0}</p>
                    <p className="text-xs text-red-600">Echecs</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-700">{(validationModal.report.pass_rate || 0).toFixed(0)}%</p>
                    <p className="text-xs text-purple-600">Taux de reussite</p>
                  </div>
                </div>

                {/* Config */}
                {validationModal.report.config && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-600">Score global min:</span>{' '}
                        <span className="font-mono font-semibold">{validationModal.report.config.global_min_score}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Modele:</span>{' '}
                        <span className="font-mono">{validationModal.report.config.model || 'N/A'}</span>
                      </div>
                    </div>
                    {validationModal.report.config.validation_criteria && Object.keys(validationModal.report.config.validation_criteria).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Criteres de validation:</p>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          {Object.entries(validationModal.report.config.validation_criteria).map(([code, cfg]) => (
                            <div key={code} className="flex justify-between bg-white px-2 py-1 rounded">
                              <span className="font-medium">{code}</span>
                              <span className="text-gray-500">min: {(cfg as any).min}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* All validations with full Gemini details */}
                {validationModal.report.all_validations && validationModal.report.all_validations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Toutes les validations ({validationModal.report.all_validations.length})</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {validationModal.report.all_validations.map((v, i) => (
                        <div key={i} className={`p-3 rounded-lg text-xs ${v.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold ${v.passed ? 'text-green-800' : 'text-red-800'}`}>
                              {v.passed ? '✅' : '❌'} Scene {v.scene_id} - {v.kf_type} (tentative {v.attempt})
                            </span>
                            <span className={`font-mono ${v.passed ? 'text-green-600' : 'text-red-600'}`}>
                              Score global: {v.gemini_score?.toFixed(2) || 'N/A'}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-gray-600 text-[10px] mb-2 italic">"{v.description}"</p>
                          )}
                          {/* Gemini scores by criterion */}
                          {v.gemini_scores && Object.keys(v.gemini_scores).length > 0 && (
                            <div className="mb-2">
                              <p className="text-[10px] text-gray-500 mb-1">Scores Gemini par critere:</p>
                              <div className="grid grid-cols-2 gap-1">
                                {Object.entries(v.gemini_scores).map(([code, data]) => {
                                  const scoreData = data as { score: number; comment: string };
                                  const score = typeof scoreData === 'object' ? scoreData.score : scoreData;
                                  const comment = typeof scoreData === 'object' ? scoreData.comment : '';
                                  return (
                                    <div key={code} className="bg-white/50 px-2 py-1 rounded text-[10px]">
                                      <div className="flex justify-between">
                                        <span className="font-medium">{code}</span>
                                        <span className={`font-mono ${(score as number) >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                                          {typeof score === 'number' ? score.toFixed(2) : score}
                                        </span>
                                      </div>
                                      {comment && <p className="text-gray-500 truncate" title={comment}>{comment}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Face validation */}
                          {v.face_result && (
                            <div className="text-[10px] mb-1">
                              <span className="font-medium">Face:</span>{' '}
                              {Object.entries(v.face_result.scores).map(([k, val]) => (
                                <span key={k} className="mr-2">{k}: {(val as number).toFixed(3)}</span>
                              ))}
                              <span className="ml-2">Gap: {v.face_result.cumulative_gap?.toFixed(3)}</span>
                            </div>
                          )}
                          {/* Major issues */}
                          {v.gemini_major_issues && v.gemini_major_issues.length > 0 && (
                            <div className="text-red-600 text-[10px]">
                              <span className="font-medium">Issues:</span> {v.gemini_major_issues.join(', ')}
                            </div>
                          )}
                          {/* Failures */}
                          {v.failures && v.failures.length > 0 && (
                            <div className="text-red-600 text-[10px] mt-1">
                              {v.failures.join(' | ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Face validation summary */}
                {validationModal.report.face_validation && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-orange-800 mb-2">Validation faciale (DeepFace + ArcFace)</h4>
                    <div className="grid grid-cols-4 gap-4 text-xs mb-2">
                      <div>
                        <span className="text-orange-600">Total:</span>{' '}
                        <span className="font-mono">{validationModal.report.face_validation.total_validations}</span>
                      </div>
                      <div>
                        <span className="text-orange-600">Reussies:</span>{' '}
                        <span className="font-mono text-green-600">{validationModal.report.face_validation.passed}</span>
                      </div>
                      <div>
                        <span className="text-orange-600">Rejetees:</span>{' '}
                        <span className="font-mono text-red-600">{validationModal.report.face_validation.rejected}</span>
                      </div>
                      <div>
                        <span className="text-orange-600">Taux:</span>{' '}
                        <span className="font-mono">{validationModal.report.face_validation.pass_rate?.toFixed(0)}%</span>
                      </div>
                    </div>
                    {validationModal.report.face_validation.config && (
                      <div className="text-[10px] text-orange-700">
                        Config: seuil={validationModal.report.face_validation.config.threshold}, tolerance={validationModal.report.face_validation.config.tolerance}
                      </div>
                    )}
                  </div>
                )}

                {/* Costs */}
                {validationModal.report.costs && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Couts validation (Gemini)</h4>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-gray-600">Tokens input:</span>{' '}
                        <span className="font-mono">{validationModal.report.costs.tokens_input.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tokens output:</span>{' '}
                        <span className="font-mono">{validationModal.report.costs.tokens_output.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Appels:</span>{' '}
                        <span className="font-mono">{validationModal.report.costs.calls}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun rapport de validation disponible pour ce run.</p>
                <p className="text-xs mt-2">Le fichier validation_report.json n'a pas ete trouve.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* V7 Scenario dialog modal */}
      {v7Modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setV7Modal(null)}>
          <div
            className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                Dialogue v7 - {v7Modal.run.traceId}
              </h3>
              <button
                onClick={() => setV7Modal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {v7Modal.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : v7Modal.data?.hasV7 ? (
              <div className="space-y-6">
                {/* Metadata */}
                {v7Modal.data.scenarioV7?.metadata && (
                  <div className="grid grid-cols-5 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-blue-900">{v7Modal.data.scenarioV7.metadata.nb_scenes}</p>
                      <p className="text-[10px] text-blue-600">Scenes</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-green-900">{v7Modal.data.scenarioV7.metadata.duree_totale}s</p>
                      <p className="text-[10px] text-green-600">Duree totale</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-purple-900">{v7Modal.data.scenarioV7.metadata.llm_calls}</p>
                      <p className="text-[10px] text-purple-600">Appels LLM</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-orange-900">{v7Modal.data.scenarioV7.metadata.tokens_total?.toLocaleString()}</p>
                      <p className="text-[10px] text-orange-600">Tokens</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-center">
                      <p className="text-xl font-bold text-red-900">${v7Modal.data.scenarioV7.metadata.cost_usd?.toFixed(2)}</p>
                      <p className="text-[10px] text-red-600">Cout USD</p>
                    </div>
                  </div>
                )}

                {/* Pitch global */}
                {v7Modal.data.scenarioV7?.pitch_global && (
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-indigo-800 mb-2">Pitch global</h4>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">
                      {typeof v7Modal.data.scenarioV7.pitch_global === 'string'
                        ? v7Modal.data.scenarioV7.pitch_global
                        : v7Modal.data.scenarioV7.pitch_global?.answer || JSON.stringify(v7Modal.data.scenarioV7.pitch_global, null, 2)}
                    </p>
                  </div>
                )}

                {/* Blocages emotionnels */}
                {v7Modal.data.scenarioV7?.blocages_emotionnels && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2">Blocages emotionnels & Affirmations</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-amber-600 font-semibold mb-1">Blocages</p>
                        {(v7Modal.data.scenarioV7.blocages_emotionnels.blocages || []).map((b: string, i: number) => (
                          <p key={i} className="text-xs text-gray-700">- {b}</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-green-600 font-semibold mb-1">Affirmations</p>
                        {(v7Modal.data.scenarioV7.blocages_emotionnels.affirmations || []).map((a: string, i: number) => (
                          <p key={i} className="text-xs text-gray-700">+ {a}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Scenes comparison FR/EN */}
                {v7Modal.data.scenariosFr && v7Modal.data.scenariosEn && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">
                      Scenes video ({v7Modal.data.scenariosFr.length} scenes - FR → EN)
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {v7Modal.data.scenariosFr.map((fr: any, i: number) => {
                        const en = v7Modal.data.scenariosEn[i] || {};
                        return (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg text-xs border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-800">Scene {fr.scene_id}</span>
                              <span className="text-[10px] text-gray-500">
                                {fr.shooting?.shot_type} | {fr.shooting?.camera_movement} | {fr.shooting?.camera_angle}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-[10px] text-blue-600 font-semibold mb-1">FR (original)</p>
                                <p className="text-gray-700">{fr.start_keyframe?.description || '-'}</p>
                                <p className="text-gray-500 mt-1 italic">{fr.action || '-'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-green-600 font-semibold mb-1">EN (traduit)</p>
                                <p className="text-gray-700">{en.start_keyframe?.description || '-'}</p>
                                <p className="text-gray-500 mt-1 italic">{en.action || '-'}</p>
                              </div>
                            </div>
                            {fr.prompt_video && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-[10px] text-purple-600 font-semibold mb-1">Prompt video (EN)</p>
                                <p className="text-gray-600 text-[10px]">{en.prompt_video || fr.prompt_video}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Palettes */}
                {v7Modal.data.scenarioV7?.palette_globale && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Palette globale</h4>
                    <div className="flex gap-2">
                      {Object.entries(v7Modal.data.scenarioV7.palette_globale).map(([name, hex]) => (
                        <div key={name} className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-lg border border-gray-200" style={{ backgroundColor: hex as string }} />
                          <span className="text-[9px] text-gray-500">{name}</span>
                          <span className="text-[9px] font-mono text-gray-400">{hex as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit log (dialogue IA) */}
                {v7Modal.data.auditLog && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">
                      Journal d'audit ({v7Modal.data.auditLog.entries_count} entrees - {v7Modal.data.auditLog.duration_seconds}s)
                    </h4>
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-[10px] max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                      {(v7Modal.data.auditLog.entries || []).map((entry: string, i: number) => (
                        <div key={i} className={
                          entry.includes('======') ? 'text-yellow-300 font-bold mt-2' :
                          entry.includes('------') ? 'text-gray-500' :
                          entry.includes('PASS') ? 'text-green-400' :
                          entry.includes('FAIL') ? 'text-red-400' :
                          entry.startsWith('[') ? 'text-cyan-300' :
                          'text-gray-300'
                        }>
                          {entry}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun dialogue v7 disponible pour ce run.</p>
                <p className="text-xs mt-2">Ce run n'utilise peut-etre pas le mode scenario v7.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
