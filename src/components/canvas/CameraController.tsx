import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface VehicleState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  speedMph: number;
  collisionShake?: number;
}

interface CameraControllerProps {
  mode: 'follow' | 'orbit';
  vehicleStateRef: React.MutableRefObject<VehicleState>;
}

// Pre-allocated static vectors outside the render loop to eliminate per-frame garbage collection
const _orbitTarget = new THREE.Vector3();

/**
 * Free Orbit Controller.
 * In follow mode, camera tracking is handled tightly inside Vehicle.tsx useFrame.
 * In orbit mode, orbit controls smoothly track the car's position.
 */
export function CameraController({ mode, vehicleStateRef }: CameraControllerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const currentLookAt = useRef(new THREE.Vector3(-42.5, 1.2, 50));

  useFrame((_, delta) => {
    if (mode === 'follow') {
      // Follow camera is directly and tightly managed inside Vehicle.tsx useFrame
      return;
    }

    const { position: carPos } = vehicleStateRef.current;

    // Free orbit mode: orbit controls smoothly track the car's position without allocations
    if (orbitRef.current) {
      _orbitTarget.set(carPos.x, carPos.y + 0.6, carPos.z);
      currentLookAt.current.lerp(_orbitTarget, delta * 6.0);
      orbitRef.current.target.copy(currentLookAt.current);
      orbitRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={orbitRef}
      enabled={mode === 'orbit'}
      makeDefault
      maxPolarAngle={Math.PI / 2.05}
      minDistance={3}
      maxDistance={45}
    />
  );
}

export default CameraController;
