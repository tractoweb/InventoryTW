import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

function TractorMark({ stroke = '#2563eb' }: { stroke?: string }) {
  return (
    <svg
      width="360"
      height="360"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20" />
      <path d="M16 18h-5" />
      <path d="M18 5a1 1 0 0 0-1 1v5.573" />
      <path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246" />
      <path d="M4 11V4" />
      <path d="M7 15h.01" />
      <path d="M8 10.1V4" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="7" cy="15" r="5" />
    </svg>
  );
}

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 60px rgba(37, 99, 235, 0.18)',
          }}
        >
          <TractorMark />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
