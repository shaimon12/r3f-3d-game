import { useMemo } from 'react';
import { useGLTF, BakeShadows } from '@react-three/drei';
import { RigidBody, MeshCollider, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

/**
 * Professional Formula 1 Grand Prix Circuit.
 * - Stops using trimesh for the outer barriers to eliminate high-speed wall tunneling.
 * - Uses trimesh strictly for the drivable road floor (Simplified_Collision_Mesh).
 * - Instantiates thick, invisible <CuboidCollider> bumpers along perimeter edges of the track.
 */
export function Track() {
  const { scene } = useGLTF('/models/track.glb');
  const { visualScene, roadMesh } = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });

    // Extract the dedicated road collision mesh for drivable trimesh
    const scm = s.getObjectByName('Simplified_Collision_Mesh') as THREE.Mesh | null;
    let roadClone: THREE.Mesh | null = null;
    if (scm) {
      scm.visible = false;
      roadClone = scm.clone();
      roadClone.visible = false;
    }

    return { visualScene: s, roadMesh: roadClone };
  }, [scene]);

  return (
    <>
      {/* Bake static shadows for track elements */}
      <BakeShadows />

      {/* Visual track model (asphalt, rumble strips, tire barriers, armco, gantry) */}
      <primitive object={visualScene} />

      {/* Physical Track Colliders: Drivable road floor trimesh + Thick Invisible Perimeter Bumpers */}
      <RigidBody
        type="fixed"
        colliders={false}
        friction={1.2}
        restitution={0.1}
      >
        {/* Road surface trimesh: smooth drivable asphalt, no thin barrier meshes */}
        {roadMesh && (
          <MeshCollider type="trimesh">
            <primitive object={roadMesh} />
          </MeshCollider>
        )}

        {/* =========================================================================
            THICK INVISIBLE PERIMETER CONCRETE WALL BUMPERS
            Massive 10m-thick physical concrete walls that the car cannot skip through
           ========================================================================= */}
        {/* North Perimeter Wall (+Z) */}
        <CuboidCollider args={[110, 10, 5]} position={[20, 5, 119]} />
        {/* South Perimeter Wall (-Z) */}
        <CuboidCollider args={[110, 10, 5]} position={[20, 5, -119]} />
        {/* West Perimeter Wall (-X) */}
        <CuboidCollider args={[5, 10, 130]} position={[-60, 5, 0]} />
        {/* East Perimeter Wall (+X) */}
        <CuboidCollider args={[5, 10, 130]} position={[100, 5, 0]} />

        {/* Diagonal Corner Bumpers */}
        <CuboidCollider args={[25, 10, 5]} position={[95, 5, 110]} rotation={[0, -Math.PI / 4, 0]} />
        <CuboidCollider args={[25, 10, 5]} position={[-50, 5, 105]} rotation={[0, Math.PI / 4, 0]} />
        <CuboidCollider args={[25, 10, 5]} position={[-45, 5, -105]} rotation={[0, -Math.PI / 4, 0]} />
        <CuboidCollider args={[25, 10, 5]} position={[85, 5, -105]} rotation={[0, Math.PI / 4, 0]} />
      </RigidBody>
    </>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
