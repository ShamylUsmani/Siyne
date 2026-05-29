import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import CityCanvas from '@/components/CityCanvas';

export const metadata: Metadata = {
  title: 'Siyne — Professional Networking',
  description: 'Professional networking, without the noise.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved theme before React hydrates — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('siyne-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}` }} />
      </head>
      <body>
        {/* global fixed canvas */}
        <div style={{ position: 'fixed', inset: 0, zIndex: -20, pointerEvents: 'none' }}>
          <CityCanvas />
        </div>
        {/* page overlay — changes colour in light mode via CSS var */}
        <div style={{ position: 'fixed', inset: 0, zIndex: -10, pointerEvents: 'none', background: 'var(--page-ov)' }} />

        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
