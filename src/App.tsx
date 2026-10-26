import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sky, ContactShadows } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from './components/canvas/Ground';
import { Lights } from './components/canvas/Lights';
import { Vehicle } from './components/canvas/Vehicle';
import { Track } from './components/canvas/Track';
import { CameraController, type VehicleState } from './components/canvas/CameraController';
import { HUD } from './components/ui/HUD';
import './App.css';

/**
 * High-resolution contact shadow that dynamically tracks directly underneath the sports car.
 */
function VehicleContactShadow({
  vehicleStateRef,
}: {
  vehicleStateRef: React.MutableRefObject<VehicleState>;
}) {
  const shadowGroupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (shadowGroupRef.current) {
      const pos = vehicleStateRef.current.position;
      // Position contact shadow directly below current car coordinates
      shadowGroupRef.current.position.set(pos.x, Math.max(0.02, pos.y - 0.28), pos.z);
    }
  });

  return (
    <group ref={shadowGroupRef}>
      <ContactShadows
        opacity={0.92}
        scale={8.5}
        blur={1.6}
        far={5}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}

export function App() {
  const [speedMph, setSpeedMph] = useState(0);
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow');

  // Shared reactive state ref for vehicle position, orientation quaternion, and velocity
  const vehicleStateRef = useRef<VehicleState>({
    position: new THREE.Vector3(0, 0.6, 60),
    quaternion: new THREE.Quaternion(),
    speedMph: 0,
  });

  const toggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'follow' ? 'orbit' : 'follow'));
  };

  return (
    <div className="canvas-container">
      {/* 2D Interactive Game HUD with Top-Left MPH Speedometer */}
      <HUD
        speedMph={speedMph}
        cameraMode={cameraMode}
        onToggleCamera={toggleCameraMode}
      />

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 4.5, 68], fov: 52 }}
        dpr={[1, 2]}
      >
        {/* Realistic Sunset HDRI Environment & Reflections (Replaced basic ambient light) */}
        <Environment background preset="sunset" />

        {/* Atmosphere & Sky enhancement */}
        <Sky
          sunPosition={[140, 25, -60]}
          turbidity={8}
          rayleigh={4}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />

        {/* Directional Sun Light matching Sunset HDRI */}
        <Lights directionalIntensity={1.8} />

        {/* Contact Shadows directly under the entire Track & Ramps */}
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.8}
          scale={220}
          blur={2.2}
          far={25}
          resolution={1024}
          color="#000000"
        />

        {/* Contact Shadows directly under the moving Sports Car */}
        <VehicleContactShadow vehicleStateRef={vehicleStateRef} />

        {/* Cinematic Follow-Camera using lerp to trail smoothly behind & above */}
        <CameraController mode={cameraMode} vehicleStateRef={vehicleStateRef} />

        {/* Rapier Physics Simulation with variable timeStep to eliminate physics jitter */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            {/* 500x500 Ground Plane with 4 Invisible Perimeter Boundary Walls */}
            <Ground size={[500, 500]} color="#141820" gridColor="#2a3444" />

            {/* Stylized Race Track with Mega Launch Ramp & Static Trimesh Colliders */}
            <Track />

            {/* Aerodynamic Sports Car with Doubled Engine Force & Tuned Rigid Body */}
            <Vehicle
              position={[0, 0.6, 60]}
              onSpeedChange={(mph) => setSpeedMph(mph)}
              vehicleStateRef={vehicleStateRef}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
