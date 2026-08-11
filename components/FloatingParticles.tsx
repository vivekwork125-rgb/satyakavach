
import React, { useMemo } from 'react';

/* ──────────────────────────────────────────────────────────
   FLOATING PARTICLES + NEURAL NETWORK BACKGROUND
   - Ambient gradient orbs (no animation)
   - SVG faint grid overlay
   - SVG neural-network connection lines (randomly generated)
   - CSS-animated floating particles (existing)
   - CSS-animated energy streaks (new)
   All are pointer-events: none and very low opacity.
────────────────────────────────────────────────────────── */

interface Particle {
  id: number;
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
  driftX: number;
}

interface Node {
  x: number; // percentage
  y: number; // percentage
}

interface Edge {
  x1: number; y1: number;
  x2: number; y2: number;
  opacity: number;
}

interface Streak {
  id: number;
  x: number;       // start %, horizontal
  duration: number;
  delay: number;
  opacity: number;
  width: number;
}

const FloatingParticles: React.FC = () => {
  const particles = useMemo<Particle[]>(() => {
    const colors = [
      'rgba(0, 229, 255, 0.60)',
      'rgba(124, 58, 237, 0.50)',
      'rgba(99, 102, 241, 0.45)',
      'rgba(6, 182, 212, 0.45)',
      'rgba(139, 92, 246, 0.40)',
      'rgba(0, 229, 255, 0.30)',
      'rgba(255, 255, 255, 0.18)',
    ];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${60 + Math.random() * 40}%`,
      size: 1 + Math.random() * 3.5,
      duration: 22 + Math.random() * 20,
      delay: Math.random() * 18,
      opacity: 0.2 + Math.random() * 0.55,
      color: colors[Math.floor(Math.random() * colors.length)],
      driftX: (Math.random() - 0.5) * 70,
    }));
  }, []);

  // Neural network node positions (% coordinates)
  const nodes = useMemo<Node[]>(() => {
    return Array.from({ length: 18 }, () => ({
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
    }));
  }, []);

  // Edges: connect nearby nodes (distance < 35%)
  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 32) {
          result.push({
            x1: nodes[i].x, y1: nodes[i].y,
            x2: nodes[j].x, y2: nodes[j].y,
            // Closer = slightly more visible, max 0.07
            opacity: Math.max(0.02, 0.07 * (1 - dist / 32)),
          });
        }
      }
    }
    return result;
  }, [nodes]);

  // Vertical energy streaks
  const streaks = useMemo<Streak[]>(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 10 + i * 20 + (Math.random() - 0.5) * 8,
      duration: 6 + Math.random() * 6,
      delay: Math.random() * 8,
      opacity: 0.04 + Math.random() * 0.06,
      width: 1 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">

      {/* ── Deep radial gradient background layer ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 30% 20%, #0d1433 0%, #0B0F1A 40%, #020617 100%)',
        }}
      />

      {/* ── SVG layer: faint grid + neural connections ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 1 }}
      >
        <defs>
          {/* Subtle dot-pattern grid */}
          <pattern id="grid-dots" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="0.7" fill="rgba(99,102,241,0.18)" />
          </pattern>
          {/* Fade mask so grid is stronger in center */}
          <radialGradient id="grid-fade" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-fade)" />
          </mask>
        </defs>

        {/* Dot-grid */}
        <rect width="100%" height="100%" fill="url(#grid-dots)" mask="url(#grid-mask)" />

        {/* Neural connection lines */}
        {edges.map((e, i) => (
          <line
            key={i}
            x1={`${e.x1}%`} y1={`${e.y1}%`}
            x2={`${e.x2}%`} y2={`${e.y2}%`}
            stroke="rgba(99,102,241,1)"
            strokeWidth="0.5"
            strokeOpacity={e.opacity}
          />
        ))}

        {/* Neural node dots */}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={`${n.x}%`} cy={`${n.y}%`}
            r="1.4"
            fill="rgba(0,229,255,0.25)"
          />
        ))}
      </svg>

      {/* ── Ambient glow orbs ── */}
      <div className="absolute rounded-full blur-[200px]" style={{ width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(99,102,241,1) 0%, transparent 70%)', top: '0%', left: '5%', opacity: 0.07 }} />
      <div className="absolute rounded-full blur-[180px]" style={{ width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(0,229,255,1) 0%, transparent 70%)', bottom: '10%', right: '8%', opacity: 0.05 }} />
      <div className="absolute rounded-full blur-[220px]" style={{ width: '450px', height: '450px', background: 'radial-gradient(circle, rgba(124,58,237,1) 0%, transparent 70%)', top: '35%', left: '48%', transform: 'translateX(-50%)', opacity: 0.045 }} />

      {/* ── Energy streaks (vertical, CSS-animated) ── */}
      {streaks.map((s) => (
        <div
          key={s.id}
          className="streak"
          style={{
            left: `${s.x}%`,
            width: `${s.width}px`,
            opacity: s.opacity,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* ── Floating particles ── */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
            ['--drift-x' as string]: `${p.driftX}px`,
          }}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
