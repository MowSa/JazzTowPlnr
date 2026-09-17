import type { Metadata } from 'next';
import './globals.css';
import { ArrivalToastHost } from '@/components/yul-ops/arrival-toasts';

export const metadata: Metadata = {
  title: 'JazzTow | Operations Console',
  icons: { icon: { url: '/favicon.svg?v=2', type: 'image/svg+xml' } },
  description:
    'Aircraft tow planning, gate verification and overnight operations.',
};

const THEME_BOOTSTRAP = `(function(){try{if(localStorage.getItem('jazztow-theme')!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <ArrivalToastHost />
      </body>
    </html>
  );
}
