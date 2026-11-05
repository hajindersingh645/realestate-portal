export interface BrandProps {
  /** The app's name under the logo, e.g. "Admin" or "Dashboard". */
  app: string;
}

export function Brand({ app }: BrandProps) {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white"
      >
        H
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold">Hanu.property</p>
        <p className="text-xs text-zinc-500">{app}</p>
      </div>
    </div>
  );
}
