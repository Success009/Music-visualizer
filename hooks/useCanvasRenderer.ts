

import { useEffect, useRef } from 'react';

export interface LogoConfig {
  size: number;
  x: number;
  y: number;
  bounce: number;
}

export interface BackgroundConfig {
  zoom: number;
  pulse: number;
}

export type ReflectionType = 'none' | 'two' | 'four' | 'eight';

export interface VisualizerConfig {
    color: string;
    rotation: number;
    reflection: ReflectionType;
    sensitivity: number;
    smoothing: number;
    barCount: number;
    barThickness: number;
    barMaxHeight: number;
    barDistance: number;
}

export interface ParticleConfig {
  enabled: boolean;
  count: number;
  color: string;
  blur: number;
  direction: 'top' | 'bottom' | 'left' | 'right';
  speed: number;
}

export interface TextConfig {
  mainText: string;
  mainColor: string;
  mainSize: number;
  mainFont: string;
  mainBold: boolean;
  mainItalic: boolean;
  mainLetterSpacing: number;
  mainYOffset: number;
  authorText: string;
  authorColor: string;
  authorSize: number;
  authorFont: string;
  authorBold: boolean;
  authorItalic: boolean;
  authorLetterSpacing: number;
  authorYOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RendererProps {
  audioData: Uint8Array | null;
  logoImage: HTMLImageElement | null;
  backgroundImage: HTMLImageElement | null;
  isPlaying: boolean;
  logoConfig: LogoConfig;
  backgroundConfig: BackgroundConfig;
  visualizerConfig: VisualizerConfig;
  particleConfig: ParticleConfig;
  textConfig: TextConfig;
}

// --- Helper Functions ---
const hexToRgba = (hex: string, alpha: number): string => {
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return `rgba(255, 255, 255, ${alpha})`; // Return white on invalid hex
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const num = parseInt(c.join(''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getAudioAverages = (audioData: Uint8Array | null) => {
    if (!audioData || audioData.length === 0) return { bass: 0, mids: 0, overall: 0 };
    
    const bassEnd = Math.floor(audioData.length * 0.1);
    const midsEnd = Math.floor(audioData.length * 0.4);
    
    let bass = 0;
    for (let i = 0; i < bassEnd; i++) bass += audioData[i];
    bass /= bassEnd;

    let mids = 0;
    for (let i = bassEnd; i < midsEnd; i++) mids += audioData[i];
    mids /= (midsEnd - bassEnd);
    
    let overall = 0;
    for(let i=0; i < audioData.length; i++) overall += audioData[i];
    overall /= audioData.length;

    return { 
        bass: isNaN(bass) ? 0 : bass,
        mids: isNaN(mids) ? 0 : mids,
        overall: isNaN(overall) ? 0 : overall
    };
};

const drawBackground = (ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, config: BackgroundConfig, pulse: number) => {
    const { width, height } = ctx.canvas;
    ctx.save();
    
    if (image) {
        const imgRatio = image.naturalWidth / image.naturalHeight;
        const canvasRatio = width / height;
        let sw, sh, sx, sy;

        if (imgRatio > canvasRatio) { // image wider than canvas
            sh = image.naturalHeight;
            sw = sh * canvasRatio;
            sx = (image.naturalWidth - sw) / 2;
            sy = 0;
        } else { // image taller than canvas
            sw = image.naturalWidth;
            sh = sw / canvasRatio;
            sx = 0;
            sy = (image.naturalHeight - sh) / 2;
        }
        
        const scale = config.zoom * pulse;
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);
        
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0f0c29');
        gradient.addColorStop(0.5, '#302b63');
        gradient.addColorStop(1, '#24243e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    ctx.restore();
};

export const initParticles = (particles: Particle[], config: ParticleConfig, width: number, height: number) => {
    particles.length = 0; // Clear existing particles
    for (let i = 0; i < config.count; i++) {
        let p: Particle;
        switch (config.direction) {
            case 'top': p = { x: Math.random() * width, y: Math.random() * height, vx: 0, vy: 1 + Math.random() }; break;
            case 'bottom': p = { x: Math.random() * width, y: Math.random() * height, vx: 0, vy: -1 - Math.random() }; break;
            case 'left': p = { x: Math.random() * width, y: Math.random() * height, vx: 1 + Math.random(), vy: 0 }; break;
            case 'right': p = { x: Math.random() * width, y: Math.random() * height, vx: -1 - Math.random(), vy: 0 }; break;
        }
        particles.push(p);
    }
};

export const updateParticles = (particles: Particle[], config: ParticleConfig, width: number, height: number, bassIntensity: number) => {
    const speedMultiplier = 1 + bassIntensity * 0.3; // Speed up with bass, up to 30%
    for (const p of particles) {
        p.x += p.vx * config.speed * speedMultiplier;
        p.y += p.vy * config.speed * speedMultiplier;

        switch (config.direction) {
            case 'top': if (p.y > height + 5) { p.y = -5; p.x = Math.random() * width; } break;
            case 'bottom': if (p.y < -5) { p.y = height + 5; p.x = Math.random() * width; } break;
            case 'left': if (p.x > width + 5) { p.x = -5; p.y = Math.random() * height; } break;
            case 'right': if (p.x < -5) { p.x = width + 5; p.y = Math.random() * height; } break;
        }
    }
};

const drawParticles = (ctx: CanvasRenderingContext2D, particles: Particle[], config: ParticleConfig) => {
    ctx.save();
    ctx.fillStyle = config.color;
    ctx.shadowColor = config.color;
    ctx.shadowBlur = config.blur;
    ctx.globalAlpha = 0.7;

    for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
};

const drawCircularVisualizer = (ctx: CanvasRenderingContext2D, audioData: Uint8Array, logoRect: {x: number, y: number, w: number, h: number}, config: VisualizerConfig) => {
    const barCount = Math.max(8, Math.min(128, config.barCount));
    const maxBarHeight = (logoRect.w * 0.5 + 20) * config.barMaxHeight;
    const barWidth = Math.max(1, logoRect.w * config.barThickness);
    
    const centerX = logoRect.x + logoRect.w / 2;
    const centerY = logoRect.y + logoRect.h / 2;
    const radius = Math.min(logoRect.w, logoRect.h) / 2 + 15 + (logoRect.w * config.barDistance);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(config.rotation * (Math.PI / 180));

    const gradient = ctx.createRadialGradient(0, 0, radius, 0, 0, radius + maxBarHeight);
    gradient.addColorStop(0, hexToRgba(config.color, 0.7));
    gradient.addColorStop(1, hexToRgba(config.color, 0.9));
    ctx.fillStyle = gradient;
    ctx.lineWidth = barWidth;
    ctx.strokeStyle = gradient;

    const drawBar = (height: number) => {
        if (height < 1) return;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(radius + height, 0);
        ctx.stroke();
    };

    if (config.reflection === 'eight') {
        const count = Math.floor(barCount / 8);
        const dataSlice = audioData.slice(0, count);
        for (let i = 0; i < count; i++) {
            const barHeight = (dataSlice[i] / 255) * maxBarHeight * config.sensitivity;
            const angle = (i / count) * (Math.PI / 4);

            ctx.save(); ctx.rotate(angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(-angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI / 2 - angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI / 2 + angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI - angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI + angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(3 * Math.PI / 2 - angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(3 * Math.PI / 2 + angle); drawBar(barHeight); ctx.restore();
        }
    } else if (config.reflection === 'four') {
        const count = Math.floor(barCount / 4);
        const dataSlice = audioData.slice(0, count);
        for (let i = 0; i < count; i++) {
            const barHeight = (dataSlice[i] / 255) * maxBarHeight * config.sensitivity;
            const angle = (i / count) * (Math.PI / 2);
            
            ctx.save(); ctx.rotate(angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(-angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI - angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(Math.PI + angle); drawBar(barHeight); ctx.restore();
        }
    } else if (config.reflection === 'two') {
        const count = Math.floor(barCount / 2);
        const dataSlice = audioData.slice(0, count);
        for (let i = 0; i < count; i++) {
            const barHeight = (dataSlice[i] / 255) * maxBarHeight * config.sensitivity;
            const angle = (i / count) * Math.PI;

            ctx.save(); ctx.rotate(angle); drawBar(barHeight); ctx.restore();
            ctx.save(); ctx.rotate(-angle); drawBar(barHeight); ctx.restore();
        }
    } else { // 'none'
        const dataSlice = audioData.slice(0, barCount);
        for (let i = 0; i < barCount; i++) {
            const barHeight = (dataSlice[i] / 255) * maxBarHeight * config.sensitivity;
            const angle = (i / barCount) * (Math.PI * 2);

            ctx.save(); ctx.rotate(angle); drawBar(barHeight); ctx.restore();
        }
    }

    ctx.restore();
};

const drawLogo = (ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, rect: {x: number, y: number, w: number, h: number}, bass: number) => {
    const { x, y, w, h } = rect;
    ctx.save();
    
    if (image) {
        ctx.shadowColor = 'rgba(124, 58, 237, 0.7)';
        ctx.shadowBlur = 30 * (bass / 255);
        ctx.drawImage(image, x, y, w, h);
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `bold ${Math.min(w,h) * 0.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Upload Logo', x + w/2, y + h/2);
    }
    ctx.restore();
};

const drawText = (ctx: CanvasRenderingContext2D, config: TextConfig) => {
    const { width, height } = ctx.canvas;
    const centerX = width / 2;

    if (config.mainText) {
        ctx.save();
        const mainFontSize = height * (config.mainSize / 100);
        const mainY = (height / 2) + config.mainYOffset;
        
        ctx.font = `${config.mainItalic ? 'italic ' : ''}${config.mainBold ? 'bold ' : ''}${mainFontSize}px "${config.mainFont}"`;
        ctx.fillStyle = config.mainColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) {
          (ctx as any).letterSpacing = `${config.mainLetterSpacing}px`;
        }
        ctx.fillText(config.mainText, centerX, mainY);
        ctx.restore();

        if (config.authorText) {
            ctx.save();
            const authorFontSize = height * (config.authorSize / 100);
            const authorY = mainY + (mainFontSize / 2) + config.authorYOffset + (authorFontSize / 2);

            ctx.font = `${config.authorItalic ? 'italic ' : ''}${config.authorBold ? 'bold ' : ''}${authorFontSize}px "${config.authorFont}"`;
            ctx.fillStyle = config.authorColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if ('letterSpacing' in ctx) {
              (ctx as any).letterSpacing = `${config.authorLetterSpacing}px`;
            }
            ctx.fillText(config.authorText, centerX, authorY);
            ctx.restore();
        }
    }
};

export const drawFrame = (ctx: CanvasRenderingContext2D, props: RendererProps, particles: Particle[]) => {
  const { audioData, logoImage, backgroundImage, logoConfig, backgroundConfig, visualizerConfig, particleConfig, textConfig } = props;
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  
  const { bass, mids } = getAudioAverages(audioData);
  
  const bgPulseAmount = 1 + (mids / 255) * 0.05 * backgroundConfig.pulse;
  drawBackground(ctx, backgroundImage, backgroundConfig, bgPulseAmount);

  if (particleConfig.enabled) {
      drawParticles(ctx, particles, particleConfig);
  }

  const logoBaseSize = Math.min(width, height) * 0.2 * logoConfig.size;
  const logoBounceAmount = 1 + (bass / 255) * 0.1 * logoConfig.bounce;

  const logoRect = {
      w: logoBaseSize,
      h: logoBaseSize,
      x: (width / 2) - (logoBaseSize / 2) + logoConfig.x,
      y: (height / 2) - (logoBaseSize / 2) + logoConfig.y
  };

  ctx.save();
  ctx.translate(logoRect.x + logoRect.w / 2, logoRect.y + logoRect.h / 2);
  ctx.scale(logoBounceAmount, logoBounceAmount);
  ctx.translate(-(logoRect.x + logoRect.w / 2), -(logoRect.y + logoRect.h / 2));
  
  if (audioData) {
    drawCircularVisualizer(ctx, audioData, logoRect, visualizerConfig);
  }
  
  drawLogo(ctx, logoImage, logoRect, bass);
  
  ctx.restore();
  
  drawText(ctx, textConfig);
};


// --- The Hook for live preview ---
export const useCanvasRenderer = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  props: RendererProps
) => {
  const animationFrameId = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const { particleConfig, audioData } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initParticles(particlesRef.current, particleConfig, canvas.width, canvas.height);
  }, [particleConfig.count, particleConfig.direction, canvasRef, particleConfig.enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (particleConfig.enabled) {
        const { bass } = getAudioAverages(audioData);
        const bassIntensity = bass / 255;
        updateParticles(particlesRef.current, particleConfig, canvas.width, canvas.height, bassIntensity);
      }
      drawFrame(ctx, props, particlesRef.current);
      animationFrameId.current = requestAnimationFrame(render);
    };
    
    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [props]);
};