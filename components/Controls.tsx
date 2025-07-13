

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { RecordIcon } from './icons/RecordIcon';
import { LogoConfig, BackgroundConfig, VisualizerConfig, ReflectionType, ParticleConfig, TextConfig } from '../hooks/useCanvasRenderer';

type AspectRatio = '16:9' | '9:16';

interface ControlsProps {
  onLogoUpload: (file: File) => void;
  onBackgroundUpload: (file: File) => void;
  onAudioUpload: (file: File) => void;
  isPlaying: boolean;
  isRendering: boolean;
  togglePlayPause: () => void;
  onRenderVideo: () => void;
  hasAudio: boolean;
  logoConfig: LogoConfig;
  onLogoConfigChange: React.Dispatch<React.SetStateAction<LogoConfig>>;
  backgroundConfig: BackgroundConfig;
  onBackgroundConfigChange: React.Dispatch<React.SetStateAction<BackgroundConfig>>;
  visualizerConfig: VisualizerConfig;
  onVisualizerConfigChange: React.Dispatch<React.SetStateAction<VisualizerConfig>>;
  particleConfig: ParticleConfig;
  onParticleConfigChange: React.Dispatch<React.SetStateAction<ParticleConfig>>;
  textConfig: TextConfig;
  onTextConfigChange: React.Dispatch<React.SetStateAction<TextConfig>>;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  renderSpeed: number;
  onRenderSpeedChange: (speed: number) => void;
  projectName: string;
  onProjectNameChange: React.Dispatch<React.SetStateAction<string>>;
}

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const floorSeconds = Math.floor(seconds);
    const m = Math.floor(floorSeconds / 60);
    const s = floorSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const Slider: React.FC<{label: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min: number, max: number, step: number}> = 
  ({ label, value, onChange, min, max, step }) => (
    <div className="w-full">
        <label className="text-xs text-gray-400">{label}: {label === 'Bar Count' ? value : label === 'Bar Thickness' ? Number(value).toFixed(3) : Number(value).toFixed(2)}</label>
        <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-violet-500" />
    </div>
);

const CollapsibleSection: React.FC<{ title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, isOpen, onToggle, children }) => (
    <div className="border-t border-gray-700">
        <button
            onClick={onToggle}
            className="w-full flex justify-between items-center p-3 text-left focus:outline-none"
            aria-expanded={isOpen}
        >
            <h3 className="text-base font-semibold text-violet-300">{title}</h3>
            <span className="text-violet-300 transform transition-transform text-lg">{isOpen ? '▼' : '►'}</span>
        </button>
        {isOpen && <div className="px-3 pb-4 space-y-4">{children}</div>}
    </div>
);


