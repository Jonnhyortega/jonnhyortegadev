import React from 'react';
import { Heart, Github, Linkedin, Mail } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  const socials = [
    { icon: Mail, href: 'mailto:jonnhyortega@gmail.com', label: 'Email' },
    { icon: Linkedin, href: 'https://www.linkedin.com/in/jonathan-ortega-a00970191/', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/jonnhyortega', label: 'GitHub' },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-gradient-to-b from-transparent via-ink/80 to-ink pt-12 backdrop-blur-[2px]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">

          {/* Branding */}
          <div className="flex items-center gap-2 text-sm text-purple-100/70">
            <span>{t('footer.made')}</span>
            <span>{t('footer.by')}</span>

            <span className="font-semibold tracking-wide text-yellow-400">
              Jonnhy Ortega
            </span>
            <Heart className="h-4 w-4 animate-pulse fill-red-500 text-red-500" />
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap gap-6 font-mono text-xs uppercase tracking-widest text-purple-200/60">
            <a href="#home" className="transition-colors hover:text-yellow-400"> {t('nav.home')} </a>
            <a href="#projects" className="transition-colors hover:text-yellow-400"> {t('nav.projects')} </a>
            <a href="#skills" className="transition-colors hover:text-yellow-400"> {t('nav.skills')} </a>
            <a href="#contact" className="transition-colors hover:text-yellow-400"> {t('nav.contact')} </a>
          </div>

          {/* Socials */}
          <div className="flex items-center gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-400/50 hover:shadow-[0_0_20px_-4px_rgba(250,204,21,0.6)]"
              >
                <s.icon className="h-5 w-5 text-purple-100/70 transition-colors group-hover:text-yellow-400" />
              </a>
            ))}
          </div>

        </div>

        {/* Wordmark gigante */}
        <p
          aria-hidden
          className="select-none whitespace-nowrap pt-10 text-center font-display text-[clamp(2.4rem,11vw,11rem)] font-bold uppercase leading-[0.85] tracking-tighter text-outline"
          style={{ WebkitTextStroke: '1px rgba(196,181,253,0.22)' }}
        >
          Jonnhy Ortega
        </p>

        {/* Bottom */}
        <p className="relative -mt-2 pb-6 text-center font-mono text-[11px] tracking-widest text-purple-200/40">
          © {year} {t('footer.rights')}
        </p>

      </div>
    </footer>
  );
};

export default Footer;
