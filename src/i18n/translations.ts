import type { Key } from './en';
import { de } from './lang/de';
import { es } from './lang/es';
import { fr } from './lang/fr';
import { hu } from './lang/hu';
import { it } from './lang/it';
import { ja } from './lang/ja';
import { ko } from './lang/ko';
import { pt } from './lang/pt';
import { ru } from './lang/ru';
import { tr } from './lang/tr';
import { zh } from './lang/zh';

/** A missing key falls back to English. */
export const TRANSLATIONS: Partial<Record<string, Partial<Record<Key, string>>>> = { de, es, fr, hu, it, ja, ko, pt, ru, tr, zh };
