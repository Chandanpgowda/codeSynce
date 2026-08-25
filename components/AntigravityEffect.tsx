'use client';

import dynamic from 'next/dynamic';

// three.js/WebGL must run client-side only
const Antigravity = dynamic(() => import('@/components/reactbits/Antigravity'), {
  ssr: false,
  loading: () => null
});

export default function AntigravityEffect() {
  return (
    <div style={{ width: '1080px', height: '1080px', position: 'relative' }}>
      <Antigravity
        count={300}
        magnetRadius={10}
        ringRadius={10}
        waveSpeed={0.4}
        waveAmplitude={1}
        particleSize={2}
        lerpSpeed={0.1}
        color="#FF9FFC"
        autoAnimate={false}
        particleVariance={1}
        rotationSpeed={0}
        depthFactor={1}
        pulseSpeed={3}
        particleShape="capsule"
        fieldStrength={10}
      />
    </div>
  );
}
