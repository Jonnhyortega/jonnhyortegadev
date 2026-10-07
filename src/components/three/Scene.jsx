import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Escena 3D fija de fondo. Un único objeto (nudo toroidal con degradé
 * violeta -> dorado) viaja y rota según la sección visible, con parallax de
 * mouse, impulso por velocidad de scroll, anillos orbitales y partículas.
 */

const SECTION_IDS = ['home', 'projects', 'skills', 'contact'];

// x,y: fracción del ancho/alto visible (centro = 0). s: escala. rx/ry: rotación.
const STAGES_DESKTOP = [
  { x: 0.27, y: 0.02, z: 0, s: 0.95, rx: 0.25, ry: 0 },
  { x: 0.34, y: 0.2, z: -1.8, s: 0.5, rx: 0.9, ry: 2.1 },
  { x: 0.32, y: 0.22, z: -1.8, s: 0.55, rx: -0.5, ry: 4.2 },
  { x: 0.24, y: 0.02, z: 0.2, s: 1.05, rx: 0.3, ry: 6.28 },
];

const STAGES_MOBILE = [
  { x: 0, y: 0.31, z: -0.8, s: 0.52, rx: 0.25, ry: 0 },
  { x: 0.34, y: 0.44, z: -3.4, s: 0.26, rx: 0.9, ry: 2.1 },
  { x: 0.34, y: 0.44, z: -3.4, s: 0.26, rx: -0.5, ry: 4.2 },
  { x: 0.34, y: 0.44, z: -3.4, s: 0.28, rx: 0.3, ry: 6.28 },
];

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;
const damp = THREE.MathUtils.damp;

const BRAND = {
  violet: new THREE.Color('#7c3aed'),
  magenta: new THREE.Color('#c026d3'),
  gold: new THREE.Color('#facc15'),
};

