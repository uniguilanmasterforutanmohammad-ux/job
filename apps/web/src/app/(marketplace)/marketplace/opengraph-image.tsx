import { ImageResponse } from 'next/og';

export const alt = 'بازارگاه محصولات و خدمات اصناف';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2';

let cachedFont: Promise<ArrayBuffer | null> | null = null;

function loadFont() {
  cachedFont ??= fetch(FONT_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);
  return cachedFont;
}

export default async function Image() {
  const font = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #0f1c4d 0%, #1f42f5 55%, #06b6d4 100%)',
          color: 'white',
          fontFamily: font ? 'Vazirmatn' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
            }}
          >
            🛍
          </div>
          بازارگاه
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, lineHeight: 1.35, fontWeight: 700 }}>
            محصولات و خدمات همهٔ اصناف، یک‌جا
          </div>
          <div style={{ fontSize: 32, opacity: 0.85 }}>
            خرید از فروشگاه‌ها و رزرو کلاس‌ها و خدمات — مستقیم از خود کسب‌وکار
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 26, opacity: 0.9 }}>
          <span>محصولات</span>
          <span>•</span>
          <span>خدمات</span>
          <span>•</span>
          <span>کسب‌وکارها</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: 'Vazirmatn', data: font, style: 'normal' as const, weight: 700 as const }]
        : undefined,
    },
  );
}
