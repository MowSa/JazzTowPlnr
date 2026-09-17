import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './yul-ops.css';

export const metadata: Metadata = {
  title: 'Jazz @ YUL | Montréal Operations',
  description: 'Live Jazz Aviation inbound and outbound operations at Montréal–Trudeau.',
};

export default function YulLayout({ children }: { children: ReactNode }) {
  return children;
}
