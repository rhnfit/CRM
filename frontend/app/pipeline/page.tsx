'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CrmShell } from '../../components/ui/crm-shell';
import { Button } from '../../components/ui/button';
import { apiFetch, getToken } from '../../lib/api';

type BoardLead = {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  leadScore: number;
  assignedTo: string;
  nextFollowupAt: string | null;
  kanbanOrder: number;
  stageId: string | null;
  pipelineId: string | null;
  updatedAt: string;
};

type BoardStage = {
  id: string;
  name: string;
  sortOrder: number;
  mapsToStatus: string | null;
  color: string | null;
  leads: BoardLead[];
};

type BoardResponse = {
  pipeline: {
    id: string;
    name: string;
    teamId: string | null;
    department: string | null;
    isDefault: boolean;
    team: { id: string; name: string } | null;
  };
  stages: BoardStage[];
};

type PipelineListItem = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: { id: string; name: string }[];
};

function KanbanCard({ lead, stageId }: { lead: BoardLead; stageId: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { type: 'lead', stageId },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`mb-2 cursor-grab touch-none rounded-xl border border-black/5 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? 'z-50 opacity-90 ring-2 ring-brand' : ''
      }`}
    >
      <p className="text-sm font-semibold text-ink">{lead.name}</p>
      <p className="mt-0.5 text-xs text-slate-500">{lead.phone}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[10px] font-semibold text-brand">
          {lead.status}
        </span>
        <Link
          href={`/leads/${lead.id}`}
          className="text-xs font-medium text-brand hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, children }: { stage: BoardStage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border border-black/5 bg-slate-50/90 p-3 shadow-inner ${
        isOver ? 'ring-2 ring-brand/60' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{stage.name}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
          {stage.leads.length}
        </span>
      </div>
      <div className="min-h-[min(420px,60vh)] flex-1 space-y-0 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<PipelineListItem[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const loadBoard = useCallback(async () => {
    if (!getToken() || !pipelineId) return;
    setLoading(true);
    setErr(null);
    try {
      const b = await apiFetch<BoardResponse>(`/pipelines/${pipelineId}/board`);
      setBoard(b);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load board');
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    if (!getToken()) {
      setErr('Sign in to view the pipeline.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const list = await apiFetch<PipelineListItem[]>('/pipelines');
        setPipelines(list);
        setPipelineId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list.find((p) => p.isDefault)?.id ?? list[0]?.id ?? null;
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load pipelines');
      }
    })();
  }, []);

  useEffect(() => {
    if (pipelineId) void loadBoard();
  }, [pipelineId, loadBoard]);

  function resolveTargetStageId(overId: string, current: BoardResponse | null): string | null {
    if (!current) return null;
    for (const s of current.stages) {
      if (s.id === overId) return s.id;
      if (s.leads.some((l) => l.id === overId)) return s.id;
    }
    return null;
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !board) return;
    const leadId = String(active.id);
    const targetStageId = resolveTargetStageId(String(over.id), board);
    if (!targetStageId) return;
    const fromStage = board.stages.find((s) => s.leads.some((l) => l.id === leadId));
    if (fromStage?.id === targetStageId) return;
    try {
      await apiFetch(`/leads/${leadId}/move`, {
        method: 'PATCH',
        json: { stageId: targetStageId },
      });
      await loadBoard();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Move failed');
    }
  }

  return (
    <CrmShell
      title="Sales pipeline"
      subtitle="Drag cards between stages. Drops sync status from the stage mapping."
      actions={(
        <Button variant="secondary" onClick={() => void loadBoard()}>
          Refresh
        </Button>
      )}
    >
      {err ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{err}</p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-slate-600">Pipeline</label>
        <select
          value={pipelineId ?? ''}
          onChange={(e) => setPipelineId(e.target.value || null)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </div>

      {loading && !board ? (
        <p className="text-sm text-slate-500">Loading board…</p>
      ) : board ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.stages.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage}>
                {stage.leads.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} stageId={stage.id} />
                ))}
              </KanbanColumn>
            ))}
          </div>
        </DndContext>
      ) : (
        <p className="text-sm text-slate-500">No pipeline available. Run DB migration and seed.</p>
      )}
    </CrmShell>
  );
}
