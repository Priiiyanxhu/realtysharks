"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Sphere as DreiSphere, Stars, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { supabase } from "@/utils/supabase/client";
import { useInView, useReducedMotion } from "framer-motion";

// Dictionary to map cities to Lat/Lng
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "pune": { lat: 18.5204, lng: 73.8567 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "gurugram": { lat: 28.4595, lng: 77.0266 },
  "noida": { lat: 28.5355, lng: 77.3910 },
  "dubai": { lat: 25.2048, lng: 55.2708 },
  "london": { lat: 51.5074, lng: -0.1278 },
  "singapore": { lat: 1.3521, lng: 103.8198 },
};

function getVertex(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function SynapseLine({ start, end, radius }: { start: {lat: number, lng: number}, end: {lat: number, lng: number}, radius: number }) {
  const points = useMemo(() => {
    const vStart = getVertex(start.lat, start.lng, radius);
    const vEnd = getVertex(end.lat, end.lng, radius);
    
    const distance = vStart.distanceTo(vEnd);
    if (distance < 0.1) return null; // Too close
    
    const mid = vStart.clone().lerp(vEnd, 0.5);
    // Push the arc out
    mid.normalize().multiplyScalar(radius + distance * 0.4);

    const curve = new THREE.QuadraticBezierCurve3(vStart, mid, vEnd);
    return curve.getPoints(30);
  }, [start, end, radius]);

  if (!points) return null;

  return (
    <Line
      points={points}
      color="#D4AF37"
      lineWidth={2}
      transparent
      opacity={0.8}
    />
  );
}

function GlowingNode({ position, isMatch = false }: { position: THREE.Vector3, isMatch?: boolean }) {
  const color = isMatch ? "#FACC15" : "#D4AF37";
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.025, 16, 16]} />
      {/* High emissive intensity for Bloom to pick up */}
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={3} 
        toneMapped={false} 
      />
    </mesh>
  );
}

function ParticleGlobe({ radius }: { radius: number }) {
  // Create a dense cloud of points for the globe surface instead of wireframe
  const points = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    return positions;
  }, [radius]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.015} 
        color="#3B82F6" 
        transparent 
        opacity={0.3} 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
}

function Earth({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 2;
  
  const [locations, setLocations] = useState<{lat: number, lng: number}[]>([]);
  const [synapses, setSynapses] = useState<{start: {lat: number, lng: number}, end: {lat: number, lng: number}}[]>([]);

  useEffect(() => {
    const fetchRealData = async () => {
      // Fetch recent listings to plot hot-spots
      const { data: listings } = await supabase
        .from('listings')
        .select('location') // was 'city', replaced to match listing schema
        .limit(100);
      
      const parsedLocations: {lat: number, lng: number}[] = [];
      if (listings) {
        listings.forEach(l => {
          const c = l.location?.toLowerCase().trim();
          if (c && CITY_COORDINATES[c]) {
            // Add a tiny bit of jitter so same-city nodes don't overlap perfectly
            const jitterLat = CITY_COORDINATES[c].lat + (Math.random() - 0.5) * 0.5;
            const jitterLng = CITY_COORDINATES[c].lng + (Math.random() - 0.5) * 0.5;
            parsedLocations.push({ lat: jitterLat, lng: jitterLng });
          }
        });
      }
      
      // Fallback/Demo data if DB is empty to keep it looking cool
      if (parsedLocations.length < 5) {
        Object.values(CITY_COORDINATES).forEach(coords => {
          parsedLocations.push({ 
            lat: coords.lat + (Math.random() - 0.5) * 0.5, 
            lng: coords.lng + (Math.random() - 0.5) * 0.5 
          });
        });
      }
      
      setLocations(parsedLocations);

      // Generate some active Synapses between these valid nodes
      const activeSynapses = [];
      for (let i = 0; i < Math.min(10, parsedLocations.length / 2); i++) {
        const start = parsedLocations[Math.floor(Math.random() * parsedLocations.length)];
        const end = parsedLocations[Math.floor(Math.random() * parsedLocations.length)];
        activeSynapses.push({ start, end });
      }
      setSynapses(activeSynapses);
    };

    fetchRealData();
  }, []);

  useFrame((state) => {
    if (groupRef.current && !shouldReduceMotion) {
      groupRef.current.rotation.y += 0.0015; // Slow rotation
      // Cinematic subtle float
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05; 
    }
  });

  return (
    <group ref={groupRef}>
      {/* Dense Hologram Point Cloud */}
      <ParticleGlobe radius={radius} />

      {/* Atmospheric Inner Core */}
      <DreiSphere args={[radius * 0.98, 32, 32]}>
        <meshBasicMaterial 
          color="#0B1120" 
        />
      </DreiSphere>

      {/* Real Data Nodes */}
      {locations.map((loc, idx) => (
        <GlowingNode key={`loc-${idx}`} position={getVertex(loc.lat, loc.lng, radius)} />
      ))}

      {/* Active Deal / Match Synapses */}
      {synapses.map((conn, idx) => (
        <SynapseLine key={`conn-${idx}`} start={conn.start} end={conn.end} radius={radius} />
      ))}
    </group>
  );
}

// Camera Fly-In Animation
function Rig({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  useFrame((state) => {
    if (!shouldReduceMotion) {
      // Smoothly animate camera from z=15 to z=5 on load
      state.camera.position.lerp(new THREE.Vector3(0, 0, 5), 0.05);
      state.camera.lookAt(0, 0, 0);
    } else {
      state.camera.position.set(0, 0, 5);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
}

export function MarketSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pause rendering when component is off-screen to save battery
  const isInView = useInView(containerRef, { margin: "200px" });
  
  // Respect accessibility preferences
  const shouldReduceMotion = useReducedMotion();

  // Determine frameloop strategy
  let frameloop: "always" | "demand" | "never" = "always";
  if (!isInView) {
    frameloop = "never"; // Completely freeze background GPU usage
  } else if (shouldReduceMotion) {
    frameloop = "demand"; // Only render on interaction/prop changes
  }

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      {/* Vignette Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_40%,_#0B1120_100%)] opacity-90" />
      
      <Canvas
        camera={{ position: [0, 0, 15], fov: 45 }} // Starts far away for fly-in
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ReinhardToneMapping }}
        frameloop={frameloop}
        dpr={[1, 1.5]} // Limit pixel ratio to 1.5 for heavy mobile optimization
        className="w-full h-full"
      >
        <color attach="background" args={["#0B1120"]} />
        <ambientLight intensity={0.2} />
        
        {/* Cinematic Lighting */}
        <pointLight position={[10, 10, 10]} intensity={0.5} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#D4AF37" />
        <spotLight position={[0, 10, 0]} intensity={2} color="#FACC15" angle={0.5} penumbra={1} />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.5} fade speed={shouldReduceMotion ? 0 : 1} />
        
        {shouldReduceMotion ? (
          <Earth shouldReduceMotion={shouldReduceMotion} />
        ) : (
          <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2}>
            <Earth shouldReduceMotion={shouldReduceMotion} />
          </Float>
        )}
        
        <Rig shouldReduceMotion={shouldReduceMotion} />
        
        {/* Post-Processing Bloom for Liquid Glass / Neon aesthetic */}
        <EffectComposer>
          <Bloom 
            luminanceThreshold={1} 
            mipmapBlur 
            intensity={2.5} 
          />
        </EffectComposer>

        <OrbitControls 
          enableZoom={true} 
          minDistance={3}
          maxDistance={8}
          enablePan={false} 
          autoRotate={!shouldReduceMotion}
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 1.2}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  );
}
