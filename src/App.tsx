import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from './components/canvas/Ground';
import { Lights } from './components/canvas/Lights';
import { Vehicle } from './components/canvas/Vehicle';
import { Track } from './components/canvas/Track';
import { CameraController } from './components/canvas/CameraController';
import { HUD } from './components/ui/HUD';
import './App.css';

export function App() {
  const [speedMph, setSpeedMph] = useState(0);
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow');
  const vehiclePosRef = useRef(new THREE.Vector3(0, 0.6, 60));

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
        camera={{ position: [0, 4.5, 69], fov: 50 }}
        dpr={[1, 2]}
      >
        {/* Sky Atmosphere & Background */}
        <color attach="background" args={['#0b0f17']} />
        <fog attach="fog" args={['#0b0f17', 70, 260]} />
        <Sky
          sunPosition={[140, 40, 100]}
          turbidity={6}
          rayleigh={3}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />

        {/* Scene Lighting */}
        <Lights ambientIntensity={0.55} directionalIntensity={1.9} />

        {/* Dynamic Follow / Free Orbit Camera Controller */}
        <CameraController mode={cameraMode} targetPosRef={vehiclePosRef} />

        {/* Rapier Physics Simulation with variable timeStep to eliminate physics jitter */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            {/* 500x500 Ground Plane with 4 Invisible Perimeter Boundary Walls */}
            <Ground size={[500, 500]} color="#141820" gridColor="#232d3d" />

            {/* Stylized Race Track with Mega Launch Ramp & Static Trimesh Colliders */}
            <Track />

            {/* High-Performance Vehicle (Spawned on Start Line at Z = 60) */}
            <Vehicle
              position={[0, 0.6, 60]}
              onSpeedChange={(mph) => setSpeedMph(mph)}
              targetPosRef={vehiclePosRef}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
