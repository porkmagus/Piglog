import { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getWidgetEntry, getAvailableWidgets, WIDGET_METADATA } from './widget-registry';
import { WidgetCard } from './widget-card';
import type { DashboardWidgetData } from './types';
import { initWidgets } from './widgets';

initWidgets();

interface SortableWidgetProps {
  widget: DashboardWidgetData;
  editMode: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, w: number, h: number) => void;
  workspaceId: string;
}

function SortableWidget({ widget, editMode, onRemove, onResize, workspaceId }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const entry = getWidgetEntry(widget.type);
  const Component = entry?.component;

  return (
    <div ref={setNodeRef} style={style} {...(editMode ? { ...attributes, ...listeners } : {})}>
      <WidgetCard widget={widget} editMode={editMode} onRemove={onRemove} onResize={onResize}>
        {Component ? <Component widget={widget} workspaceId={workspaceId} /> : <div className="p-4 text-sm text-[#8A8F98]">Unknown widget type: {widget.type}</div>}
      </WidgetCard>
    </div>
  );
}

interface DashboardGridProps {
  widgets: DashboardWidgetData[];
  workspaceId: string;
  onSave: (widgets: DashboardWidgetData[], hiddenIds: string[]) => void;
}

export function DashboardGrid({ widgets, workspaceId, onSave }: DashboardGridProps) {
  const [editMode, setEditMode] = useState(false);
  const [localWidgets, setLocalWidgets] = useState(widgets);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalWidgets((prev) => {
        const oldIndex = prev.findIndex((w) => w.id === active.id);
        const newIndex = prev.findIndex((w) => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    const widget = localWidgets.find((w) => w.id === id);
    if (widget && widget.id.startsWith('default-')) {
      setHiddenIds((prev) => [...prev, id]);
      setLocalWidgets((prev) => prev.filter((w) => w.id !== id));
    } else {
      setLocalWidgets((prev) => prev.filter((w) => w.id !== id));
    }
  }, [localWidgets]);

  const handleResize = useCallback((id: string, w: number, h: number) => {
    setLocalWidgets((prev) => prev.map((widget) => widget.id === id ? { ...widget, w, h } : widget));
  }, []);

  const handleAddWidget = useCallback((type: string) => {
    const meta = WIDGET_METADATA[type];
    if (!meta) return;
    const newWidget: DashboardWidgetData = {
      id: `custom-${Date.now()}`,
      type,
      col: 0,
      row: localWidgets.length,
      w: meta.defaultW,
      h: meta.defaultH,
      config: type === 'custom_sql' ? { sql: '', chartType: 'table', xAxis: '', yAxis: '', groupBy: '', timeRange: '24h' } : { timeRange: '24h', limit: 10 },
    };
    setLocalWidgets((prev) => [...prev, newWidget]);
    setShowAddModal(false);
  }, [localWidgets.length]);

  const handleSave = useCallback(() => {
    onSave(localWidgets, hiddenIds);
    setEditMode(false);
  }, [localWidgets, hiddenIds, onSave]);

  const handleReset = useCallback(() => {
    setLocalWidgets(widgets);
    setHiddenIds([]);
    setEditMode(false);
  }, [widgets]);

  const availableWidgets = getAvailableWidgets();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[#8A8F98]">Monitor your workspace at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={handleReset} className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-gray-200 hover:bg-[#1a1a1a]">Reset</button>
              <button onClick={handleSave} className="rounded-md bg-[#F09040] px-3 py-2 text-sm font-medium text-white hover:bg-[#D87830]">Save</button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)} className="rounded-md border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-gray-200 hover:bg-[#1a1a1a]">Edit Dashboard</button>
          )}
        </div>
      </div>

      {editMode && (
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md border border-dashed border-[#2A2A2A] px-4 py-3 text-sm text-[#8A8F98] hover:text-[#F09040] hover:border-[#F09040]/30 transition-colors w-full text-center"
        >
          + Add Widget
        </button>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={editMode ? handleDragEnd : undefined}>
        <SortableContext items={localWidgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-12 gap-4">
            {localWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                editMode={editMode}
                onRemove={handleRemove}
                onResize={handleResize}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {localWidgets.length === 0 && (
        <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-8 text-center">
          <p className="text-sm text-[#8A8F98]">No widgets on your dashboard.</p>
          {editMode && (
            <button onClick={() => setShowAddModal(true)} className="mt-4 rounded-md bg-[#F09040] px-4 py-2 text-sm font-medium text-white hover:bg-[#D87830]">Add Widget</button>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Widget</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableWidgets.map((entry) => (
                <button
                  key={entry.type}
                  onClick={() => handleAddWidget(entry.type)}
                  className="w-full text-left p-3 rounded-md border border-[#2A2A2A] hover:border-[#F09040]/30 hover:bg-[#1a1a1a] transition-colors"
                >
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-[#8A8F98]">{entry.subtitle}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddModal(false)} className="mt-4 text-sm text-[#8A8F98] hover:text-gray-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
