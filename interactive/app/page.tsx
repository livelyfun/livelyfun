'use client';

import { useEffect, useRef } from 'react';

const skills = ['Next.js', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AI / RAG'];

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let pointer = { x: 0.5, y: 0.5, active: false };
    const nodes = Array.from({ length: 105 }, (_, i) => ({
      seed: i * 17.731,
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      speed: 0.00015 + Math.random() * 0.00045,
      size: 0.6 + Math.random() * 1.8,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX / width, y: e.clientY / height, active: true };
    };
    const onLeave = () => { pointer.active = false; };

    const draw = (time: number) => {
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, width, height);

      const glowX = pointer.active ? pointer.x * width : width * 0.52;
      const glowY = pointer.active ? pointer.y * height : height * 0.42;
      const gradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.65);
      gradient.addColorStop(0, 'rgba(88, 166, 255, .16)');
      gradient.addColorStop(.42, 'rgba(88, 166, 255, .045)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const projected = nodes.map((n) => {
        n.z = (n.z + n.speed) % 1;
        const driftX = Math.sin(time * 0.00025 + n.seed) * 0.018;
        const driftY = Math.cos(time * 0.0002 + n.seed * 0.7) * 0.014;
        const px = (n.x + driftX - 0.5) * width;
        const py = (n.y + driftY - 0.5) * height;
        const depth = 0.25 + n.z * 1.15;
        const tiltX = ((pointer.x - 0.5) * 85) * n.z;
        const tiltY = ((pointer.y - 0.5) * 55) * n.z;
        return {
          x: width / 2 + px * depth + tiltX,
          y: height / 2 + py * depth + tiltY,
          r: n.size * (.45 + n.z * 1.25),
          z: n.z
        };
      });

      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 92 && Math.abs(a.z - b.z) < 0.22) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(92, 170, 255, ' + (0.13 * (1 - dist / 92)) + ')';
            ctx.lineWidth = 0.55;
            ctx.stroke();
          }
        }
      }

      projected.forEach((p) => {
        const dx = p.x - glowX;
        const dy = p.y - glowY;
        const dist = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - dist / 190);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + influence * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(150, 205, 255, ' + (0.28 + influence * 0.48) + ')';
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(glowX, glowY, 5 + Math.sin(time * 0.004) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170, 220, 255, .8)';
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <main className="shell">
      <canvas ref={canvasRef} className="space" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> LIVE · POINTER REACTIVE</div>
        <p className="kicker">SOFTWARE DEVELOPMENT · AI ENGINEERING · RAG SYSTEMS</p>
        <h1>Mithlesh <span>Das</span></h1>
        <p className="intro">I build products where polished interfaces meet reliable backend systems and practical AI.</p>
        <div className="skills">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        <div className="actions">
          <a href="https://github.com/livelyfun" target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href="https://mithesh.netlify.app/" target="_blank" rel="noreferrer">Portfolio ↗</a>
          <a href="https://www.linkedin.com/in/mithlesh-das-876973343/" target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
        <div className="hint">Move your pointer through the field</div>
      </section>
    </main>
  );
}
