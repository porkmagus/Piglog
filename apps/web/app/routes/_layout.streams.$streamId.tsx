import { useState } from 'react';
import { RequireAuth } from '~/lib/auth-client';
import LogTable from '~/components/log-table';
import SearchBar from '~/components/search-bar';

export default function StreamPage() {
  const [search, setSearch] = useState('');

  return (
    <RequireAuth>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[#2A2A2A]">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <LogTable searchQuery={search} />
      </div>
    </RequireAuth>
  );
}
