import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter, Routes, Route, Link } from 'react-router-dom';
import { Provider } from './components/state';
import { Shell, Dashboard, Empty } from './components/layout';
import { Inventory, ItemForm } from './components/inventory';
import { Detail, QuickUse, Activity } from './components/detail';
import { FreezerMap, ImportExport, SettingsPage } from './components/management';
import { AgentTools } from './components/agent-tools';
import './styles.css';
const Router = import.meta.env.VITE_GITHUB_PAGES === 'true' ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Provider>
        <AgentTools />
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/new" element={<ItemForm />} />
            <Route path="/item/:id" element={<Detail />} />
            <Route path="/item/:id/edit" element={<ItemForm />} />
            <Route path="/quick-use" element={<QuickUse />} />
            <Route path="/freezers" element={<FreezerMap />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <>
                  <Empty
                    title="Page not found"
                    description="This page is not part of the inventory workspace."
                  />
                  <Link className="button" to="/">
                    Back to dashboard
                  </Link>
                </>
              }
            />
          </Routes>
        </Shell>
      </Provider>
    </Router>
  </React.StrictMode>,
);
