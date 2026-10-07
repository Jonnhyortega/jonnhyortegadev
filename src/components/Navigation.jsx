import React, { useState, useEffect } from 'react';
import { Menu, X, Globe } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import useActiveSection from '@/hooks/useActiveSection';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const active = useActiveSection();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: t('nav.home'), href: '#home' },
    { name: t('nav.projects'), href: '#projects' },
    { name: t('nav.skills'), href: '#skills' },
    { name: t('nav.contact'), href: '#contact' },
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const handleNavClick = (e, href) => {
    e.preventDefault();

    setIsOpen(false);

    setTimeout(() => {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 350);
  };

  return (
    <>
      {/* Barra de progreso de lectura */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left bg-gradient-to-r from-purple-500 via-fuchsia-400 to-yellow-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]"
      />

      <nav className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={`flex w-full max-w-5xl items-center justify-between rounded-full border px-4 py-2 transition-all duration-500 sm:px-5 ${
            scrolled
              ? 'glass border-white/10 shadow-[0_8px_40px_-12px_rgba(124,58,237,0.55)]'
              : 'border-transparent bg-transparent'
          }`}
        >
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, '#home')}
            className="relative flex items-center gap-2 pr-10 font-mono text-sm font-bold tracking-tight"
          >
            <span className="text-gradient">Portfolio</span>
            <img
              src="https://res.cloudinary.com/do87isqjr/image/upload/v1764197594/Captura_de_pantalla_2025-11-26_195144-removebg-preview_ewhpeo.png"
              alt="Logo jonnhyortega"
              width="38"
              height="38"
              className="absolute right-0 top-1/2 -translate-y-1/2"
            />
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = active === item.href.slice(1);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative rounded-full px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-purple-200/60 hover:text-yellow-300'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full border border-purple-400/30 bg-gradient-to-r from-purple-600/30 to-yellow-500/20"
                    />
                  )}
                  <span className="relative">{item.name}</span>
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-600/15 px-3 py-2 font-mono text-xs text-purple-200 transition-all duration-300 hover:border-yellow-400/60 hover:text-yellow-300"
            >
              <Globe className="h-4 w-4" />
              <span className="font-medium">{language.toUpperCase()}</span>
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Menu"
              className="rounded-full border border-purple-400/30 bg-purple-600/15 p-2 text-purple-200 md:hidden"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col justify-center bg-ink/90 px-8 backdrop-blur-2xl md:hidden"
          >
            {navItems.map((item, i) => (
              <motion.a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-baseline gap-4 border-b border-white/10 py-4"
              >
                <span className="font-mono text-xs text-yellow-400">0{i + 1}</span>
                <span className="text-4xl font-bold tracking-tight text-gradient">{item.name}</span>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navigation;