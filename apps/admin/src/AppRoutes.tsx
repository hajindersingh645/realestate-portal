import { Route, Routes } from 'react-router';
import { AuditLogPage } from './access/audit/AuditLogPage';
import { RolesPage } from './access/roles/RolesPage';
import { UserDetailPage } from './access/users/UserDetailPage';
import { UsersPage } from './access/users/UsersPage';
import { LoginPage } from './auth/LoginPage';
import { LocationsPage } from './catalog/locations/LocationsPage';
import { LookupsPage } from './catalog/lookups/LookupsPage';
import { PropertyTypesPage } from './catalog/property-types/PropertyTypesPage';
import { UnitConversionsPage } from './catalog/unit-conversions/UnitConversionsPage';
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
          <Route path={PATHS.locations} element={<LocationsPage />} />
          <Route path={PATHS.propertyTypes} element={<PropertyTypesPage />} />
          <Route path={PATHS.lookups} element={<LookupsPage />} />
          <Route path={PATHS.unitConversions} element={<UnitConversionsPage />} />
          <Route path={PATHS.users} element={<UsersPage />} />
          <Route path="/access/users/:id" element={<UserDetailPage />} />
          <Route path={PATHS.roles} element={<RolesPage />} />
          <Route path={PATHS.auditLog} element={<AuditLogPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
