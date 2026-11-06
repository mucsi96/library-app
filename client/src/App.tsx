import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppHeader, AppHeaderActions, AppMain, BarLoader } from '@mucsi96/react-ui';
import { HeaderProfile } from './HeaderProfile';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { jobsQuery, itemsQuery } from './queries';
import styles from './App.module.css';

const Items = lazy(() => import('./items/Items'));
const Import = lazy(() => import('./imports/Import'));
const Settings = lazy(() => import('./settings/Settings'));

export function App() {
  const location = useLocation();
  const client = useQueryClient();
  const completed = useRef(new Set<string>());
  const jobs = useQuery({
    ...jobsQuery,
    refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.some(job => !['FAILED', 'NEEDS_ISBN'].includes(job.status)) ? 1500 : false,
  });
  const active = jobs.data?.filter(job => ['QUEUED', 'EXTRACTING', 'GENERATING_COVER'].includes(job.status)).length ?? 0;
  useEffect(() => {
    const fresh = jobs.data?.filter(job => job.status === 'COMPLETED' && !completed.current.has(job.reference)) ?? [];
    if (!fresh.length) return;
    fresh.forEach(job => completed.current.add(job.reference));
    void client.invalidateQueries({ queryKey: itemsQuery.queryKey });
  }, [jobs.data, client]);
  useEffect(() => {
    document.title = ({ '/': 'My loans', '/import': 'Import item', '/settings': 'Settings' })[location.pathname] ?? 'Library App';
  }, [location.pathname]);

  return <>
    <AppHeader>
      <Link to="/" className={styles.brand}>Library App</Link>
      <AppHeaderActions>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <Link to="/">My loans</Link>
          <Link to="/import">Import {active > 0 && <span className={styles.badge} aria-label={`${active} imports in progress`}>{active}</span>}</Link>
          <Link to="/settings">Settings</Link>
        </nav>
        <HeaderProfile />
      </AppHeaderActions>
    </AppHeader>
    <AppMain><RouteErrorBoundary key={location.pathname}><Suspense fallback={<BarLoader label="Loading page" />}>
      <Routes>
        <Route path="/" element={<Items />} />
        <Route path="/import" element={<Import />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<><h1>Page not found</h1><Link to="/">My loans</Link></>} />
      </Routes>
    </Suspense></RouteErrorBoundary></AppMain>
  </>;
}
