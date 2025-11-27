import React from 'react';
import { Heart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950/50 backdrop-blur-sm border-t border-purple-500/20 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <span>{t('footer.made')}</span>
            <Heart className="w-4 h-4 text-red-500 fill-current animate-pulse" />
            <span>{t('footer.by')}</span>
            <span className="text-yellow-400 font-semibold">Portfolio</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {currentYear} {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;