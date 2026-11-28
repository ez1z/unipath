/**
 * True once the island runs in the browser. The first render matches the
 * server HTML (the no-JavaScript version); the switch happens a frame later.
 */
import { useEffect, useState } from 'react';

export function useHydrated(onHydrate?: () => void): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      onHydrate?.();
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
    // Runs once, on hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return hydrated;
}
