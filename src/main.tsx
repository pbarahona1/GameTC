import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/fonts.css';
import './ui/theme.css';
import { App } from './ui/App';
import { store } from './ui/store';
import { otaBoot, markHealthy, failBoot, autoCheck } from './persistence/ota';

// Arranque: primero se revisa si esta página es una actualización recién instalada
// (para poder volver atrás si falla), después se carga la partida.
void (async () => {
  try {
    await otaBoot();
  } catch {
    /* sin actualizaciones: se sigue normalmente */
  }
  await store.boot();
  const ui = store.getSnapshot();
  if (!ui.state && ui.loadNotice?.startsWith('No se pudo recuperar')) failBoot('La versión nueva no pudo leer la partida.');
  else requestAnimationFrame(() => markHealthy());
  if (store.getSnapshot().settings.autoUpdate !== false) setTimeout(() => void autoCheck(), 4000);
})();

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
