import { useState, useEffect } from 'react';

export interface OrientationState {
  alpha: number | null; // Z-axis rotation [0,360)
  beta: number | null;  // X-axis rotation [-180,180) - Front/back tilt
  gamma: number | null; // Y-axis rotation [-90,90) - Left/right tilt
}

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<OrientationState>({
    alpha: null,
    beta: null,
    gamma: null,
  });

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      });
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  return orientation;
}
