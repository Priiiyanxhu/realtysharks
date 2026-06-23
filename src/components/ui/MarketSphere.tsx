"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Sphere as DreiSphere, Stars } from "@react-three/drei";
import * as THREE from "three";

// Helper to convert lat/long to 3D spherical coordinates
function getVertex(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Generate random cities on the globe
const CITIES = Array.from({ length: 40 }).map(() => ({
  lat: (Math.random() - 0.5) * 160,
  lng: (Math.random() - 0.5) * 360,
}));

// Generate active connections (synapses)
const CONNECTIONS = Array.from({ length: 15 }).map(() => {
  const start = CITIES[Math.floor(Math.random() * CITIES.length)];
  const end = CITIES[Math.floor(Math.random() * CITIES.length)];
  return { start, end };
});

function SynapseLine({ start, end, radius }: { start: {lat: number, lng: number}, end: {lat: number, lng: number}, radius: number }) {
  const points = useMemo(() => {
    const vStart = getVertex(start.lat, start.lng, radius);
    const vEnd = getVertex(end.lat, end.lng, radius);
    
    // Determine the midpoint and push it out to create an arc
    const mid = vStart.clone().lerp(vEnd, 0.5);
    const distance = vStart.distanceTo(vEnd);
    // Push midpoint out based on distance between points
    mid.normalize().multiplyScalar(radius + distance * 0.3);

    const curve = new THREE.QuadraticBezierCurve3(vStart, mid, vEnd);
    return curve.getPoints(20);
  }, [start, end, radius]);

  return (
    <Line
      points={points}
      color="#D4AF37"
      lineWidth={1.5}
      transparent
      opacity={0.4}
      dashed={false}
    />
  );
}

function GlowingNode({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.03, 8, 8]} />
      <meshBasicMaterial color="#FACC15" toneMapped={false} />
      <pointLight color="#D4AF37" intensity={2} distance={0.5} />
    </mesh>
  );
}

function Earth() {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 2;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002; // Slow continuous rotation
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.05; // Subtle breathing tilt
    }
  });

  return (
    <group ref={groupRef}>
      {/* Base Dark Globe */}
      <DreiSphere args={[radius, 64, 64]}>
        <meshStandardMaterial 
          color="#050814" 
          transparent 
          opacity={0.9} 
          roughness={0.8}
          metalness={0.2}
          wireframe={true}
          wireframeLinewidth={0.5}
        />
      </DreiSphere>

      {/* Atmospheric Glow */}
      <DreiSphere args={[radius * 1.05, 32, 32]}>
        <meshBasicMaterial 
          color="#D4AF37" 
          transparent 
          opacity={0.03} 
          side={THREE.BackSide}
        />
      </DreiSphere>

      {/* City Nodes */}
      {CITIES.map((city, idx) => (
        <GlowingNode key={`city-${idx}`} position={getVertex(city.lat, city.lng, radius)} />
      ))}

      {/* Synapse Connections */}
      {CONNECTIONS.map((conn, idx) => (
        <SynapseLine key={`conn-${idx}`} start={conn.start} end={conn.end} radius={radius} />
      ))}
    </group>
  );
}

export function MarketSphere() {
  return (
    <div className="w-full h-full relative group">
      {/* Vignette Overlay to blend edges into background */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[#0B1120]" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_#0B1120_100%)] opacity-80" />
      
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        className="w-full h-full"
      >
        <color attach="background" args={["#0B1120"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#D4AF37" />
        
        <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
        
        <Earth />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate={true}
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
