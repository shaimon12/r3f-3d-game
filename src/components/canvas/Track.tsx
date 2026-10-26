import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';

export function Track() {
  const { scene } = useGLTF('/models/track.glb');
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <RigidBody type="fixed" colliders="trimesh" friction={1.2} restitution={0.1}>
      <primitive object={clonedScene} />
    </RigidBody>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
