import React from 'react';
import { motion } from 'framer-motion';

/**
 * Revela el texto palabra por palabra deslizándolo desde una máscara.
 * `gradientFrom`: índice desde el cual las palabras llevan degradé animado.
 */
const RevealWords = ({
  text = '',
  className = '',
  delay = 0,
  gradientFrom = Infinity,
  as: Tag = 'span',
}) => {
  const words = String(text).split(' ');

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em] mr-[0.25em]"
        >
          <motion.span
            className={`inline-block will-change-transform ${
              i >= gradientFrom ? 'text-gradient-animated animate-shimmer' : ''
            }`}
            initial={{ y: '115%', rotate: 4 }}
            whileInView={{ y: '0%', rotate: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, delay: delay + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
};

export default RevealWords;
