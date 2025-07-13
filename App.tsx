

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useCanvasRenderer, LogoConfig, BackgroundConfig, VisualizerConfig, ParticleConfig, TextConfig, drawFrame, initParticles, updateParticles, Particle, getAudioAverages } from './hooks/useCanvasRenderer';
import { Controls } from './components/Controls';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// Declarations for WebCodecs API types to prevent TypeScript errors
// in environments where these are not globally defined.
declare var VideoEncoder: any;
declare var VideoFrame: any;
declare var AudioEncoder: any;
declare var AudioData: any;
declare var OfflineAudioContext: any;


type AspectRatio = '16:9' | '9:16';

const CANVAS_DIMENSIONS: Record<AspectRatio, { width: number, height: number }> = {
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
};

export default function App() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderMessage, setRenderMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [projectName, setProjectName] = useState('My Project');

  const [logoConfig, setLogoConfig] = useState<LogoConfig>({ size: 1.0, x: 0, y: 0, bounce: 1.0 });
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({ zoom: 1.0, pulse: 0.5 });
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig>({ 
    color: '#A78BFA', 
    rotation: 0, 
    reflection: 'four', 
    sensitivity: 0.90, 
    smoothing: 0.71,
    barCount: 100,
    barThickness: 0.021,
    barMaxHeight: 1.0,
    barDistance: 0.08,
  });
  const [particleConfig, setParticleConfig] = useState<ParticleConfig>({
      enabled: true,
      count: 150,
      color: '#FFFFFF',
      blur: 10,
      direction: 'top',
      speed: 0.5,
  });
  const [textConfig, setTextConfig] = useState<TextConfig>({
    mainText: 'wonderful music',
    mainColor: '#FFFFFF',
    mainSize: 5, // 5% of canvas height
    mainFont: 'Arial',
    mainBold: true,
    mainItalic: false,
    mainLetterSpacing: 1,
    mainYOffset: 150, // pixels from center

    authorText: 'by Sound Fold Studio',
    authorColor: '#DDDDDD',
    authorSize: 2.5, // 2.5% of canvas height
    authorFont: 'Arial',
    authorBold: false,
    authorItalic: true,
    authorLetterSpacing: 1,
    authorYOffset: 10, // pixels, gap
  });
  const [renderSpeed, setRenderSpeed] = useState<number>(2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const isRenderingRef = useRef(isRendering);
  isRenderingRef.current = isRendering;

  const [audioData] = useAudioAnalyzer(analyserRef.current, isPlaying);

  useCanvasRenderer(canvasRef, {
    audioData,
    logoImage,
    backgroundImage,
    isPlaying,
    logoConfig,
    backgroundConfig,
    visualizerConfig,
    particleConfig,
    textConfig,
  });

  // Load default logo on mount
  useEffect(() => {
    const defaultLogoUrl = 'https://raw.githubusercontent.com/Success009/portfolio/refs/heads/main/logo.png';
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Important for fetching from a URL
    img.onload = () => setLogoImage(img);
    img.onerror = () => console.error("Failed to load default logo.");
    img.src = defaultLogoUrl;
  }, []);

  // This effect handles dynamic updates to the smoothing property on the analyser
  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = visualizerConfig.smoothing;
    }
  }, [visualizerConfig.smoothing]);

  useEffect(() => {
    if (logoFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => setLogoImage(img);
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(logoFile);
    }
  }, [logoFile]);
  
  useEffect(() => {
    if (backgroundFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => setBackgroundImage(img);
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(backgroundFile);
    }
  }, [backgroundFile]);

  // This effect sets up and tears down the entire audio graph.
  // It should ONLY run when a new audio file is provided.
  useEffect(() => {
    const audioEl = audioRef.current;
    
    // If no audio file or element, we don't need to do anything.
    if (!audioFile || !audioEl) {
        return;
    }

    let context: AudioContext;
    let source: MediaElementAudioSourceNode;
    let newUrl: string;

    try {
        context = new (window.AudioContext || (window as any).webkitAudioContext)();
        source = context.createMediaElementSource(audioEl);
        const analyser = context.createAnalyser();

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = visualizerConfig.smoothing; // Set initial value
        
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;

        newUrl = URL.createObjectURL(audioFile);
        setAudioSrc(newUrl);

    } catch (err: any) {
        console.error("Failed to create audio graph:", err);
        setError(`Error setting up audio: ${err.message}. Please try reloading.`);
        return; // Abort if setup fails
    }

    return () => {
        source?.disconnect();
        context?.close().catch(console.error);
        if (newUrl) {
            URL.revokeObjectURL(newUrl);
        }
        audioContextRef.current = null;
        sourceNodeRef.current = null;
        analyserRef.current = null;
    };
  }, [audioFile]);


  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !audioFile) {
        setError("Please upload an audio file first.");
        return;
    }
    if (isPlaying) {
        audioRef.current.pause();
    } else {
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audioFile]);

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };


  const handleRenderVideo = async () => {
    if (!canvasRef.current || !audioRef.current || !audioFile) {
        setError("Please upload audio and any images before rendering.");
        return;
    }
    const liveAnalyser = analyserRef.current;
    if (!liveAnalyser) {
        setError("Audio analyser not ready. Please try reloading.");
        return;
    }
    if (isRendering) return;
    
    setIsPlaying(false);
    await new Promise(resolve => setTimeout(resolve, 100)); 
    setIsRendering(true);
    setRenderProgress(0);
    setRenderMessage("Initializing render...");
    setError(null);

    const canvas = canvasRef.current;
    const audioForDuration = audioRef.current;
    const globalAudioContext = new AudioContext();

    try {
        const frameRate = 30;
        const audioDuration = audioForDuration.duration;
        const totalFrames = Math.floor(audioDuration * frameRate);

        const audioBuffer = await globalAudioContext.decodeAudioData(await audioFile.arrayBuffer());

        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: canvas.width,
                height: canvas.height,
                frameRate: frameRate,
            },
            audio: {
                codec: 'aac',
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
            },
            fastStart: 'fragmented'
        });

        const videoEncoder = new VideoEncoder({
            output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
            error: (e: any) => { throw e; }
        });
        videoEncoder.configure({ codec: 'avc1.42001f', width: canvas.width, height: canvas.height, framerate: frameRate });

        const audioEncoder = new AudioEncoder({
            output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
            error: (e: any) => { throw e; }
        });
        audioEncoder.configure({ codec: 'mp4a.40.2', numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate });
        
        setRenderMessage("Encoding audio...");
        const audioDataForEncoder = new AudioData({
            format: 'f32-planar',
            sampleRate: audioBuffer.sampleRate,
            numberOfFrames: audioBuffer.length,
            numberOfChannels: audioBuffer.numberOfChannels,
            timestamp: 0,
            data: (() => {
                const combined = new Float32Array(audioBuffer.length * audioBuffer.numberOfChannels);
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    combined.set(audioBuffer.getChannelData(i), i * audioBuffer.length);
                }
                return combined;
            })()
        });
        audioEncoder.encode(audioDataForEncoder);
        await audioEncoder.flush();

        audioForDuration.pause();
        audioForDuration.currentTime = 0;
        
        const fftSize = liveAnalyser.fftSize;
        const frequencyBinCount = liveAnalyser.frequencyBinCount;
        const analysisWindowLength = 1024;
        const rawDataArray = new Uint8Array(frequencyBinCount);
        const smoothedDataArray = new Uint8Array(frequencyBinCount).fill(0);
        const smoothingFactor = visualizerConfig.smoothing;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        const particles: Particle[] = [];
        if (particleConfig.enabled) {
          initParticles(particles, particleConfig, canvas.width, canvas.height);
        }
        
        setRenderMessage("Rendering video frames...");
        for (let i = 0; i <= totalFrames; i++) {
             if (!isRenderingRef.current) {
                console.log("Rendering cancelled by user.");
                throw new Error("Render cancelled");
            }

            const time = i / frameRate;

            const offlineAudioCtx = new OfflineAudioContext(1, analysisWindowLength, audioBuffer.sampleRate);
            const offlineAnalyser = offlineAudioCtx.createAnalyser();
            offlineAnalyser.fftSize = fftSize;
            offlineAnalyser.smoothingTimeConstant = 0;
            
            const offlineSource = offlineAudioCtx.createBufferSource();
            offlineSource.buffer = audioBuffer;
            offlineSource.connect(offlineAnalyser);
            offlineSource.start(0, time);
            await offlineAudioCtx.startRendering();
            offlineAnalyser.getByteFrequencyData(rawDataArray);
            
            for (let j = 0; j < frequencyBinCount; j++) {
                smoothedDataArray[j] = smoothingFactor * smoothedDataArray[j] + (1 - smoothingFactor) * rawDataArray[j];
            }

            if (particleConfig.enabled) {
              const { bass } = getAudioAverages(smoothedDataArray);
              const bassIntensity = bass / 255;
              updateParticles(particles, particleConfig, canvas.width, canvas.height, bassIntensity);
            }

            drawFrame(ctx, {
                audioData: smoothedDataArray,
                logoImage, backgroundImage, isPlaying: true,
                logoConfig, backgroundConfig, visualizerConfig, particleConfig,
                textConfig,
            }, particles);

            const frame = new VideoFrame(canvas, { timestamp: i * 1_000_000 / frameRate });
            videoEncoder.encode(frame);
            frame.close();

            setRenderProgress(Math.round((i / totalFrames) * 100));
            
            if (renderSpeed > 1) await new Promise(res => setTimeout(res, 10 * (renderSpeed - 1)));
        }
        
        setRenderMessage("Finalizing video...");
        await videoEncoder.flush();
        
        setRenderMessage("Packing MP4 file...");
        muxer.finalize();
        
        const { buffer } = muxer.target;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Success visualizer - ${projectName || 'video'}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (err: any) {
        console.error("Rendering failed:", err);
        setError(`Rendering failed: ${err.message}. Check console for details.`);
    } finally {
        globalAudioContext.close();
        setIsRendering(false);
        setRenderProgress(0);
        setRenderMessage('');
        audioForDuration.currentTime = 0;
        setCurrentTime(0);
    }
  };
  
  const {width, height} = CANVAS_DIMENSIONS[aspectRatio];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gray-800 flex flex-col items-center justify-center">
        {isRendering && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-80 z-40 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-violet-300">{renderMessage}</h2>
                <p className="text-gray-300 text-lg mt-2">{renderProgress}%</p>
                <div className="w-1/2 max-w-md mt-4 bg-gray-700 rounded-full h-2.5">
                    <div className="bg-violet-500 h-2.5 rounded-full" style={{ width: `${renderProgress}%` }}></div>
                </div>
                 <button onClick={() => setIsRendering(false)} className="mt-6 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Cancel</button>
            </div>
        )}
        
        <canvas ref={canvasRef} width={width} height={height} className="w-full h-full object-contain" />
        
        <audio 
            ref={audioRef}
            src={audioSrc || ''}
            crossOrigin="anonymous" 
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />

        <Controls
            onLogoUpload={setLogoFile}
            onBackgroundUpload={setBackgroundFile}
            onAudioUpload={setAudioFile}
            isPlaying={isPlaying}
            isRendering={isRendering}
            togglePlayPause={togglePlayPause}
            onRenderVideo={handleRenderVideo}
            hasAudio={!!audioFile}
            logoConfig={logoConfig}
            onLogoConfigChange={setLogoConfig}
            backgroundConfig={backgroundConfig}
            onBackgroundConfigChange={setBackgroundConfig}
            visualizerConfig={visualizerConfig}
            onVisualizerConfigChange={setVisualizerConfig}
            particleConfig={particleConfig}
            onParticleConfigChange={setParticleConfig}
            textConfig={textConfig}
            onTextConfigChange={setTextConfig}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            renderSpeed={renderSpeed}
            onRenderSpeedChange={setRenderSpeed}
            projectName={projectName}
            onProjectNameChange={setProjectName}
        />
        
        {error && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
                Error: {error}
            </div>
        )}
    </main>
  );
};