import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import './i18n';
import { initLogger } from './lib/logger';

initLogger();

// Per-environment browser-tab title. deploy-env.yml writes
// VITE_APP_TITLE=EduStack - sandbox-${env_id} into .env before vite build,
// so each deployed sandbox identifies itself in the title bar. Falls back
// to the index.html-declared title for local dev.
const appTitle = import.meta.env.VITE_APP_TITLE as string | undefined;
if (appTitle) {
    document.title = appTitle;
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
