import React from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';

/**
 * Tarjeta con inclinación 3D siguiendo el mouse, borde degradé
 * y foco de luz que persigue el cursor.
 */
const TiltCard = ({
  children,
  className = '',
  innerClassName = '',
  max = 7,
  glow = 'rgba(168,85,247,0.30)',
}) => {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 22, mass: 0.6 };

  const rotateX = useSpring(useTransform(my, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-max, max]), spring);
  const gx = useTransform(mx, (v) => `${v * 100}%`);
  const gy = useTransform(my, (v) => `${v * 100}%`);
  const spot = useMotionTemplate`radial-gradient(380px circle at ${gx} ${gy}, ${glow}, transparent 65%)`;

  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={`group relative rounded-2xl p-px bg-gradient-to-br from-purple-500/40 via-white/10 to-yellow-500/30 transition-shadow duration-500 hover:shadow-[0_0_50px_-12px_rgba(168,85,247,0.7)] ${className}`}
    >
      <div className={`glass relative h-full overflow-hidden rounded-[15px] ${innerClassName}`}>
        <motion.div
          aria-hidden
          style={{ background: spot }}
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        {children}
      </div>
    </motion.div>
  );
};

export default TiltCard;
