import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sentinel Trading Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1a1f 50%, #0a0a0a 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'linear-gradient(rgba(0,200,200,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,200,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,200,200,0.15) 0%, transparent 70%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 80,
          height: 80,
          borderRadius: 16,
          border: '2px solid rgba(0,200,200,0.3)',
          background: 'rgba(0,200,200,0.08)',
          marginBottom: 24,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgb(0,200,200)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 64,
          fontWeight: 700,
          color: '#f0f0f0',
          letterSpacing: '-0.02em',
        }}
      >
        Sentinel
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 24,
          fontWeight: 400,
          color: 'rgba(0,200,200,0.8)',
          marginTop: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}
      >
        Trading Platform
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          color: 'rgba(200,200,200,0.5)',
          marginTop: 20,
        }}
      >
        Autonomous stock trading command center
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: 4,
          background: 'linear-gradient(90deg, transparent, rgba(0,200,200,0.6), transparent)',
          display: 'flex',
        }}
      />
    </div>,
    { ...size },
  );
}
