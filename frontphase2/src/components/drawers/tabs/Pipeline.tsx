'use client';

import React from 'react';
import { DrawerSectionCard, DRAWER_LIST_SHELL } from '../drawerFormUi';
import { GitBranch, Plus, GripVertical, Clock, Trash2 } from 'lucide-react';
import { requestConfirm, requestInfo, requestError } from '../../../lib/appDialog';
import { apiResetJobPipelineToOrgTemplate } from '../../../lib/api';
import type { PipelineTabProps } from '../jobDrawerTabProps';

export function PipelineTab(props: PipelineTabProps) {
  const {
    PIPELINE_SYSTEM_ROLE_OPTIONS,
    draggedStageId,
    handleAddStage,
    handlePipelineReorder,
    handleRemoveStage,
    handleStageNameChange,
    handleStageSlaChange,
    handleStageSystemRoleChange,
    isDefaultPipelineStage,
    job,
    notifyPipelineChange,
    onSavePipelineStages,
    pipelineConfigLocked,
    pipelineDirty,
    pipelineStageCountCards,
    pipelineStages,
    pipelineValidationError,
    setDraggedStageId,
    setJobPipelineCustomized,
    setPipelineDirty,
    setPipelineStages,
    setPipelineValidationError,
  } = props;

  return (
<div className="space-y-5">
                  <DrawerSectionCard
                    title="Stage Counts"
                    subtitle="Candidates per pipeline stage"
                    icon={GitBranch}
                    accent="emerald"
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {pipelineStageCountCards.map((stage: any) => (
                        <div key={stage.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                          <p className="truncate text-[10px] font-bold uppercase text-slate-400" title={stage.name}>
                            {stage.name}
                          </p>
                          <p className="mt-1 text-xl font-bold text-slate-900">{stage.count}</p>
                        </div>
                      ))}
                    </div>
                  </DrawerSectionCard>

                  <DrawerSectionCard
                    title="Pipeline Configuration"
                    subtitle={
                      pipelineConfigLocked
                        ? 'Organization default pipeline from Settings'
                        : 'Custom hiring pipeline for this job'
                    }
                    icon={GitBranch}
                    accent="indigo"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500">
                          {pipelineConfigLocked
                            ? 'Use “Customize pipeline” to define stages for this job only.'
                            : 'Drag to reorder, add or remove stages.'}
                        </p>
                        <p className="mt-1 text-[11px] text-amber-600">Note: SLA values are currently display-only and are not persisted yet.</p>
                      </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {job?.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await requestConfirm(
                                  'Reset this job\'s pipeline to the organization default template? This wipes the current stages and any candidates already on them.',
                                  {
                                    tone: 'warning',
                                    confirmLabel: 'Reset pipeline',
                                    cancelLabel: 'Cancel',
                                  }
                                );
                                if (!ok) return;
                                try {
                                  const res = await apiResetJobPipelineToOrgTemplate(job.id);
                                  const stages = res.data?.stages || [];
                                  const mapped = stages.map((s: any) => ({
                                    id: String(s.id),
                                    name: String(s.name || ''),
                                    sla: '',
                                    systemRole: s.systemRole || undefined,
                                  }));
                                  setPipelineStages(mapped);
                                  notifyPipelineChange(mapped);
                                  setPipelineDirty(false);
                                  setJobPipelineCustomized(false);
                                  void requestInfo('Pipeline reset to org default');
                                } catch (err: any) {
                                  void requestError(err?.message || 'Failed to reset pipeline');
                                }
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                              title="Replace this job's stages with the saved org template"
                            >
                              Reset to org default
                            </button>
                          )}
                          {pipelineConfigLocked ? (
                            <button
                              type="button"
                              onClick={() => setJobPipelineCustomized(true)}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              Customize pipeline
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setJobPipelineCustomized(false);
                                setPipelineDirty(false);
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                            >
                              Use org default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (pipelineConfigLocked) return;
                              const hasEmptyStageName = pipelineStages.some(
                                (stage: any) => String(stage.name || '').trim().length === 0
                              );
                              if (hasEmptyStageName) {
                                setPipelineValidationError('Please enter a stage name for all pipeline stages before saving.');
                                return;
                              }
                              const stagesForSave = pipelineStages.map((stage: any) => ({
                                ...stage,
                                name: String(stage.name || '').trim(),
                                systemRole: stage.systemRole && String(stage.systemRole).trim()
                                  ? String(stage.systemRole).trim()
                                  : undefined,
                              }));
                              setPipelineStages(stagesForSave);
                              notifyPipelineChange(stagesForSave);
                              onSavePipelineStages?.(stagesForSave);
                              setPipelineValidationError('');
                              setPipelineDirty(false);
                            }}
                            disabled={!pipelineDirty || pipelineConfigLocked}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              pipelineDirty && !pipelineConfigLocked
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            Save pipeline
                          </button>
                        </div>
                      </div>
                      {!pipelineConfigLocked && (
                        <button
                          type="button"
                          onClick={handleAddStage}
                          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                        >
                          <Plus size={14} /> Add stage
                        </button>
                      )}
                      {pipelineValidationError ? (
                        <p className="mt-3 text-xs font-medium text-red-600">{pipelineValidationError}</p>
                      ) : null}
                    <div className={`mt-4 ${DRAWER_LIST_SHELL}`}>
                      {pipelineStages.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No stages yet. Click &quot;+ Add stage&quot; to build your pipeline, then &quot;Save pipeline&quot; when done.
                        </div>
                      ) : (
                        pipelineStages.map((stage: any, index: any) => (
                          <div
                            key={stage.id}
                            draggable={!pipelineConfigLocked}
                            onDragStart={() => {
                              if (pipelineConfigLocked) return;
                              setDraggedStageId(stage.id);
                            }}
                            onDragOver={(e: any) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                            }}
                            onDrop={(e: any) => {
                              if (pipelineConfigLocked) return;
                              e.preventDefault();
                              if (!draggedStageId || draggedStageId === stage.id) return;
                              const from = pipelineStages.findIndex((s: any) => s.id === draggedStageId);
                              const to = index;
                              if (from >= 0 && to >= 0) handlePipelineReorder(from, to);
                              setDraggedStageId(null);
                            }}
                            onDragEnd={() => setDraggedStageId(null)}
                            className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-50/50 ${
                              draggedStageId === stage.id ? 'opacity-50' : ''
                            }`}
                          >
                            <span
                              className={`shrink-0 ${pipelineConfigLocked ? 'text-slate-200' : 'cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600'}`}
                              aria-label="Drag to reorder"
                            >
                              <GripVertical size={18} />
                            </span>
                            <span className="text-sm font-medium text-slate-500 w-8 shrink-0">{index + 1}</span>
                            {pipelineConfigLocked ? (
                              <span className="flex-1 min-w-0 text-sm font-medium text-slate-900">{stage.name}</span>
                            ) : (
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e: any) => handleStageNameChange(stage.id, e.target.value)}
                                className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="Stage name"
                              />
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Role</span>
                              {pipelineConfigLocked ? (
                                <span className="text-xs font-medium text-slate-600 min-w-[100px]">
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.find((o: any) => o.value === (stage.systemRole || ''))?.label ||
                                    stage.systemRole ||
                                    '—'}
                                </span>
                              ) : (
                                <select
                                  value={stage.systemRole || ''}
                                  onChange={(e: any) => handleStageSystemRoleChange(stage.id, e.target.value)}
                                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 min-w-[128px]"
                                >
                                  {PIPELINE_SYSTEM_ROLE_OPTIONS.map((o: any) => (
                                    <option key={o.value || 'unset'} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 w-28">
                              <Clock size={14} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={stage.sla ?? ''}
                                onChange={(e: any) => handleStageSlaChange(stage.id, e.target.value)}
                                placeholder="e.g. 2 days"
                                disabled
                                title="SLA persistence is not enabled yet"
                                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                              />
                            </div>
                            {!pipelineConfigLocked && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStage(stage.id)}
                                disabled={isDefaultPipelineStage(stage)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                aria-label="Remove stage"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </DrawerSectionCard>
                </div>
  );
}
