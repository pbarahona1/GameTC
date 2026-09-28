import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/fonts.css';
import './ui/theme.css';
import { App } from './ui/App';
import { store } from './ui/store';

void store.boot();

// Botón "atrás" de Android: cierra la hoja abierta, vuelve a Inicio o guarda y minimiza.
void import('@capacitor/core').then(async ({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  const { App: CapApp } = await import('@capacitor/app');
  const { navStore } = await import('./ui/nav');
  CapApp.addListener('backButton', () => {
    const nav = navStore.get();
    if (nav.sheets.length) navStore.close();
    else if (nav.tab !== 'home') navStore.go('home');
    else void store.save().then(() => CapApp.minimizeApp());
  });
  CapApp.addListener('pause', () => void store.save());
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
