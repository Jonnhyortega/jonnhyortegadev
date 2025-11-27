import React from 'react';
import { motion } from 'framer-motion';
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
  FaDocker, 
  FaGitAlt, 
  FaGithub 
} from 'react-icons/fa';
import { 
  SiMongodb, 
  SiTypescript, 
  SiNextdotjs,
  SiTailwindcss  
} from 'react-icons/si';

const Skills = () => {
  const { t } = useLanguage();

  const skills = [
    {
      category: 'Frontend',
      technologies: [
        { name: 'React', icon: <FaReact className="w-full h-full text-[#61DAFB]" /> },
        { name: 'Next.js', icon: <SiNextdotjs className="w-full h-full text-white" /> },
        { name: 'TypeScript', icon: <SiTypescript className="w-full h-full text-[#3178C6]" /> },
        { name: 'JavaScript', icon: <FaJs className="w-full h-full text-[#F7DF1E]" /> },
        { name: 'HTML5', icon: <FaHtml5 className="w-full h-full text-[#E34F26]" /> },
        { name: 'CSS3', icon: <FaCss3 className="w-full h-full text-[#1572B6]" /> },
        { name: 'tailwind', icon: <SiTailwindcss className="w-full h-full text-[#61bdff]" /> },
      ],
    },
    {
      category: 'Backend',
      technologies: [
        { name: 'Node.js', icon: <FaNodeJs className="w-full h-full text-[#339933]" /> },
        { name: 'Python', icon: <FaPython className="w-full h-full text-[#3776AB]" /> },
        { name: 'MongoDB', icon: <SiMongodb className="w-full h-full text-[#47A248]" /> },
        { name: 'AWS', icon: <FaAws className="w-full h-full text-[#FF9900]" /> },
      ],
    },
    {
      category: 'Tools & Others',
      technologies: [
        { name: 'Docker', icon: <FaDocker className="w-full h-full text-[#2496ED]" /> },
        { name: 'Git', icon: <FaGitAlt className="w-full h-full text-[#F05032]" /> },
        { name: 'GitHub', icon: <FaGithub className="w-full h-full text-white" /> },
      ],
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
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
  };

  return (
    <>
      <Helmet>
        <title>{t('skills.title')} - Professional Portfolio</title>
        <meta name="description" content={t('skills.subtitle')} />
      </Helmet>
      <section id="skills" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                {t('skills.title')}
              </span>
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-400 to-yellow-400 mx-auto mb-4"></div>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('skills.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {skills.map((skillGroup, groupIndex) => (
              <motion.div
                key={groupIndex}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: groupIndex * 0.2 }}
                className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300"
              >
                <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">
                  {skillGroup.category}
                </h3>
                <motion.div
                  variants={container}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="grid grid-cols-2 gap-4"
                >
                  {skillGroup.technologies.map((tech, techIndex) => (
                    <motion.div
                      key={techIndex}
                      variants={item}
                      whileHover={{ scale: 1.1 }}
                      className="flex flex-col items-center gap-3 p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-all duration-300 group"
                    >
                      <div className="w-12 h-12">
                        {tech.icon}
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-yellow-400 transition-colors text-center">
                        {tech.name}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Skills;