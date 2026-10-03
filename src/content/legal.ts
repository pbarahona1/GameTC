/**
 * TEXTOS LEGALES: única fuente para la pantalla «Privacidad, términos y licencias»
 * de la app y para las páginas públicas (docs/legal/, `npm run legal`), que son las
 * que se enlazan en Google Play.
 *
 * Describen lo que la app hace HOY: sin cuentas, sin anuncios, sin compras, sin
 * analíticas y sin enviar datos personales. Si se agregan anuncios o compras, estos
 * textos (y el formulario de Seguridad de los datos de Play Console) deben cambiar
 * ANTES de publicar esa versión.
 */
export const LEGAL = {
  app: 'Ultimate Realistic Tycoon',
  packageId: 'com.urt.tycoon',
  /**
   * Nombre del desarrollador tal como figura en la ficha de Google Play y correo de
   * contacto (aparecen en las páginas públicas). Los completa el dueño del juego:
   * `npm run legal` no genera las páginas mientras falten.
   */
  developer: 'Paolo Barahona',
  contact: 'paolobaraho415@gmail.com',
  country: 'El Salvador',
  updated: '2026-10-02',
};

/** ¿Están los datos de contacto que exige Google Play? */
export function legalReady(): boolean {
  return LEGAL.developer.trim() !== '' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(LEGAL.contact);
}

/** Contacto para mostrar (o un aviso mientras no esté configurado). */
export const CONTACT_TEXT = (): string => (legalReady() ? LEGAL.contact : 'el correo de contacto de la ficha de Google Play');

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export const PRIVACY: LegalSection[] = [
  {
    title: 'Resumen',
    paragraphs: [
      `${LEGAL.app} es un juego de simulación que funciona sin conexión. No pide crear una cuenta, no muestra anuncios, no tiene compras, no usa analíticas ni herramientas de seguimiento y no envía tus datos personales a nadie, ni al desarrollador.`,
    ],
  },
  {
    title: 'Qué datos guarda el juego',
    paragraphs: [
      'Tus partidas (nombre y aspecto del personaje que inventás, y todo lo que pasa en la simulación) y tus ajustes se guardan solamente en tu dispositivo, en el almacenamiento privado de la app.',
      'El nombre del personaje es ficticio: no hace falta que uses tu nombre real.',
    ],
  },
  {
    title: 'Conexión a internet',
    paragraphs: [
      'La app solo se conecta a internet para buscar actualizaciones del juego, descargándolas de GitHub (servicio de GitHub, Inc.). En esa consulta no se envía ningún dato de tu partida ni datos personales; como en cualquier conexión, GitHub recibe datos técnicos como la dirección IP, que trata según su propia política de privacidad. Podés desactivar la búsqueda automática en Ajustes → Actualizaciones.',
    ],
  },
  {
    title: 'Copias de seguridad y archivos exportados',
    paragraphs: [
      'Si tu dispositivo tiene activada la copia de seguridad de Android, el sistema puede copiar tus partidas a tu cuenta de Google. Esa copia la gestiona Google según tu configuración y su política de privacidad; el desarrollador no tiene acceso.',
      'Cuando exportás una partida, el archivo va a donde vos elijas (Archivos, Drive, correo…). Ese archivo contiene los datos de la partida.',
    ],
  },
  {
    title: 'Permisos',
    paragraphs: ['La app solo usa el permiso de acceso a internet (para las actualizaciones). No accede a tu ubicación, contactos, cámara, micrófono, fotos ni a otras apps.'],
  },
  {
    title: 'Niñas, niños y adolescentes',
    paragraphs: [
      'El juego no está dirigido a menores de 13 años. Incluye temas de finanzas, deudas y, de forma opcional y desactivada al empezar, actividades ilegales ficticias con consecuencias. No recopilamos datos de nadie, tampoco de menores.',
    ],
  },
  {
    title: 'Conservación y borrado',
    paragraphs: [
      'Los datos quedan en tu dispositivo hasta que los borres: podés borrar cada partida desde Ajustes → Guardado y copias, o borrar todo desinstalando la app (y, si querés, las copias de seguridad de Android desde la configuración de tu cuenta de Google).',
    ],
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      `Como el desarrollador no recibe ni guarda tus datos, no tiene datos tuyos para entregar, corregir o borrar. Igual podés escribir a ${CONTACT_TEXT()} con cualquier consulta sobre privacidad, incluidos los derechos que te reconoce la Ley para la Protección de Datos Personales de ${LEGAL.country} u otras leyes que te apliquen.`,
    ],
  },
  {
    title: 'Cambios en esta política',
    paragraphs: [
      'Si una versión futura cambia cómo se tratan los datos (por ejemplo, si se agregaran anuncios o compras), esta política se actualizará antes de publicar esa versión y la fecha de arriba cambiará.',
    ],
  },
  {
    title: 'Contacto',
    paragraphs: [legalReady() ? `${LEGAL.developer} · ${LEGAL.contact} · ${LEGAL.country}.` : `Desarrollador de ${LEGAL.app} · ${LEGAL.country}. El contacto figura en la ficha de Google Play.`],
  },
];

