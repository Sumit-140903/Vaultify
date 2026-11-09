import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import * as THREE from "three";

/* --------------------------------------------------
   INTERACTIVE 3D VAULT
-------------------------------------------------- */

function VaultModel() {
  const vaultRef = useRef(null);
  const ringRef = useRef(null);
  const outerRingRef = useRef(null);
  const coreRef = useRef(null);

  useFrame((state, delta) => {
    if (vaultRef.current) {
      const targetY =
        state.pointer.x * 0.35 +
        Math.sin(state.clock.elapsedTime * 0.3) * 0.08;

      const targetX = -state.pointer.y * 0.2;

      vaultRef.current.rotation.y = THREE.MathUtils.damp(
        vaultRef.current.rotation.y,
        targetY,
        3,
        delta
      );

      vaultRef.current.rotation.x = THREE.MathUtils.damp(
        vaultRef.current.rotation.x,
        targetX,
        3,
        delta
      );
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.2;
      ringRef.current.rotation.x += delta * 0.08;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.y += delta * 0.13;
      outerRingRef.current.rotation.z -= delta * 0.08;
    }

    if (coreRef.current) {
      coreRef.current.material.emissiveIntensity =
        1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.8;
    }
  });

  return (
    <Float
      speed={1.2}
      floatIntensity={0.22}
      rotationIntensity={0.06}
    >
      <group>
        <mesh
          ref={outerRingRef}
          rotation={[0.8, 0.3, 0]}
        >
          <torusGeometry args={[1.8, 0.012, 12, 140]} />
          <meshBasicMaterial
            color="#327CFF"
            transparent
            opacity={0.8}
          />
        </mesh>

        <mesh
          ref={ringRef}
          rotation={[1.1, 0.2, 0.6]}
        >
          <torusGeometry args={[1.5, 0.018, 12, 120]} />
          <meshBasicMaterial
            color="#A779FF"
            transparent
            opacity={0.9}
          />
        </mesh>

        <group ref={vaultRef}>
          <mesh>
            <icosahedronGeometry args={[1.05, 1]} />
            <meshPhysicalMaterial
              color="#102F76"
              metalness={0.8}
              roughness={0.22}
              transparent
              opacity={0.92}
              emissive="#124DDB"
              emissiveIntensity={0.7}
            />
          </mesh>

          <mesh scale={1.12}>
            <icosahedronGeometry args={[1.05, 1]} />
            <meshBasicMaterial
              color="#62CFFF"
              wireframe
              transparent
              opacity={0.5}
            />
          </mesh>

          <mesh position={[0, 0, 1]}>
            <torusGeometry args={[0.32, 0.04, 16, 64]} />
            <meshStandardMaterial
              color="#68E8FF"
              emissive="#168DFF"
              emissiveIntensity={2.5}
            />
          </mesh>

          <mesh position={[0, 0, 1.03]}>
            <torusGeometry args={[0.19, 0.018, 16, 48]} />
            <meshStandardMaterial
              color="#D2B6FF"
              emissive="#8550FF"
              emissiveIntensity={2}
            />
          </mesh>

          <mesh position={[0, 0, 1.06]}>
            <sphereGeometry args={[0.055, 20, 20]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>

          <mesh position={[0, 0, 1.3]} ref={coreRef}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#80CFFF"
              emissiveIntensity={2}
            />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

/* --------------------------------------------------
   3D VAULT SCENE
-------------------------------------------------- */

export default function VaultScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.1], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.3} />

      <pointLight
        position={[3, 3, 4]}
        intensity={35}
        color="#438BFF"
      />

      <pointLight
        position={[-3, -2, 2]}
        intensity={22}
        color="#984AFF"
      />

      <Stars
        radius={35}
        depth={25}
        count={500}
        factor={2}
        fade
      />

      <VaultModel />
    </Canvas>
  );
}
