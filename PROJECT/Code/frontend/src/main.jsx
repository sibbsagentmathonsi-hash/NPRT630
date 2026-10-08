import React from 'react';
import ReactDOM from 'react-dom/client';
import WorkerApp from './apps/WorkerApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WorkerApp />
  </React.StrictMode>,
);
