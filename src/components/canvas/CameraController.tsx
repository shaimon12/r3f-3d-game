import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface CameraControllerProps {
  mode: 'follow' | 'orbit';
  targetPosRef: React.MutableRefObject<THREE.Vector3>;
}

export function CameraController({ mode, targetPosRef }: CameraControllerProps) {
  const { camera } = useThree();
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const currentLookAt = useRef(new THREE.Vector3(0, 0.6, 0));

  useFrame((_, delta) => {
    const target = targetPosRef.current;

    if (mode === 'follow') {
      // Third-person chase camera positioned slightly behind and above vehicle
      const idealOffset = new THREE.Vector3(0, 3.8, 8.5);
      const idealLookAt = new THREE.Vector3(target.x, target.y + 0.8, target.z);

      const targetCamPos = new THREE.Vector3().copy(target).add(idealOffset);

      // Smooth camera interpolation
      camera.position.lerp(targetCamPos, delta * 4.5);
      currentLookAt.current.lerp(idealLookAt, delta * 6.0);
      camera.lookAt(currentLookAt.current);

      if (orbitRef.current) {
        orbitRef.current.target.copy(currentLookAt.current);
      }
    } else {
      // Free orbit mode: update orbit controls target to track the vehicle smoothly
      if (orbitRef.current) {
        currentLookAt.current.lerp(new THREE.Vector3(target.x, target.y + 0.6, target.z), delta * 5.0);
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
      maxDistance={40}
    />
  );
}

export default CameraController;
