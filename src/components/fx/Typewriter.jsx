import React, { useEffect, useState } from 'react';

/** Efecto de tipeo tipo terminal con cursor parpadeante. */
const Typewriter = ({ text, delay = 1200, speed = 55 }) => {
  const [n, setN] = useState(0);

  useEffect(() => {
    let i = 0;
    let interval;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, delay, speed]);

  return (
    <span>
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block animate-blink text-yellow-400">▌</span>
    </span>
  );
};

export default Typewriter;
