import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/lib/providers';

export const metadata: Metadata = {
  title: {
    default: 'پلتفرم مدیریت کسب‌وکار',
    template: '%s | پلتفرم مدیریت کسب‌وکار',
  },
  description:
    'پلتفرم جامع و ماژولار مدیریت کسب‌وکارهای خدماتی و تک‌شغلی: مشتری، نوبت، مالی، حضور و غیاب، پیام و گزارش.',
  applicationName: 'Business Platform',
};

export const viewport: Viewport = {
  themeColor: '#1f42f5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
