import { useEffect, useState } from 'react';

export interface MovementControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

const keyMap: Record<string, keyof MovementControls> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};

/**
 * Scalable keyboard input hook for 3D character or camera movement.
 */
export function useKeyboardControls(): MovementControls {
  const [movement, setMovement] = useState<MovementControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = keyMap[e.code];
      if (action) {
        setMovement((prev) => (prev[action] ? prev : { ...prev, [action]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = keyMap[e.code];
      if (action) {
        setMovement((prev) => (!prev[action] ? prev : { ...prev, [action]: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return movement;
}

export default useKeyboardControls;
