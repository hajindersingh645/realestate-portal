import { Link } from 'react-router';

export interface NotFoundPageProps {
  homePath: string;
}

export function NotFoundPage({ homePath }: NotFoundPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-zinc-500">The page you opened does not exist.</p>
      <Link className="font-medium text-accent hover:text-accent-hover" to={homePath}>
        Go to the home page
      </Link>
    </main>
  );
}
