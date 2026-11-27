import type { APIRoute } from 'astro';
import { LANG_COOKIE, resolveLang } from '../i18n/config';

export const prerender = false;

/** `/` opens the saved language, else Turkmen. */
export const GET: APIRoute = ({ cookies }) => {
  const lang = resolveLang(cookies.get(LANG_COOKIE)?.value);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${lang}`,
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  });
};
