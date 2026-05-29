import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import BackgroundCanvas from '@/components/BackgroundCanvas';

export const metadata: Metadata = {
  title: 'Siyne',
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
        <AuthProvider>
          <ThemeProvider>
            {/* background canvas — inside ThemeProvider so it can read bgTheme */}
            <div style={{ position: 'fixed', inset: 0, zIndex: -20, pointerEvents: 'none' }}>
              <BackgroundCanvas />
            </div>
            {/* page overlay — changes colour in light mode via CSS var */}
            <div style={{ position: 'fixed', inset: 0, zIndex: -10, pointerEvents: 'none', background: 'var(--page-ov)' }} />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
