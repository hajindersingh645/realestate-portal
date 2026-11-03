import { Route, Routes } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RequireSession } from './auth/RequireSession';
import { SetupPage } from './auth/SetupPage';
import { NotFoundPage } from './NotFoundPage';
import { PATHS } from './paths';
import { AppShell } from './shell/AppShell';
import { HomePage } from './shell/HomePage';

/** Every screen of the admin. `main.tsx` wraps it in the router and query client. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.login} element={<LoginPage />} />
      <Route path={PATHS.setup} element={<SetupPage />} />
      <Route element={<RequireSession />}>
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<HomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
