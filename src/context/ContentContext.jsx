import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_TRANSLATIONS, DEFAULT_PROJECTS } from '@/content/defaults';
import { mergeContent } from '@/content/merge';

const DEFAULTS = { translations: DEFAULT_TRANSLATIONS, projects: DEFAULT_PROJECTS };
const INITIAL = { ...mergeContent(DEFAULTS, null), status: 'default' };

const ContentContext = createContext(INITIAL);

export const useContent = () => useContext(ContentContext);

const FETCH_TIMEOUT_MS = 4000;

// Carga el contenido editable una sola vez; si falla, el sitio sigue con los defaults.
const ContentProvider = ({ children }) => {
  const [content, setContent] = useState(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const res = await fetch('/api/content', { signal: controller.signal, credentials: 'omit' });
        if (!res.ok) return;
        const merged = mergeContent(DEFAULTS, await res.json());
        if (merged.theme) {
          const root = document.documentElement;
          for (const [name, value] of Object.entries(merged.theme.vars)) {
            root.style.setProperty(name, value);
          }
        }
        setContent({ ...merged, status: 'remote' });
      } catch {
        // Sin API o respuesta inválida: se mantienen los defaults.
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
};

export default ContentProvider;
