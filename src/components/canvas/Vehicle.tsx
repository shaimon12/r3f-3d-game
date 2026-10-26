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
import type { VehicleState } from './CameraController';

export interface VehicleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  onSpeedChange?: (speedMph: number, speedMs?: number) => void;
  targetPosRef?: React.MutableRefObject<THREE.Vector3>;
  vehicleStateRef?: React.MutableRefObject<VehicleState>;
}

export function Vehicle({
  position = [-42.5, 0.6, 56],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
  vehicleStateRef,
}: VehicleProps) {
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
      controller.setWheelSuspensionStiffness(i, 68.0);
      controller.setWheelMaxSuspensionTravel(i, 0.30);
      controller.setWheelFrictionSlip(i, 4.0);
      controller.setWheelSuspensionCompression(i, 5.2);
      controller.setWheelSuspensionRelaxation(i, 3.0);
    }

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
  const handleCollision = (payload: CollisionEnterPayload) => {
    const chassis = chassisRigidBodyRef.current;
    if (!chassis) return;

    const now = performance.now();
    // 120ms debounce to prevent multiple triggers from consecutive manifold contacts
    if (now - lastCrashTimestamp.current < 120) return;

    // Linear velocity vector of vehicle
    const linvel = chassis.linvel();
    const speed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);

    // Collision normal impact velocity
    let normalSpeed = speed;
    try {
      const normal = payload.manifold.normal();
      if (normal) {
        normalSpeed = Math.abs(linvel.x * normal.x + linvel.y * normal.y + linvel.z * normal.z);
      }
    } catch {
      normalSpeed = speed;
    }

    // Check contact impulse from solver if available
    let maxImpulse = 0;
    try {
      const numContacts = payload.manifold.numContacts();
      for (let i = 0; i < numContacts; i++) {
        const imp = payload.manifold.contactImpulse(i) || 0;
        if (imp > maxImpulse) maxImpulse = imp;
      }
    } catch {
      maxImpulse = 0;
    }

    // Vehicle mass = 1900 kg. Calculate impact impulse force: J = m * deltaV
    const vehicleMass = 1900;
    const velocityForce = vehicleMass * Math.max(normalSpeed, speed * 0.45);
    const totalImpactForce = Math.max(velocityForce, maxImpulse);

    // Minimum impact threshold: 5500 N*s (approx 6.5 mph hard impact into barrier/wall)
    const minThreshold = 5500;
    const maxForceScale = 42000; // Force of high-speed ~50+ mph crash

    if (totalImpactForce > minThreshold) {
      lastCrashTimestamp.current = now;

      // Scale volume dynamically based on impact force (from 0.25 for a solid bump up to 1.0 for a hard crash)
      const normalizedForce = THREE.MathUtils.clamp(
        (totalImpactForce - minThreshold) / (maxForceScale - minThreshold),
        0,
        1
      );
      const crashVolume = THREE.MathUtils.clamp(0.25 + normalizedForce * 0.75, 0.25, 1.0);

      // Randomize pitch slightly (0.92 to 1.08) for acoustic variation on repeated impacts
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
  const maxSteerAngle = 0.50;
  const maxEngineForce = 8840; // Doubled engine force
  const boostMultiplier = 1.70;
  const maxBrakeForce = 220;

  const spawnPos = useRef(position);

  // Run before each physics step: sample WASD inputs and update Rapier Vehicle Controller
  useBeforePhysicsStep((stepWorld) => {
    const controller = vehicleControllerRef.current;
    const chassis = chassisRigidBodyRef.current;
    if (!controller || !chassis) return;

    const { forward, backward, left, right, handbrake, boost, reset } = controlsRef.current;

    // Reset vehicle on 'R' key to upright position above track
    if (reset) {
      chassis.setTranslation({ x: spawnPos.current[0], y: 1.0, z: spawnPos.current[2] }, true);
      chassis.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
      steerAngleRef.current = 0;
      return;
    }

    // Steering input (A / D)
    let targetSteer = 0;
    if (left) targetSteer += maxSteerAngle;
    if (right) targetSteer -= maxSteerAngle;

    const steerSpeed = 10.0;
    steerAngleRef.current = THREE.MathUtils.lerp(
      steerAngleRef.current,
      targetSteer,
      stepWorld.timestep * steerSpeed
    );

    controller.setWheelSteering(0, steerAngleRef.current);
    controller.setWheelSteering(1, steerAngleRef.current);

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
      // Calculate target pitch and strictly clamp to safe acoustic envelope [0.75, 2.30]
      const targetPitch = THREE.MathUtils.clamp(0.75 + (speedMph / 60) * 1.30, 0.75, 2.30);

      // Smooth lerp to prevent abrupt frequency jumps
      const currentPitch = engineAudioRef.current.playbackRate ?? 1.0;
      const lerpedPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, delta * 4.5);
      const safePitch = THREE.MathUtils.clamp(lerpedPitch, 0.75, 2.30);

      if (Number.isFinite(safePitch)) {
        engineAudioRef.current.setPlaybackRate(safePitch);
      }

      // Smooth dynamic volume scaling
      const isThrottling = controlsRef.current.forward || controlsRef.current.backward;
      const targetVolume = isThrottling
        ? THREE.MathUtils.clamp(0.70 + (speedMph / 120) * 0.25, 0.70, 0.95)
        : THREE.MathUtils.clamp(0.35 + (speedMph / 120) * 0.25, 0.35, 0.60);

      const currentVol = engineAudioRef.current.getVolume();
      const safeVol = THREE.MathUtils.clamp(THREE.MathUtils.lerp(currentVol, targetVolume, delta * 4.0), 0.1, 1.0);
      engineAudioRef.current.setVolume(safeVol);
    }

    // 2. Secondary Tire-Screeching Sound Effect: Triggers on high angular velocity (drifting)
    if (skidAudioRef.current && chassisRigidBodyRef.current) {
      const angvel = chassisRigidBodyRef.current.angvel();
      const yawSpeed = Math.abs(angvel.y); // Angular velocity around Y-axis (rad/s)
      const driftThreshold = 1.15; // Threshold in rad/s

      const isHandbrakeSlide = controlsRef.current.handbrake && speedMs > 3.0;
      const isDrifting = (yawSpeed > driftThreshold && speedMs > 4.5) || isHandbrakeSlide;

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

    // Update wheel mesh visual transforms
    const wheels = [wheelFL, wheelFR, wheelRL, wheelRR];
    const rollRate = -controller.currentVehicleSpeed() / wheelRadius;

    wheels.forEach((wheel, idx) => {
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
      linearDamping={0.22}
      angularDamping={2.8}
      onCollisionEnter={handleCollision}
    >
      {/* Central Chassis Tub Collider */}
      <CuboidCollider
        args={[0.85, 0.16, 1.3]}
        position={[0, 0.38, 0]}
        mass={1200}
        friction={0.4}
        restitution={0.02}
      />

      {/* Elevated Front Nose Collider */}
      <CuboidCollider
        args={[0.75, 0.12, 0.6]}
        position={[0, 0.45, -1.6]}
        mass={350}
        friction={0.3}
        restitution={0.02}
      />

      {/* Elevated Rear Tail Collider */}
      <CuboidCollider
        args={[0.80, 0.14, 0.6]}
        position={[0, 0.46, 1.6]}
        mass={350}
        friction={0.3}
        restitution={0.02}
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