export const TERMS: LegalSection[] = [
  {
    title: 'Aceptación',
    paragraphs: [`Al usar ${LEGAL.app} aceptás estos términos. Si no estás de acuerdo, no uses la app.`],
  },
  {
    title: 'Es una simulación ficticia',
    paragraphs: [
      'Todo lo que pasa en el juego es ficticio: el dinero, las empresas, los bancos, las acciones, los inmuebles, los países, las personas y los resultados. No hay dinero real en juego y nada de lo que ganes o pierdas en la partida tiene valor fuera de ella.',
      'Los resultados son probabilísticos: el juego no garantiza ganancias, ascensos, absoluciones ni predicciones acertadas.',
    ],
  },
  {
    title: 'No es asesoramiento',
    paragraphs: [
      'El juego explica conceptos de finanzas, impuestos y derecho con fines de entretenimiento y aprendizaje general. No es asesoramiento financiero, de inversión, fiscal, legal ni profesional. Para decisiones reales consultá a un profesional habilitado.',
    ],
  },
  {
    title: 'Actividades ilegales ficticias',
    paragraphs: [
      'El juego puede simular, solo si las activás, actividades ilegales ficticias (por ejemplo, sobornos o evasión) con riesgos y castigos dentro de la partida. Existen para mostrar sus consecuencias, no para promoverlas. No contienen instrucciones aplicables a la vida real. En la vida real esas conductas son delitos.',
    ],
  },
  {
    title: 'Licencia de uso',
    paragraphs: [
      'Te damos una licencia personal, no exclusiva e intransferible para instalar y jugar el juego en tus dispositivos. No podés vender, alquilar ni redistribuir la app ni presentarla como propia. El juego, su diseño y sus textos pertenecen al desarrollador, salvo los componentes de terceros indicados en Licencias, que se rigen por sus propias licencias.',
    ],
  },
  {
    title: 'Partidas guardadas',
    paragraphs: [
      'El juego guarda tus partidas en tu dispositivo con copias de seguridad automáticas, pero ningún sistema está libre de fallas. Te recomendamos exportar tus partidas de vez en cuando. El desarrollador no puede recuperar partidas que estaban solo en tu dispositivo.',
    ],
  },
  {
    title: 'Disponibilidad y cambios',
    paragraphs: [
      'El juego se ofrece «tal como está». Podemos actualizarlo, cambiar sus reglas o su balance, o dejar de distribuirlo. Las actualizaciones se instalan solo si las confirmás.',
    ],
  },
  {
    title: 'Responsabilidad',
    paragraphs: [
      'En la medida que lo permita la ley aplicable, el desarrollador no responde por daños indirectos derivados del uso del juego ni de decisiones reales tomadas a partir de él. Nada de esto limita los derechos que te da la ley de protección al consumidor de tu país.',
    ],
  },
  {
    title: 'Ley aplicable y contacto',
    paragraphs: [
      `Estos términos se rigen por las leyes de ${LEGAL.country}, sin perjuicio de las normas de tu país que no puedan dejarse de lado. Consultas: ${CONTACT_TEXT()}.`,
    ],
  },
];

export interface LicenseNotice {
  name: string;
  license: string;
  url: string;
}

/** Componentes de terceros incluidos en la app (sus licencias piden mencionarlos). */
export const LICENSES: LicenseNotice[] = [
  { name: 'React y React DOM', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Capacitor (núcleo, Android y plugins oficiales)', license: 'MIT', url: 'https://github.com/ionic-team/capacitor' },
  { name: 'Lucide (íconos)', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'Manrope (tipografía)', license: 'SIL Open Font License 1.1', url: 'https://github.com/sharanda/manrope' },
  { name: 'IBM Plex Mono (tipografía)', license: 'SIL Open Font License 1.1', url: 'https://github.com/IBM/plex' },
  { name: 'Fontsource (empaquetado de tipografías)', license: 'MIT', url: 'https://fontsource.org' },
];
