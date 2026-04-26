import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

async function getFaviconDataUri() {
  const filePath = path.join(process.cwd(), 'public', 'fs.png');
  const buffer = await readFile(filePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export default async function Favicon() {
  const dataUri = await getFaviconDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundImage: `url(${dataUri})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
    ),
    {
      ...size,
    }
  );
}
