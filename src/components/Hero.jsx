import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { Helmet } from 'react-helmet';
import RevealWords from '@/components/fx/RevealWords';
import Typewriter from '@/components/fx/Typewriter';
import MagneticButton from '@/components/fx/MagneticButton';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

const SEO_DESCRIPTION = {
  es: 'Portfolio de Jonathan "Jonnhy" Ortega, desarrollador Full Stack (MERN) en Buenos Aires. Proyectos, tecnologías y contacto para desarrollo web y marketing digital.',
  en: 'Portfolio of Jonathan "Jonnhy" Ortega, Full Stack (MERN) developer based in Buenos Aires. Projects, tech stack and contact for web development and digital marketing.',
};

const Hero = () => {
  const {
    t,
    language
  } = useLanguage();
  const { scrollY } = useScroll();
  const contentY = useTransform(scrollY, [0, 700], [0, 140]);
  const contentOpacity = useTransform(scrollY, [0, 520], [1, 0]);

  const scrollToProjects = () => {
    const element = document.querySelector('#projects');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  const title = t('hero.title');
  const words = title.split(' ');

  return <>
      {/* Único Helmet del sitio: los valores por defecto viven en index.html */}
      <Helmet htmlAttributes={{ lang: language }}>
        <title>Jonnhy Ortega — {t('hero.title')}</title>
        <meta name="description" content={SEO_DESCRIPTION[language] ?? SEO_DESCRIPTION.es} />
      </Helmet>
      <section id="home" className="relative flex min-h-screen items-end overflow-hidden pb-28 pt-32 lg:items-center lg:pb-20">
        {/* Lavado de color y piso en perspectiva */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_78%_38%,rgba(124,58,237,0.28),transparent_70%),radial-gradient(40%_40%_at_95%_95%,rgba(234,179,8,0.16),transparent_70%),radial-gradient(45%_45%_at_0%_100%,rgba(168,85,247,0.14),transparent_70%)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] overflow-hidden opacity-50">
          <div className="grid-floor animate-gridmove absolute inset-x-[-40%] top-0 h-[160%]" />
        </div>

        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-3xl">
            {/* Estado del sistema */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-purple-200/80 sm:text-xs sm:tracking-[0.25em]"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulseRing" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span>SYS.ONLINE</span>
              <span className="h-px w-8 bg-gradient-to-r from-purple-400 to-transparent" />
              <span className="text-yellow-300">Jonathan Ortega</span>
            </motion.div>

            {/* Línea de terminal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-6 rounded-xl border border-white/10 bg-ink/60 px-4 py-3 font-mono text-sm backdrop-blur-md"
            >
              <p className="text-purple-300/70">
                <span className="text-yellow-400">&gt;</span> whoami
              </p>
              <p className="text-white">
                <span className="text-yellow-400">&gt;</span>{' '}
                <Typewriter text="jonathan_ortega.full_stack()" delay={1100} />
              </p>
            </motion.div>

            <h1 className="mb-8 font-display font-bold leading-[0.92] tracking-tight text-[clamp(3.2rem,9vw,8.2rem)]">
              <RevealWords
                text={title}
                delay={0.25}
                gradientFrom={Math.max(1, words.length - 2)}
              />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="mb-10 max-w-xl text-lg text-purple-100/70 md:text-xl"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.8 }}
              className="flex flex-wrap gap-4"
            >
              <MagneticButton
                onClick={scrollToProjects}
                className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-brand-gradient px-8 py-4 font-semibold text-white shadow-[0_0_40px_-8px_rgba(168,85,247,0.9)]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">{t('hero.cta')}</span>
                <ArrowDownRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
              </MagneticButton>

              <MagneticButton
                onClick={e => {
                  window.open('https://api.whatsapp.com/send?phone=5491122684234&text=Hola%20quiero%20más%20info', '_blank');
                }}
                className="group flex cursor-pointer items-center gap-3 rounded-full bg-yellow-400 px-8 py-4 font-semibold text-ink shadow-[0_0_40px_-10px_rgba(250,204,21,0.9)] transition-colors hover:bg-yellow-300"
              >
                {t('hero.contact')}
                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </MagneticButton>
            </motion.div>
          </div>
        </motion.div>

        {/* Indicador de scroll */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          onClick={scrollToProjects}
          aria-label="Scroll"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 sm:flex"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-purple-200/70">Scroll</span>
          <span className="relative h-12 w-px overflow-hidden bg-white/15">
            <span className="absolute inset-0 animate-scrollLine bg-gradient-to-b from-purple-400 to-yellow-400" />
          </span>
        </motion.button>
      </section>
    </>;
};
export default Hero;