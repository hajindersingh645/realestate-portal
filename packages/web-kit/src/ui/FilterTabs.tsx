import { useSearchParams } from 'react-router';

export interface FilterTabsProps {
  label: string;
  param: string;
  tabs: { value: string; label: string; count?: number }[];
  /** The tab shown when the URL has no `param`. Defaults to the first tab. */
  defaultValue?: string;
}

/** Tabs that live in the URL (`?param=value`); choosing the default tab clears the param. */
export function FilterTabs({ label, param, tabs, defaultValue }: FilterTabsProps) {
  const [params, setParams] = useSearchParams();
  const fallback = defaultValue ?? tabs[0]?.value;
  const current = params.get(param) ?? fallback;
  return (
    <div
      role="group"
      aria-label={label}
      className="-mb-px flex gap-5 overflow-x-auto border-b border-zinc-200"
    >
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                if (tab.value === fallback) next.delete(param);
                else next.set(param, tab.value);
                return next;
              });
            }}
            className={`whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm transition-colors ${active ? 'border-accent font-medium text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
          >
            {tab.label}
            {tab.count === undefined ? null : (
              <>
                {' '}
                <span className="ml-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs tabular-nums text-zinc-600">
                  {tab.count}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
