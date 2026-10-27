import { useEffect, useRef, useState } from 'react';

export interface VehicleControls {
  forward: boolean;     // W / UpArrow
  backward: boolean;    // S / DownArrow
  left: boolean;        // A / LeftArrow
  right: boolean;       // D / RightArrow
  handbrake: boolean;   // Space
  boost: boolean;       // Shift
  reset: boolean;       // R (reset orientation & position)
}

const keyMap: Record<string, keyof VehicleControls> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'handbrake',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  KeyR: 'reset',
};

function resolveAction(e: KeyboardEvent): keyof VehicleControls | undefined {
  if (keyMap[e.code]) return keyMap[e.code];
  const k = e.key ? e.key.toLowerCase() : '';
  if (k === 'w' || k === 'arrowup') return 'forward';
  if (k === 's' || k === 'arrowdown') return 'backward';
  if (k === 'a' || k === 'arrowleft') return 'left';
  if (k === 'd' || k === 'arrowright') return 'right';
  if (k === ' ' || k === 'spacebar') return 'handbrake';
  if (k === 'shift') return 'boost';
  if (k === 'r') return 'reset';
  return undefined;
}

const initialControls: VehicleControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  boost: false,
  reset: false,
};

/**
 * Responsive keyboard controls hook for vehicle physics.
 * Provides both instantaneous synchronous ref for physics loops and reactive state for UI/HUD.
 */
export function useKeyboardControls() {
  const [controls, setControls] = useState<VehicleControls>(initialControls);
  const controlsRef = useRef<VehicleControls>({ ...initialControls });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling when using arrow keys or space in the game
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.key === ' ') {
        e.preventDefault();
      }

      const action = resolveAction(e);
      if (action) {
        controlsRef.current[action] = true;
        setControls((prev) => (prev[action] ? prev : { ...prev, [action]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = resolveAction(e);
      if (action) {
        controlsRef.current[action] = false;
        setControls((prev) => (!prev[action] ? prev : { ...prev, [action]: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { controls, controlsRef };
}

export default useKeyboardControls;
