import type { CSSProperties } from 'react';
import {
  House, Briefcase, Landmark, ChartLine, Factory, LayoutGrid, Compass, BookOpen, Settings2, Newspaper, ShoppingBag, Shirt, Car, Laptop, Sofa, Gem,
  CreditCard, ChartColumn, Globe, Receipt, Users, Scale, Trophy, ScrollText, Swords, Download, Target, ChartCandlestick, Building2, ChartPie, FileText,
  UserCog, ChevronRight, X, Check, Info, Search, ZoomIn, ZoomOut, RefreshCw, ShieldAlert, Palette, Accessibility, Clock, Save, Upload, Sparkles, Crown,
  Store, Watch, Bike, Smartphone, Tag, Handshake, Magnet, Bell, SquareParking, KeyRound, GraduationCap, PiggyBank, Banknote, Coins, Gauge, Lightbulb,
  ListChecks, Rocket, Plus, Minus, Zap, Wallet, Eye, HardDrive, Maximize2, Undo2, Flame, Pause, Play, Gift,
  TriangleAlert, History, FolderOpen, Copy, ArchiveRestore, SkipForward, ChevronDown, CalendarDays, ChevronsRight, Ellipsis,
} from 'lucide-react';

/**
 * Íconos de la interfaz (líneas, 1 color, se adaptan al tema claro/oscuro).
 * Los emojis quedan solo para contenido (registro, sectores, eventos).
 */
const MAP = {
  home: House, career: Briefcase, finance: Landmark, invest: ChartLine, business: Factory, more: LayoutGrid,
  advisor: Compass, glossary: BookOpen, settings: Settings2, news: Newspaper, shop: ShoppingBag, wardrobe: Shirt,
  car: Car, tech: Laptop, homegoods: Sofa, luxury: Gem, card: CreditCard, reports: ChartColumn, economy: Globe,
  tax: Receipt, pros: Users, legal: Scale, progress: Trophy, log: ScrollText, rivals: Swords, update: Download,
  missions: Target, stocks: ChartCandlestick, realestate: Building2, funds: ChartPie, bonds: FileText, gestor: UserCog,
  chevron: ChevronRight, close: X, check: Check, info: Info, search: Search, zoomIn: ZoomIn, zoomOut: ZoomOut,
  refresh: RefreshCw, danger: ShieldAlert, palette: Palette, access: Accessibility, clock: Clock, save: Save,
  upload: Upload, sparkles: Sparkles, crown: Crown, store: Store, watch: Watch, bike: Bike, phone: Smartphone,
  tag: Tag, deal: Handshake, poach: Magnet, bell: Bell, parking: SquareParking, key: KeyRound, education: GraduationCap,
  savings: PiggyBank, cash: Banknote, coins: Coins, gauge: Gauge, idea: Lightbulb, list: ListChecks, rocket: Rocket,
  plus: Plus, minus: Minus, bolt: Zap, wallet: Wallet, eye: Eye, disk: HardDrive, expand: Maximize2, undo: Undo2, fire: Flame, pause: Pause, play: Play, gift: Gift,
  alert: TriangleAlert, history: History, folder: FolderOpen, copy: Copy, restore: ArchiveRestore, skip: SkipForward,
  chevronDown: ChevronDown, calendar: CalendarDays, fastForward: ChevronsRight, dots: Ellipsis,
} as const;

export type IconName = keyof typeof MAP;

export function isIconName(x: string): x is IconName {
  return Object.prototype.hasOwnProperty.call(MAP, x);
}

export function Icon({ name, size = 18, stroke = 2, className, style, label }: { name: IconName; size?: number; stroke?: number; className?: string; style?: CSSProperties; label?: string }) {
  const C = MAP[name];
  return <C size={size} strokeWidth={stroke} className={className} style={style} aria-hidden={label ? undefined : true} aria-label={label} focusable={false} />;
}
