import { NotFoundPage, RequireSession } from '@hanu/web-kit';
import { Route, Routes } from 'react-router';
import { ContentPage } from './content/ContentPage';
import { ProfessionalDetailPage } from './professionals/ProfessionalDetailPage';
import { ProfessionalsPage } from './professionals/ProfessionalsPage';
import { RequirementDetailPage } from './requirements/RequirementDetailPage';
import { RequirementsPage } from './requirements/RequirementsPage';
import { AuditLogPage } from './access/audit/AuditLogPage';
import { RolesPage } from './access/roles/RolesPage';
import { UserDetailPage } from './access/users/UserDetailPage';
import { UsersPage } from './access/users/UsersPage';
import { LoginPage } from './auth/LoginPage';
import { LocationsPage } from './catalog/locations/LocationsPage';
import { LookupsPage } from './catalog/lookups/LookupsPage';
import { PropertyTypesPage } from './catalog/property-types/PropertyTypesPage';
import { UnitConversionsPage } from './catalog/unit-conversions/UnitConversionsPage';
import { SetupPage } from './auth/SetupPage';
import { PATHS } from './paths';
import { AppShell } from './shell/AppShell';
import { HomePage } from './shell/HomePage';

/** Every screen of the admin. `main.tsx` wraps it in the router and query client. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.login} element={<LoginPage />} />
      <Route path={PATHS.setup} element={<SetupPage />} />
      <Route element={<RequireSession signInPath={PATHS.login} />}>
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<HomePage />} />
          <Route path={PATHS.locations} element={<LocationsPage />} />
          <Route path={PATHS.propertyTypes} element={<PropertyTypesPage />} />
          <Route path={PATHS.lookups} element={<LookupsPage />} />
          <Route path={PATHS.unitConversions} element={<UnitConversionsPage />} />
          <Route path={PATHS.users} element={<UsersPage />} />
          <Route path="/access/users/:id" element={<UserDetailPage />} />
          <Route path={PATHS.roles} element={<RolesPage />} />
          <Route path={PATHS.auditLog} element={<AuditLogPage />} />
          <Route path={PATHS.professionals} element={<ProfessionalsPage />} />
          <Route path="/professionals/:id" element={<ProfessionalDetailPage />} />
          <Route path={PATHS.requirements} element={<RequirementsPage />} />
          <Route path="/requirements/:id" element={<RequirementDetailPage />} />
          <Route path={PATHS.content} element={<ContentPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage homePath={PATHS.home} />} />
    </Routes>
  );
}
