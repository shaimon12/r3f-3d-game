import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  useRapier,
  useBeforePhysicsStep,
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';

export interface VehicleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  onSpeedChange?: (speedMph: number, speedMs?: number) => void;
  targetPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export function Vehicle({
  position = [0, 0.6, 60],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
}: VehicleProps) {
  const chassisRigidBodyRef = useRef<RapierRigidBody>(null);
  const vehicleControllerRef = useRef<RAPIER.DynamicRayCastVehicleController | null>(null);
  const { world } = useRapier();
  const { controlsRef } = useKeyboardControls();

  // Load the new Sleek Aerodynamic Sports Car GLB model
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
  const connectionY = 0.35; // Connection point tuned for low center-of-mass & ample ramp clearance

  // Wheel attachment points in local coordinates (wide sports car track)
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
      // Racing suspension: firm spring stiffness, high grip friction slip
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

  // Tuned driving parameters: DOUBLED engine force to 8840 N so it easily clears the inclines
  const steerAngleRef = useRef(0);
  const maxSteerAngle = 0.50; // High-speed sports car steering ratio
  const maxEngineForce = 8840; // DOUBLED (was 4420)
  const boostMultiplier = 1.70; // 15,000 N Turbo
  const maxBrakeForce = 220; // High-performance racing brakes

  // Initial spawn position memory for reset
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

    // Dynamic steering speed: smooth and precise at high speeds
    const steerSpeed = 10.0;
    steerAngleRef.current = THREE.MathUtils.lerp(
      steerAngleRef.current,
      targetSteer,
      stepWorld.timestep * steerSpeed
    );

    // Apply steering to front wheels (0 = FL, 1 = FR)
    controller.setWheelSteering(0, steerAngleRef.current);
    controller.setWheelSteering(1, steerAngleRef.current);

    // Vehicle forward speed (m/s along forward axis)
    const currentSpeed = controller.currentVehicleSpeed();

    // Throttle & Brake logic (W / S)
    const enginePower = boost ? maxEngineForce * boostMultiplier : maxEngineForce;

    if (forward) {
      // Accelerating forward - apply full power to all 4 wheels
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, enginePower);
        controller.setWheelBrake(i, 0);
      }
    } else if (backward) {
      // If moving forward at speed, apply brakes
      if (currentSpeed < -1.0) {
        for (let i = 0; i < 4; i++) {
          controller.setWheelEngineForce(i, 0);
          controller.setWheelBrake(i, maxBrakeForce);
        }
      } else {
        // Reverse gear
        for (let i = 0; i < 4; i++) {
          controller.setWheelEngineForce(i, -enginePower * 0.55);
          controller.setWheelBrake(i, 0);
        }
      }
    } else {
      // Rolling friction / coasting
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, 0);
        controller.setWheelBrake(i, 5.0);
      }
    }

    // Handbrake (Space) - Locks rear wheels for power slides
    if (handbrake) {
      controller.setWheelBrake(2, maxBrakeForce * 2.5);
      controller.setWheelBrake(3, maxBrakeForce * 2.5);
    }

    // Update Rapier vehicle physics
    controller.updateVehicle(stepWorld.timestep);
  });

  // Render loop: Synchronize wheel meshes and camera
  const wheelRollRef = useRef([0, 0, 0, 0]);

  useFrame((_, delta) => {
    const controller = vehicleControllerRef.current;
    if (!controller) return;

    // Convert speed to MPH (1 m/s = 2.23694 mph)
    const speedMs = Math.abs(controller.currentVehicleSpeed());
    const speedMph = Math.round(speedMs * 2.23694);
    if (onSpeedChange) {
      onSpeedChange(speedMph, speedMs);
    }

    // Update target position ref for camera tracking
    if (chassisRigidBodyRef.current && targetPosRef) {
      const t = chassisRigidBodyRef.current.translation();
      targetPosRef.current.set(t.x, t.y, t.z);
    }

    // Update wheel mesh visual transforms
    const wheels = [wheelFL, wheelFR, wheelRL, wheelRR];
    const rollRate = -controller.currentVehicleSpeed() / wheelRadius;

    wheels.forEach((wheel, idx) => {
      if (!wheel) return;

      // Update roll angle around axle
      wheelRollRef.current[idx] += rollRate * delta;

      // Local suspension displacement
      const suspLength = controller.wheelSuspensionLength(idx) ?? suspensionRestLength;
      const defaultY = 0.34;
      const travelDelta = suspensionRestLength - suspLength;
      wheel.position.y = defaultY + travelDelta;

      // Front wheels steering
      if (idx === 0 || idx === 1) {
        wheel.rotation.y = controller.wheelSteering(idx) ?? 0;
      }

      // Wheel spinning rotation
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
      // Low linear damping for blazing speed on straightaways and inclines
      linearDamping={0.22}
      // High angular damping for flight stabilization and smooth ramp landings
      angularDamping={2.8}
    >
      {/* 
        High-Clearance, Low-Center-of-Mass Multi-Collider Design:
        1. Central tub between axles (bottom at Y = 0.22m, mass = 1200kg)
        2. Elevated front nose with high approach angle clearance (bottom at Y = 0.33m, mass = 350kg)
        3. Elevated rear tail with high departure clearance (bottom at Y = 0.32m, mass = 350kg)
        Total Mass: 1900 kg (increased from 1400kg). Center of mass sits low, preventing flips & bottoming out!
      */}
      {/* Central Chassis Tub */}
      <CuboidCollider
        args={[0.85, 0.16, 1.3]}
        position={[0, 0.38, 0]}
        mass={1200}
        friction={0.4}
        restitution={0.02}
      />

      {/* Elevated Front Nose (High approach angle clearance prevents ramp snagging!) */}
      <CuboidCollider
        args={[0.75, 0.12, 0.6]}
        position={[0, 0.45, -1.6]}
        mass={350}
        friction={0.3}
        restitution={0.02}
      />

      {/* Elevated Rear Tail */}
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
    </RigidBody>
  );
}

// Pre-load the sports car GLTF
useGLTF.preload('/models/car.glb');

export default Vehicle;
