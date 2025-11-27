import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin, Github, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const Contact = () => {
  const { t } = useLanguage();

  const socialLinks = [
    {
      name: 'Email',
      icon: Mail,
      href: 'mailto:jonnhyortega@gmail.com',
      color: 'from-purple-400 to-purple-600',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      href: 'https://www.linkedin.com/in/jonathan-ortega-a00970191/',
      color: 'from-blue-400 to-blue-600',
    },
    {
      name: 'GitHub',
      icon: Github,
      href: 'https://github.com/jonnhyortega',
      color: 'from-gray-400 to-gray-600',
    },
    {
      name: 'WhatsApp',
      icon: MessageSquare,
      href: 'https://wa.me/541122684234',
      color: 'from-green-400 to-green-600',
    },
  ];

  const handleSocialClick = (e) => {
    toast({
      title: "⏳ Redirigiendo",
      // description: `Enviando correo...`,
      duration: 3000,
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <>
      <Helmet>
        <title>{t('contact.title')} - Professional Portfolio</title>
        <meta name="description" content={t('contact.subtitle')} />
      </Helmet>
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                {t('contact.title')}
              </span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-400 to-yellow-400 mx-auto mb-4"></div>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('contact.subtitle')}
            </p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {socialLinks.map((link) => (
              <motion.a
                key={link.name}
                variants={item}
                href={link.href}
                target='_blank'
                // onClick={(e) => handleSocialClick(e, link.name)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative bg-slate-900/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <div className="relative flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full bg-gradient-to-br ${link.color} shadow-lg`}>
                    {link.name === "WhatsApp" ? 
                    (<img width="40" height="40" src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="whatsapp--v1"/>) : 
                    (<link.icon className="w-8 h-8 text-white" />)}
                  </div>
                  <span className="text-xl font-semibold text-white group-hover:text-yellow-400 transition-colors">
                    {link.name}
                  </span>
                </div>
              </motion.a>
            ))}
          </motion.div>

        </div>
      </section>
    </>
  );
};

export default Contact;