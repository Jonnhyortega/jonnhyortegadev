import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Helmet } from 'react-helmet';
import { 
  FaReact, 
  FaJs, 
  FaHtml5, 
  FaCss3, 
  FaNodeJs, 
  FaPython, 
  FaAws, 
  FaDocker 
} from 'react-icons/fa';
import { 
  SiMongodb, 
  SiTypescript, 
  SiNextdotjs 
} from 'react-icons/si';
import { TiendaNubeIcon } from './ui/tnIcon';

const TechIcon = ({ type }) => {
  const icons = {
    react: <FaReact className="text-[#61DAFB]" />,
    js: <FaJs className="text-[#F7DF1E]" />,
    html5: <FaHtml5 className="text-[#E34F26]" />,
    css3: <FaCss3 className="text-[#1572B6]" />,
    node: <FaNodeJs className="text-[#339933]" />,
    python: <FaPython className="text-[#3776AB]" />,
    aws: <FaAws className="text-[#FF9900]" />,
    docker: <FaDocker className="text-[#2496ED]" />,
    mongo: <SiMongodb className="text-[#47A248]" />,
    typescript: <SiTypescript className="text-[#3178C6]" />,
    next: <SiNextdotjs className="text-white" />,
    tn: <TiendaNubeIcon className="text-[#0068ff]" />
    
  };

  return (
    <div className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded p-1 hover:bg-slate-700 transition-colors" title={type}>
      {icons[type] || null}
    </div>
  );
};

