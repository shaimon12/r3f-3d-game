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
    <>
      {/* 1. Visual ground surface - purely visual scenery so track road is the sole physical floor */}
      <mesh receiveShadow={false} position={[0, -floorThickness / 2, 0]}>
        <boxGeometry args={[width, floorThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Prototyping reference grid */}
      <gridHelper
        args={[width, width / 2, gridColor, '#12161f']}
        position={[0, 0.005, 0]}
      />

      {/* 2. Safety ground floor and four invisible boundary walls around 500x500 world perimeter */}
      <RigidBody name="wall" type="fixed" colliders={false} friction={0.6} restitution={0.2}>
        {/* Sub-surface ground floor beneath asphalt (spanning Y in [-1.0, 0.0]) */}
        <CuboidCollider
          name="ground-floor"
          args={[halfW, 0.5, halfD]}
          position={[0, -0.5, 0]}
        />
        {/* North Wall (+Z) */}
        <CuboidCollider
          name="boundary-wall"
          args={[halfW, wallHeight / 2, wallThickness / 2]}
          position={[0, wallHeight / 2, halfD + wallThickness / 2]}
        />
        {/* South Wall (-Z) */}
        <CuboidCollider
          name="boundary-wall"
          args={[halfW, wallHeight / 2, wallThickness / 2]}
          position={[0, wallHeight / 2, -halfD - wallThickness / 2]}
        />
        {/* East Wall (+X) */}
        <CuboidCollider
          name="boundary-wall"
          args={[wallThickness / 2, wallHeight / 2, halfD]}
          position={[halfW + wallThickness / 2, wallHeight / 2, 0]}
        />
        {/* West Wall (-X) */}
        <CuboidCollider
          name="boundary-wall"
          args={[wallThickness / 2, wallHeight / 2, halfD]}
          position={[-halfW - wallThickness / 2, wallHeight / 2, 0]}
        />
      </RigidBody>
    </>
  );
}

export default Ground;
