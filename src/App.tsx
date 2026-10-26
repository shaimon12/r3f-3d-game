import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from './components/canvas/Ground';
import { Lights } from './components/canvas/Lights';
import { Vehicle } from './components/canvas/Vehicle';
import { CameraController } from './components/canvas/CameraController';
import { HUD } from './components/ui/HUD';
import './App.css';

export function App() {
  const [speed, setSpeed] = useState(0);
  const [cameraMode, setCameraMode] = useState<'follow' | 'orbit'>('follow');
  const vehiclePosRef = useRef(new THREE.Vector3(0, 0.6, 0));

  const toggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'follow' ? 'orbit' : 'follow'));
  };

  return (
    <div className="canvas-container">
      {/* 2D Interactive Game HUD */}
      <HUD
        speed={speed}
        cameraMode={cameraMode}
        onToggleCamera={toggleCameraMode}
      />

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 4.5, 9], fov: 50 }}
        dpr={[1, 2]}
      >
        {/* Sky Atmosphere & Background */}
        <color attach="background" args={['#0d1117']} />
        <fog attach="fog" args={['#0d1117', 40, 120]} />
        <Sky
          sunPosition={[120, 30, 80]}
          turbidity={7}
          rayleigh={4}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />

        {/* Scene Lighting */}
        <Lights ambientIntensity={0.5} directionalIntensity={1.8} />

        {/* Dynamic / Orbit Camera Controller */}
        <CameraController mode={cameraMode} targetPosRef={vehiclePosRef} />

        {/* Rapier Physics Simulation */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            {/* Ground Plane with Static RigidBody Collider */}
            <Ground size={[160, 160]} color="#1e2430" gridColor="#334155" />

            {/* Player Controlled Toyota Camry with Vehicle Physics */}
            <Vehicle
              position={[0, 0.6, 0]}
              onSpeedChange={setSpeed}
              targetPosRef={vehiclePosRef}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
