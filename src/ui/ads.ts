import { useEffect, useState } from 'react';
/**
 * Anuncios recompensados (AdMob) — solo en la app de Android y solo cuando el
 * jugador toca «Ver anuncio». Nunca hay anuncios que interrumpan el juego.
 *
 * - Las versiones de prueba y de desarrollo usan el bloque de PRUEBA de Google: un
 *   clic propio en un anuncio real puede hacer que AdMob suspenda la cuenta.
 * - Solo la compilación publicada desde `main` (VITE_ADS_LIVE=true en el CI) usa el
 *   bloque real.
 * - Antes del primer anuncio se pide el consentimiento que exige la ley a quienes
 *   viven en el EEE, Reino Unido o Suiza (formulario UMP de Google).
 */
export const ADMOB = {
  appId: 'ca-app-pub-4476148181913403~7529688921',
  rewardedLive: 'ca-app-pub-4476148181913403/2034568093',
  /** Bloque recompensado de prueba publicado por Google. */
  rewardedTest: 'ca-app-pub-3940256099942544/5224354917',
};

export const ADS_LIVE = import.meta.env.VITE_ADS_LIVE === 'true';

export type AdOutcome = 'rewarded' | 'closed' | 'unavailable' | 'error';

let ready: Promise<boolean> | null = null;

/** ¿Se pueden mostrar anuncios en este dispositivo? (Android con el plugin). */
export async function adsSupported(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AdMob');
  } catch {
    return false;
  }
}

async function init(): Promise<boolean> {
  if (!(await adsSupported())) return false;
  const { AdMob, MaxAdContentRating } = await import('@capacitor-community/admob');
  await AdMob.initialize({ initializeForTesting: !ADS_LIVE, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: MaxAdContentRating.Teen });
  try {
    const info = await AdMob.requestConsentInfo();
    if (!info.canRequestAds && info.isConsentFormAvailable) {
      const after = await AdMob.showConsentForm();
      return after.canRequestAds;
    }
    return info.canRequestAds;
  } catch {
    // Sin respuesta del servicio de consentimiento: fuera del EEE se puede seguir.
    return true;
  }
}

/** Muestra un anuncio recompensado y devuelve si el jugador ganó la recompensa. */
export async function showRewardedAd(): Promise<AdOutcome> {
  try {
    ready ??= init();
    if (!(await ready)) {
      ready = null;
      return 'unavailable';
    }
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({ adId: ADS_LIVE ? ADMOB.rewardedLive : ADMOB.rewardedTest, isTesting: !ADS_LIVE });
    const item = await AdMob.showRewardVideoAd();
    return item && item.amount > 0 ? 'rewarded' : 'closed';
  } catch {
    return 'error';
  }
}

/** Fecha real de hoy (AAAA-MM-DD, hora local): el límite de recompensas es por día. */
export function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

let supportedCache: boolean | null = null;
/** Hook: si este dispositivo puede mostrar anuncios (se consulta una sola vez). */
export function useAdsSupported(): boolean {
  const [ok, setOk] = useState(supportedCache ?? false);
  useEffect(() => {
    if (supportedCache !== null) return;
    void adsSupported().then((v) => {
      supportedCache = v;
      setOk(v);
    });
  }, []);
  return ok;
}
