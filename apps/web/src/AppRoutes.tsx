import { NotFoundPage, RequireSession } from '@hanu/web-kit';
import { Route, Routes } from 'react-router';
import { SignInPage } from './auth/SignInPage';
import { PATHS } from './paths';
import { ProfessionalPage } from './professional/ProfessionalPage';
import { MyProfilePage } from './profile/MyProfilePage';
import { AppShell } from './shell/AppShell';
import { HomePage } from './shell/HomePage';

/** Every screen of the dashboard. Buyers' modules join in Phase 3. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.signIn} element={<SignInPage />} />
      <Route element={<RequireSession signInPath={PATHS.signIn} />}>
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<HomePage />} />
          <Route path={PATHS.me} element={<MyProfilePage />} />
          <Route path={PATHS.professional} element={<ProfessionalPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage homePath={PATHS.home} />} />
    </Routes>
  );
}
