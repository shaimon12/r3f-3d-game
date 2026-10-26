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
  onSpeedChange?: (speedKmh: number) => void;
  targetPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export function Vehicle({
  position = [0, 0.6, 0],
  rotation = [0, 0, 0],
  onSpeedChange,
  targetPosRef,
}: VehicleProps) {
  const chassisRigidBodyRef = useRef<RapierRigidBody>(null);
  const vehicleControllerRef = useRef<RAPIER.DynamicRayCastVehicleController | null>(null);
  const { world } = useRapier();
  const { controlsRef } = useKeyboardControls();

  // Load the generated Toyota Camry GLB model
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

  // Suspension & wheel configuration
  const wheelRadius = 0.33;
  const suspensionRestLength = 0.25;
  const connectionY = 0.55;

  // Wheel attachment points in local coordinates
  const wheelPositions = useMemo(
    () => [
      new RAPIER.Vector3(-0.84, connectionY, -1.38), // Front Left (0)
      new RAPIER.Vector3(0.84, connectionY, -1.38),  // Front Right (1)
      new RAPIER.Vector3(-0.84, connectionY, 1.38),  // Rear Left (2)
      new RAPIER.Vector3(0.84, connectionY, 1.38),   // Rear Right (3)
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
      controller.setWheelSuspensionStiffness(i, 55.0);
      controller.setWheelMaxSuspensionTravel(i, 0.25);
      controller.setWheelFrictionSlip(i, 3.2);
      controller.setWheelSuspensionCompression(i, 4.4);
      controller.setWheelSuspensionRelaxation(i, 2.3);
    }

    vehicleControllerRef.current = controller;

    return () => {
      if (vehicleControllerRef.current) {
        world.removeVehicleController(vehicleControllerRef.current);
        vehicleControllerRef.current = null;
      }
    };
  }, [world, wheelPositions]);

  // Dynamic driving state
  const steerAngleRef = useRef(0);
  const maxSteerAngle = 0.52; // ~30 degrees
  const maxEngineForce = 3400; // Base engine power
  const boostMultiplier = 1.6;
  const maxBrakeForce = 140;

  // Run before each physics step: sample WASD inputs and update Rapier Vehicle Controller
  useBeforePhysicsStep((stepWorld) => {
    const controller = vehicleControllerRef.current;
    const chassis = chassisRigidBodyRef.current;
    if (!controller || !chassis) return;

    const { forward, backward, left, right, handbrake, boost, reset } = controlsRef.current;

    // Reset vehicle on 'R' key
    if (reset) {
      chassis.setTranslation({ x: 0, y: 1.0, z: 0 }, true);
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

    // Smooth steering response
    const steerSpeed = 8.0;
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
      // Accelerating forward
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
          controller.setWheelEngineForce(i, -enginePower * 0.6);
          controller.setWheelBrake(i, 0);
        }
      }
    } else {
      // Rolling friction / coasting
      for (let i = 0; i < 4; i++) {
        controller.setWheelEngineForce(i, 0);
        controller.setWheelBrake(i, 4.0); // Gentle engine drag
      }
    }

    // Handbrake (Space) - Locks rear wheels
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

    // Report current speed in km/h for UI/HUD
    const speedMs = Math.abs(controller.currentVehicleSpeed());
    const speedKmh = Math.round(speedMs * 3.6);
    if (onSpeedChange) {
      onSpeedChange(speedKmh);
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
      const defaultY = 0.33;
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
      linearDamping={0.5}
      angularDamping={2.0}
    >
      {/* Chassis Main Physics Collider */}
      <CuboidCollider
        args={[0.91, 0.35, 2.3]}
        position={[0, 0.55, 0]}
        density={240}
        friction={0.6}
        restitution={0.1}
      />

      {/* 3D Car Model Visuals */}
      {chassisNode && <primitive object={chassisNode} />}
      {wheelFL && <primitive object={wheelFL} />}
      {wheelFR && <primitive object={wheelFR} />}
      {wheelRL && <primitive object={wheelRL} />}
      {wheelRR && <primitive object={wheelRR} />}
    </RigidBody>
  );
}

// Pre-load the car GLTF for instant rendering without hitching
useGLTF.preload('/models/car.glb');

export default Vehicle;
