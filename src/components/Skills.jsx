import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import TiltCard from '@/components/fx/TiltCard';
import SectionHeading from '@/components/fx/SectionHeading';
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
        staggerChildren: 0.07,
        delayChildren: 0.25,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, scale: 0.7, y: 16 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
  };

  return (
    <>
      <section id="skills" className="relative px-4 py-32 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_20%_30%,rgba(124,58,237,0.14),transparent_70%),radial-gradient(40%_40%_at_85%_80%,rgba(234,179,8,0.10),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeading
            index="03"
            label="Stack"
            title={t('skills.title')}
            subtitle={t('skills.subtitle')}
          />

          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 lg:grid-cols-3">
            {skills.map((skillGroup, groupIndex) => (
              <motion.div
                key={groupIndex}
                initial={{ opacity: 0, y: 60, rotateX: -14, transformPerspective: 1000 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: groupIndex * 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={groupIndex === 2 ? 'md:col-span-2 lg:col-span-1' : ''}
              >
                <TiltCard max={4} className="h-full" innerClassName="p-7">
                  <div className="mb-8 flex items-start justify-between">
                    <h3 className="text-2xl font-bold tracking-tight text-white">
                      {skillGroup.category}
                    </h3>
                    <span className="font-display text-6xl font-bold leading-none text-outline">
                      {String(groupIndex + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <motion.div
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {skillGroup.technologies.map((tech, techIndex) => (
                      <motion.div
                        key={techIndex}
                        variants={item}
                        whileHover={{ y: -6, scale: 1.04 }}
                        className="group/tile tech-tile flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors duration-300 hover:border-purple-400/40 hover:bg-purple-500/10"
                      >
                        <div className="tech-icon h-11 w-11">
                          {tech.icon}
                        </div>
                        <span className="text-center font-mono text-[11px] uppercase tracking-wider text-purple-100/70 transition-colors group-hover/tile:text-yellow-300">
                          {tech.name}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Skills;