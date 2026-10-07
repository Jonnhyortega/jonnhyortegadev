import React from 'react';
import { motion } from 'framer-motion';
import RevealWords from '@/components/fx/RevealWords';

/**
 * Encabezado de sección: índice mono + línea que se dibuja + título gigante.
 */
const SectionHeading = ({ index, label, title, subtitle, className = '' }) => (
  <div className={`mb-14 md:mb-20 ${className}`}>
    <div className="mb-6 flex items-center gap-4">
      <motion.span
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        className="eyebrow !text-yellow-400/90"
      >
        {index}
      </motion.span>
      <motion.span
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="h-px w-16 origin-left bg-gradient-to-r from-yellow-400 to-purple-500"
      />
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ delay: 0.3 }}
        className="eyebrow"
      >
        {label}
      </motion.span>
    </div>

    <h2 className="font-display font-bold leading-[0.95] tracking-tight text-[clamp(2.6rem,7vw,6rem)]">
      <RevealWords
        text={title}
        gradientFrom={Math.max(1, String(title).split(' ').length - 1)}
      />
    </h2>

    {subtitle && (
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ delay: 0.35, duration: 0.7 }}
        className="mt-6 max-w-xl text-lg text-purple-100/60"
      >
        {subtitle}
      </motion.p>
    )}
  </div>
);

export default SectionHeading;
