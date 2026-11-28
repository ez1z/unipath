/**
 * Admin logo / photo upload. The browser draws the chosen picture onto a
 * canvas no bigger than 128 px (logo) or 1200 px (photo), encodes it as WebP,
 * and sends it to /api/admin/upload; the returned R2 key goes into a hidden
 * field, saved with the form. Without JavaScript the current key is kept.
 */
import { useState } from 'react';
import { fitWithin, IMAGE_LIMITS, type ImageKind } from '../lib/admin/images';

export interface ImageUploadProps {
  name: string;
  kind: ImageKind;
  value: string;
  /** id of the visible label. */
  labelledBy: string;
  labels: {
    choose: string;
    uploading: string;
    done: string;
    remove: string;
    failed: string;
    noWebp: string;
  };
}

type Status = 'idle' | 'uploading' | 'done' | 'failed' | 'noWebp';

async function toWebp(file: File, maxSide: number): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const size = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  // Browsers that can't encode WebP hand back a PNG instead.
  return blob && blob.type === 'image/webp' ? blob : null;
}

export default function ImageUpload({ name, kind, value, labelledBy, labels }: ImageUploadProps) {
  const [key, setKey] = useState(value);
  const [status, setStatus] = useState<Status>('idle');
  const inputId = `${name}-file`;
  const limit = IMAGE_LIMITS[kind];

  async function upload(file: File) {
    setStatus('uploading');
    try {
      const blob = await toWebp(file, limit.maxSide);
      if (!blob) {
        setStatus('noWebp');
        return;
      }
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', blob, `${kind}.webp`);
      const response = await fetch('/api/admin/upload', { method: 'POST', body });
      const data = (await response.json().catch(() => null)) as { key?: string } | null;
      if (!response.ok || !data?.key) throw new Error('upload');
      setKey(data.key);
      setStatus('done');
    } catch {
      setStatus('failed');
    }
  }

  const message =
    status === 'uploading'
      ? labels.uploading
      : status === 'done'
        ? labels.done
        : status === 'failed'
          ? labels.failed
          : status === 'noWebp'
            ? labels.noWebp
            : '';

  return (
    <div class="image-upload" role="group" aria-labelledby={labelledBy}>
      <input type="hidden" name={name} value={key} />
      {key && (
        <img
          class={`image-preview image-${kind}`}
          src={`/files/${key}`}
          alt=""
          width={kind === 'logo' ? 64 : 240}
          height={kind === 'logo' ? 64 : 135}
        />
      )}
      <div class="image-actions">
        <label class="button button-secondary" for={inputId}>
          {labels.choose}
        </label>
        <input
          id={inputId}
          class="visually-hidden"
          type="file"
          accept="image/*"
          onChange={(event: Event) => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0];
            if (file) void upload(file);
          }}
        />
        {key && (
          <button
            type="button"
            class="button button-quiet"
            onClick={() => {
              setKey('');
              setStatus('idle');
            }}
          >
            {labels.remove}
          </button>
        )}
      </div>
      <p
        class={status === 'failed' || status === 'noWebp' ? 'form-error' : 'muted-note'}
        role="status"
      >
        {message}
      </p>
    </div>
  );
}
