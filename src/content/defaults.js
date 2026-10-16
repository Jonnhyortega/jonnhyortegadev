export const DEFAULT_TRANSLATIONS = {
    en: {
    chatbot: {
    header: "Jonathan Ortega’s Assistant Chatbot",
    presentacion: "Hello! I’m Jonson AI, the smart assistant of Jonathan Ortega’s portfolio. How can I help you today?",
    inputPlaceholder: "Type your message...",
    sendButton: "Send",
    loadingMessage: "Typing...",
    openButton: "Open Chat",
    quickReplies: {
      budget: "How can I request a quote?",
      social: "Social Media"
    },
    follow: "Follow me on",
    and: "and"
  },
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
      live: 'See demo',
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
      chatbot: {
  header: "Chatbot Asistente de Jonathan Ortega",
  presentacion: "¡Hola! Soy Jonson IA, el asistente inteligente del portafolio de Jonathan Ortega. ¿En qué puedo ayudarte hoy?",
  inputPlaceholder: "Escribe tu mensaje aquí...",
  sendButton: "Enviar",
  loadingMessage: "escribiendo...",
  openButton: "Abrir chat",
  quickReplies: {
    budget: "¿Cómo puedo pedir un presupuesto?",
    social: "Redes sociales"
  },
  follow: "Sígueme en",
  and: "y"
    },
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
      live: 'Ver demo',
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

export const TECH_KEYS = ['react', 'js', 'html5', 'css3', 'node', 'python', 'aws', 'docker', 'mongo', 'typescript', 'next', 'tailwind', 'tn'];

export const DEFAULT_THEME = {
  primary: '#a855f7',
  secondary: '#8b5cf6',
  accent: '#d946ef',
  highlight: '#facc15',
  ink: '#07030f',
};

// Paletas de Tailwind que reemplaza cada color del tema (ink es un color único).
export const THEME_PALETTES = {
  primary: 'purple',
  secondary: 'violet',
  accent: 'fuchsia',
  highlight: 'yellow',
};

const CLD = 'https://res.cloudinary.com/do87isqjr/image/upload';

export const DEFAULT_PROJECTS = [
  {
    id: 'lsmotos',
    title: 'Ls Motos',
    descriptionEn: 'Interactive website built with Next Js and modern web technologies',
    descriptionEs: 'Sitio web interactivo construido con Next.js y tecnologías web modernas',
    imageUrl: `${CLD}/v1790638270/combinado_motos_negro_qcrc2g.jpg`,
    tech: ['next', 'tailwind', 'css3'],
    liveUrl: 'https://lsmotos.com',
    githubUrl: 'https://github.com/Jonnhyortega/JonathanOrtega-Proyects',
    published: true,
  },
  {
    id: 'chatbot',
    title: 'API Chatbot',
    descriptionEn: 'AI-powered chatbot API deployed on AWS Lambda with serverless architecture',
    descriptionEs: 'API de chatbot con IA desplegada en AWS Lambda con arquitectura serverless',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
    tech: ['aws', 'python', 'docker'],
    liveUrl: 'https://2j5uuy7hcg.execute-api.us-east-1.amazonaws.com',
    githubUrl: 'https://github.com/Jonnhyortega/ia-portfolio',
    published: true,
  },
  {
    id: 'controlia',
    title: 'Controlia',
    descriptionEn: 'Application for managing businesses',
    descriptionEs: 'Sistema para gestion de comercios',
    imageUrl: `${CLD}/v1764769583/Captura_de_pantalla_2025-12-03_104451-removebg-preview_a13tvh.png`,
    tech: ['next', 'node', 'typescript', 'mongo'],
    liveUrl: 'https://controlia-software.vercel.app/',
    githubUrl: 'https://github.com/Jonnhyortega/controlia-software',
    published: true,
  },
  {
    id: 'rokotovich',
    title: 'Estudio juridico Rokotovich',
    descriptionEn: 'Website for a law firm, soon to be launched.',
    descriptionEs: 'Sitio web para estudio juridico, proximo a lanzar.',
    imageUrl: `${CLD}/v1764261488/logo-sinfondo_lbgdzo.png`,
    tech: ['next', 'js', 'css3'],
    liveUrl: 'https://www.estudiorokotovich.com/',
    githubUrl: 'https://github.com/Jonnhyortega/rokotovich',
    published: true,
  },
  {
    id: 'hc',
    title: 'HC Habilitaciones',
    descriptionEn: 'Business website for commercial licensing and permits',
    descriptionEs: 'Sitio web empresarial para habilitaciones y permisos comerciales',
    imageUrl: `${CLD}/v1764194887/hc-removebg-preview_zo1jou.png`,
    tech: ['next', 'css3', 'js'],
    liveUrl: 'https://gestioncomercialhc.com',
    githubUrl: 'https://github.com/Jonnhyortega/hc',
    published: true,
  },
  {
    id: 'chulos',
    title: 'Chulos Design',
    descriptionEn: 'Responsive landing page with modern design principles',
    descriptionEs: 'Página de aterrizaje responsiva con principios de diseño moderno para empresa de muebles',
    imageUrl: `${CLD}/v1764194680/Logo-removebg-preview_1_qr35lb.png`,
    tech: ['react', 'css3', 'js'],
    liveUrl: 'https://landingchulos.vercel.app/',
    githubUrl: 'https://github.com/Jonnhyortega/landingchulos',
    published: true,
  },
  {
    id: 'sanitarios',
    title: 'Sanitarios Lugano',
    descriptionEn: 'Website for sanitary products and fixtures',
    descriptionEs: 'Sitio web de comercio de productos sanitarios',
    imageUrl: `${CLD}/v1764196473/SanitariosLugano-removebg-preview_vms5em.png`,
    tech: ['react', 'css3', 'js'],
    liveUrl: 'https://sanitarioslugano.vercel.app',
    githubUrl: 'https://github.com/Jonnhyortega/sanitarioslugano',
    published: true,
  },
  {
    id: 'wuwei',
    title: 'Sublime Kids',
    descriptionEn: 'Video platform with interactive features and modern UI',
    descriptionEs: 'Plataforma de video con características interactivas e interfaz moderna',
    imageUrl: `${CLD}/v1790637089/logo-color_v9mqkv.jpg`,
    tech: ['tn', 'css3'],
    liveUrl: 'https://tiendadesublimekids26.mitiendanube.com/',
    githubUrl: 'https://github.com',
    published: true,
  },
  {
    id: 'casa',
    title: 'Casa Molinas',
    descriptionEn: 'Real estate showcase website with elegant design',
    descriptionEs: 'Sitio web de bienes raíces con diseño elegante',
    imageUrl: `${CLD}/v1764189657/logoCM-removebg-preview_ozwejp.png`,
    tech: ['tn', 'css3'],
    liveUrl: 'https://casamolinas.mitiendanube.com/',
    githubUrl: null,
    published: true,
  },
];
