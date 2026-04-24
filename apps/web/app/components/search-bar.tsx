import { useState, useRef, useEffect, useMemo } from 'react';
import { parseQuery, type ParsedQuery } from '@piglog/contracts';
import { Search, X, Terminal } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SYNTAX_HINTS = [
  { label: 'service:nginx', desc: 'field match' },
  { label: '-level:debug', desc: 'negate' },
  { label: 'level:error OR level:warn', desc: 'boolean' },
  { label: '"exact phrase"', desc: 'phrase' },
  { label: 'message~/fatal|panic/', desc: 'regex' },
  { label: 'meta.status_code:404', desc: 'metadata' },
  { label: 'meta.latency>100', desc: 'numeric' },
  { label: 'host:web[1-3]', desc: 'glob' },
  { label: 'sql:WHERE...', desc: 'raw SQL' },
];

export default function SearchBar({ value, onChange, placeholder = 'Search logs...' }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => value ? parseQuery(value) : null, [value]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !focused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focused]);

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 px-3 h-9 rounded-md border transition-colors ${
          focused
            ? 'border-[#5E6AD2] bg-[#151515]'
            : 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-[#3A3A3A]'
        }`}
      >
        <Search className="w-4 h-4 text-[#8A8F98] flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { setFocused(true); setShowHelp(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setShowHelp(false), 200); }}
          placeholder={placeholder}
          className="flex-1 min-w-[80px] bg-transparent text-sm font-mono text-gray-200 placeholder:text-[#8A8F98] focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />

        {parsed && parsed.clauses.length > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#5E6AD2]/15 text-[#5E6AD2] border border-[#5E6AD2]/20 flex-shrink-0">
            {parsed.clauses.length}
          </span>
        )}

        {value && (
          <button
            onClick={() => onChange('')}
            className="p-0.5 rounded hover:bg-[#2A2A2A] text-[#8A8F98] flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {!value && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8A8F98] bg-[#151515] border border-[#2A2A2A]">
            /
          </kbd>
        )}
      </div>

      {showHelp && focused && !value && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] shadow-lg z-50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#2A2A2A]">
            <Terminal className="w-3.5 h-3.5 text-[#5E6AD2]" />
            <span className="text-xs font-medium text-gray-200">Query Syntax</span>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {SYNTAX_HINTS.map((hint) => (
              <button
                key={hint.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(hint.label);
                  setShowHelp(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#151515] text-left"
              >
                <code className="text-xs font-mono text-[#5E6AD2]">{hint.label}</code>
                <span className="text-[10px] text-[#8A8F98]">{hint.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
