import { useEffect, useMemo } from 'react';
import { useGLTF, BakeShadows } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

/**
 * Professional Formula 1 Grand Prix Circuit.
 * - Traverses all loaded GLTF nodes and wraps each individual mesh in its own
 *   <RigidBody colliders="trimesh" type="fixed">.
 * - Guarantees every wall, barrier, curb, and floor segment gets physical geometry in Rapier.
 * - Preserves the perimeter bumpers as an outer safety boundary.
 */
export function Track() {
  const { scene } = useGLTF('/models/track.glb');

  // The Blindness Fix: calculate and console.log the exact bounding box size of the Track model
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log('🏁 [BOUNDING BOX] Track Model (Track.tsx):', {
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
    });
  }, [scene]);

  // Traverse loaded GLTF scene & nodes, extracting every individual mesh with its world transform
  const trackMeshes = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        // Hide dedicated collision mesh so asphalt texture renders cleanly
        if (mesh.name === 'Simplified_Collision_Mesh') {
          mesh.visible = false;
        }

        // Bake world transforms directly into mesh position/quaternion/scale
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        mesh.getWorldQuaternion(worldQuat);
        mesh.getWorldScale(worldScale);

        mesh.position.copy(worldPos);
        mesh.quaternion.copy(worldQuat);
        mesh.scale.copy(worldScale);
        mesh.updateMatrix();

        meshes.push(mesh);
      }
    });

    return meshes;
  }, [scene]);

  return (
    <>
      {/* Bake static shadows for track elements */}
      <BakeShadows />

      {/* Individual Trimesh Rigid Bodies for every single wall, barrier, and floor mesh */}
      {trackMeshes.map((mesh, index) => (
        <RigidBody
          key={mesh.uuid || index}
          name={mesh.name || `track-mesh-${index}`}
          type="fixed"
          colliders="trimesh"
          friction={0}
        >
          <primitive object={mesh} />
        </RigidBody>
      ))}

      {/* =========================================================================
          TIGHT OUTER PERIMETER BUMPERS
          Extreme outer boundary safety walls along the track perimeter.
         ========================================================================= */}
      <RigidBody
        name="wall"
        type="fixed"
        colliders={false}
        friction={0.1}
      >
        {/* North Perimeter Wall (+Z: outer edge beyond max Z = 114) */}
        <CuboidCollider name="wall" args={[76, 2, 2]} position={[20, 2, 118]} />
        {/* South Perimeter Wall (-Z: outer edge beyond min Z = -114) */}
        <CuboidCollider name="wall" args={[76, 2, 2]} position={[20, 2, -118]} />
        {/* West Perimeter Wall (-X: outer edge beyond min X = -55) */}
        <CuboidCollider name="wall" args={[2, 2, 118]} position={[-58, 2, 0]} />
        {/* East Perimeter Wall (+X: outer edge beyond max X = 95) */}
        <CuboidCollider name="wall" args={[2, 2, 118]} position={[98, 2, 0]} />
      </RigidBody>
    </>
  );
}

useGLTF.preload('/models/track.glb');

export default Track;
