import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/**
 * Banda de texto gigante cuyo desplazamiento horizontal depende del scroll.
 * Dos filas en sentidos opuestos, levemente inclinadas.
 */
const Row = ({ x, text, outline }) => (
  <motion.div
    style={{ x }}
    className="flex w-max items-center gap-10 whitespace-nowrap font-display font-bold uppercase leading-none tracking-tight text-[clamp(3rem,8vw,7rem)]"
  >
    {Array.from({ length: 10 }).map((_, i) => (
      <React.Fragment key={i}>
        <span className={outline ? 'text-outline' : 'text-gradient'}>{text}</span>
        <span className="text-yellow-400/80 text-[0.5em]">✦</span>
      </React.Fragment>
    ))}
  </motion.div>
);

const ScrollMarquee = ({ text }) => {
  const { scrollY } = useScroll();
  const x1 = useTransform(scrollY, [0, 4000], [0, -1400]);
  const x2 = useTransform(scrollY, [0, 4000], [-1400, 0]);

  return (
    <div
      aria-hidden
      className="relative -rotate-2 scale-105 overflow-hidden border-y border-white/5 bg-ink/50 py-8 backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-4">
        <Row x={x1} text={text} />
        <Row x={x2} text={text} outline />
      </div>
    </div>
  );
};

export default ScrollMarquee;
