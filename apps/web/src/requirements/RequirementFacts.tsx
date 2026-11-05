import type { RequirementBody } from './requirements-api';
import { useDescribe } from './useDescribe';

export interface RequirementFactsProps {
  requirement: RequirementBody;
}

export function RequirementFacts({ requirement }: RequirementFactsProps) {
  const describe = useDescribe();
  return (
    <dl className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
      {describe(requirement).map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-zinc-500">{row.label}</dt>
          <dd className="whitespace-pre-line text-zinc-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
