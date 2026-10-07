import React from 'react';
import { motion } from 'framer-motion';
import useActiveSection, { SECTION_IDS } from '@/hooks/useActiveSection';
import { useLanguage } from '@/context/LanguageContext';

/**
 * HUD lateral (solo desktop): contador "01 / 04" y puntos de navegación.
 */
const SideHud = () => {
  const active = useActiveSection();
  const { t } = useLanguage();
  const current = SECTION_IDS.indexOf(active);

  const labels = {
    home: t('nav.home'),
    projects: t('nav.projects'),
    skills: t('nav.skills'),
    contact: t('nav.contact'),
  };

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.6, duration: 0.8 }}
      className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-5 lg:flex"
    >
      <span className="font-mono text-xs tracking-widest text-purple-200/70">
        <span className="text-yellow-400">{String(current + 1).padStart(2, '0')}</span>
        {' / '}
        {String(SECTION_IDS.length).padStart(2, '0')}
      </span>

      <div className="flex flex-col items-end gap-3">
        {SECTION_IDS.map((id, i) => {
          const isActive = i === current;
          return (
            <button
              key={id}
              onClick={() => go(id)}
              aria-label={labels[id]}
              className="group flex items-center gap-3"
            >
              <span
                className={`font-mono text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  isActive
                    ? 'translate-x-0 text-yellow-300 opacity-100'
                    : 'translate-x-2 text-purple-200/60 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`}
              >
                {labels[id]}
              </span>
              <span
                className={`block rounded-full transition-all duration-500 ${
                  isActive
                    ? 'h-8 w-[3px] bg-gradient-to-b from-purple-400 to-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                    : 'h-2 w-[3px] bg-white/25 group-hover:bg-purple-300'
                }`}
              />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default SideHud;
