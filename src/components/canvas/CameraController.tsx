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

// Pre-allocated static vectors outside the render loop to eliminate per-frame garbage collection
const _carForward = new THREE.Vector3();
const _carBack = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _orbitTarget = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _forwardUnit = new THREE.Vector3(0, 0, -1);
const _backUnit = new THREE.Vector3(0, 0, 1);

/**
 * Cinematic Follow-Camera & Free Orbit Controller.
 * In follow mode: smoothly trails slightly behind and above the sports car using lerp,
 * adjusting elevation and field of view dynamically based on speed and heading.
 * Fully allocation-free inside useFrame to guarantee 60-120 FPS without GC stutter.
 */
export function CameraController({ mode, vehicleStateRef }: CameraControllerProps) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const currentLookAt = useRef(new THREE.Vector3(-42.5, 1.2, 50));

  useFrame((state, delta) => {
    const { position: carPos, quaternion: carQuat, speedMph } = vehicleStateRef.current;

    if (mode === 'follow') {
      // 1. Calculate orientation-aware trailing offset behind sports car without allocating new vectors
      // In car local space: forward is -Z, rear is +Z
      _carForward.copy(_forwardUnit).applyQuaternion(carQuat);
      _carBack.copy(_backUnit).applyQuaternion(carQuat);

      // Dynamic distance and height based on speed for cinematic sensation
      const speedFactor = Math.min(1, speedMph / 120);
      const trailDistance = 7.2 + speedFactor * 2.2;
      const trailHeight = 2.6 + speedFactor * 0.7;

      // Target camera world position: trailing behind and elevated above
      _targetCamPos
        .copy(carPos)
        .addScaledVector(_upVec, trailHeight)
        .addScaledVector(_carBack, trailDistance);

      // Target look-at point: forward through hood towards the road/horizon
      _targetLookAt
        .copy(carPos)
        .addScaledVector(_upVec, 0.85)
        .addScaledVector(_carForward, 3.2);

      // 2. Smooth lerp for cinematic trailing
      // Camera position interpolation
      state.camera.position.lerp(_targetCamPos, Math.min(1, delta * 5.5));

      // Camera aiming interpolation
      currentLookAt.current.lerp(_targetLookAt, Math.min(1, delta * 7.5));
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
      // Free orbit mode: orbit controls smoothly track the car's position without allocations
      if (orbitRef.current) {
        _orbitTarget.set(carPos.x, carPos.y + 0.6, carPos.z);
        currentLookAt.current.lerp(_orbitTarget, delta * 6.0);
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
