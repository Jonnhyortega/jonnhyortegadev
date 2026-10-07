import React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/**
 * Botón/enlace "magnético": se desplaza levemente hacia el cursor.
 * `as` permite renderizar button o a.
 */
const MagneticButton = ({ as = 'button', strength = 0.3, className = '', children, ...props }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 14, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 220, damping: 14, mass: 0.5 });
  const Comp = motion[as];

  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <Comp
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.96 }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
};

export default MagneticButton;
