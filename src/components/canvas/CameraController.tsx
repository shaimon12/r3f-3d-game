import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export interface VehicleState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  speedMph: number;
}

interface CameraControllerProps {
  mode: 'follow' | 'orbit';
  vehicleStateRef: React.MutableRefObject<VehicleState>;
}

/**
 * Cinematic Follow-Camera & Free Orbit Controller.
 * In follow mode: smoothly trails slightly behind and above the sports car using lerp,
 * adjusting elevation and field of view dynamically based on speed and heading.
 */
export function CameraController({ mode, vehicleStateRef }: CameraControllerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 55));

  useFrame((state, delta) => {
    const { position: carPos, quaternion: carQuat, speedMph } = vehicleStateRef.current;

    if (mode === 'follow') {
      // 1. Calculate orientation-aware trailing offset behind sports car
      // In car local space: forward is -Z, rear is +Z
      const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuat);
      const carBack = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);

      // Dynamic distance and height based on speed for cinematic sensation
      const speedFactor = Math.min(1, speedMph / 120);
      const trailDistance = 7.2 + speedFactor * 2.2;
      const trailHeight = 2.6 + speedFactor * 0.7;

      // Target camera world position: trailing behind and elevated above
      const targetCamPos = new THREE.Vector3()
        .copy(carPos)
        .add(new THREE.Vector3(0, trailHeight, 0))
        .add(carBack.multiplyScalar(trailDistance));

      // Target look-at point: forward through hood towards the road/horizon
      const targetLookAt = new THREE.Vector3()
        .copy(carPos)
        .add(new THREE.Vector3(0, 0.85, 0))
        .add(carForward.multiplyScalar(3.2));

      // 2. Smooth lerp for cinematic trailing
      // Camera position interpolation
      state.camera.position.lerp(targetCamPos, Math.min(1, delta * 5.5));

      // Camera aiming interpolation
      currentLookAt.current.lerp(targetLookAt, Math.min(1, delta * 7.5));
      state.camera.lookAt(currentLookAt.current);

      // 3. Dynamic speed-based FOV for high-speed sensation
      if ('fov' in state.camera) {
        const pCam = state.camera as THREE.PerspectiveCamera;
        const targetFov = THREE.MathUtils.lerp(52, 64, speedFactor);
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, targetFov, delta * 3.5);
        pCam.updateProjectionMatrix();
      }

      if (orbitRef.current) {
        orbitRef.current.target.copy(currentLookAt.current);
      }
    } else {
      // Free orbit mode: orbit controls smoothly track the car's position
      if (orbitRef.current) {
        currentLookAt.current.lerp(
          new THREE.Vector3(carPos.x, carPos.y + 0.6, carPos.z),
          delta * 6.0
        );
        orbitRef.current.target.copy(currentLookAt.current);
        orbitRef.current.update();
      }
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
