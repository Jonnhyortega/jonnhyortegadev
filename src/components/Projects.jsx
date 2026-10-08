import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion';
import { ExternalLink, Github } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import TiltCard from '@/components/fx/TiltCard';
import SectionHeading from '@/components/fx/SectionHeading';
import useMediaQuery from '@/hooks/useMediaQuery';
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
  SiNextdotjs,
  SiTailwindcss 
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
    tailwind: <SiTailwindcss className="text-[#06B6D4]" />,
    tn: <TiendaNubeIcon className="text-[#0068ff]" />
  };

  const titles = {
    react: 'React',
    js: 'JavaScript',
    html5: 'HTML5',
    css3: 'CSS3',
    node: 'Node.js',
    python: 'Python',
    aws: 'AWS',
    docker: 'Docker',
    mongo: 'MongoDB',
    typescript: 'TypeScript',
    next: 'Next.js',
    tailwind: 'Tailwind CSS',
    tn: 'Tienda Nube'
  };

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-400/50 hover:bg-purple-500/10" title={titles[type] || type}>
      {icons[type] || null}
    </div>
  );
};

const Projects = () => {
  const { t } = useLanguage();

  const projects = [
    {
      id: 1,
      title: 'Ls Motos',
      description: t('projects.lsmotos.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1790638270/combinado_motos_negro_qcrc2g.jpg',
      tech: ['next', 'tailwind', 'css3'],
      liveUrl: 'https://lsmotos.com',
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
    {
      id: 3,
      title: 'Controlia',
      description: t('projects.controlia.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764769583/Captura_de_pantalla_2025-12-03_104451-removebg-preview_a13tvh.png',
      tech: ['next', 'node', 'typescript', 'mongo'],
      liveUrl: 'https://controlia-software.vercel.app/',
      githubUrl: 'https://github.com/Jonnhyortega/controlia-software',
    },
    {
      id: 6,
      title: 'Estudio juridico Rokotovich',
      description: t('projects.rokotovich.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764261488/logo-sinfondo_lbgdzo.png',
      tech: ['next', 'js', 'css3'],
      liveUrl: 'https://estudio-rokotovich.vercel.app/',
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
    {
      id: 10,
      title: 'Sublime Kids',
      description: t('projects.wuwei.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1790637089/logo-color_v9mqkv.jpg',
      tech: ['tn', 'css3'],
      liveUrl: 'https://tiendadesublimekids26.mitiendanube.com/',
      githubUrl: 'https://github.com',
    },
    {
      id: 11,
      title: 'Casa Molinas',
      description: t('projects.casa.description'),
      image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764189657/logoCM-removebg-preview_ozwejp.png',
      tech: ['tn', 'css3'],
      liveUrl: 'https://casamolinas.mitiendanube.com/',
      // githubUrl: 'https://github.com',
    },
    // {
    //   id: 12,
    //   title: 'Viandas H&G',
    //   description: t('projects.viandashyg.description'),
    //   image: 'https://res.cloudinary.com/do87isqjr/image/upload/v1764201568/hyg-logo-removebg-preview_vjq36t.png',
    //   tech: ['tn', 'css3'],
    //   liveUrl: 'https://viandashyg.mitiendanube.com/',
    //   // githubUrl: 'https://github.com',
    // },
  ];

  const sectionRef = useRef(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Parallax: cada columna se mueve a distinta velocidad (solo desktop)
  const col0 = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const col1 = useTransform(scrollYProgress, [0, 1], [110, -110]);
  const col2 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const still = useMotionValue(0);
  const columns = isDesktop ? [col0, col1, col2] : [still, still, still];

  const item = {
    hidden: { opacity: 0, y: 70, rotateX: -16, scale: 0.95, transformPerspective: 1000 },
    show: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      scale: 1,
      transformPerspective: 1000,
      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <>
      <section id="projects" ref={sectionRef} className="relative px-4 pb-40 pt-28 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(7,3,15,0.55)_12%,rgba(7,3,15,0.55)_88%,transparent)]"
        />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeading
            index="02"
            label="Selected work"
            title={t('projects.title')}
            subtitle={t('projects.subtitle')}
          />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <motion.div key={project.id} style={{ y: columns[index % 3] }}>
                <motion.div
                  variants={item}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: (index % 3) * 0.08 }}
                  className="h-full"
                >
                  <TiltCard className="h-full" innerClassName="flex h-full flex-col">
                    <div className={`
                      ${project.title === "API Chatbot" ||  
                      project.title === "Astral Vision" ||  
                      project.title === "Chulos Design" ? "bg-gray-300" : 
                      project.title === "Casa Molinas" ? "bg-[#F8F4EF]" : 
                      project.title === "HC Habilitaciones" ? "bg-[#1550A0]" : 
                      project.title === "Wuweiclip" ? "bg-black" : 
                      ""} relative h-52 overflow-hidden shrink-0 flex justify-center items-center`}>
                      <img
                        src={project.image}
                        alt={project.title}
                        loading="lazy"
                        className={`${
                          project.title === "Personal Portfolio" || 
                          project.title === "Wuweiclip" || 
                          project.title === "Chulos Design" || 
                          project.title === "Sanitarios Lugano" ? "w-[120px] h-[120px]" : 
                          "w-full h-full"
                        }  object-cover transform group-hover:scale-110 transition-transform duration-700`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent opacity-70"></div>
                      <span className="absolute left-4 top-4 rounded-md border border-white/10 bg-ink/70 px-2 py-1 font-mono text-[11px] tracking-widest text-yellow-300 backdrop-blur-md">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex grow flex-col p-6">
                      <h3 className="mb-2 text-2xl font-bold tracking-tight text-white transition-colors group-hover:text-gradient">
                        {project.title}
                      </h3>
                      <p className="mb-5 grow text-sm leading-relaxed text-purple-100/60">
                        {project.description}
                      </p>

                      <div className="mb-6 flex flex-wrap gap-2">
                        {project.tech.map((techType, i) => (
                          <TechIcon key={i} type={techType} />
                        ))}
                      </div>

                      <div className="mt-auto flex gap-3">
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-600/20 px-4 py-2 text-sm text-purple-200 transition-all duration-300 hover:border-yellow-400/60 hover:bg-yellow-400/10 hover:text-yellow-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t('projects.live')}
                        </a>
                        {project.githubUrl ? (<a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all duration-300 hover:border-white/30 hover:text-white"
                        >
                          <Github className="h-4 w-4" />
                          {t('projects.code')}
                        </a>) : ""}
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Projects;
