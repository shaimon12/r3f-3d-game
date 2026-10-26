import { RigidBody } from '@react-three/rapier';

export interface GroundProps {
  size?: [number, number];
  color?: string;
  gridColor?: string;
}

/**
 * Basic static ground plane with a rigid body collider.
 * Uses a cuboid collider for stability and prevents physics objects from tunneling.
 */
export function Ground({
  size = [100, 100],
  color = '#252d3d',
  gridColor = '#3a475e',
}: GroundProps) {
  const [width, depth] = size;
  const thickness = 1;

  return (
    <RigidBody type="fixed" colliders="cuboid" friction={1} restitution={0.2}>
      {/* Visual ground surface */}
      <mesh receiveShadow position={[0, -thickness / 2, 0]}>
        <boxGeometry args={[width, thickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Prototyping reference grid positioned slightly above floor to prevent z-fighting */}
      <gridHelper
        args={[width, width / 2, gridColor, '#1b222d']}
        position={[0, 0.005, 0]}
      />
    </RigidBody>
  );
}

export default Ground;
