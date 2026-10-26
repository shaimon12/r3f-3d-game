import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, PositionalAudio } from '@react-three/drei';
import {
  useRapier,
  useBeforePhysicsStep,
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
  type CollisionEnterPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { useGameStore } from '@/stores/useGameStore';
import type { VehicleState } from './CameraController';

export interface VehicleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  onSpeedChange?: (speedMph: number, speedMs?: number) => void;
  targetPosRef?: React.MutableRefObject<THREE.Vector3>;
  vehicleStateRef?: React.MutableRefObject<VehicleState>;
}

export function Vehicle({
  position = [-42.5, 2.0, 56],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
  vehicleStateRef,
}: VehicleProps) {
  const matchState = useGameStore((state) => state.matchState);
  const chassisRigidBodyRef = useRef<RapierRigidBody>(null);
  const vehicleControllerRef = useRef<RAPIER.DynamicRayCastVehicleController | null>(null);
  const { world } = useRapier();
  const { controlsRef } = useKeyboardControls();

  // Spatial Audio Refs
  const engineAudioRef = useRef<THREE.PositionalAudio>(null);
  const skidAudioRef = useRef<THREE.PositionalAudio>(null);
  const crashAudioRef = useRef<THREE.PositionalAudio>(null);

  // Crash cooldown tracker to prevent multi-contact frame stuttering
  const lastCrashTimestamp = useRef(0);

  // Load the Sleek Aerodynamic Sports Car GLB model
  const { scene } = useGLTF('/models/car.glb');

  // Clone scene so materials/instances are completely isolated
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Extract individual chassis and wheel nodes
  const { chassisNode, wheelFL, wheelFR, wheelRL, wheelRR } = useMemo(() => {
    const chassisNode = clonedScene.getObjectByName('Chassis') as THREE.Group;
    const wheelFL = clonedScene.getObjectByName('Wheel_FL') as THREE.Group;
    const wheelFR = clonedScene.getObjectByName('Wheel_FR') as THREE.Group;
    const wheelRL = clonedScene.getObjectByName('Wheel_RL') as THREE.Group;
    const wheelRR = clonedScene.getObjectByName('Wheel_RR') as THREE.Group;

    // Set rotation orders to YXZ so steering yaw doesn't gimbal-lock wheel spin
    if (wheelFL) wheelFL.rotation.order = 'YXZ';
    if (wheelFR) wheelFR.rotation.order = 'YXZ';
    if (wheelRL) wheelRL.rotation.order = 'YXZ';
    if (wheelRR) wheelRR.rotation.order = 'YXZ';

    return { chassisNode, wheelFL, wheelFR, wheelRL, wheelRR };
  }, [clonedScene]);

  // Memoized wheel array to eliminate per-frame array allocations in useFrame
  const wheelsList = useMemo(
    () => [wheelFL, wheelFR, wheelRL, wheelRR],
    [wheelFL, wheelFR, wheelRL, wheelRR]
  );

  // High-performance sports car suspension & wheel configuration
  const wheelRadius = 0.34;
  const suspensionRestLength = 0.28;
  const connectionY = 0.35;

  // Wheel attachment points in local coordinates
  const wheelPositions = useMemo(
    () => [
      new RAPIER.Vector3(-0.92, connectionY, -1.36), // Front Left (0)
      new RAPIER.Vector3( 0.92, connectionY, -1.36), // Front Right (1)
      new RAPIER.Vector3(-0.94, connectionY,  1.36), // Rear Left (2)
      new RAPIER.Vector3( 0.94, connectionY,  1.36), // Rear Right (3)
    ],
    []
  );

  // Initialize Rapier Vehicle Controller
  useEffect(() => {
    const chassis = chassisRigidBodyRef.current;
    if (!chassis) return;

    // Create the vehicle controller on the chassis rigid body
    const controller = world.createVehicleController(chassis);
    controller.setIndexForwardAxis = 2; // Z-axis forward

    const downDir = new RAPIER.Vector3(0, -1, 0);
    const axleDir = new RAPIER.Vector3(1, 0, 0);

    wheelPositions.forEach((pos) => {
      controller.addWheel(pos, downDir, axleDir, suspensionRestLength, wheelRadius);
    });

    for (let i = 0; i < 4; i++) {
      // Soften suspension stiffness so the car absorbs track bumps instead of launching off them
      controller.setWheelSuspensionStiffness(i, 88.0);
      controller.setWheelMaxSuspensionTravel(i, 0.28);
      // High asphalt friction grip to maintain traction without spinning out
      controller.setWheelFrictionSlip(i, 11.5);
      // Significantly increase suspension damping (compression & relaxation) to absorb bump energy
      controller.setWheelSuspensionCompression(i, 22.0);
      controller.setWheelSuspensionRelaxation(i, 18.0);
    }

    // Lower the RigidBody center of mass significantly on the Y-axis (-0.45m)
    // to eliminate roll/pitch moments and keep the car suctioned to the road
    const numColliders = chassis.numColliders();
    for (let i = 0; i < numColliders; i++) {
      const col = chassis.collider(i);
      if (col) {
        col.setMassProperties(
          1900,
          new RAPIER.Vector3(0, -0.45, 0),
          new RAPIER.Vector3(1200, 1500, 2200),
          new RAPIER.Quaternion(0, 0, 0, 1)
        );
      }
    }
    chassis.recomputeMassPropertiesFromColliders();

    vehicleControllerRef.current = controller;

    return () => {
      if (vehicleControllerRef.current) {
        world.removeVehicleController(vehicleControllerRef.current);
        vehicleControllerRef.current = null;
      }
    };
  }, [world, wheelPositions]);

  // Browser Autoplay Policy: resume audio context and prepare audio nodes on user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      // Resume and start continuous engine audio loop
      if (engineAudioRef.current) {
        const ctx = engineAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
        if (!engineAudioRef.current.isPlaying) {
          engineAudioRef.current.setVolume(0.40);
          engineAudioRef.current.play();
        }
      }

      // Resume skid audio context (muted until drifting)
      if (skidAudioRef.current) {
        const ctx = skidAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
        if (!skidAudioRef.current.isPlaying) {
          skidAudioRef.current.setVolume(0);
          skidAudioRef.current.play();
        }
      }

      // Resume crash audio context
      if (crashAudioRef.current) {
        const ctx = crashAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
      }
    };

    window.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  // Collision handling & metallic crash sound trigger
  // Specifically ignores vertical suspension bounces and triggers only on high-velocity wall impacts
  const handleCollision = (payload: CollisionEnterPayload) => {
    const chassis = chassisRigidBodyRef.current;
    if (!chassis) return;

    const now = performance.now();
    // 250ms debounce to prevent multiple triggers from consecutive manifold contacts on barrier scrape
    if (now - lastCrashTimestamp.current < 250) return;

    // Extract collision normal from contact manifold
    let normalX = 0;
    let normalY = 1;
    let normalZ = 0;
    let hasNormal = false;

    try {
      const normal = payload.manifold.normal();
      if (normal) {
        normalX = normal.x;
        normalY = normal.y;
        normalZ = normal.z;
        hasNormal = true;
      }
    } catch {
      hasNormal = false;
    }

    // IGNORE STANDARD SUSPENSION BOUNCES & GROUND BOTTOMING:
    // If contact normal is predominantly vertical (|normalY| > 0.6), the contact is with
    // the road surface, ground plane, or curb top face.
    // True crash impacts with tire barriers/walls are predominantly horizontal (|normalY| <= 0.6).
    if (hasNormal && Math.abs(normalY) > 0.6) {
      return;
    }

    // Linear velocity vector of vehicle
    const linvel = chassis.linvel();

    // Normal velocity component directed into the barrier/wall surface
    let normalSpeed = 0;
    if (hasNormal) {
      normalSpeed = Math.abs(linvel.x * normalX + linvel.y * normalY + linvel.z * normalZ);
    } else {
      // Fallback: horizontal speed
      normalSpeed = Math.sqrt(linvel.x ** 2 + linvel.z ** 2);
    }

    // Check contact impulse from solver if available
    let maxSolverImpulse = 0;
    try {
      const numContacts = payload.manifold.numContacts();
      for (let i = 0; i < numContacts; i++) {
        const imp = payload.manifold.contactImpulse(i) || 0;
        if (imp > maxSolverImpulse) maxSolverImpulse = imp;
      }
    } catch {
      maxSolverImpulse = 0;
    }

    // Vehicle mass = 1900 kg. Calculate impact impulse force: J = m * deltaV_normal
    const vehicleMass = 1900;
    const kinematicImpulse = vehicleMass * normalSpeed;
    const totalImpactForce = Math.max(kinematicImpulse, maxSolverImpulse);

    // TRIGGER CAMERA SHAKE ON WALL COLLISION:
    // When the car strikes a wall or perimeter barrier, trigger camera shake
    if (vehicleStateRef && (normalSpeed > 1.2 || totalImpactForce > 3000)) {
      const shakeIntensity = THREE.MathUtils.clamp(
        0.40 + (totalImpactForce / 60000) * 0.60,
        0.40,
        1.0
      );
      vehicleStateRef.current.collisionShake = shakeIntensity;
    }

    // HIGH-VELOCITY WALL IMPACT THRESHOLD:
    // Increased to 26,000 N*s (requires at least ~14 m/s or 31 mph direct impact into a barrier).
    // Standard suspension bounces and mild grazing are completely ignored.
    const minThreshold = 26000;
    const maxForceScale = 75000; // Force of severe ~70+ mph head-on barrier crash

    if (totalImpactForce > minThreshold) {
      lastCrashTimestamp.current = now;

      // Scale volume dynamically based on impact force (from 0.35 up to 1.0 for a hard crash)
      const normalizedForce = THREE.MathUtils.clamp(
        (totalImpactForce - minThreshold) / (maxForceScale - minThreshold),
        0,
        1
      );
      const crashVolume = THREE.MathUtils.clamp(0.35 + normalizedForce * 0.65, 0.35, 1.0);

      // Acoustic pitch randomization for metallic impact variation
      const crashPitch = THREE.MathUtils.clamp(0.95 + (Math.random() - 0.5) * 0.16, 0.85, 1.15);

      if (crashAudioRef.current) {
        const audio = crashAudioRef.current;
        if (audio.context && audio.context.state === 'suspended') {
          audio.context.resume();
        }

        if (audio.isPlaying) {
          audio.stop();
        }
        audio.setVolume(crashVolume);
        audio.setPlaybackRate(crashPitch);
        audio.play();
      }
    }
  };

  // Driving parameters
  const steerAngleRef = useRef(0);
  const maxEngineForce = 62000; // Increased by >600% to overpower damping and achieve 150+ mph
  const boostMultiplier = 1.60; // Delivers ~99,200 N under nitrous boost
  const maxBrakeForce = 1400; // Scaled braking force for high-speed deceleration

  const spawnPos = useRef(position);

  // Run before each physics step: sample WASD inputs and update Rapier Vehicle Controller
  useBeforePhysicsStep((stepWorld) => {
    const controller = vehicleControllerRef.current;
    const chassis = chassisRigidBodyRef.current;
    if (!controller || !chassis) return;

    const { forward, backward, handbrake, boost, reset } = controlsRef.current;

    // Reset vehicle on 'R' key to upright position above track
    if (reset) {
      chassis.setTranslation({ x: spawnPos.current[0], y: 2.0, z: spawnPos.current[2] }, true);
      chassis.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
      steerAngleRef.current = 0;
      controller.setWheelSteering(0, 0);
      controller.setWheelSteering(1, 0);
      return;
    }

    // Apply smoothed steering angle to front wheels for physics step
    controller.setWheelSteering(0, steerAngleRef.current);
    controller.setWheelSteering(1, steerAngleRef.current);

    // INTERCEPT MOVEMENT INPUTS DURING COUNTDOWN:
    // If matchState is 'countdown', do NOT apply any forces to the vehicle's rigid body
    // until the state changes to 'racing'. Lock wheel brakes to hold grid position.
    if (matchState === 'countdown') {
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, 0);
        controller.setWheelBrake(i, maxBrakeForce);
      }
      controller.updateVehicle(stepWorld.timestep);
      return;
    }

    const currentSpeed = controller.currentVehicleSpeed();
    const enginePower = boost ? maxEngineForce * boostMultiplier : maxEngineForce;

    if (forward) {
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, enginePower);
        controller.setWheelBrake(i, 0);
      }
    } else if (backward) {
      if (currentSpeed < -1.0) {
        for (let i = 0; i < 4; i++) {
          controller.setWheelEngineForce(i, 0);
          controller.setWheelBrake(i, maxBrakeForce);
        }
      } else {
        for (let i = 0; i < 4; i++) {
          controller.setWheelEngineForce(i, -enginePower * 0.55);
          controller.setWheelBrake(i, 0);
        }
      }
    } else {
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, 0);
        controller.setWheelBrake(i, 5.0);
      }
    }

    if (handbrake) {
      controller.setWheelBrake(2, maxBrakeForce * 2.5);
      controller.setWheelBrake(3, maxBrakeForce * 2.5);
    }

    // Continuous aerodynamic downforce: apply negative Y vector scaling with velocity to keep car planted
    const currentPhysicsSpeed = controller.currentVehicleSpeed();
    const physicsSpeedMs = Number.isFinite(currentPhysicsSpeed) ? Math.abs(currentPhysicsSpeed) : 0;
    if (physicsSpeedMs > 1.0) {
      const downforce = THREE.MathUtils.clamp(physicsSpeedMs * 350 + (physicsSpeedMs * physicsSpeedMs) * 9.5, 0, 85000);
      chassis.addForce({ x: 0, y: -downforce, z: 0 }, true);
    }

    controller.updateVehicle(stepWorld.timestep);
  });

  // Render loop: Synchronize wheel meshes, telemetry, and clamped spatial audio
  const wheelRollRef = useRef([0, 0, 0, 0]);

  useFrame((_, delta) => {
    const controller = vehicleControllerRef.current;
    if (!controller) return;

    // Convert speed to MPH (1 m/s = 2.23694 mph)
    const currentSpeed = controller.currentVehicleSpeed();
    const speedMs = Number.isFinite(currentSpeed) ? Math.abs(currentSpeed) : 0;
    const speedMph = Math.round(speedMs * 2.23694);
    if (onSpeedChange) {
      onSpeedChange(speedMph, speedMs);
    }

    // 1. Input smoothing using MathUtils.lerp in the useFrame loop
    // High-speed adaptive steering: At low speeds (0-35 mph), allows full ~0.46 rad (~26°) lock for hairpins.
    // At high speeds (100-150+ mph), dynamically scales down to ~0.16 rad (~9°) for smooth high-speed sweepers without spinouts.
    const speedFactor = THREE.MathUtils.clamp(speedMph / 140, 0, 1);
    const dynamicMaxSteer = THREE.MathUtils.lerp(0.46, 0.16, speedFactor);

    const { left, right } = controlsRef.current;
    let targetSteer = 0;
    if (left) targetSteer += dynamicMaxSteer;
    if (right) targetSteer -= dynamicMaxSteer;

    const steerSmoothingSpeed = 4.8; // Responsive yet gradual transition
    steerAngleRef.current = THREE.MathUtils.lerp(
      steerAngleRef.current,
      targetSteer,
      Math.min(1.0, delta * steerSmoothingSpeed)
    );

    // Apply smoothed steering angle directly to the vehicle controller front wheels
    controller.setWheelSteering(0, steerAngleRef.current);
    controller.setWheelSteering(1, steerAngleRef.current);

    // 2. Artificial Aerodynamic Downforce in useFrame loop:
    // Calculates forward velocity and applies a continuous downward force (negative Y vector)
    // that scales proportionally with speed to keep the vehicle suctioned and planted on the track
    if (chassisRigidBodyRef.current && speedMs > 1.0) {
      const downforce = THREE.MathUtils.clamp(speedMs * 350 + (speedMs * speedMs) * 9.5, 0, 85000);
      chassisRigidBodyRef.current.addForce({ x: 0, y: -downforce, z: 0 }, true);
    }

    // Update target position and full orientation state for cinematic camera tracking
    if (chassisRigidBodyRef.current) {
      const t = chassisRigidBodyRef.current.translation();
      const r = chassisRigidBodyRef.current.rotation();

      if (targetPosRef) {
        targetPosRef.current.set(t.x, t.y, t.z);
      }

      if (vehicleStateRef) {
        vehicleStateRef.current.position.set(t.x, t.y, t.z);
        vehicleStateRef.current.quaternion.set(r.x, r.y, r.z, r.w);
        vehicleStateRef.current.speedMph = speedMph;
      }
    }

    // ==========================================
    // REFACTORED SPATIAL AUDIO PROCESSING
    // ==========================================
    // 1. Continuous Engine Loop: Smoothly clamped pitch without audio glitching
    if (engineAudioRef.current && engineAudioRef.current.isPlaying) {
      let targetPitch = 0.80;
      let targetVolume = 0.35;

      if (matchState === 'countdown') {
        // PRE-RACE ENGINE REVVING ON STARTING GRID:
        // Allow the engine pitch audio to increase when 'W' is pressed so the player can rev their engine
        const isRevving = controlsRef.current.forward;
        if (isRevving) {
          targetPitch = controlsRef.current.boost ? 2.25 : 1.90;
          targetVolume = 0.85;
        } else {
          targetPitch = 0.80;
          targetVolume = 0.35;
        }
      } else {
        // STANDARD RACING DYNAMICS: pitch scales smoothly up to 150+ mph
        targetPitch = THREE.MathUtils.clamp(0.75 + (speedMph / 150) * 1.45, 0.75, 2.35);
        const isThrottling = controlsRef.current.forward || controlsRef.current.backward;
        targetVolume = isThrottling
          ? THREE.MathUtils.clamp(0.70 + (speedMph / 160) * 0.25, 0.70, 0.98)
          : THREE.MathUtils.clamp(0.35 + (speedMph / 160) * 0.25, 0.35, 0.65);
      }

      // Smooth lerp for responsive revving and acoustic pitch stability
      const currentPitch = engineAudioRef.current.playbackRate ?? 1.0;
      const pitchLerpSpeed = matchState === 'countdown' ? (controlsRef.current.forward ? 7.0 : 4.0) : 4.5;
      const lerpedPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, delta * pitchLerpSpeed);
      const safePitch = THREE.MathUtils.clamp(lerpedPitch, 0.75, 2.30);

      if (Number.isFinite(safePitch)) {
        engineAudioRef.current.setPlaybackRate(safePitch);
      }

      // Smooth dynamic volume scaling
      const currentVol = engineAudioRef.current.getVolume();
      const safeVol = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(currentVol, targetVolume, delta * 4.5),
        0.1,
        1.0
      );
      engineAudioRef.current.setVolume(safeVol);
    }

    // 2. Secondary Tire-Screeching Sound Effect: Triggers on high angular velocity (drifting) during racing
    if (skidAudioRef.current && chassisRigidBodyRef.current) {
      const angvel = chassisRigidBodyRef.current.angvel();
      const yawSpeed = Math.abs(angvel.y); // Angular velocity around Y-axis (rad/s)
      const driftThreshold = 1.15; // Threshold in rad/s

      const isHandbrakeSlide = controlsRef.current.handbrake && speedMs > 3.0;
      const isDrifting = matchState === 'racing' && ((yawSpeed > driftThreshold && speedMs > 4.5) || isHandbrakeSlide);

      let targetSkidVolume = 0;
      if (isDrifting) {
        if (!skidAudioRef.current.isPlaying) {
          skidAudioRef.current.play();
        }
        // Scale screech volume and pitch based on drift severity
        const driftSeverity = isHandbrakeSlide ? 0.9 : Math.min(1.0, (yawSpeed - driftThreshold) / 1.3);
        targetSkidVolume = 0.25 + driftSeverity * 0.65; // Volume up to 0.90

        const skidPitch = THREE.MathUtils.clamp(0.95 + driftSeverity * 0.35, 0.9, 1.4);
        skidAudioRef.current.setPlaybackRate(skidPitch);
      }

      // Smooth volume fade-in and fade-out to prevent audio clicking
      const currentSkidVol = skidAudioRef.current.getVolume();
      const fadeSpeed = isDrifting ? 12.0 : 7.0;
      skidAudioRef.current.setVolume(THREE.MathUtils.lerp(currentSkidVol, targetSkidVolume, delta * fadeSpeed));
    }

    // Update wheel mesh visual transforms without allocating array objects
    const rollRate = -controller.currentVehicleSpeed() / wheelRadius;

    wheelsList.forEach((wheel, idx) => {
      if (!wheel) return;

      wheelRollRef.current[idx] += rollRate * delta;

      const suspLength = controller.wheelSuspensionLength(idx) ?? suspensionRestLength;
      const defaultY = 0.34;
      const travelDelta = suspensionRestLength - suspLength;
      wheel.position.y = defaultY + travelDelta;

      if (idx === 0 || idx === 1) {
        wheel.rotation.y = controller.wheelSteering(idx) ?? 0;
      }

      wheel.rotation.x = wheelRollRef.current[idx];
    });
  });

  return (
    <RigidBody
      ref={chassisRigidBodyRef}
      position={position}
      rotation={rotation}
      colliders={false}
      type="dynamic"
      canSleep={false}
      ccd={true}
      linearDamping={0.50}
      angularDamping={7.0}
      onCollisionEnter={handleCollision}
    >
      {/* Explicitly defined vehicle hitbox scaled 5% larger than the visual 3D mesh */}
      {/* Visual mesh dimensions: W: 2.23m, H: 1.172m (from y=0.20 to 1.372m), L: 4.91m */}
      {/* Lowered center of mass significantly on Y-axis (-0.45m) for planted ground-effect physics */}
      <CuboidCollider
        args={[1.171, 0.615, 2.578]}
        position={[0, 0.79, -0.02]}
        massProperties={{
          mass: 1900,
          centerOfMass: { x: 0, y: -0.45, z: 0 },
          principalAngularInertia: { x: 1200, y: 1500, z: 2200 },
          angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
        }}
        friction={0.4}
        restitution={0.05}
      />

      {/* 3D Sports Car Model Visuals */}
      {chassisNode && <primitive object={chassisNode} />}
      {wheelFL && <primitive object={wheelFL} />}
      {wheelFR && <primitive object={wheelFR} />}
      {wheelRL && <primitive object={wheelRL} />}
      {wheelRR && <primitive object={wheelRR} />}

      {/* Spatial Positional Audio: Continuous Engine Sound Loop */}
      <PositionalAudio
        ref={engineAudioRef}
        url="/audio/engine.wav"
        distance={24}
        loop
        autoplay={false}
      />

      {/* Spatial Positional Audio: Secondary Tire-Screeching Sound */}
      <PositionalAudio
        ref={skidAudioRef}
        url="/audio/skid.wav"
        distance={20}
        loop
        autoplay={false}
      />

      {/* Spatial Positional Audio: Metallic Crash Sound Effect */}
      <PositionalAudio
        ref={crashAudioRef}
        url="/audio/crash.wav"
        distance={28}
        loop={false}
        autoplay={false}
      />
    </RigidBody>
  );
}

// Pre-load the sports car GLTF
useGLTF.preload('/models/car.glb');

export default Vehicle;
