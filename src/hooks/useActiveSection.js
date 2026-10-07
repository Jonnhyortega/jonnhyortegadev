import { useEffect, useState } from 'react';

export const SECTION_IDS = ['home', 'projects', 'skills', 'contact'];

/**
 * Devuelve el id de la sección que cruza el centro del viewport.
 * Se usa para el menú activo y el HUD lateral.
 */
export default function useActiveSection(ids = SECTION_IDS) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(',');

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}
