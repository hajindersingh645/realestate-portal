import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export interface SearchInputProps {
  label?: string;
  param?: string;
}

/** A search box bound to the URL (`?q=`), written 250 ms after typing stops. */
export function SearchInput({ label = 'Search', param = 'q' }: SearchInputProps) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get(param) ?? '';
  const [text, setText] = useState(fromUrl);

  useEffect(() => {
    if (text === fromUrl) return undefined;
    const timer = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (text.trim() === '') next.delete(param);
          else next.set(param, text.trim());
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [text, fromUrl, param, setParams]);

  return (
    <label className="relative flex w-full items-center sm:w-64">
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 size-4 text-zinc-400"
      />
      <input
        type="search"
        value={text}
        placeholder={label}
        onChange={(e) => {
          setText(e.target.value);
        }}
        className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}
