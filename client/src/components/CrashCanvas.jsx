import { useEffect, useRef, useState } from 'react';
import './CrashCanvas.css';

const PLANE_IMG_SRC = '/aviator-plane.png';
const PLANE_W = 120;
const PLANE_H = 60;

function curvePoint(t, w, h, pad) {
  const startX = pad;
  const startY = h - pad;
  const endX = w - pad;
  const endY = pad + 20;

  const ctrlX = startX + (endX - startX) * 0.8;
  const ctrlY = startY;

  const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
  const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;
  
  const dx = 2 * (1 - t) * (ctrlX - startX) + 2 * t * (endX - ctrlX);
  const dy = 2 * (1 - t) * (ctrlY - startY) + 2 * t * (endY - ctrlY);
  const angle = Math.atan2(dy, dx);
  
  return { x, y, angle, startX, startY, endX, endY, ctrlX, ctrlY };
}

export default function CrashCanvas({ phase, multiplier, crashPoint, activeBets, user }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const planeImgRef = useRef(null);
  
  const [smoothMult, setSmoothMult] = useState(1);
  const actualMultRef = useRef(1);
  const renderMultRef = useRef(1);
  const lastTimeRef = useRef(Date.now());
  const crashAtRef = useRef(null);
  const particlesRef = useRef([]);
  const cloudsRef = useRef([]);

  // Initialize clouds
  useEffect(() => {
    cloudsRef.current = Array.from({ length: 8 }).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 300,
      speed: 0.5 + Math.random() * 1.5,
      size: 30 + Math.random() * 60,
      opacity: 0.05 + Math.random() * 0.05
    }));
  }, []);

  useEffect(() => {
    actualMultRef.current = multiplier || 1;
    if (phase === 'waiting' || phase === 'betting') {
      renderMultRef.current = 1;
      setSmoothMult(1);
      crashAtRef.current = null;
      particlesRef.current = [];
    } else if (phase === 'crashed' && !crashAtRef.current) {
      crashAtRef.current = Date.now();
    }
  }, [multiplier, phase]);

  useEffect(() => {
    const img = new Image();
    img.src = PLANE_IMG_SRC;
    img.onload = () => {
      planeImgRef.current = img;
    };
  }, []);

  const myBet = activeBets?.find(b => b.username === user?.username);
  const myCashoutMult = myBet?.status === 'cashed_out' ? myBet.cashoutMultiplier : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawFrame = () => {
      const now = Date.now();
      const dt = Math.min(now - lastTimeRef.current, 50);
      lastTimeRef.current = now;

      if (phase === 'flying') {
        const diff = actualMultRef.current - renderMultRef.current;
        renderMultRef.current += diff * (dt / 150);
        if (renderMultRef.current < 1) renderMultRef.current = 1;
        setSmoothMult(renderMultRef.current);
      } else if (phase === 'crashed') {
        renderMultRef.current = crashPoint || actualMultRef.current;
        setSmoothMult(renderMultRef.current);
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      
      if (w < 10 || h < 10) return;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, w, h);

      // Draw moving clouds/speed effects
      if (phase === 'flying') {
        ctx.fillStyle = '#ffffff';
        cloudsRef.current.forEach(cloud => {
          cloud.x -= cloud.speed * (1 + (renderMultRef.current * 0.1));
          if (cloud.x < -cloud.size) {
            cloud.x = w + cloud.size;
            cloud.y = Math.random() * h;
          }
          ctx.globalAlpha = cloud.opacity;
          ctx.beginPath();
          ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1.0;
      }

      // Grid lines
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < w; i += 50) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
      }
      for (let i = 0; i < h; i += 50) {
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
      }
      ctx.stroke();

      const pad = 30;
      let t = 0;
      if (phase === 'flying' || phase === 'crashed') {
        const m = Math.max(1, renderMultRef.current);
        t = Math.min(1, (Math.log(m) / Math.log(20)) * 0.95);
      }

      if (phase === 'crashed') {
        t = Math.min(1, (Math.log(Math.max(1, crashPoint || actualMultRef.current)) / Math.log(20)) * 0.95);
      }

      if (t > 0.01) {
        const pt = curvePoint(t, w, h, pad);
        const { startX, startY, ctrlX, ctrlY, x, y } = pt;

        // Sub-curve control points (De Casteljau's)
        const q1x = (1 - t) * startX + t * ctrlX;
        const q1y = (1 - t) * startY + t * ctrlY;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(q1x, q1y, x, y);
        ctx.lineTo(x, startY);
        ctx.closePath();
        
        const fillGrad = ctx.createLinearGradient(0, y, 0, startY);
        fillGrad.addColorStop(0, 'rgba(229, 5, 57, 0.4)');
        fillGrad.addColorStop(1, 'rgba(229, 5, 57, 0.0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(q1x, q1y, x, y);
        ctx.strokeStyle = '#e50539';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#e50539';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const showPlane = phase === 'flying' || phase === 'crashed' || phase === 'betting' || phase === 'waiting';
      
      if (showPlane) {
        let pt = curvePoint(t, w, h, pad);
        
        let crashOffsetY = 0;
        let crashOffsetX = 0;
        // Freeze plane on crash, no falling animation

        // Organic wobble (multiple sine waves for realistic turbulence)
        let wobbleAngle = 0;
        let hoverY = 0;
        if (phase === 'flying') {
          wobbleAngle = Math.sin(now / 150) * 0.03 + Math.cos(now / 400) * 0.02;
          hoverY = Math.sin(now / 200) * 3 + Math.cos(now / 350) * 2;
        } else if (phase === 'betting' || phase === 'waiting') {
          hoverY = Math.sin(now / 400) * 5;
        }

        const planeX = pt.x + crashOffsetX;
        const planeY = pt.y + crashOffsetY + hoverY;

        let finalAngle = pt.angle + wobbleAngle;

        // --- Particle System (Exhaust Flames/Smoke) ---
        if (phase === 'flying') {
          // Add new particles
          if (Math.random() > 0.3) {
            const tailX = planeX - Math.cos(finalAngle) * (PLANE_W * 0.4);
            const tailY = planeY - Math.sin(finalAngle) * (PLANE_W * 0.4);
            particlesRef.current.push({
              x: tailX,
              y: tailY + (Math.random() * 8 - 4),
              life: 1.0,
              maxLife: 0.5 + Math.random() * 0.5,
              size: 5 + Math.random() * 8,
              vx: -Math.cos(finalAngle) * (2 + Math.random() * 3) - 2, // move back
              vy: -Math.sin(finalAngle) * (2 + Math.random() * 3) + (Math.random() - 0.5),
            });
          }
        }

        // Update and draw particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          let p = particlesRef.current[i];
          p.life -= (dt / 500);
          if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.size *= 0.95; // shrink

          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          // Color goes from yellow -> orange -> red -> dark gray
          const lifePct = p.life / p.maxLife;
          if (lifePct > 0.7) ctx.fillStyle = '#facc15';
          else if (lifePct > 0.4) ctx.fillStyle = '#f97316';
          else if (lifePct > 0.2) ctx.fillStyle = '#ef4444';
          else ctx.fillStyle = '#333333';

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        ctx.save();
        ctx.translate(planeX, planeY);
        ctx.rotate(finalAngle);

        if (planeImgRef.current && planeImgRef.current.complete) {
          const img = planeImgRef.current;
          const scale = 0.5;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(img, -PLANE_W * scale, -PLANE_H * scale, PLANE_W * 2 * scale, PLANE_H * 2 * scale);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.fillStyle = '#e50539';
          ctx.beginPath();
          ctx.moveTo(20, 0);
          ctx.lineTo(-20, 10);
          ctx.lineTo(-20, -10);
          ctx.fill();
        }
        ctx.restore();

        // Draw floating multiplier exactly where the plane is ONLY when crashed OR user cashed out
        if (phase === 'crashed' || (phase === 'flying' && myCashoutMult)) {
          const isCrash = phase === 'crashed';
          const multVal = isCrash ? (crashPoint || 1).toFixed(2) : (myCashoutMult || 1).toFixed(2);
          
          ctx.fillStyle = isCrash ? '#e50539' : '#22c55e'; // match Aviator red or green
          ctx.font = '900 80px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 10;
          ctx.fillText(multVal + 'x', planeX, planeY - 40);
          
          ctx.shadowBlur = 0;
        }
      }
    };

    const loop = () => {
      drawFrame();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [phase, crashPoint]);

  const displayMult = phase === 'crashed' ? (crashPoint || 1).toFixed(2) : smoothMult.toFixed(2);

  return (
    <div className={`crash-canvas phase-${phase}`}>
      <canvas ref={canvasRef} className="crash-canvas-el" />
      <div className="crash-multiplier">
        <span className={phase === 'crashed' ? 'crashed' : phase === 'flying' ? 'flying' : 'idle'}>
          {displayMult}x
        </span>
      </div>
      <div className="crash-phase-label">
        {phase === 'betting' && 'Waiting for next round...'}
        {phase === 'flying' && ''}
        {phase === 'waiting' && 'Preparing next round...'}
      </div>
    </div>
  );
}
