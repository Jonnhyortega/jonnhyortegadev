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
    <footer
      className="
        bg-gradient-to-b from-slate-950/40 to-slate-950/80
        backdrop-blur-md border-t border-purple-500/20
        pt-10 pb-6
      "
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top Section */}
        <div className="flex flex-col items-center gap-6">

          {/* Branding */}
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <span>{t('footer.made')}</span>
            <span>{t('footer.by')}</span>

            <span className="text-yellow-400 font-semibold tracking-wide">
              Jonnhy Ortega
            </span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
          </div>

          {/* Socials */}
          <div className="flex items-center gap-6">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  group flex items-center justify-center w-10 h-10
                  rounded-full border border-purple-500/20
                  hover:border-purple-500/40
                  bg-slate-900/40 backdrop-blur-sm
                  transition-all duration-300 hover:scale-105
                "
              >
                <s.icon className="w-5 h-5 text-gray-300 group-hover:text-yellow-400 transition-colors" />
              </a>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#home" className="hover:text-yellow-400 transition-colors"> {t('nav.home')} </a>
            <a href="#projects" className="hover:text-yellow-400 transition-colors"> {t('nav.projects')} </a>
            <a href="#skills" className="hover:text-yellow-400 transition-colors"> {t('nav.skills')} </a>
            <a href="#contact" className="hover:text-yellow-400 transition-colors"> {t('nav.contact')} </a>
          </div>

        </div>

        {/* Divider */}
        <div className="mt-8 mb-4 border-t border-purple-500/10"></div>

        {/* Bottom */}
        <p className="text-center text-gray-500 text-xs">
          © {year} {t('footer.rights')}
        </p>

      </div>
    </footer>
  );
};

export default Footer;
