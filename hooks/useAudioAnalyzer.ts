
import { useState, useEffect } from 'react';

export const useAudioAnalyzer = (
  analyserNode: AnalyserNode | null,
  isPlaying: boolean
): [Uint8Array | null, React.Dispatch<React.SetStateAction<Uint8Array | null>>] => {
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!analyserNode || !isPlaying) {
      // Stop analyzing if not playing or if analyser is not ready
      setAudioData(null);
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationFrameId: number;

    const analyze = () => {
      analyserNode.getByteFrequencyData(dataArray);
      setAudioData(new Uint8Array(dataArray)); // Create new array to trigger re-render
      animationFrameId = requestAnimationFrame(analyze);
    };

    analyze();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserNode, isPlaying]);

  return [audioData, setAudioData];
};
