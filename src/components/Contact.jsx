import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Linkedin, Github, MessageSquare, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import SectionHeading from '@/components/fx/SectionHeading';

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

  const handleSocialClick = (e, href) => {
    e.preventDefault(); // Evita que se abra instantáneamente

    toast({
      title: "⏳ Redirigiendo...",
      duration: 1500
    });

    setTimeout(() => {
      // Si es mailto, no usar window.open con _blank (a veces bloquea)
      if (href.startsWith("mailto:")) {
        window.location.href = href;
      } else {
        window.open(href, "_blank");
      }
    }, 1200);
  };

  return (
    <>

      <section id="contact" className="relative flex min-h-screen items-center px-4 py-32 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_80%_45%,rgba(124,58,237,0.22),transparent_70%),radial-gradient(40%_40%_at_10%_90%,rgba(234,179,8,0.12),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-7xl">
          <SectionHeading
            index="04"
            label="Contact"
            title={t('contact.title')}
            subtitle={t('contact.subtitle')}
          />

          <div className="max-w-2xl border-t border-white/10">
            {socialLinks.map((link, i) => (
              <motion.a
                key={link.name}
                href={link.href}
                onClick={(e) => handleSocialClick(e, link.href)}
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex items-center gap-5 overflow-hidden border-b border-white/10 py-6"
              >
                {/* Barrido de degradé al hacer hover */}
                <span className={`absolute inset-0 -translate-x-full bg-gradient-to-r ${link.color} opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-[0.14]`} />

                <span className="relative font-mono text-xs text-yellow-400/80">0{i + 1}</span>

                <div className={`relative rounded-full bg-gradient-to-br ${link.color} p-3 shadow-lg transition-transform duration-500 group-hover:rotate-[360deg] group-hover:scale-110`}>
                  {link.name === "WhatsApp" ? (
                    <img width="28" height="28" src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="whatsapp" />
                  ) : (
                    <link.icon className="h-7 w-7 text-white" />
                  )}
                </div>

                <span className="relative flex-1 text-3xl font-bold tracking-tight text-white transition-all duration-300 group-hover:translate-x-2 group-hover:text-yellow-300 sm:text-4xl">
                  {link.name}
                </span>

                <ArrowUpRight className="relative h-7 w-7 text-purple-300/60 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-yellow-300" />
              </motion.a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;
