import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, PositionalAudio, useKeyboardControls } from '@react-three/drei';
import {
  RigidBody,
  BallCollider,
  CoefficientCombineRule,
  useRapier,
  type RapierRigidBody,
  type CollisionEnterPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '@/stores/useGameStore';
import type { VehicleState } from './CameraController';

export interface VehicleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  onSpeedChange?: (speedMph: number, speedMs?: number) => void;
  targetPosRef?: React.MutableRefObject<THREE.Vector3>;
  vehicleStateRef?: React.MutableRefObject<VehicleState>;
  cameraMode?: 'follow' | 'orbit';
}

// Pre-allocated static vectors outside render loop to eliminate per-frame GC
const _targetPos = new THREE.Vector3();
const _targetVisualPos = new THREE.Vector3();
const _fwdVec = new THREE.Vector3();
const _fwdSlope = new THREE.Vector3();
const _rightSlope = new THREE.Vector3();
const _negFwdSlope = new THREE.Vector3();
const _groundNormal = new THREE.Vector3(0, 1, 0);
const _slopeMatrix = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();
const _downDir = new THREE.Vector3(0, -1, 0);
const _carForward = new THREE.Vector3();
const _carBack = new THREE.Vector3();
const _carUp = new THREE.Vector3();
const _idealCamPos = new THREE.Vector3();
const _idealLookAt = new THREE.Vector3();

// Vector3 component-wise damping using native THREE.MathUtils.damp
function dampVec3(current: THREE.Vector3, target: THREE.Vector3, lambda: number, delta: number) {
  current.x = THREE.MathUtils.damp(current.x, target.x, lambda, delta);
  current.y = THREE.MathUtils.damp(current.y, target.y, lambda, delta);
  current.z = THREE.MathUtils.damp(current.z, target.z, lambda, delta);
}

// Bounding Box-adjusted physics constants based on exact 3D model dimensions:
// - Car Model Box: width 1.98m, height 1.18m, length 4.50m (tires bottom out at local y = -0.43)
// - Track Model Box: width 150.3m, height 8.5m, length 228.4m
// - Sphere Radius: 1.5m (thickened collider physically resists passing through thin trimesh walls)
// - Impulse Multiplier: 1500 (boosted thrust for natural 120-150 mph cruising speed)
const SPHERE_RADIUS = 1.5;
const WHEEL_RADIUS = 0.34;
const IMPULSE_MULTIPLIER = 1500;

