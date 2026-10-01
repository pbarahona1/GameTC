import type { ThemeChoice } from './store';

/**
 * Barras del sistema en Android (Capacitor 8, borde a borde): el color del texto y
 * los íconos de la barra de estado y de navegación sigue al tema del juego.
 * "Sistema" deja que Android decida según el modo claro/oscuro del teléfono.
 */
export async function syncSystemBars(theme: ThemeChoice): Promise<void> {
  try {
    const { Capacitor, SystemBars, SystemBarsStyle } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const style = theme === 'dark' ? SystemBarsStyle.Dark : theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Default;
    await SystemBars.setStyle({ style });
  } catch {
    /* sin barras del sistema (web o versión nativa vieja): no hace falta nada */
  }
}
