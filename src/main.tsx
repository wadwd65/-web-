import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './base.css';
import './experience.css';
import './experience-workbench.css';
import './motion-terminal.css';
import './scene-interactions.css';
import './tool-details.css';
import './music-player.css';

window.history.scrollRestoration = 'manual';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
