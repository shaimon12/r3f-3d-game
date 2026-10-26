import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, PositionalAudio } from '@react-three/drei';
import {
  useRapier,
  RigidBody,
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

// Pre-allocated static vectors & quaternions outside render loop to eliminate per-frame GC
const _worldUp = new THREE.Vector3(0, 1, 0);
const _groundNormal = new THREE.Vector3(0, 1, 0);
const _slopeQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _targetPos = new THREE.Vector3();

// Sphere collider radius & wheel dimensions
// Radius 1.2m gives 2.4m width matching sports car footprint, preventing wall tunneling
const SPHERE_RADIUS = 1.2;
const WHEEL_RADIUS = 0.34;
const MAX_FORWARD_SPEED = 150;
const MAX_REVERSE_SPEED = 40;

export function Vehicle({
  position = [-42.5, 2.0, 56],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
  vehicleStateRef,
}: VehicleProps) {
  const matchState = useGameStore((state) => state.matchState);
  const sphereRigidBodyRef = useRef<RapierRigidBody>(null);
  const visualCarRef = useRef<THREE.Group>(null);
  const { world } = useRapier();
  const { controlsRef } = useKeyboardControls();

  // Spatial Audio Refs
  const engineAudioRef = useRef<THREE.PositionalAudio>(null);
  const skidAudioRef = useRef<THREE.PositionalAudio>(null);
  const crashAudioRef = useRef<THREE.PositionalAudio>(null);

  // Crash cooldown tracker to prevent multi-contact frame stuttering
  const lastCrashTimestamp = useRef(0);

  // Vehicle driving & orientation tracking refs
  const yawRef = useRef(rotation[1] || 0);
  const steerAngleRef = useRef(0);
  const forwardSpeedRef = useRef(0);
  const lateralSpeedRef = useRef(0);
  const wheelRollRef = useRef([0, 0, 0, 0]);
  const spawnPos = useRef(position);

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

  // Memoized wheel array for per-frame wheel rotation updates
  const wheelsList = useMemo(
    () => [wheelFL, wheelFR, wheelRL, wheelRR],
    [wheelFL, wheelFR, wheelRL, wheelRR]
  );

  // Browser Autoplay Policy: resume audio context and prepare audio nodes on user interaction
  useEffect(() => {
    if (sphereRigidBodyRef.current) {
      sphereRigidBodyRef.current.enableCcd(true);
    }

    const handleUserInteraction = () => {
      if (engineAudioRef.current) {
        const ctx = engineAudioRef.current.context;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
        if (!engineAudioRef.current.isPlaying) {
          engineAudioRef.current.setVolume(0.4);
          engineAudioRef.current.play();
        }
      }

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
  // Specifically ignores vertical ground contact and triggers only on horizontal wall impacts
  const handleCollision = (payload: CollisionEnterPayload) => {
    const sphere = sphereRigidBodyRef.current;
    if (!sphere) return;

    const now = performance.now();
    if (now - lastCrashTimestamp.current < 250) return;

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

    // IGNORE VERTICAL GROUND CONTACT:
    // If contact normal is predominantly vertical (|normalY| > 0.4), it is contact with the road
    if (!hasNormal || Math.abs(normalY) > 0.4) {
      return;
    }

    const linvel = sphere.linvel();
    const normalSpeed = Math.abs(linvel.x * normalX + linvel.z * normalZ);
    if (normalSpeed < 4.0) {
      return;
    }

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

    const vehicleMass = 1500;
    const kinematicImpulse = vehicleMass * normalSpeed;
    const totalImpactForce = Math.max(kinematicImpulse, maxSolverImpulse);

    // Trigger camera shake on wall collision
    if (vehicleStateRef && totalImpactForce > 12000) {
      const shakeIntensity = THREE.MathUtils.clamp(
        0.35 + (totalImpactForce / 50000) * 0.65,
        0.35,
        1.0
      );
      vehicleStateRef.current.collisionShake = shakeIntensity;
    }

    const minThreshold = 18000;
    const maxForceScale = 65000;

    if (totalImpactForce > minThreshold) {
      lastCrashTimestamp.current = now;

      const normalizedForce = THREE.MathUtils.clamp(
        (totalImpactForce - minThreshold) / (maxForceScale - minThreshold),
        0,
        1
      );
      const crashVolume = THREE.MathUtils.clamp(0.35 + normalizedForce * 0.65, 0.35, 1.0);
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

  // Render loop & Arcade Sphere Movement Driver inside useFrame
  useFrame((_, delta) => {
    const sphere = sphereRigidBodyRef.current;
    const visualCar = visualCarRef.current;
    if (!sphere || !visualCar) return;

    const { forward, backward, left, right, boost, handbrake, reset } = controlsRef.current;

    // Reset vehicle on 'R' key to upright position above track
    if (reset) {
      sphere.setTranslation({ x: spawnPos.current[0], y: 2.0, z: spawnPos.current[2] }, true);
      sphere.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      sphere.setLinvel({ x: 0, y: 0, z: 0 }, true);
      sphere.setAngvel({ x: 0, y: 0, z: 0 }, true);
      yawRef.current = rotation[1] || 0;
      steerAngleRef.current = 0;
      forwardSpeedRef.current = 0;
      lateralSpeedRef.current = 0;
      return;
    }

    const linvel = sphere.linvel();

    // INTERCEPT MOVEMENT INPUTS DURING COUNTDOWN:
    // If matchState is 'countdown', do NOT apply any forces to the vehicle's rigid body
    // until the state changes to 'racing'. Keep horizontal velocity at zero.
    if (matchState === 'countdown') {
      sphere.setLinvel({ x: 0, y: linvel.y, z: 0 }, true);
      sphere.setAngvel({ x: 0, y: 0, z: 0 }, true);
      forwardSpeedRef.current = 0;
      lateralSpeedRef.current = 0;
    } else {
      // 1. Calculate steering angle and update vehicle heading yaw based on A / D input
      const currentSpeed = Math.hypot(linvel.x, linvel.z);
      const speedRatio = THREE.MathUtils.clamp(currentSpeed / MAX_FORWARD_SPEED, 0, 1);

      // Dynamic steering lock: responsive at low speed, tighter lock at high speed for control
      const dynamicMaxSteer = THREE.MathUtils.lerp(0.48, 0.16, speedRatio);
      let targetSteer = 0;
      if (left) targetSteer += dynamicMaxSteer;
      if (right) targetSteer -= dynamicMaxSteer;

      // Smooth steering transitions
      steerAngleRef.current = THREE.MathUtils.lerp(
        steerAngleRef.current,
        targetSteer,
        Math.min(1.0, delta * 10.0)
      );

      // Heading yaw rotation based on steering input
      let turnRate = 0;
      if (currentSpeed < 1.0) {
        // Pivot at rest so player can re-orient vehicle
        if (left) turnRate += 1.35;
        if (right) turnRate -= 1.35;
      } else {
        const speedSign = forwardSpeedRef.current >= -0.5 ? 1 : -1;
        const turnSensitivity = THREE.MathUtils.lerp(2.6, 1.2, speedRatio);
        turnRate = (steerAngleRef.current / dynamicMaxSteer) * turnSensitivity * speedSign;
      }

      if (handbrake && currentSpeed > 3.0) {
        turnRate *= 1.45; // Drift turn assist
      }

      yawRef.current += turnRate * delta;

      // 2. Calculate local forward/backward vector based on heading and WASD input
      const yaw = yawRef.current;
      // In local vehicle space, forward is -Z (0, 0, -1), right is +X (1, 0, 0)
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      // Decompose current velocity along local forward and right vectors
      let vFwd = linvel.x * fwdX + linvel.z * fwdZ;
      let vLat = linvel.x * rightX + linvel.z * rightZ;

      if (forward) {
        // W / ArrowUp: Accelerate forward
        const accelRate = boost ? 260.0 : 180.0;
        vFwd += accelRate * delta;
      } else if (backward) {
        // S / ArrowDown: Active braking if moving forward, else reverse
        if (vFwd > 1.0) {
          const brakeDecel = 85.0;
          vFwd = Math.max(0, vFwd - brakeDecel * delta);
        } else {
          const reverseAccel = 45.0;
          vFwd -= reverseAccel * delta;
        }
      } else {
        // Coasting drag when neither W nor S is pressed
        const coastDecel = 15.0;
        if (vFwd > 0) {
          vFwd = Math.max(0, vFwd - coastDecel * delta);
        } else if (vFwd < 0) {
          vFwd = Math.min(0, vFwd + coastDecel * delta);
        }
      }

      // Handbrake deceleration
      if (handbrake) {
        const handbrakeDecel = 40.0;
        if (vFwd > 0) {
          vFwd = Math.max(0, vFwd - handbrakeDecel * delta);
        }
      }

      // 3. Mathematically clamp the forward velocity magnitude strictly to a maximum of 150,
      // and clamp the reverse velocity strictly to a maximum of 40
      if (vFwd > 0) {
        vFwd = Math.min(MAX_FORWARD_SPEED, vFwd);
      } else if (vFwd < 0) {
        vFwd = Math.max(-MAX_REVERSE_SPEED, vFwd);
      }

      // Lateral tire grip vs drift
      if (handbrake && currentSpeed > 3.0) {
        // Handbrake drift: allow lateral sliding
        vLat = THREE.MathUtils.lerp(vLat, 0, Math.min(1.0, delta * 3.0));
      } else {
        // High tire grip: rapidly eliminate sideways slip so car grips the road
        vLat = THREE.MathUtils.lerp(vLat, 0, Math.min(1.0, delta * 15.0));
      }

      forwardSpeedRef.current = vFwd;
      lateralSpeedRef.current = vLat;

      // Calculate target velocity vector in world coordinates
      let targetVx = vFwd * fwdX + vLat * rightX;
      let targetVz = vFwd * fwdZ + vLat * rightZ;

      // Strict vector magnitude clamp
      const targetSpeed = Math.hypot(targetVx, targetVz);
      const maxAllowedSpeed = vFwd >= 0 ? MAX_FORWARD_SPEED : MAX_REVERSE_SPEED;
      if (targetSpeed > maxAllowedSpeed) {
        const scale = maxAllowedSpeed / targetSpeed;
        targetVx *= scale;
        targetVz *= scale;
      }

      // Move the sphere strictly by applying the target velocity vector via ref.current.setLinvel().
      // Do NOT use setTranslation for driving, preserving the collision solver and CCD against walls.
      // Vertical velocity (linvel.y) is preserved for natural gravity and track slope traversal.
      sphere.setLinvel({ x: targetVx, y: linvel.y, z: targetVz }, true);

      // =========================================================================
      // PRAGMATIC MATHEMATICAL FALLBACK: HORIZONTAL WALL RAYCAST REPULSION
      // =========================================================================
      // Fire short, horizontal raycasts from the sphere's center to the left, right, and front.
      // If a raycast detects the track's wall mesh at a distance shorter than the sphere's
      // radius plus a small buffer, immediately apply an opposing impulse (repulsion force)
      // to the sphere's RigidBody to bounce it away from the wall.
      const currentPos = sphere.translation();
      const sphereCenter = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
      const currentLv = sphere.linvel();

      // Probe directions: Front, Left, Right, Front-Left, Front-Right
      const probeDirs = [
        { x: fwdX, y: 0, z: fwdZ, isFront: true }, // Front
        { x: -rightX, y: 0, z: -rightZ, isFront: false }, // Left
        { x: rightX, y: 0, z: rightZ, isFront: false }, // Right
        { x: (fwdX - rightX) * 0.7071, y: 0, z: (fwdZ - rightZ) * 0.7071, isFront: true }, // Front-Left
        { x: (fwdX + rightX) * 0.7071, y: 0, z: (fwdZ + rightZ) * 0.7071, isFront: true }, // Front-Right
      ];

      const wallBuffer = 0.35;
      const wallThreshold = SPHERE_RADIUS + wallBuffer; // 1.55m
      const maxProbeDist = wallThreshold + 0.6; // 2.15m

      for (let i = 0; i < probeDirs.length; i++) {
        const pDir = probeDirs[i];
        const pRay = new RAPIER.Ray(sphereCenter, { x: pDir.x, y: pDir.y, z: pDir.z });
        const wallHit = world.castRayAndGetNormal(
          pRay,
          maxProbeDist,
          true,
          undefined,
          undefined,
          undefined,
          sphere
        );

        // Verify hit is a vertical wall barrier (|normal.y| < 0.6) and closer than radius + buffer
        if (wallHit && wallHit.timeOfImpact < wallThreshold && Math.abs(wallHit.normal.y) < 0.6) {
          let repX = wallHit.normal.x;
          let repZ = wallHit.normal.z;
          const repLen = Math.hypot(repX, repZ);

          if (repLen > 0.001) {
            repX /= repLen;
            repZ /= repLen;
          } else {
            repX = -pDir.x;
            repZ = -pDir.z;
          }

          // Calculate velocity component heading directly into the wall
          const velIntoWall = -(currentLv.x * repX + currentLv.z * repZ);
          const bounceSpeed = Math.max(22.0, velIntoWall * 1.45);
          const repImpulse = 1500 * bounceSpeed; // Mass * bounce speed

          // Immediately apply opposing impulse (repulsion force) to bounce the sphere away
          sphere.applyImpulse({ x: repX * repImpulse, y: 0, z: repZ * repImpulse }, true);

          // If front wall impact, reverse forward speed reference to rebound naturally
          if (pDir.isFront && forwardSpeedRef.current > 0) {
            forwardSpeedRef.current = Math.min(0, forwardSpeedRef.current * -0.4);
          }

          // Trigger collision shake for cinematic camera feedback
          if (vehicleStateRef) {
            vehicleStateRef.current.collisionShake = Math.max(
              vehicleStateRef.current.collisionShake || 0,
              0.8
            );
          }

          // Trigger metallic crash sound effect with debounce
          const now = performance.now();
          if (crashAudioRef.current && now - lastCrashTimestamp.current > 250) {
            lastCrashTimestamp.current = now;
            const audio = crashAudioRef.current;
            if (audio.context && audio.context.state === 'suspended') {
              audio.context.resume();
            }
            if (audio.isPlaying) audio.stop();
            audio.setVolume(0.85);
            audio.play();
          }

          break; // Process one barrier bounce per frame
        }
      }
    }

    // Telemetry updates
    const currentLinvel = sphere.linvel();
    const speedMs = Math.hypot(currentLinvel.x, currentLinvel.z);
    const speedMph = Math.round(speedMs);

    if (onSpeedChange) {
      onSpeedChange(speedMph, speedMs);
    }

    // 4. Update Loop: Downward Raycast & Ground Normal Hugging
    const spherePos = sphere.translation();
    const rayOrigin = { x: spherePos.x, y: spherePos.y + 0.5, z: spherePos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const maxToi = SPHERE_RADIUS * 2 + 3.0;
    const hit = world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      undefined,
      sphere
    );

    let groundY = spherePos.y - SPHERE_RADIUS;
    if (hit && hit.normal && hit.normal.y > 0.35) {
      groundY = rayOrigin.y - hit.timeOfImpact;
      _groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
    } else {
      _groundNormal.set(0, 1, 0);
    }

    // Constantly update visual car model's position to match the invisible physics sphere's position
    // Wheels sit precisely on the asphalt at groundY, airborne drops follow sphere height
    const visualY = Math.max(groundY, spherePos.y - SPHERE_RADIUS);
    visualCar.position.set(spherePos.x, visualY, spherePos.z);

    // Adjust the visual car's rotation (quaternion) to match the ground normal so it visually hugs the slopes
    _slopeQuat.setFromUnitVectors(_worldUp, _groundNormal);
    _yawQuat.setFromAxisAngle(_worldUp, yawRef.current);
    _targetQuat.copy(_slopeQuat).multiply(_yawQuat);

    // Smooth slerp rotation for fluid banking across curves and slopes
    visualCar.quaternion.slerp(_targetQuat, Math.min(1.0, delta * 15.0));

    // Update target position and orientation for cinematic follow camera & mini-map driver
    if (targetPosRef) {
      _targetPos.copy(visualCar.position);
      targetPosRef.current.copy(_targetPos);
    }

    if (vehicleStateRef) {
      vehicleStateRef.current.position.copy(visualCar.position);
      vehicleStateRef.current.quaternion.copy(visualCar.quaternion);
      vehicleStateRef.current.speedMph = speedMph;
    }

    // Update wheel visual transforms
    const rollSpeed = forwardSpeedRef.current;
    const rollRate = -rollSpeed / WHEEL_RADIUS;

    wheelsList.forEach((wheel, idx) => {
      if (!wheel) return;
      wheelRollRef.current[idx] += rollRate * delta;

      // Front wheels visually turn with smoothed steering angle
      if (idx === 0 || idx === 1) {
        wheel.rotation.y = steerAngleRef.current;
      }
      wheel.rotation.x = wheelRollRef.current[idx];
    });

    // ==========================================
    // SPATIAL AUDIO PROCESSING
    // ==========================================
    // 1. Continuous Engine Audio: Pitch scales with speed or revs during countdown
    if (engineAudioRef.current && engineAudioRef.current.isPlaying) {
      let targetPitch = 0.8;
      let targetVolume = 0.35;

      if (matchState === 'countdown') {
        const isRevving = controlsRef.current.forward;
        if (isRevving) {
          targetPitch = controlsRef.current.boost ? 2.25 : 1.9;
          targetVolume = 0.85;
        } else {
          targetPitch = 0.8;
          targetVolume = 0.35;
        }
      } else {
        targetPitch = THREE.MathUtils.clamp(0.75 + (speedMph / 150) * 1.45, 0.75, 2.35);
        const isThrottling = controlsRef.current.forward || controlsRef.current.backward;
        targetVolume = isThrottling
          ? THREE.MathUtils.clamp(0.7 + (speedMph / 160) * 0.25, 0.7, 0.98)
          : THREE.MathUtils.clamp(0.35 + (speedMph / 160) * 0.25, 0.35, 0.65);
      }

      const currentPitch = engineAudioRef.current.playbackRate ?? 1.0;
      const pitchLerpSpeed =
        matchState === 'countdown' ? (controlsRef.current.forward ? 7.0 : 4.0) : 4.5;
      const lerpedPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, delta * pitchLerpSpeed);
      const safePitch = THREE.MathUtils.clamp(lerpedPitch, 0.75, 2.3);

      if (Number.isFinite(safePitch)) {
        engineAudioRef.current.setPlaybackRate(safePitch);
      }

      const currentVol = engineAudioRef.current.getVolume();
      const safeVol = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(currentVol, targetVolume, delta * 4.5),
        0.1,
        1.0
      );
      engineAudioRef.current.setVolume(safeVol);
    }

    // 2. Secondary Tire-Screeching Audio: Triggers on drifting (handbrake or lateral slide)
    if (skidAudioRef.current) {
      const isHandbrakeSlide = controlsRef.current.handbrake && speedMs > 3.0;
      const latSpeed = Math.abs(lateralSpeedRef.current);
      const isDrifting =
        matchState === 'racing' && ((latSpeed > 2.0 && speedMs > 5.0) || isHandbrakeSlide);

      let targetSkidVolume = 0;
      if (isDrifting) {
        if (!skidAudioRef.current.isPlaying) {
          skidAudioRef.current.play();
        }
        const driftSeverity = isHandbrakeSlide ? 0.9 : Math.min(1.0, (latSpeed - 2.0) / 4.0);
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
      {/* 1. Invisible Arcade Physics Sphere Body: heavy marble with high linear/angular damping */}
      <RigidBody
        ref={sphereRigidBodyRef}
        position={position}
        rotation={rotation}
        colliders="ball"
        type="dynamic"
        canSleep={false}
        ccd={true}
        linearDamping={2.2}
        angularDamping={3.5}
        mass={1500}
        onCollisionEnter={handleCollision}
      >
        <mesh visible={false}>
          <sphereGeometry args={[SPHERE_RADIUS, 16, 16]} />
          <meshBasicMaterial />
        </mesh>
      </RigidBody>

      {/* 3. Decoupled Visuals: 3D car model independent in scene, oriented & positioned in useFrame */}
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

// Pre-load the sports car GLTF
useGLTF.preload('/models/car.glb');

export default Vehicle;
