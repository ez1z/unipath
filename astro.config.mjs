// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Pages are static by default; data pages opt out with `export const prerender = false`.
  output: 'static',
  adapter: cloudflare({
    // Images are resized on upload (M7) and served from R2, so no runtime image service.
    imageService: 'passthrough',
    // Never reach real Cloudflare resources from local dev.
    remoteBindings: false,
  }),
  integrations: [react()],
  // Better Auth owns sessions (M3); Astro's own KV-backed sessions stay off.
  session: false,
  devToolbar: { enabled: false },
});
