import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.urt.tycoon',
  appName: 'Ultimate Realistic Tycoon',
  webDir: 'dist',
  android: { backgroundColor: '#0d1014' },
  plugins: {
    // Android 15+ dibuja borde a borde: Capacitor inyecta las zonas seguras como
    // variables CSS (--safe-area-inset-*), que usa theme.css.
    SystemBars: { insetsHandling: 'css', style: 'DEFAULT' },
  },
};
export default config;
