/**
 * Logo and photo uploads (SPEC: 128 px logos, 1200 px photos, WebP). The
 * admin's browser resizes and encodes (islands/ImageUpload.tsx); the server
 * checks the bytes really are a WebP of the right size before storing in R2.
 */

export type ImageKind = 'logo' | 'photo';

export const IMAGE_LIMITS: Record<
  ImageKind,
  { maxSide: number; maxBytes: number; prefix: string }
> = {
  logo: { maxSide: 128, maxBytes: 100 * 1024, prefix: 'logos/' },
  photo: { maxSide: 1200, maxBytes: 1024 * 1024, prefix: 'photos/' },
};

/** `logos/<uuid>.webp` or `photos/<uuid>.webp`: the only keys /files serves. */
export const PUBLIC_IMAGE_KEY = /^(logos|photos)\/[0-9a-f-]{36}\.webp$/;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/**
 * Width and height from a WebP file's header (lossy VP8, lossless VP8L or
 * extended VP8X), or null if it isn't a WebP.
 * https://developers.google.com/speed/webp/docs/riff_container
 */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const b = (i: number) => bytes[i] ?? 0;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
    if (b(23) !== 0x9d || b(24) !== 0x01 || b(25) !== 0x2a) return null;
    return { width: (b(26) | (b(27) << 8)) & 0x3fff, height: (b(28) | (b(29) << 8)) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b(20) !== 0x2f) return null;
    return {
      width: 1 + (((b(22) & 0x3f) << 8) | b(21)),
      height: 1 + (((b(24) & 0x0f) << 10) | (b(23) << 2) | ((b(22) & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)),
      height: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)),
    };
  }
  return null;
}

export type ImageCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: 'type' | 'size' | 'dimensions' };

export function checkImage(kind: ImageKind, bytes: Uint8Array): ImageCheck {
  const limit = IMAGE_LIMITS[kind];
  if (bytes.length === 0 || bytes.length > limit.maxBytes) return { ok: false, reason: 'size' };
  const size = webpSize(bytes);
  if (!size) return { ok: false, reason: 'type' };
  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > limit.maxSide ||
    size.height > limit.maxSide
  ) {
    return { ok: false, reason: 'dimensions' };
  }
  return { ok: true, ...size };
}

/** The size to draw at: the longest side at most `maxSide`, never enlarged. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
