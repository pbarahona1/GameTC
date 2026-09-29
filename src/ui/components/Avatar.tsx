import type { GameState } from '../../engine/state';
import type { Slot } from '../../content/shops';
import { ITEM_BY_ID, SKIN_TONES, HAIR_COLORS } from '../../content/shops';
import type { Look, OwnedItem } from '../../engine/lifestyle/types';

/**
 * Personaje dibujado en SVG a partir de su apariencia y de la ropa puesta.
 * Todo es original y vectorial: cambia al instante al vestirse o comprar.
 */
interface Worn {
  shape: string;
  c1: string;
  c2: string;
  worn: boolean;
}

function wornIn(items: OwnedItem[], outfit: Partial<Record<Slot, number>>, slot: Slot): Worn | null {
  const uid = outfit[slot];
  const o = uid !== undefined ? items.find((x) => x.uid === uid) : undefined;
  const d = o ? ITEM_BY_ID[o.itemId] : undefined;
  if (!o || !d) return null;
  return { shape: d.shape ?? slot, c1: d.colors?.[0] ?? '#888', c2: d.colors?.[1] ?? '#555', worn: !d.durable && o.condition < 40 };
}

export interface AvatarData {
  look: Look;
  items: OwnedItem[];
  outfit: Partial<Record<Slot, number>>;
}

export function avatarOf(s: GameState): AvatarData {
  return { look: s.possessions.look, items: s.possessions.items, outfit: s.possessions.outfit };
}

