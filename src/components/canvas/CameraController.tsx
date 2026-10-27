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
  const collisionShakeIntensity = useRef(0);
  const isFirstFrameRef = useRef(true);

  useFrame((state, delta) => {
    const { position: carPos, quaternion: carQuat, speedMph, collisionShake = 0 } = vehicleStateRef.current;

    // Smoothly decay wall collision shake impulse over time
    if (collisionShake > 0) {
      collisionShakeIntensity.current = Math.max(collisionShakeIntensity.current, collisionShake);
      vehicleStateRef.current.collisionShake = 0; // Consume trigger
    }
    collisionShakeIntensity.current = THREE.MathUtils.lerp(
      collisionShakeIntensity.current,
      0,
      Math.min(1, delta * 5.5)
    );

    if (mode === 'follow') {
      // 1. Calculate orientation-aware trailing offset behind sports car without allocating new vectors
      // In car local space: forward is -Z, rear is +Z
      _carForward.copy(_forwardUnit).applyQuaternion(carQuat);
      _carBack.copy(_backUnit).applyQuaternion(carQuat);

      // Dynamic distance and height based on speed for visceral sensation of speed
      const speedRatio = THREE.MathUtils.clamp(speedMph / 150, 0, 1.15);
      const trailDistance = 7.2 + speedRatio * 2.8;
      const trailHeight = 2.6 + speedRatio * 0.8;

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

      // 2. Smooth 'lazy follow' spring lerp to completely absorb physics vibrations
      if (isFirstFrameRef.current) {
        state.camera.position.copy(_targetCamPos);
        currentLookAt.current.copy(_targetLookAt);
        state.camera.lookAt(currentLookAt.current);
        isFirstFrameRef.current = false;
      } else {
        state.camera.position.lerp(_targetCamPos, 0.1);
        currentLookAt.current.lerp(_targetLookAt, 0.1);
        state.camera.lookAt(currentLookAt.current);
      }

      // 3. Dynamic speed-based FOV for visceral sense of speed
      // Widens slightly as velocity increases (52° at rest -> 72° at 150+ mph)
      if ('fov' in state.camera) {
        const pCam = state.camera as THREE.PerspectiveCamera;
        const targetFov = THREE.MathUtils.lerp(52, 72, speedRatio);
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, targetFov, Math.min(1, delta * 4.0));
        pCam.updateProjectionMatrix();
      }

      // 4. Wall collision shake effect (only triggers upon physical impact)
      const totalShake = collisionShakeIntensity.current * 0.15;

      if (totalShake > 0.001) {
        const t = state.clock.getElapsedTime() * 30;
        const offsetX = (Math.sin(t * 1.3) + Math.cos(t * 2.1)) * 0.5 * totalShake;
        const offsetY = (Math.sin(t * 1.7) + Math.cos(t * 1.1)) * 0.5 * totalShake;
        const offsetZ = (Math.cos(t * 1.9) + Math.sin(t * 0.7)) * 0.3 * totalShake;

        state.camera.position.x += offsetX;
        state.camera.position.y += offsetY;
        state.camera.position.z += offsetZ;
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
