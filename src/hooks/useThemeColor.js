import { useEffect, useState } from 'react';
import { useContent } from '@/context/ContentContext';

const toHex = (n) => Number(n).toString(16).padStart(2, '0');

// Lee una variable CSS "r g b" y la devuelve como hex; si no existe, el fallback.
function readVar(varName, fallbackHex) {
  if (typeof document === 'undefined') return fallbackHex;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const m = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/.exec(raw);
  return m ? `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}` : fallbackHex;
}

// Se relee cuando cambia el tema del ContentContext (las variables se aplican allí).
export default function useThemeColor(varName, fallbackHex) {
  const { theme } = useContent();
  const [color, setColor] = useState(() => readVar(varName, fallbackHex));

  useEffect(() => {
    setColor(readVar(varName, fallbackHex));
  }, [theme, varName, fallbackHex]);

  return color;
}
