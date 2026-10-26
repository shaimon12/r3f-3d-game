import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { useProgress } from '@react-three/drei';
import './CountdownOverlay.css';

/**
 * Synthesizes clean acoustic countdown beeps using the browser's Web Audio API:
 * - 440 Hz (A4) solid tone for 3, 2, 1
 * - 880 Hz (A5) bright triumphant tone for GO!
 */
function playCountdownTone(freq: number, duration: number) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Graceful fallback if audio context blocked before gesture
  }
}

export const CountdownOverlay: React.FC = () => {
  const matchState = useGameStore((state) => state.matchState);
  const setMatchState = useGameStore((state) => state.setMatchState);
  const { active: loadingActive } = useProgress();

  // Countdown stage: null | 3 | 2 | 1 | 'GO!'
  const [count, setCount] = useState<number | 'GO!' | null>(null);
  const [fading, setFading] = useState(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    // Only begin countdown when matchState is 'countdown' AND all 3D assets have finished loading
    if (matchState === 'countdown' && !loadingActive) {
      clearTimers();
      setFading(false);

      // Start countdown sequence with precise 1-second intervals
      // T = 0ms: "3"
      const t0 = setTimeout(() => {
        setCount(3);
        playCountdownTone(440, 0.18);
      }, 300);

      // T = 1300ms: "2"
      const t1 = setTimeout(() => {
        setCount(2);
        playCountdownTone(440, 0.18);
      }, 1300);

      // T = 2300ms: "1"
      const t2 = setTimeout(() => {
        setCount(1);
        playCountdownTone(440, 0.18);
      }, 2300);

      // T = 3300ms: "GO!" -> Transition matchState to 'racing'
      const t3 = setTimeout(() => {
        setCount('GO!');
        playCountdownTone(880, 0.45);
        setMatchState('racing');
      }, 3300);

      // T = 4200ms: Smooth fade-out
      const t4 = setTimeout(() => {
        setFading(true);
      }, 4200);

      // T = 4700ms: Unmount countdown display
      const t5 = setTimeout(() => {
        setCount(null);
      }, 4700);

      timersRef.current = [t0, t1, t2, t3, t4, t5];

      return () => {
        clearTimers();
      };
    } else if (matchState !== 'countdown') {
      clearTimers();
      setCount(null);
    }
  }, [matchState, loadingActive, setMatchState]);

  if (count === null || matchState === 'finished') return null;

  const isGo = count === 'GO!';
  const stageNum = typeof count === 'number' ? count : 0;

  return (
    <div className={`countdown-overlay ${fading ? 'fade-out' : ''}`}>
      <div className="countdown-card">
        {/* FIA Starting Gantry Traffic Lights */}
        <div className="countdown-traffic-lights">
          {[3, 2, 1].map((lightIndex) => {
            // Light 1 (left) illuminates at count <= 3
            // Light 2 (middle) illuminates at count <= 2
            // Light 3 (right) illuminates at count <= 1
            const isRedLit = !isGo && stageNum <= lightIndex;
            const isGreenLit = isGo;

            return (
              <div key={lightIndex} className="traffic-light-unit">
                <div
                  className={`signal-lamp ${
                    isGreenLit ? 'green-on' : isRedLit ? 'red-on' : 'lamp-off'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Dynamic Animated '3, 2, 1, GO!' Typography */}
        <div key={String(count)} className={`countdown-number ${isGo ? 'go-text' : 'num-text'}`}>
          {count}
        </div>

        {/* Interactive rev hint */}
        <div className="countdown-hint">
          {isGo ? (
            <span className="go-subtext">LIGHTS OUT AND AWAY WE GO!</span>
          ) : (
            <span className="rev-hint">
              HOLD <kbd className="hint-key">W</kbd> TO REV ENGINE ON GRID
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountdownOverlay;
