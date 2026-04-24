import { useState, useCallback } from 'react';
import type { DashboardWidgetData } from './types';

interface WidgetCardProps {
  widget: DashboardWidgetData;
  editMode: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string, w: number, h: number) => void;
  children: React.ReactNode;
}

export function WidgetCard({ widget, editMode, onRemove, onResize, children }: WidgetCardProps) {
  const handleResize = useCallback(() => {
    const newW = widget.w === 6 ? 12 : 6;
    const newH = widget.h === 1 ? 2 : 1;
    onResize(widget.id, newW, newH);
  }, [widget.id, widget.w, widget.h, onResize]);

  return (
    <div
      className={`rounded-lg border border-[#2A2A2A] bg-[#151515] relative ${editMode ? 'ring-1 ring-[#F09040]/30' : ''}`}
      style={{ gridColumn: `span ${widget.w}`, gridRow: `span ${widget.h}` }}
    >
      {editMode && (
        <>
          <button
            onClick={() => onRemove(widget.id)}
            className="absolute top-2 right-2 z-10 w-6 h-6 rounded flex items-center justify-center text-[#8A8F98] hover:text-red-400 hover:bg-[#1a1a1a] text-sm"
          >
            ×
          </button>
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100"
            style={{ cursor: 'se-resize' }}
            onClick={handleResize}
          />
        </>
      )}
      {children}
    </div>
  );
}