function Hair({ style, color, back }: { style: string; color: string; back: boolean }) {
  if (back) {
    if (style === 'largo') return <path d="M39 40 Q38 13 60 13 Q82 13 81 40 L84 76 Q72 69 60 69 Q48 69 36 76 Z" fill={color} />;
    if (style === 'recogido') return <circle cx="60" cy="13" r="8" fill={color} />;
    return null;
  }
  if (style === 'rapado') return <path d="M42 36 Q43 18 60 18 Q77 18 78 36 Q72 25 60 25 Q48 25 42 36 Z" fill={color} opacity={0.55} />;
  if (style === 'rulos') {
    const pts: Array<[number, number]> = [[44, 30], [48, 22], [55, 18], [62, 17], [69, 19], [75, 24], [78, 31], [42, 38], [79, 38]];
    return <g fill={color}>{pts.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6.2" />)}</g>;
  }
  if (style === 'largo') return <path d="M41 38 Q41 16 60 16 Q79 16 79 38 Q74 27 62 26 Q55 30 46 30 Q43 33 41 38 Z" fill={color} />;
  // corto y recogido
  return <path d="M41 37 Q42 15 60 15 Q78 15 79 37 Q74 25 60 24 Q47 25 41 37 Z" fill={color} />;
}

function Patches({ worn, x, y }: { worn: boolean; x: number; y: number }) {
  if (!worn) return null;
  return <g fill="#000" opacity={0.18}><circle cx={x} cy={y} r="2.4" /><circle cx={x + 7} cy={y + 9} r="1.8" /><rect x={x - 5} y={y + 14} width="6" height="3" rx="1" /></g>;
}

export function Avatar({ data, size = 160, bust = false, title }: { data: AvatarData; size?: number; bust?: boolean; title?: string }) {
  const skin = SKIN_TONES[data.look.skin] ?? SKIN_TONES[1];
  const hair = HAIR_COLORS[data.look.hairColor] ?? HAIR_COLORS[0];
  const top = wornIn(data.items, data.outfit, 'torso') ?? { shape: 'remera', c1: '#9aa3ad', c2: '#7d858f', worn: false };
  const legs = wornIn(data.items, data.outfit, 'piernas') ?? { shape: 'jean', c1: '#3a4c66', c2: '#2c3a4f', worn: false };
  const shoes = wornIn(data.items, data.outfit, 'calzado') ?? { shape: 'zapatillas', c1: '#ddd', c2: '#aaa', worn: false };
  const coat = wornIn(data.items, data.outfit, 'abrigo');
  const watch = wornIn(data.items, data.outfit, 'reloj');
  const acc = wornIn(data.items, data.outfit, 'accesorio');
  const sleeve = coat ? coat.c1 : top.c1;
  const vb = bust ? '22 4 76 76' : '0 0 120 200';
  const h = bust ? size : size * (200 / 120);
  return (
    <svg viewBox={vb} width={size} height={h} role="img" aria-label={title ?? 'Tu personaje'} className="avatar-svg">
      {title && <title>{title}</title>}
      <Hair style={data.look.hair} color={hair} back />
      {/* Piernas */}
      {legs.shape === 'falda' ? (
        <g>
          <rect x="43" y="140" width="9" height="38" rx="3" fill={skin} />
          <rect x="68" y="140" width="9" height="38" rx="3" fill={skin} />
          <path d="M34 116 L86 116 L93 154 L27 154 Z" fill={legs.c1} />
          <path d="M34 116 L86 116 L87 122 L33 122 Z" fill={legs.c2} />
        </g>
      ) : (
        <g>
          <path d="M34 116 L59 116 L57 178 L40 178 Z" fill={legs.c1} />
          <path d="M61 116 L86 116 L80 178 L63 178 Z" fill={legs.c1} />
          <path d="M59 118 L61 118 L60 150 Z" fill={legs.c2} />
          {legs.shape === 'jean' && <g stroke={legs.c2} strokeWidth="1" fill="none"><path d="M40 124 Q45 128 50 124" /><path d="M70 124 Q75 128 80 124" /></g>}
          <Patches worn={legs.worn} x={46} y={140} />
        </g>
      )}
      {/* Calzado */}
      <ellipse cx="46" cy="181" rx="12" ry="5.5" fill={shoes.c1} />
      <ellipse cx="74" cy="181" rx="12" ry="5.5" fill={shoes.c1} />
      {shoes.shape === 'zapatillas' ? <g fill={shoes.c2}><rect x="35" y="182" width="22" height="3" rx="1.5" /><rect x="63" y="182" width="22" height="3" rx="1.5" /></g>
        : <g fill="#fff" opacity={0.25}><ellipse cx="42" cy="179" rx="4" ry="1.4" /><ellipse cx="70" cy="179" rx="4" ry="1.4" /></g>}
      {/* Brazos */}
      <path d="M37 66 Q26 70 24 92 L22 116 L32 117 L35 93 Z" fill={sleeve} />
      <path d="M83 66 Q94 70 96 92 L98 116 L88 117 L85 93 Z" fill={sleeve} />
      <circle cx="27" cy="120" r="5.2" fill={skin} />
      <circle cx="93" cy="120" r="5.2" fill={skin} />
      {/* Torso */}
      <rect x="54" y="50" width="12" height="13" rx="4" fill={skin} />
      <path d="M36 66 Q60 57 84 66 L88 118 Q60 124 32 118 Z" fill={top.c1} />
      {top.shape === 'camisa' && <g><path d="M51 60 L60 72 L69 60 L66 58 L60 66 L54 58 Z" fill={top.c2} />{[80, 90, 100, 110].map((y) => <circle key={y} cx="60" cy={y} r="1.1" fill={top.c2} />)}<path d="M60 70 L60 120" stroke={top.c2} strokeWidth="0.8" /></g>}
      {top.shape === 'remera' && <path d="M51 60 Q60 68 69 60" stroke={top.c2} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {top.shape === 'sweater' && <g><path d="M52 60 L60 70 L68 60" stroke={top.c2} strokeWidth="2.6" fill="none" /><path d="M33 113 Q60 119 87 113" stroke={top.c2} strokeWidth="3" fill="none" /></g>}
      {top.shape === 'buzo' && <g><path d="M47 62 Q60 76 73 62 Q70 54 60 53 Q50 54 47 62 Z" fill={top.c2} /><path d="M46 100 L74 100 L72 114 L48 114 Z" fill={top.c2} opacity={0.6} /><path d="M56 70 L55 84 M64 70 L65 84" stroke="#fff" strokeWidth="1" opacity={0.6} /></g>}
      {top.shape === 'gala' && <g><path d="M50 60 L60 84 L70 60" fill={skin} /><path d="M40 72 Q60 66 80 72" stroke="#fff" strokeWidth="1" opacity={0.25} fill="none" /></g>}
      <Patches worn={top.worn} x={44} y={88} />
      {/* Abrigo */}
      {coat && coat.shape === 'campera' && <g><path d="M35 66 Q60 57 85 66 L89 120 Q60 126 31 120 Z" fill={coat.c1} /><path d="M60 62 L60 122" stroke={coat.c2} strokeWidth="2" /><path d="M36 110 L50 110 M70 110 L84 110" stroke={coat.c2} strokeWidth="1.5" /></g>}
      {coat && (coat.shape === 'blazer' || coat.shape === 'tapado') && (
        <g>
          <path d={`M36 66 Q48 61 55 62 L57 ${coat.shape === 'tapado' ? 152 : 122} L30 ${coat.shape === 'tapado' ? 150 : 119} Z`} fill={coat.c1} />
          <path d={`M84 66 Q72 61 65 62 L63 ${coat.shape === 'tapado' ? 152 : 122} L90 ${coat.shape === 'tapado' ? 150 : 119} Z`} fill={coat.c1} />
          <path d="M55 62 L49 84 L56 92 Z" fill={coat.c2} />
          <path d="M65 62 L71 84 L64 92 Z" fill={coat.c2} />
          <circle cx="57" cy="100" r="1.3" fill={coat.c2} />
          <path d="M40 98 L50 98" stroke={coat.c2} strokeWidth="1.4" />
        </g>
      )}
      {coat && <Patches worn={coat.worn} x={38} y={96} />}
      {/* Accesorios */}
      {acc?.shape === 'cadena' && <path d="M50 64 Q60 80 70 64" stroke={acc.c1} strokeWidth="1.6" fill="none" />}
      {acc?.shape === 'bolso' && <g><path d="M84 68 L97 108" stroke={acc.c2} strokeWidth="1.6" /><rect x="90" y="106" width="18" height="15" rx="3" fill={acc.c1} /><rect x="96" y="104" width="6" height="3" rx="1" fill={acc.c2} /></g>}
      {acc?.shape === 'anillo' && <circle cx="95" cy="122" r="1.8" fill={acc.c1} stroke="#fff" strokeWidth="0.6" />}
      {watch && <g><rect x="21.5" y="109.5" width="10" height="6" rx="2" fill={watch.c2} /><rect x="23.5" y="110.5" width="6" height="4" rx="1.5" fill={watch.c1} /></g>}
      {/* Cabeza */}
      <circle cx="60" cy="38" r="18" fill={skin} />
      <ellipse cx="42.5" cy="40" rx="2.6" ry="4" fill={skin} />
      <ellipse cx="77.5" cy="40" rx="2.6" ry="4" fill={skin} />
      <circle cx="53.5" cy="39" r="1.9" fill="#1d1a18" />
      <circle cx="66.5" cy="39" r="1.9" fill="#1d1a18" />
      <path d="M54 46.5 Q60 51 66 46.5" stroke="#1d1a18" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g fill="#e07a6a" opacity={0.18}><circle cx="49" cy="45" r="3" /><circle cx="71" cy="45" r="3" /></g>
      <Hair style={data.look.hair} color={hair} back={false} />
    </svg>
  );
}