const Projects = () => {
  const { t } = useLanguage();

  const projects = [
    {
      id: 1,
      title: 'Personal Portfolio',
      description: t('projects.portfolio.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764197594/Captura_de_pantalla_2025-11-26_195144-removebg-preview_ewhpeo.png',
      tech: ['react', 'html5', 'css3'],
      liveUrl: 'https://jonnhyortegadev.com',
      githubUrl: 'https://github.com/Jonnhyortega/JonathanOrtega-Proyects',
    },
    {
      id: 2,
      title: 'API Chatbot',
      description: t('projects.chatbot.description'),
      image: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
      tech: ['aws', 'python', 'docker'],
      liveUrl: 'https://2j5uuy7hcg.execute-api.us-east-1.amazonaws.com',
      githubUrl: 'https://github.com/Jonnhyortega/ia-portfolio',
    },
    // {
    //   id: 3,
    //   title: 'Controlia',
    //   description: t('projects.controlia.description'),
    //   image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764189600/logoAstral_losxg8.png',
    //   tech: ['next', 'node', 'typescript', 'mongo'],
    //   liveUrl: 'https://example.com',
    //   githubUrl: 'https://github.com',
    // },
    {
      id: 4,
      title: 'Creatina Sticks',
      description: t('projects.creatina.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764194811/CSlogo-removebg-preview_fydzhj.png',
      tech: ['tn', 'css3'],
      liveUrl: 'https://creatinasticks.mitiendanube.com/',
      // githubUrl: 'https://github.com',
    },
    {
      id: 5,
      title: 'DVT Equipamiento',
      description: t('projects.dvt.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764194841/dvt-logo_go5rsp.png',
      tech: ['tn', 'css3'],
      liveUrl: 'https://dvtequipamientogastronomi.mitiendanube.com',
    },
    {
      id: 6,
      title: 'Estudio juridico Rokotovich',
      description: t('projects.rokotovich.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764261488/logo-sinfondo_lbgdzo.png',
      tech: ['next', 'js', 'css3'],
      liveUrl: 'https://rokotovich.vercel.app/',
      githubUrl: 'https://github.com/Jonnhyortega/rokotovich',
    },
    {
      id: 7,
      title: 'HC Habilitaciones',
      description: t('projects.hc.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764194887/hc-removebg-preview_zo1jou.png',
      tech: ['next', 'css3', 'js'],
      liveUrl: 'https://gestioncomercialhc.com',
      githubUrl: 'https://github.com/Jonnhyortega/hc',
    },
    {
      id: 8,
      title: 'Chulos Design',
      description: t('projects.chulos.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764194680/Logo-removebg-preview_1_qr35lb.png',
      tech: ['react', 'css3', 'js'],
      liveUrl: 'https://landingchulos.vercel.app/',
      githubUrl: 'https://github.com/Jonnhyortega/landingchulos',
    },
    {
      id: 9,
      title: 'Sanitarios Lugano',
      description: t('projects.sanitarios.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764196473/SanitariosLugano-removebg-preview_vms5em.png',
      tech: ['react', 'css3', 'js'],
      liveUrl: 'https://sanitarioslugano.vercel.app',
      githubUrl: 'https://github.com/Jonnhyortega/sanitarioslugano',
    },
    // {
    //   id: 10,
    //   title: 'Wuweiclip',
    //   description: t('projects.wuwei.description'),
    //   image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764194762/clipgenlogo-removebg-preview_yjla3s.png',
    //   tech: ['react', 'node', 'python', 'aws'],
    //   liveUrl: 'https://example.com',
    //   githubUrl: 'https://github.com',
    // },
    {
      id: 11,
      title: 'Casa Molinas',
      description: t('projects.casa.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764189657/logoCM-removebg-preview_ozwejp.png',
      tech: ['tn', 'css3'],
      liveUrl: 'https://casamolinas.mitiendanube.com/',
      // githubUrl: 'https://github.com',
    },
    {
      id: 12,
      title: 'Viandas H&G',
      description: t('projects.viandashyg.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764201568/hyg-logo-removebg-preview_vjq36t.png',
      tech: ['tn', 'css3'],
      liveUrl: 'https://viandashyg.mitiendanube.com/',
      // githubUrl: 'https://github.com',
    },
  ];

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
        <title>{t('projects.title')} - Professional Portfolio</title>
        <meta name="description" content={t('projects.subtitle')} />
      </Helmet>
      <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                {t('projects.title')}
              </span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-400 to-yellow-400 mx-auto mb-4"></div>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('projects.subtitle')}
            </p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {projects.map((project) => (
              <motion.div
                key={project.id}
                variants={item}
                className={`group relative bg-slate-900/50 backdrop-blur-sm rounded-xl overflow-hidden border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 flex flex-col`}
              >
                <div className={`
                  ${project.title === "API Chatbot" ||  
                  project.title === "Astral Vision" ||  
                  project.title === "Chulos Design" ? "bg-gray-300" : 
                  project.title === "Creatina Sticks" ? "bg-[#68A305]" : 
                  project.title === "Casa Molinas" ? "bg-[#F8F4EF]" : 
                  project.title === "HC Habilitaciones" ? "bg-[#1550A0]" : 
                  project.title === "Wuweiclip" ? "bg-black" : 
                  ""} relative h-48 overflow-hidden shrink-0 flex justify-center items-center`}>
                  <img
                    src={project.image}
                    alt={project.title}
                    className={`${
                      project.title === "Personal Portfolio" || 
                      project.title === "Wuweiclip" || 
                      project.title === "Chulos Design" || 
                      project.title === "Sanitarios Lugano" ? "w-[120px] h-[120px]" : 
                      project.title === "DVT Equipamiento" ? "w-[80%] h-[160px]" :
                      "w-full h-full"
                    }  object-cover transform group-hover:scale-110 transition-transform duration-500`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60"></div>
                </div>

                <div className="p-6 flex flex-col grow">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed grow">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tech.map((techType, index) => (
                      <TechIcon key={index} type={techType} />
                    ))}
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/30 rounded-lg transition-all duration-300 text-purple-300 hover:text-yellow-400 text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('projects.live')}
                    </a>
                    {project.githubUrl ? (<a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-600/30 rounded-lg transition-all duration-300 text-gray-300 hover:text-white text-sm"
                    >
                      <Github className="w-4 h-4" />
                      {t('projects.code')}
                    </a>) : ""}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Projects;