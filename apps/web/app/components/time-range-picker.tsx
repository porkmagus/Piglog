import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, X } from 'lucide-react';

export interface TimeRange {
  label: string;
  from: Date;
  to: Date;
}

const PRESETS: { label: string; value: number }[] = [
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 },
  { label: '7d', value: 7 * 24 * 60 * 60 * 1000 },
];

interface TimeRangePickerProps {
  value: TimeRange | null;
  onChange: (range: TimeRange | null) => void;
}

export default function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectPreset(ms: number, label: string) {
    const to = new Date();
    const from = new Date(to.getTime() - ms);
    onChange({ label, from, to });
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value
            ? 'bg-[#5E6AD2]/15 text-[#5E6AD2] border border-[#5E6AD2]/20'
            : 'text-[#8A8F98] bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#3A3A3A]'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        {value ? value.label : 'All time'}
        {value ? (
          <X
            className="w-3 h-3 ml-0.5 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
          />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-md border border-[#2A2A2A] bg-[#151515] shadow-lg overflow-hidden">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => selectPreset(preset.value, preset.label)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                value?.label === preset.label
                  ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                  : 'text-gray-300 hover:bg-[#1a1a1a]'
              }`}
            >
              Last {preset.label}
            </button>
          ))}
          <button
            onClick={clear}
            className="w-full text-left px-3 py-2 text-xs text-[#8A8F98] hover:bg-[#1a1a1a] border-t border-[#2A2A2A]"
          >
            All time
          </button>
        </div>
      )}
    </div>
  );
}
