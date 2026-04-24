import { useState, useRef, useEffect } from 'react';
import { parseSearchTokens, tokensToQueryString, type SearchTokens } from '@piglog/contracts';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder = 'Search logs...' }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokens = parseSearchTokens(value);

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

  function removeToken(key: keyof SearchTokens) {
    const newTokens = { ...tokens };
    delete newTokens[key];
    onChange(tokensToQueryString(newTokens));
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 h-9 rounded-md border transition-colors ${
        focused
          ? 'border-[#5E6AD2] bg-[#151515]'
          : 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-[#3A3A3A]'
      }`}
    >
      <Search className="w-4 h-4 text-[#8A8F98] flex-shrink-0" />

      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {tokens.service && (
          <TokenBadge label={`service:${tokens.service}`} onRemove={() => removeToken('service')} />
        )}
        {tokens.level && (
          <TokenBadge label={`level:${tokens.level.toLowerCase()}`} onRemove={() => removeToken('level')} />
        )}
        {tokens.host && (
          <TokenBadge label={`host:${tokens.host}`} onRemove={() => removeToken('host')} />
        )}
        {tokens.traceId && (
          <TokenBadge label={`traceId:${tokens.traceId.slice(0, 8)}`} onRemove={() => removeToken('traceId')} />
        )}

        <input
          ref={inputRef}
          type="text"
          value={tokens.search || ''}
          onChange={(e) => {
            const newTokens = { ...tokens, search: e.target.value || undefined };
            onChange(tokensToQueryString(newTokens));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={!value ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-gray-200 placeholder:text-[#8A8F98] focus:outline-none"
        />
      </div>

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
  );
}

function TokenBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[#5E6AD2]/15 text-[#5E6AD2] border border-[#5E6AD2]/20 flex-shrink-0">
      {label}
      <button onClick={onRemove} className="hover:text-white">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