function KnotGeometry({ mobile }) {
  const geometry = useMemo(() => {
    const g = new THREE.TorusKnotGeometry(1, 0.34, mobile ? 120 : 260, mobile ? 16 : 48, 2, 3);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const t = 0.5 + 0.5 * Math.sin(pos.getX(i) * 1.4 + pos.getY(i) * 1.8 + pos.getZ(i) * 0.8);
      if (t < 0.55) tmp.copy(BRAND.violet).lerp(BRAND.magenta, t / 0.55);
      else tmp.copy(BRAND.magenta).lerp(BRAND.gold, (t - 0.55) / 0.45);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [mobile]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function Orbiter({ radius, speed, offset, size = 0.07, color = '#facc15' }) {
  const ref = useRef();
  useFrame((state) => {
    const a = state.clock.elapsedTime * speed + offset;
    ref.current.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Ring({ radius, tilt, color, opacity = 0.35, children }) {
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.006, 8, 160]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {children}
    </group>
  );
}

function Rig({ mobile, reduced }) {
  const group = useRef();
  const knot = useRef();
  const rings = useRef();
  const dust = useRef();
  const st = useRef({ pos: 0, spin: 0, lastY: 0, tops: [], heights: [] });

  // Mide las secciones para convertir el scroll en "posición narrativa" (0..3)
  useEffect(() => {
    const measure = () => {
      const els = SECTION_IDS.map((id) => document.getElementById(id));
      st.current.tops = els.map((el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0));
      st.current.heights = els.map((el) => (el ? el.offsetHeight : 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useFrame((state, delta) => {
    const s = st.current;
    const { viewport, pointer } = state;
    const stages = mobile ? STAGES_MOBILE : STAGES_DESKTOP;
    const dt = Math.min(delta, 0.05);

    // Posición narrativa según el centro del viewport
    const y = window.scrollY + window.innerHeight * 0.5;
    let idx = 0;
    for (let i = 0; i < s.tops.length; i += 1) if (y >= s.tops[i]) idx = i;
    const nextTop = s.tops[idx + 1] ?? s.tops[idx] + s.heights[idx];
    const span = Math.max(1, nextTop - s.tops[idx]);
    const raw = idx + THREE.MathUtils.clamp((y - s.tops[idx]) / span, 0, 1);
    s.pos = damp(s.pos, Math.min(raw, 3), reduced ? 2 : 4, dt);

    const i0 = Math.min(Math.floor(s.pos), 2);
    const f = smooth(THREE.MathUtils.clamp(s.pos - i0, 0, 1));
    const a = stages[i0];
    const b = stages[i0 + 1];
    const tx = lerp(a.x, b.x, f) * viewport.width;
    const ty = lerp(a.y, b.y, f) * viewport.height;
    const tz = lerp(a.z, b.z, f);
    const ts = lerp(a.s, b.s, f);
    const trx = lerp(a.rx, b.rx, f);
    const tryy = lerp(a.ry, b.ry, f);

    const g = group.current;
    g.position.x = damp(g.position.x, tx, 5, dt);
    g.position.y = damp(g.position.y, ty, 5, dt);
    g.position.z = damp(g.position.z, tz, 5, dt);
    const sc = damp(g.scale.x, ts, 5, dt);
    g.scale.setScalar(sc);

    const m = reduced ? 0 : 1;
    g.rotation.y = damp(g.rotation.y, tryy + pointer.x * 0.5 * m, 3, dt);
    g.rotation.x = damp(g.rotation.x, trx - pointer.y * 0.35 * m, 3, dt);

    // Impulso por velocidad de scroll
    const dy = window.scrollY - s.lastY;
    s.lastY = window.scrollY;
    s.spin = damp(s.spin, 0, 2.5, dt);
    if (!reduced) s.spin = Math.min(4, s.spin + Math.abs(dy) * 0.02);

    knot.current.rotation.y += dt * ((reduced ? 0.04 : 0.2) + s.spin);
    knot.current.rotation.z += dt * (reduced ? 0.02 : 0.12);
    rings.current.rotation.z += dt * (reduced ? 0.01 : 0.08);
    rings.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;

    if (dust.current) dust.current.position.y = s.pos * 1.4;
  });

  return (
    <>
      <group ref={dust}>
        <Sparkles count={mobile ? 50 : 130} scale={[16, 10, 8]} size={2.6} speed={0.25} opacity={0.8} color="#a78bfa" />
        <Sparkles count={mobile ? 25 : 60} scale={[14, 9, 7]} size={3.2} speed={0.35} opacity={0.9} color="#facc15" />
      </group>

      <group ref={group} scale={0.01}>
        <mesh ref={knot}>
          <KnotGeometry mobile={mobile} />
          <meshPhysicalMaterial
            vertexColors
            metalness={0.9}
            roughness={0.18}
            clearcoat={1}
            clearcoatRoughness={0.1}
            iridescence={1}
            iridescenceIOR={1.5}
            iridescenceThicknessRange={[200, 600]}
            envMapIntensity={1.7}
          />
        </mesh>

        <group ref={rings}>
          <Ring radius={2.1} tilt={[1.2, 0.2, 0]} color="#facc15" opacity={0.4}>
            <Orbiter radius={2.1} speed={0.7} offset={0} />
          </Ring>
          <Ring radius={2.7} tilt={[0.5, 0.9, 0.3]} color="#a855f7" opacity={0.45}>
            <Orbiter radius={2.7} speed={-0.45} offset={2} color="#c4b5fd" size={0.06} />
            <Orbiter radius={2.7} speed={-0.45} offset={4.5} color="#facc15" size={0.045} />
          </Ring>
          {!mobile && (
            <Ring radius={3.3} tilt={[1.0, -0.5, 0.8]} color="#f0abfc" opacity={0.25}>
              <Orbiter radius={3.3} speed={0.3} offset={1} color="#f0abfc" size={0.05} />
            </Ring>
          )}
        </group>
      </group>
    </>
  );
}

function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class SceneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Scene() {
  const [ready, setReady] = useState(false);
  const mobile = useMemo(() => window.matchMedia('(max-width: 767px)').matches, []);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const supported = useMemo(webglSupported, []);

  if (!supported) return null;

  return (
    <SceneBoundary>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Canvas
          dpr={[1, mobile ? 1.5 : 1.75]}
          camera={{ position: [0, 0, 7], fov: 45 }}
          gl={{ antialias: !mobile, alpha: true, powerPreference: 'high-performance' }}
          eventSource={document.documentElement}
          eventPrefix="client"
          onCreated={() => setReady(true)}
        >
          <ambientLight intensity={0.25} />
          <pointLight position={[4, 3, 4]} color="#a855f7" intensity={70} />
          <pointLight position={[-4, -2, 3]} color="#facc15" intensity={55} />

          {/* Entorno procedural: no descarga HDRIs externos */}
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={4} color="#a855f7" position={[-5, 3, -2]} scale={[9, 4, 1]} />
            <Lightformer form="rect" intensity={4} color="#facc15" position={[5, -2, -1]} scale={[9, 3, 1]} />
            <Lightformer form="ring" intensity={3} color="#f0abfc" position={[0, 4, 3]} scale={4} />
            <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 0, 6]} scale={[10, 2, 1]} />
          </Environment>

          <Rig mobile={mobile} reduced={reduced} />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
