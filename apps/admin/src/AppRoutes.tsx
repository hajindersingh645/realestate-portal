import { Route, Routes } from 'react-router';
import { NotFoundPage } from './NotFoundPage';

/** Every screen of the admin. `main.tsx` wraps it in the router and query client. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
