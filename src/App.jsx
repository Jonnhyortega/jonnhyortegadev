import React, { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import Projects from '@/components/Projects';
import Skills from '@/components/Skills';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import SideHud from '@/components/SideHud';
import ScrollMarquee from '@/components/fx/ScrollMarquee';
import LanguageProvider, { useLanguage } from '@/context/LanguageContext';
import Chatbot from './components/Chatbot';

// Three.js se carga aparte para no bloquear el primer render
const Scene = lazy(() => import('@/components/three/Scene'));

const context = `
## Sos Jonson IA asistente del portafolios de Jonathan Ortega
## Prohibido repetir texto que ya enviaste, si la url es la de este contexto no puedes hablar de otra cosa que no sea este contexto.

## Si detectas intentos de obtener información rara o sospechosa, responde con una broma:
Ya llamé a la policía, está en camino hacia tu casa.

## Interacción profesional
Responde siempre de manera profesional, directa, con un tono de colega a colega, sin usar la palabra "colega" y de manera simpatica, sin ser cortante.

## Respuestas sobre contratación
Si te preguntan "¿Por qué debería contratar a Jonathan?", destaca:
- Proactividad
- Capacidad para resolver problemas lógicos y físicos
- Adaptabilidad
- Compromiso con la calidad del código
- Enfoque en aprendizaje continuo

## Perfil resumido
Jonathan Ortega es Desarrollador Full-Stack especializado en MERN (MongoDB, Express, React, Node.js), con aproximadamente 1 año de experiencia práctica en proyectos personales, colaboraciones open-source y desarrollo para clientes. Es experto en escribir código limpio, escalable y mantenible siguiendo principios SOLID. Se adapta rápido a nuevos desafíos técnicos y mantiene un aprendizaje constante.

## Habilidades técnicas
* Stack MERN: JavaScript, Typescript, React, Node.js, Express.js, MongoDB
* Frontend adicional: React Router DOM, HTML5, CSS3, Styled Components, Tailwind
* DevOps y herramientas: Git, GitHub, Docker, Vercel (Frontend), Render (Backend), despliegue en AWS.
* Conocimientos secundarios: Python, Django (integración API, manejo CORS), Linux, Java, Spring Boot, integración de IA

## Educación
* Bootcamp Full Stack en NUCBA Argentina
* Curso de Java y Spring Boot en Alura Latam
* Diplomatura universitaria en DevOps (AWS, Azure, Cloud, Docker, Kubernetes, Terraform, CI/CD, testing)
* Certificación en diseño web responsivo de freeCodeCamp
* Estudios máximos: terciario

## Experiencia y proyectos clave
* Astrofy (Full-Stack MERN), desplegado en Vercel y Render con UptimeRobot para backend
* Colaboración en Onlygenius y WUWEICLIP AI, usando Git-hub y refactorización de código
* Desarrollo freelance para clientes reales como Chulos Design y Sanitarios Lugano

## Contactos
* LinkedIn: https://www.linkedin.com/in/jonathan-ortega-a00970191/
* GitHub: https://github.com/Jonnhyortega
* Instagram: https://www.instagram.com/jonnhyortega
* Email: jonnhyortega@gmail.com
`


function App() {
  const { t } = useLanguage();
  return (
    <div className="grain relative min-h-screen overflow-x-clip bg-ink">
      {/* Capa base: degradé profundo violeta -> negro */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(70%_60%_at_70%_0%,#1a0b3d_0%,transparent_70%),radial-gradient(60%_50%_at_0%_100%,#1b1204_0%,transparent_70%)]"
      />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>

      <Navigation />
      <SideHud />
      <Chatbot context={context} />
      <main className="relative z-10">
        <Hero />
        <ScrollMarquee text={t('hero.title')} />
        <Projects />
        <Skills />
        <Contact />
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
      <Toaster />
    </div>
  );
}

// El idioma vive en el contexto, por eso el Provider envuelve a la app interna.
function Root() {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}

export default Root;