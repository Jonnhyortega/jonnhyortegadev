import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

const translations = {
  en: {
    nav: {
      home: 'Home',
      projects: 'Projects',
      skills: 'Skills',
      contact: 'Contact',
    },
    hero: {
      title: 'Full Stack Developer',
      subtitle: 'Building modern web applications with cutting-edge technologies',
      cta: 'View Projects',
      contact: 'Get In Touch',
    },
    projects: {
      title: 'My Projects',
      subtitle: 'A showcase of my latest work and achievements',
      portfolio: {
        description: 'Interactive portfolio website built with React and modern web technologies',
      },
      chatbot: {
        description: 'AI-powered chatbot API deployed on AWS Lambda with serverless architecture',
      },
      hc: {
        description: 'Business website for commercial licensing and permits',
      },
      astral: {
        description: 'React Router implementation with modern component design',
      },
      controlia: {
        description: 'E-commerce application for astronomical equipment built with Next.js',
      },
      creatina: {
        description: 'Ecommerce for a dietary and fitness supplement brand',
      },
      dvt: {
        description: 'Catalog and sales platform for professional gastronomic equipment',
      },
      chulos: {
        description: 'Responsive landing page with modern design principles',
      },
      sanitarios: {
        description: 'Website for sanitary products and fixtures',
      },
      wuwei: {
        description: 'Video platform with interactive features and modern UI',
      },
      casa: {
        description: 'Real estate showcase website with elegant design',
      },
      viandashyg: {
        description: 'online store for a food business',
      },
      rokotovich: {
        description: 'Website for a law firm, soon to be launched.'},
      live: 'See project',
      code: 'Source Code',
    },
    skills: {
      title: 'Technologies',
      subtitle: 'Tools and frameworks I work with',
    },
    contact: {
      title: 'Get In Touch',
      subtitle: "Let's discuss your next project",
      direct: 'Or email me directly at:',
      send: 'Send Email',
    },
    footer: {
      made: 'Made',
      by: 'by',
      rights: 'All rights reserved.',
    },
  },
  es: {
    nav: {
      home: 'Inicio',
      projects: 'Proyectos',
      skills: 'Habilidades',
      contact: 'Contacto',
    },
    hero: {
      title: 'Desarrollador Full Stack',
      subtitle: 'Construyendo aplicaciones web modernas con tecnologías de vanguardia',
      cta: 'Ver Proyectos',
      contact: 'Contáctame',
    },
    projects: {
      title: 'Mis Proyectos',
      subtitle: 'Una muestra de mis últimos trabajos y logros',
      portfolio: {
        description: 'Sitio web de portafolio interactivo construido con React y tecnologías web modernas',
      },
      chatbot: {
        description: 'API de chatbot con IA desplegada en AWS Lambda con arquitectura serverless',
      },
      hc: {
        description: 'Sitio web empresarial para habilitaciones y permisos comerciales',
      },
      astral: {
        description: 'Sitio web para agencia de diseño web',
      },
      controlia: {
        description: 'Sistema para gestion de comercios',
      },
      creatina: {
        description: 'Eccomerce para marca de suplementos dietarios y fitness',
      },
      dvt: {
        description: 'Plataforma de catálogo y ventas para equipamiento gastronómico profesional',
      },
      chulos: {
        description: 'Página de aterrizaje responsiva con principios de diseño moderno para empresa de muebles',
      },
      sanitarios: {
        description: 'Sitio web de comercio de productos sanitarios',
      },
      wuwei: {
        description: 'Plataforma de video con características interactivas e interfaz moderna',
      },
      casa: {
        description: 'Sitio web de bienes raíces con diseño elegante',
      },
      viandashyg: {
        description: 'Tienda online para empresa gastronomica de viandas',
      },
      rokotovich: {
        description: 'Sitio web para estudio juridico, proximo a lanzar.',
      },
      live: 'Ver proyecto',
      code: 'Código Fuente',
    },
    skills: {
      title: 'Tecnologías',
      subtitle: 'Herramientas y frameworks con los que trabajo',
    },
    contact: {
      title: 'Contacto',
      subtitle: 'Hablemos sobre tu próximo proyecto',
      direct: 'O envíame un correo directamente a:',
      send: 'Enviar Email',
    },
    footer: {
      made: 'Hecho',
      by: 'por',
      rights: 'Todos los derechos reservados.',
    },
  },
};

const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('es');

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;