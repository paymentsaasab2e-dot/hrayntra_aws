import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

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
          background: '#0891b2',
          color: '#ffffff',
          fontSize: 6,
          fontWeight: 700,
          borderRadius: 6,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        CON
      </div>
    ),
    {
      ...size,
    }
  );
}