export function Vehicle({
  position = [-42.5, 10.0, 56],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
  vehicleStateRef,
  cameraMode = 'follow',
}: VehicleProps) {
  const { world, rapier } = useRapier();
  const matchState = useGameStore((state) => state.matchState);
  const sphereRigidBodyRef = useRef<RapierRigidBody>(null);
  const visualCarRef = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls();

  // Spatial Audio Refs
  const engineAudioRef = useRef<THREE.PositionalAudio>(null);
  const skidAudioRef = useRef<THREE.PositionalAudio>(null);
  const crashAudioRef = useRef<THREE.PositionalAudio>(null);
  const lastCrashTimestamp = useRef(0);

  // Vehicle driving & orientation tracking refs
  const yawRef = useRef(rotation[1] || 0);
  const steerAngleRef = useRef(0);
  const wheelRollRef = useRef([0, 0, 0, 0]);
  const spawnPos = useRef(position);
  const isFirstFrameRef = useRef(true);

  // Arcade Chase Camera tracking refs
  const currentLookAt = useRef(new THREE.Vector3(-42.5, 8.93, 46));
  const isFirstCameraFrameRef = useRef(true);

  // Load the 3D models for car and track
  const { scene: carScene } = useGLTF('/models/car.glb');
  const { scene: trackScene } = useGLTF('/models/track.glb');

  // =========================================================================
  // THE BLINDNESS FIX: Calculate and console.log exact bounding box sizes
  // =========================================================================
  useEffect(() => {
    // 1. Calculate Car Model Bounding Box using THREE.Box3
    const carBox = new THREE.Box3().setFromObject(carScene);
    const carSize = new THREE.Vector3();
    carBox.getSize(carSize);
    console.log('🚗 [BOUNDING BOX] Car Model:', {
      min: carBox.min.toArray(),
      max: carBox.max.toArray(),
      size: carSize.toArray(),
    });

    // 2. Calculate Track Model Bounding Box using THREE.Box3
    const trackBox = new THREE.Box3().setFromObject(trackScene);
    const trackSize = new THREE.Vector3();
    trackBox.getSize(trackSize);
    console.log('🏁 [BOUNDING BOX] Track Model:', {
      min: trackBox.min.toArray(),
      max: trackBox.max.toArray(),
      size: trackSize.toArray(),
    });
  }, [carScene, trackScene]);

  // Clone car scene so instances/materials are completely isolated
  const clonedScene = useMemo(() => carScene.clone(true), [carScene]);

  // Extract individual chassis and wheel nodes
  const { chassisNode, wheelFL, wheelFR, wheelRL, wheelRR } = useMemo(() => {
    const chassisNode = clonedScene.getObjectByName('Chassis') as THREE.Group;
    const wheelFL = clonedScene.getObjectByName('Wheel_FL') as THREE.Group;
    const wheelFR = clonedScene.getObjectByName('Wheel_FR') as THREE.Group;
    const wheelRL = clonedScene.getObjectByName('Wheel_RL') as THREE.Group;
    const wheelRR = clonedScene.getObjectByName('Wheel_RR') as THREE.Group;

    if (wheelFL) wheelFL.rotation.order = 'YXZ';
    if (wheelFR) wheelFR.rotation.order = 'YXZ';
    if (wheelRL) wheelRL.rotation.order = 'YXZ';
    if (wheelRR) wheelRR.rotation.order = 'YXZ';

    return { chassisNode, wheelFL, wheelFR, wheelRL, wheelRR };
  }, [clonedScene]);

  const wheelsList = useMemo(
    () => [wheelFL, wheelFR, wheelRL, wheelRR],
    [wheelFL, wheelFR, wheelRL, wheelRR]
  );

  // Resume Web Audio context on user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      if (engineAudioRef.current) {
        const ctx = engineAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') ctx.resume();
        if (!engineAudioRef.current.isPlaying) {
          engineAudioRef.current.setVolume(0.4);
          engineAudioRef.current.play();
        }
      }
      if (skidAudioRef.current) {
        const ctx = skidAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') ctx.resume();
        if (!skidAudioRef.current.isPlaying) {
          skidAudioRef.current.setVolume(0);
          skidAudioRef.current.play();
        }
      }
      if (crashAudioRef.current) {
        const ctx = crashAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') ctx.resume();
      }
    };

    window.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  // Collision handling for wall impacts & crash sound
  const handleCollision = (payload: CollisionEnterPayload) => {
    const sphere = sphereRigidBodyRef.current;
    if (!sphere) return;

    const otherRbName = (payload.other?.rigidBodyObject?.name || '').toLowerCase();
    const otherColliderName = (payload.other?.colliderObject?.name || '').toLowerCase();
    const isWall =
      otherRbName.includes('wall') ||
      otherRbName.includes('barrier') ||
      otherRbName.includes('bumper') ||
      otherColliderName.includes('wall') ||
      otherColliderName.includes('barrier') ||
      otherColliderName.includes('bumper');

    if (!isWall) return;

    let normalX = 0;
    let normalZ = 0;
    try {
      const normal = payload.manifold.normal();
      if (normal) {
        normalX = normal.x;
        normalZ = normal.z;
        if (Math.abs(normal.y) > 0.4) return; // Ignore floor contacts
      }
    } catch {
      return;
    }

    const linvel = sphere.linvel();
    const impactSpeed = Math.abs(linvel.x * normalX + linvel.z * normalZ);
    if (impactSpeed < 6.0) return;

    // Trigger camera shake on wall collision
    if (vehicleStateRef) {
      vehicleStateRef.current.collisionShake = THREE.MathUtils.clamp(impactSpeed / 25, 0.4, 1.0);
    }

    const now = performance.now();
    if (now - lastCrashTimestamp.current < 300) return;
    lastCrashTimestamp.current = now;

    if (crashAudioRef.current) {
      const audio = crashAudioRef.current;
      if (audio.context && audio.context.state === 'suspended') {
        audio.context.resume();
      }
      if (audio.isPlaying) audio.stop();
      audio.setVolume(THREE.MathUtils.clamp(impactSpeed / 30, 0.4, 1.0));
      audio.play();
    }
  };

  // =========================================================================
  // SIMPLE FORCE MOVEMENT LOOP: Pure applyImpulse forward & steering
  // =========================================================================
  useFrame((state, delta) => {
    const sphere = sphereRigidBodyRef.current;
    const visualCar = visualCarRef.current;
    if (!sphere || !visualCar || !world || !rapier) return;

    // Drei KeyboardControls: get synchronous controls state
    const { forward, backward, left, right, boost, handbrake, reset } = get();

    // Console Log the Thrust (Debug verification)
    if (get().forward) {
      console.log('W pressed, applying thrust');
    }

    // Reset vehicle on 'R' key to upright position above track
    if (reset) {
      sphere.wakeUp();
      sphere.setTranslation({ x: spawnPos.current[0], y: spawnPos.current[1], z: spawnPos.current[2] }, true);
      sphere.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      sphere.setLinvel({ x: 0, y: 0, z: 0 }, true);
      sphere.setAngvel({ x: 0, y: 0, z: 0 }, true);
      yawRef.current = rotation[1] || 0;
      steerAngleRef.current = 0;
      isFirstFrameRef.current = true;
      isFirstCameraFrameRef.current = true;
      return;
    }

    // If forward key is pressed during pre-race countdown, start racing immediately
    if (forward && matchState === 'countdown') {
      useGameStore.getState().setMatchState('racing');
    }

    // 1. Steering: update vehicle heading yaw based on A / D input
    let steerInput = 0;
    if (left) steerInput += 1;
    if (right) steerInput -= 1;

    steerAngleRef.current = THREE.MathUtils.lerp(
      steerAngleRef.current,
      steerInput * 0.45,
      Math.min(1.0, delta * 12.0)
    );

    const turnSensitivity = 3.0;
    yawRef.current += steerInput * turnSensitivity * delta;

    // 2. Heading direction vector in horizontal plane
    const dirX = -Math.sin(yawRef.current);
    const dirZ = -Math.cos(yawRef.current);

    // 3. Thrust Application (IMPULSE_MULTIPLIER = 1500 balanced against linearDamping = 2)
    const boostMult = boost ? 1.4 : 1.0;
    const impulse = IMPULSE_MULTIPLIER * boostMult * delta;

    if (forward) {
      // Ensure sphereRigidBodyRef.current.wakeUp() is called so Rapier doesn't put sphere to sleep
      sphere.wakeUp();
      sphere.applyImpulse({ x: dirX * impulse, y: 0, z: dirZ * impulse }, true);
    } else if (backward) {
      sphere.wakeUp();
      const reverseImpulse = IMPULSE_MULTIPLIER * 0.6 * delta;
      sphere.applyImpulse({ x: -dirX * reverseImpulse, y: 0, z: -dirZ * reverseImpulse }, true);
    }

    const currentVel = sphere.linvel();
    const linvel = currentVel;

    // Kill Upward Bounces: If trimesh seams launch the sphere (vel.y > 2), slam it down immediately
    if (currentVel.y > 2) {
      sphere.applyImpulse({ x: 0, y: -500, z: 0 }, true);
    }

    // 4. Lateral tire grip: counteract sideways slide so turning responds instantly along heading
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);
    const latSpeed = currentVel.x * rightX + currentVel.z * rightZ;
    // Strong grip under normal driving forces the frictionless puck to track heading cleanly
    const gripFactor = handbrake ? 0.15 : 0.95;
    const gripImpulse = -latSpeed * 14.14 * gripFactor * Math.min(1.0, delta * 20.0);
    sphere.applyImpulse(
      { x: rightX * gripImpulse, y: 0, z: rightZ * gripImpulse },
      true
    );

    // Telemetry updates
    const speedMs = Math.hypot(currentVel.x, currentVel.z);
    const speedMph = Math.round(speedMs * 2.237);
    if (onSpeedChange) {
      onSpeedChange(speedMph, speedMs);
    }

    // =========================================================================
    // 5. VISUAL CAR DECOUPLING & GROUND-SLOPE ALIGNMENT (Shock Absorbers)
    // Smooth decoupling from physics body to absorb trimesh solver jitter
    // =========================================================================
    const spherePos = sphere.translation();
    const visualY = spherePos.y - (SPHERE_RADIUS - 0.43);
    _targetVisualPos.set(spherePos.x, visualY, spherePos.z);

    // Car heading direction in horizontal plane based on steering yaw
    _fwdVec.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));

    // Fire downward raycast from sphere center to detect ground normal underneath
    const downRay = new rapier.Ray(spherePos, _downDir);
    const hitDown = world.castRayAndGetNormal(
      downRay,
      SPHERE_RADIUS + 1.5,
      true,
      undefined,
      undefined,
      undefined,
      sphere
    );

    if (hitDown && !hitDown.collider.isSensor() && hitDown.normal.y > 0.3) {
      _groundNormal.set(hitDown.normal.x, hitDown.normal.y, hitDown.normal.z).normalize();
    } else {
      _groundNormal.set(0, 1, 0);
    }

    // Align visual car orientation to the ground surface normal while tracking heading yaw
    _fwdSlope.copy(_fwdVec).projectOnPlane(_groundNormal).normalize();
    _rightSlope.crossVectors(_fwdSlope, _groundNormal).normalize();
    _negFwdSlope.copy(_fwdSlope).negate();
    _slopeMatrix.makeBasis(_rightSlope, _groundNormal, _negFwdSlope);
    _targetQuat.setFromRotationMatrix(_slopeMatrix);

    // Shock Absorbers: Smooth lerp/slerp absorbs solver jitter completely
    if (isFirstFrameRef.current) {
      visualCar.position.copy(_targetVisualPos);
      visualCar.quaternion.copy(_targetQuat);
      isFirstFrameRef.current = false;
    } else {
      visualCar.position.lerp(_targetVisualPos, 0.3);
      visualCar.quaternion.slerp(_targetQuat, 0.2);
    }

    // Follow camera & state tracking
    if (targetPosRef) {
      _targetPos.copy(visualCar.position);
      targetPosRef.current.copy(_targetPos);
    }
    if (vehicleStateRef) {
      vehicleStateRef.current.position.copy(visualCar.position);
      vehicleStateRef.current.quaternion.copy(visualCar.quaternion);
      vehicleStateRef.current.speedMph = speedMph;
    }

    // =========================================================================
    // 6. TIGHT ARCADE CHASE CAMERA (Inside Vehicle.tsx useFrame)
    // 2.5m above, 6.5m behind, delta-time damp smoothing, smooth lookAt target 10m forward
    // =========================================================================
    if (cameraMode === 'follow') {
      _carForward.set(0, 0, -1).applyQuaternion(visualCar.quaternion);
      _carBack.set(0, 0, 1).applyQuaternion(visualCar.quaternion);
      _carUp.set(0, 1, 0).applyQuaternion(visualCar.quaternion);

      // Tighten the Offset: strictly 2.5m above and 6.5m behind car's current local orientation
      _idealCamPos
        .copy(visualCar.position)
        .addScaledVector(_carUp, 2.5)
        .addScaledVector(_carBack, 6.5);

      // Smooth the Look Target: car's position plus 10 meters forward along local heading
      _idealLookAt
        .copy(visualCar.position)
        .addScaledVector(_carForward, 10.0);

      if (isFirstCameraFrameRef.current) {
        state.camera.position.copy(_idealCamPos);
        currentLookAt.current.copy(_idealLookAt);
        state.camera.lookAt(currentLookAt.current);
        isFirstCameraFrameRef.current = false;
      } else {
        // Delta-Time Smoothing using THREE.MathUtils.damp to eliminate micro-stutters
        dampVec3(state.camera.position, _idealCamPos, 9.0, delta);
        dampVec3(currentLookAt.current, _idealLookAt, 12.0, delta);
        state.camera.lookAt(currentLookAt.current);
      }
    }

    // Wheel visual rotations
    const fwdVelocity = linvel.x * (-Math.sin(yawRef.current)) + linvel.z * (-Math.cos(yawRef.current));
    const rollRate = -fwdVelocity / WHEEL_RADIUS;
    wheelsList.forEach((wheel, idx) => {
      if (!wheel) return;
      wheelRollRef.current[idx] += rollRate * delta;
      if (idx === 0 || idx === 1) {
        wheel.rotation.y = steerAngleRef.current;
      }
      wheel.rotation.x = wheelRollRef.current[idx];
    });

    // Spatial Positional Audio updates
    if (engineAudioRef.current && engineAudioRef.current.isPlaying) {
      let targetPitch = 0.8;
      let targetVolume = 0.35;

      if (matchState === 'countdown') {
        const isRevving = forward;
        targetPitch = isRevving ? (boost ? 2.25 : 1.9) : 0.8;
        targetVolume = isRevving ? 0.85 : 0.35;
      } else {
        targetPitch = THREE.MathUtils.clamp(0.75 + (speedMph / 120) * 1.45, 0.75, 2.35);
        const isThrottling = forward || backward;
        targetVolume = isThrottling
          ? THREE.MathUtils.clamp(0.45 + (speedMph / 120) * 0.45, 0.45, 0.95)
          : THREE.MathUtils.clamp(0.25 + (speedMph / 120) * 0.25, 0.25, 0.5);
      }

      engineAudioRef.current.setPlaybackRate(targetPitch);
      const currentVol = engineAudioRef.current.getVolume();
      engineAudioRef.current.setVolume(
        THREE.MathUtils.clamp(THREE.MathUtils.lerp(currentVol, targetVolume, delta * 4.5), 0.1, 1.0)
      );
    }

    // Skid Audio on heavy slide / handbrake
    if (skidAudioRef.current) {
      const isHandbrakeSlide = handbrake && speedMs > 3.0;
      const rightX = Math.cos(yawRef.current);
      const rightZ = -Math.sin(yawRef.current);
      const latSpeed = Math.abs(linvel.x * rightX + linvel.z * rightZ);
      const isDrifting = matchState === 'racing' && ((latSpeed > 3.0 && speedMs > 5.0) || isHandbrakeSlide);

      let targetSkidVolume = 0;
      if (isDrifting) {
        if (!skidAudioRef.current.isPlaying) skidAudioRef.current.play();
        const driftSeverity = isHandbrakeSlide ? 0.9 : Math.min(1.0, (latSpeed - 3.0) / 4.0);
        targetSkidVolume = 0.25 + driftSeverity * 0.65;
        const skidPitch = THREE.MathUtils.clamp(0.95 + driftSeverity * 0.35, 0.9, 1.4);
        skidAudioRef.current.setPlaybackRate(skidPitch);
      }

      const currentSkidVol = skidAudioRef.current.getVolume();
      const fadeSpeed = isDrifting ? 12.0 : 7.0;
      skidAudioRef.current.setVolume(
        THREE.MathUtils.lerp(currentSkidVol, targetSkidVolume, delta * fadeSpeed)
      );
    }
  });

  return (
    <>
      {/* 1. Invisible Arcade Physics Sphere Body (Frictionless Sliding Puck) */}
      <RigidBody
        ref={sphereRigidBodyRef}
        name="vehicle"
        position={position}
        rotation={rotation}
        colliders={false}
        type="dynamic"
        canSleep={false}
        ccd={true}
        enabledRotations={[false, true, false]}
        gravityScale={6}
        linearDamping={2}
        angularDamping={2}
        friction={0}
        frictionCombineRule={CoefficientCombineRule.Min}
        onCollisionEnter={handleCollision}
      >
        <BallCollider args={[SPHERE_RADIUS]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      </RigidBody>

      {/* 2. Decoupled Visuals: 3D car model independent in scene, oriented & positioned in useFrame */}
      <group ref={visualCarRef}>
        {chassisNode && <primitive object={chassisNode} />}
        {wheelFL && <primitive object={wheelFL} />}
        {wheelFR && <primitive object={wheelFR} />}
        {wheelRL && <primitive object={wheelRL} />}
        {wheelRR && <primitive object={wheelRR} />}

        {/* Spatial Positional Audio attached to the sports car chassis */}
        <PositionalAudio
          ref={engineAudioRef}
          url="/audio/engine.wav"
          distance={24}
          loop
          autoplay={false}
        />
        <PositionalAudio
          ref={skidAudioRef}
          url="/audio/skid.wav"
          distance={20}
          loop
          autoplay={false}
        />
        <PositionalAudio
          ref={crashAudioRef}
          url="/audio/crash.wav"
          distance={28}
          loop={false}
          autoplay={false}
        />
      </group>
    </>
  );
}

// Pre-load the models
useGLTF.preload('/models/car.glb');
useGLTF.preload('/models/track.glb');

export default Vehicle;
