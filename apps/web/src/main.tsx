import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ApiLoadingOverlay, installApiLoadingTracker } from './ApiLoadingOverlay';
import './styles.css';

installApiLoadingTracker();

if ('serviceWorker' in navigator) {
	if (import.meta.env.PROD) {
		void navigator.serviceWorker.register('/sw.js');
	} else {
		void Promise.all([
			navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
			caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('nsr-impulse-')).map((key) => caches.delete(key))))
		]).then(() => {
			const reloadKey = 'nsr-service-worker-cleanup';
			if (navigator.serviceWorker.controller && !sessionStorage.getItem(reloadKey)) {
				sessionStorage.setItem(reloadKey, 'true');
				window.location.reload();
			} else {
				sessionStorage.removeItem(reloadKey);
			}
		});
	}
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ApiLoadingOverlay /><App /></BrowserRouter></StrictMode>);
