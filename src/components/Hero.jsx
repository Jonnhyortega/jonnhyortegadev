import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Helmet } from 'react-helmet';
const Hero = () => {
  const {
    t
  } = useLanguage();
  const scrollToProjects = () => {
    const element = document.querySelector('#projects');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <>
      <Helmet>
        <title>{t('hero.title')} - Professional Portfolio</title>
        <meta name="description" content={t('hero.subtitle')} />
      </Helmet>
      <section id="home" className="min-h-screen flex items-center justify-center relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-yellow-900/20"></div>
        
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => <motion.div key={i} className="absolute w-1 h-1 bg-purple-400/30 rounded-full" style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`
        }} animate={{
          opacity: [0.2, 0.8, 0.2],
          scale: [1, 1.5, 1]
        }} transition={{
          duration: Math.random() * 3 + 2,
          repeat: Infinity,
          delay: Math.random() * 2
        }} />)}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <motion.div initial={{
            opacity: 0,
            scale: 0.5
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            duration: 0.5
          }} className="mb-8">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-yellow-500 p-1">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <span className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">JO</span>
                </div>
              </div>
            </motion.div>

            <motion.h1 initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.2
          }} className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-yellow-400 to-purple-400 bg-clip-text text-transparent">
                {t('hero.title')}
              </span>
            </motion.h1>

            <motion.p initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.4
          }} className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              {t('hero.subtitle')}
            </motion.p>

            <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: 0.6
          }} className="flex flex-wrap gap-4 justify-center">
              <button onClick={scrollToProjects} className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/50">
                {t('hero.cta')}
              </button>
              <span onClick={e => {
              window.open('https://api.whatsapp.com/send?phone=5491122684234&text=Hola%20quiero%20más%20info', '_blank');
            }} className="cursor-pointer px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-yellow-500/50">
                {t('hero.contact')}
              </span>
            </motion.div>
          </div>
        </div>

        <motion.div animate={{
        y: [0, 10, 0]
      }} transition={{
        duration: 2,
        repeat: Infinity
      }} className="absolute bottom-2 left-1/2 transform -translate-x-1/2 cursor-pointer" onClick={scrollToProjects}>
          <ChevronDown className="w-8 h-8 text-purple-400" />
        </motion.div>
      </section>
    </>;
};
export default Hero;