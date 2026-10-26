interface LightsProps {
  ambientIntensity?: number;
  directionalIntensity?: number;
}

export function Lights({
  ambientIntensity = 0.4,
  directionalIntensity = 1.5,
}: LightsProps) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        castShadow
        position={[15, 25, 10]}
        intensity={directionalIntensity}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0001}
      />
    </>
  );
}

export default Lights;