export const Controls: React.FC<ControlsProps> = (props) => {
  const {
    onLogoUpload, onBackgroundUpload, onAudioUpload,
    isPlaying, isRendering, togglePlayPause, onRenderVideo, hasAudio,
    logoConfig, onLogoConfigChange,
    backgroundConfig, onBackgroundConfigChange,
    visualizerConfig, onVisualizerConfigChange,
    particleConfig, onParticleConfigChange,
    textConfig, onTextConfigChange,
    aspectRatio, onAspectRatioChange,
    currentTime, duration, onSeek,
    renderSpeed, onRenderSpeedChange,
    projectName, onProjectNameChange
  } = props;
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [openSections, setOpenSections] = useState({
      format: true,
      uploads: true,
      playback: true,
      render: true,
      text: true,
      logo: false,
      background: false,
      visualizer: false,
      particles: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
      setOpenSections(s => ({ ...s, [section]: !s[section] }));
  };

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    // This effect runs after DOM mutations but before the browser paints.
    // This is the ideal time to read layout properties like offsetWidth and then set state.
    if (panelRef.current) {
        const panelWidth = panelRef.current.offsetWidth;
        // Fallback to a default width if the measurement fails for some reason on first render
        const effectivePanelWidth = panelWidth > 0 ? panelWidth : 320;
        
        const initialX = window.innerWidth - effectivePanelWidth - 16;
        const initialY = 16;

        setPosition({
          // Position 16px from the right edge, but don't let it go off-screen on the left
          x: Math.max(16, initialX),
          y: initialY,
        });
        
        // Now that the position is calculated, make the panel visible.
        setIsVisible(true);
    }
  }, []); // Run only once on mount


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Do not start dragging if a button inside the drag handle is clicked.
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsDragging(true);
    dragStartOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      let newX = e.clientX - dragStartOffset.current.x;
      let newY = e.clientY - dragStartOffset.current.y;
      
      const panelWidth = panelRef.current?.offsetWidth ?? 320;
      const panelHeight = panelRef.current?.offsetHeight ?? (isMinimized ? 50 : 600);
      
      newX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - panelHeight));

      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, isMinimized]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    handler: (file: File) => void
  ) => {
    if (e.target.files && e.target.files[0]) {
      handler(e.target.files[0]);
    }
     e.target.value = '';
  };
  
  const buttonBaseClasses = "w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900";
  const primaryButtonClasses = "text-white bg-violet-600 hover:bg-violet-700 focus:ring-violet-500";
  const secondaryButtonClasses = "text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-gray-500";
  const disabledButtonClasses = "bg-gray-500 text-gray-400 cursor-not-allowed";
  const renderingButtonClasses = "text-white bg-red-600 focus:ring-red-500 animate-pulse cursor-not-allowed";
  const activeClass = "bg-violet-600 text-white";
  const inactiveClass = "bg-gray-700 hover:bg-gray-600 text-gray-300";
  
  const reflectionOptions: { id: ReflectionType; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'two', label: 'Two-Way' },
    { id: 'four', label: 'Four-Way' },
    { id: 'eight', label: 'Eight-Way' },
  ];
  
  const renderSpeedOptions = [
    { id: 1, label: 'Normal' },
    { id: 2, label: 'High' },
    { id: 4, label: 'Ultra' },
  ];
  
  const particleDirectionOptions: { id: ParticleConfig['direction']; label: string }[] = [
      { id: 'top', label: 'Down' },
      { id: 'bottom', label: 'Up' },
      { id: 'left', label: 'Right' },
      { id: 'right', label: 'Left' },
  ];

  const fontOptions = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Helvetica', 'Impact', 'Trebuchet MS'];

  return (
    <div 
        ref={panelRef}
        className="absolute z-20 bg-gray-900 bg-opacity-70 backdrop-blur-md rounded-xl shadow-lg border border-gray-700 w-80"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          visibility: isVisible ? 'visible' : 'hidden'
        }}
    >
        <div 
            className="p-3 cursor-move flex justify-between items-center"
            onMouseDown={handleMouseDown}
        >
            <h2 className="text-lg font-bold text-violet-300">Control | Success's Visualizer</h2>
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 rounded-full text-violet-300 hover:bg-gray-700 text-xl font-mono leading-none">
              {isMinimized ? '►' : '▼'}
            </button>
        </div>

        {!isMinimized && (
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="px-3 pb-3 space-y-4">
                  <CollapsibleSection title="Format" isOpen={openSections.format} onToggle={() => toggleSection('format')}>
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => onAspectRatioChange('16:9')} disabled={isRendering} className={`${buttonBaseClasses} ${aspectRatio === '16:9' ? activeClass : inactiveClass} ${isRendering ? disabledButtonClasses : ''}`}>16:9</button>
                          <button onClick={() => onAspectRatioChange('9:16')} disabled={isRendering} className={`${buttonBaseClasses} ${aspectRatio === '9:16' ? activeClass : inactiveClass} ${isRendering ? disabledButtonClasses : ''}`}>9:16</button>
                      </div>
                  </CollapsibleSection>
                  
                  <CollapsibleSection title="Uploads" isOpen={openSections.uploads} onToggle={() => toggleSection('uploads')}>
                      <div className="space-y-2">
                          <input type="file" accept="audio/*" ref={audioInputRef} onChange={(e) => handleFileChange(e, onAudioUpload)} className="hidden" />
                          <button onClick={() => audioInputRef.current?.click()} className={`${buttonBaseClasses} ${secondaryButtonClasses}`} disabled={isRendering}><UploadIcon /> <span className="ml-2">Upload Audio</span></button>

                          <input type="file" accept="image/*" ref={logoInputRef} onChange={(e) => handleFileChange(e, onLogoUpload)} className="hidden" />
                          <button onClick={() => logoInputRef.current?.click()} className={`${buttonBaseClasses} ${secondaryButtonClasses}`} disabled={isRendering}><UploadIcon /> <span className="ml-2">Upload Logo</span></button>

                          <input type="file" accept="image/*" ref={backgroundInputRef} onChange={(e) => handleFileChange(e, onBackgroundUpload)} className="hidden" />
                          <button onClick={() => backgroundInputRef.current?.click()} className={`${buttonBaseClasses} ${secondaryButtonClasses}`} disabled={isRendering}><UploadIcon /> <span className="ml-2">Upload Background</span></button>
                      </div>
                  </CollapsibleSection>
                  
                  <CollapsibleSection title="Playback" isOpen={openSections.playback} onToggle={() => toggleSection('playback')}>
                      <div className="flex items-center space-x-2">
                          <button onClick={togglePlayPause} disabled={!hasAudio || isRendering} className={`p-2 rounded-full transition-colors ${!hasAudio || isRendering ? 'text-gray-500 bg-gray-700 cursor-not-allowed' : 'text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-violet-500'}`}>
                              {isPlaying ? <PauseIcon /> : <PlayIcon />}
                          </button>
                          <span className="text-xs text-gray-400 w-10 text-center" aria-label="Current time">{formatTime(currentTime)}</span>
                          <input type="range" min={0} max={duration} step={0.1} value={currentTime} onChange={(e) => onSeek(+e.target.value)} disabled={!hasAudio || isRendering} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-violet-500 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Seek bar" />
                          <span className="text-xs text-gray-400 w-10 text-center" aria-label="Total duration">{formatTime(duration)}</span>
                      </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Render" isOpen={openSections.render} onToggle={() => toggleSection('render')}>
                      <div>
                          <label htmlFor="projectName" className="text-xs text-gray-400 mb-1 block">Project Name</label>
                          <input
                              type="text"
                              id="projectName"
                              value={projectName}
                              onChange={(e) => onProjectNameChange(e.target.value)}
                              className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-violet-500 focus:border-violet-500 border-transparent transition"
                              placeholder="My Project"
                              disabled={isRendering}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">Render Quality</label>
                          <div className="grid grid-cols-3 gap-1">
                              {renderSpeedOptions.map(opt => (
                                  <button key={opt.id} onClick={() => onRenderSpeedChange(opt.id)} disabled={isRendering} className={`${buttonBaseClasses} py-1 text-xs ${renderSpeed === opt.id ? activeClass : inactiveClass} ${isRendering ? disabledButtonClasses : ''}`}>
                                      {opt.label}
                                  </button>
                              ))}
                          </div>
                      </div>
                       <button onClick={onRenderVideo} disabled={!hasAudio || isRendering} className={`${buttonBaseClasses} w-full ${!hasAudio ? disabledButtonClasses : isRendering ? renderingButtonClasses : primaryButtonClasses}`}>
                          <RecordIcon /> <span className="ml-2">{isRendering ? 'Rendering...' : 'Render Video'}</span>
                      </button>
                  </CollapsibleSection>

                  <CollapsibleSection title="Text Settings" isOpen={openSections.text} onToggle={() => toggleSection('text')}>
                      <div className="space-y-4">
                          <div>
                              <h4 className="text-sm font-semibold text-violet-400 mb-2">Main Text</h4>
                              <div className="space-y-3">
                                  <input type="text" placeholder="Main Text" value={textConfig.mainText} onChange={(e) => onTextConfigChange(c => ({...c, mainText: e.target.value}))} className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-violet-500 focus:border-violet-500 border-transparent transition" />
                                  <select value={textConfig.mainFont} onChange={(e) => onTextConfigChange(c => ({...c, mainFont: e.target.value}))} className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-violet-500 focus:border-violet-500 border-transparent transition appearance-none">
                                      {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                  <div className="flex items-center justify-between">
                                      <label className="text-xs text-gray-400">Color</label>
                                      <input type="color" value={textConfig.mainColor} onChange={(e) => onTextConfigChange(c => ({...c, mainColor: e.target.value}))} className="w-10 h-6 p-0 border-none rounded cursor-pointer bg-transparent" style={{backgroundColor: 'transparent'}} />
                                  </div>
                                  <Slider label="Size" min={1} max={15} step={0.1} value={textConfig.mainSize} onChange={(e) => onTextConfigChange(c => ({...c, mainSize: +e.target.value}))} />
                                  <Slider label="Letter Spacing" min={-5} max={20} step={0.5} value={textConfig.mainLetterSpacing} onChange={(e) => onTextConfigChange(c => ({...c, mainLetterSpacing: +e.target.value}))} />
                                  <Slider label="Vertical Offset" min={-300} max={300} step={1} value={textConfig.mainYOffset} onChange={(e) => onTextConfigChange(c => ({...c, mainYOffset: +e.target.value}))} />
                                  <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => onTextConfigChange(c => ({...c, mainBold: !c.mainBold}))} className={`${buttonBaseClasses} py-1 text-xs ${textConfig.mainBold ? activeClass : inactiveClass}`}>Bold</button>
                                      <button onClick={() => onTextConfigChange(c => ({...c, mainItalic: !c.mainItalic}))} className={`${buttonBaseClasses} py-1 text-xs ${textConfig.mainItalic ? activeClass : inactiveClass}`}>Italic</button>
                                  </div>
                              </div>
                          </div>

                          <div>
                              <h4 className="text-sm font-semibold text-violet-400 mb-2 mt-4">Author Text</h4>
                              <div className="space-y-3">
                                  <input type="text" placeholder="Author Text" value={textConfig.authorText} onChange={(e) => onTextConfigChange(c => ({...c, authorText: e.target.value}))} className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-violet-500 focus:border-violet-500 border-transparent transition" />
                                  <select value={textConfig.authorFont} onChange={(e) => onTextConfigChange(c => ({...c, authorFont: e.target.value}))} className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-violet-500 focus:border-violet-500 border-transparent transition appearance-none">
                                      {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                  <div className="flex items-center justify-between">
                                      <label className="text-xs text-gray-400">Color</label>
                                      <input type="color" value={textConfig.authorColor} onChange={(e) => onTextConfigChange(c => ({...c, authorColor: e.target.value}))} className="w-10 h-6 p-0 border-none rounded cursor-pointer bg-transparent" style={{backgroundColor: 'transparent'}} />
                                  </div>
                                  <Slider label="Size" min={0.5} max={10} step={0.1} value={textConfig.authorSize} onChange={(e) => onTextConfigChange(c => ({...c, authorSize: +e.target.value}))} />
                                  <Slider label="Letter Spacing" min={-5} max={20} step={0.5} value={textConfig.authorLetterSpacing} onChange={(e) => onTextConfigChange(c => ({...c, authorLetterSpacing: +e.target.value}))} />
                                  <Slider label="Vertical Gap" min={0} max={100} step={1} value={textConfig.authorYOffset} onChange={(e) => onTextConfigChange(c => ({...c, authorYOffset: +e.target.value}))} />
                                  <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => onTextConfigChange(c => ({...c, authorBold: !c.authorBold}))} className={`${buttonBaseClasses} py-1 text-xs ${textConfig.authorBold ? activeClass : inactiveClass}`}>Bold</button>
                                      <button onClick={() => onTextConfigChange(c => ({...c, authorItalic: !c.authorItalic}))} className={`${buttonBaseClasses} py-1 text-xs ${textConfig.authorItalic ? activeClass : inactiveClass}`}>Italic</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Particle Settings" isOpen={openSections.particles} onToggle={() => toggleSection('particles')}>
                      <div className="flex items-center justify-between">
                          <label htmlFor="particleToggle" className="text-xs text-gray-400">Enable Particles</label>
                          <label htmlFor="particleToggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="particleToggle" className="sr-only peer" checked={particleConfig.enabled} onChange={(e) => onParticleConfigChange(c => ({...c, enabled: e.target.checked}))} />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                          </label>
                      </div>
                      <div className="flex items-center justify-between py-1">
                          <label className="text-xs text-gray-400">Color</label>
                          <input type="color" value={particleConfig.color} onChange={(e) => onParticleConfigChange(c => ({...c, color: e.target.value}))} className="w-10 h-6 p-0 border-none rounded cursor-pointer bg-transparent" style={{backgroundColor: 'transparent'}} />
                      </div>
                      <Slider label="Count" min={0} max={500} step={10} value={particleConfig.count} onChange={(e) => onParticleConfigChange(c => ({...c, count: +e.target.value}))} />
                      <Slider label="Speed" min={0.1} max={5} step={0.1} value={particleConfig.speed} onChange={(e) => onParticleConfigChange(c => ({...c, speed: +e.target.value}))} />
                      <Slider label="Blur" min={0} max={30} step={1} value={particleConfig.blur} onChange={(e) => onParticleConfigChange(c => ({...c, blur: +e.target.value}))} />
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">Direction</label>
                          <div className="grid grid-cols-2 gap-2">
                              {particleDirectionOptions.map(opt => (
                                  <button key={opt.id} onClick={() => onParticleConfigChange(c => ({...c, direction: opt.id}))} disabled={isRendering} className={`${buttonBaseClasses} py-1 text-xs ${particleConfig.direction === opt.id ? activeClass : inactiveClass} ${isRendering ? disabledButtonClasses : ''}`}>
                                      {opt.label}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Logo Settings" isOpen={openSections.logo} onToggle={() => toggleSection('logo')}>
                      <Slider label="Size" min={0.1} max={3} step={0.05} value={logoConfig.size} onChange={(e) => onLogoConfigChange(c => ({...c, size: +e.target.value}))} />
                      <Slider label="X Position" min={-200} max={200} step={2} value={logoConfig.x} onChange={(e) => onLogoConfigChange(c => ({...c, x: +e.target.value}))} />
                      <Slider label="Y Position" min={-200} max={200} step={2} value={logoConfig.y} onChange={(e) => onLogoConfigChange(c => ({...c, y: +e.target.value}))} />
                      <Slider label="Bounce" min={0} max={3} step={0.1} value={logoConfig.bounce} onChange={(e) => onLogoConfigChange(c => ({...c, bounce: +e.target.value}))} />
                  </CollapsibleSection>

                  <CollapsibleSection title="Background Settings" isOpen={openSections.background} onToggle={() => toggleSection('background')}>
                      <Slider label="Zoom" min={0.5} max={4} step={0.1} value={backgroundConfig.zoom} onChange={(e) => onBackgroundConfigChange(c => ({...c, zoom: +e.target.value}))} />
                      <Slider label="Pulse" min={0} max={2} step={0.05} value={backgroundConfig.pulse} onChange={(e) => onBackgroundConfigChange(c => ({...c, pulse: +e.target.value}))} />
                  </CollapsibleSection>
                  
                  <CollapsibleSection title="Visualizer Settings" isOpen={openSections.visualizer} onToggle={() => toggleSection('visualizer')}>
                      <div className="flex items-center justify-between py-1">
                          <label className="text-xs text-gray-400">Color</label>
                          <input type="color" value={visualizerConfig.color} onChange={(e) => onVisualizerConfigChange(c => ({...c, color: e.target.value}))} className="w-10 h-6 p-0 border-none rounded cursor-pointer bg-transparent" style={{backgroundColor: 'transparent'}} />
                      </div>
                      <Slider label="Bar Count" min={8} max={128} step={4} value={visualizerConfig.barCount} onChange={(e) => onVisualizerConfigChange(c => ({...c, barCount: +e.target.value}))} />
                      <Slider label="Bar Thickness" min={0.005} max={0.05} step={0.001} value={visualizerConfig.barThickness} onChange={(e) => onVisualizerConfigChange(c => ({...c, barThickness: +e.target.value}))} />
                      <Slider label="Max Bar Height" min={0.1} max={3} step={0.1} value={visualizerConfig.barMaxHeight} onChange={(e) => onVisualizerConfigChange(c => ({...c, barMaxHeight: +e.target.value}))} />
                      <Slider label="Bar Distance" min={0} max={0.5} step={0.01} value={visualizerConfig.barDistance} onChange={(e) => onVisualizerConfigChange(c => ({...c, barDistance: +e.target.value}))} />
                      <Slider label="Rotation" min={0} max={360} step={1} value={visualizerConfig.rotation} onChange={(e) => onVisualizerConfigChange(c => ({...c, rotation: +e.target.value}))} />
                      <Slider label="Sensitivity" min={0.1} max={3} step={0.05} value={visualizerConfig.sensitivity} onChange={(e) => onVisualizerConfigChange(c => ({...c, sensitivity: +e.target.value}))} />
                      <Slider label="Smoothness" min={0} max={0.99} step={0.01} value={visualizerConfig.smoothing} onChange={(e) => onVisualizerConfigChange(c => ({...c, smoothing: +e.target.value}))} />
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">Reflection</label>
                          <div className="grid grid-cols-2 gap-2">
                              {reflectionOptions.map(opt => (
                                  <button key={opt.id} onClick={() => onVisualizerConfigChange(c => ({...c, reflection: opt.id}))} disabled={isRendering} className={`${buttonBaseClasses} py-1 text-xs ${visualizerConfig.reflection === opt.id ? activeClass : inactiveClass} ${isRendering ? disabledButtonClasses : ''}`}>
                                      {opt.label}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </CollapsibleSection>
                </div>
            </div>
        )}
    </div>
  );
};