import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'JazzTow | Operations Console',
  icons: { icon: { url: '/favicon.svg?v=2', type: 'image/svg+xml' } },
  description:
    'Aircraft tow planning, gate verification and overnight operations.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
