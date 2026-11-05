export interface DiffViewProps {
  diff: unknown;
}

function asMap(value: unknown): Map<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? new Map(Object.entries(value))
    : new Map<string, unknown>();
}

function show(value: unknown): string {
  if (value === undefined) return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** The fields an audit entry changed: before → after. Unchanged fields are left out. */
export function DiffView({ diff }: DiffViewProps) {
  const entry = asMap(diff);
  const old = asMap(entry.get('before'));
  const now = asMap(entry.get('after'));
  const keys = [...new Set([...old.keys(), ...now.keys()])].filter(
    (key) => JSON.stringify(old.get(key)) !== JSON.stringify(now.get(key)),
  );
  if (keys.length === 0) return <p className="text-xs text-zinc-500">No field changes recorded.</p>;
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Changed fields</caption>
      <thead>
        <tr className="text-zinc-400">
          <th scope="col" className="py-1 pr-3 font-medium">
            Field
          </th>
          <th scope="col" className="py-1 pr-3 font-medium">
            Before
          </th>
          <th scope="col" className="py-1 font-medium">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-t border-zinc-100 align-top">
            <td className="py-1.5 pr-3 font-mono text-zinc-500">{key}</td>
            <td className="break-all py-1.5 pr-3 text-red-700">{show(old.get(key))}</td>
            <td className="break-all py-1.5 text-emerald-700">{show(now.get(key))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
