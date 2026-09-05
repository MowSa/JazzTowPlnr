import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'JazzTow | Daily tow planner',icons:{icon:'/favicon.svg'},description:'Turn a flight schedule into a reviewed, printable aircraft tow sheet.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
