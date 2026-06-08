export const TMT_PER_USD = 3.51;
export const UNOFFICIAL_TMT_PER_USD = 19.6;
export const TRANSFER_CAP_USD = 12_000;
export const TRANSFER_CAP_TMT = TRANSFER_CAP_USD * TMT_PER_USD; // 42,120 TMT
export const OLD_MANAT_MULTIPLIER = 5_000;

export const SUPPORTED_LOCALES = ['tk', 'ru', 'en'] as const;
export const DEFAULT_LOCALE = 'tk';

export type Locale = (typeof SUPPORTED_LOCALES)[number];
