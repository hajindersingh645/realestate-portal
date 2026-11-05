import { useSearchParams } from 'react-router';

export interface FilterTabsProps {
  label: string;
  param: string;
  tabs: { value: string; label: string }[];
}

/** Tabs that live in the URL (`?param=value`); the first tab is the default and clears the param. */
export function FilterTabs({ label, param, tabs }: FilterTabsProps) {
  const [params, setParams] = useSearchParams();
  const current = params.get(param) ?? tabs[0]?.value;
  return (
    <div
      role="group"
      aria-label={label}
      className="-mb-px flex gap-5 overflow-x-auto border-b border-zinc-200"
    >
      {tabs.map((tab, index) => {
        const active = tab.value === current;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (index === 0) next.delete(param);
                else next.set(param, tab.value);
                return next;
              });
            }}
            className={`whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm transition-colors ${active ? 'border-accent font-medium text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
