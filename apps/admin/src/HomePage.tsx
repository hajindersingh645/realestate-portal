import { useSession } from './session/session-store';

export function HomePage() {
  const name = useSession((s) => s.user?.name ?? '');
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Welcome, {name}</h1>
    </main>
  );
}
