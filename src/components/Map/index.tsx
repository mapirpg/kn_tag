'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false });

export function Map() {
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', zIndex: 0 }}>
      <LeafletMap />
    </div>
  );
}