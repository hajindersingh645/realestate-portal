import { NotFoundPage, RequireSession } from '@hanu/web-kit';
import { Route, Routes } from 'react-router';
import { SignInPage } from './auth/SignInPage';
import { PATHS } from './paths';
import { MyLeadsPage } from './leads/MyLeadsPage';
import { ProfessionalPage } from './professional/ProfessionalPage';
import { MyRequirementsPage } from './requirements/MyRequirementsPage';
import { RequirementDetailPage } from './requirements/RequirementDetailPage';
import { RequirementEditPage } from './requirements/RequirementEditPage';
import { MyProfilePage } from './profile/MyProfilePage';
import { AppShell } from './shell/AppShell';
import { HomePage } from './shell/HomePage';

/** Every screen of the dashboard. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.signIn} element={<SignInPage />} />
      <Route element={<RequireSession signInPath={PATHS.signIn} />}>
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<HomePage />} />
          <Route path={PATHS.me} element={<MyProfilePage />} />
          <Route path={PATHS.professional} element={<ProfessionalPage />} />
          <Route path={PATHS.requirements} element={<MyRequirementsPage />} />
          <Route path={PATHS.newRequirement} element={<RequirementEditPage />} />
          <Route path={PATHS.requirement} element={<RequirementDetailPage />} />
          <Route path={PATHS.editRequirement} element={<RequirementEditPage />} />
          <Route path={PATHS.myLeads} element={<MyLeadsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage homePath={PATHS.home} />} />
    </Routes>
  );
}
