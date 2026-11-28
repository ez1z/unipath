/**
 * Home's "Next deadline" card for a signed-in student. Home is cached and the
 * same for everyone, so this fetches the private card from /[lang]/my/next
 * after load. Signed out (204), it shows nothing.
 */
import { useEffect, useState } from 'react';

export default function NextDeadline({ path }: { path: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal, credentials: 'same-origin' })
      .then((r) => (r.status === 200 ? r.text() : null))
      .then((text) => setHtml(text?.trim() ? text : null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [path]);

  // Our own server's HTML, rendered with Astro's escaping.
  return html === null ? null : (
    <div class="next-deadline-slot" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
