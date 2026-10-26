import { RigidBody, CuboidCollider } from '@react-three/rapier';

export interface GroundProps {
  size?: [number, number];
  color?: string;
  gridColor?: string;
}

/**
 * Static ground plane expanded to 500x500 units.
 * Features 4 invisible static rigid-body boundary walls around the perimeter
 * to prevent vehicles from falling off the edge.
 */
export function Ground({
  size = [500, 500],
  color = '#181d26',
  gridColor = '#2b3648',
}: GroundProps) {
  const [width, depth] = size;
  const halfW = width / 2; // 250
  const halfD = depth / 2; // 250
  const floorThickness = 1;
  const wallHeight = 25; // 25 units tall boundary walls
  const wallThickness = 4; // Thick walls prevent tunneling at high speeds

  return (
    <RigidBody type="fixed" colliders={false} friction={1.0} restitution={0.1}>
      {/* 1. Ground floor collider */}
      <CuboidCollider
        args={[halfW, floorThickness / 2, halfD]}
        position={[0, -floorThickness / 2, 0]}
      />

      {/* 2. Four invisible boundary walls around perimeter */}
      {/* North Wall (+Z) */}
      <CuboidCollider
        args={[halfW, wallHeight / 2, wallThickness / 2]}
        position={[0, wallHeight / 2, halfD + wallThickness / 2]}
      />
      {/* South Wall (-Z) */}
      <CuboidCollider
        args={[halfW, wallHeight / 2, wallThickness / 2]}
        position={[0, wallHeight / 2, -halfD - wallThickness / 2]}
      />
      {/* East Wall (+X) */}
      <CuboidCollider
        args={[wallThickness / 2, wallHeight / 2, halfD]}
        position={[halfW + wallThickness / 2, wallHeight / 2, 0]}
      />
      {/* West Wall (-X) */}
      <CuboidCollider
        args={[wallThickness / 2, wallHeight / 2, halfD]}
        position={[-halfW - wallThickness / 2, wallHeight / 2, 0]}
      />

      {/* Visual ground surface - shadows disabled on distant 500x500 scenery to eliminate GPU lag */}
      <mesh receiveShadow={false} position={[0, -floorThickness / 2, 0]}>
        <boxGeometry args={[width, floorThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Prototyping reference grid */}
      <gridHelper
        args={[width, width / 2, gridColor, '#12161f']}
        position={[0, 0.005, 0]}
      />
    </RigidBody>
  );
}

export default Ground;
