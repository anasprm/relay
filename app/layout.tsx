import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthProvider';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { UiStyleProvider } from '@/lib/UiStyleProvider';
import { ToastProvider } from '@/lib/ToastProvider';

// -------------------------------------------------------------------------
export const metadata: Metadata = {
  title: {
    default: 'Relay — Secure Workspace Messaging',
    template: '%s · Relay',
  },
  description:
    'Relay is a focused realtime messaging workspace with direct threads, voice and video notes, secure calls, and server-side privacy controls.',
  applicationName: 'Relay',
  authors: [{ name: 'Muhammed Anas.v' }],
  creator: 'Muhammed Anas.v',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0b141a' },
  ],
};

// Inline the bootstrap payload for IndexedDB offline-first hydration.
function bootstrapScript(): string {
  return `(window.__RELAY_BOOTSTRAP__ = ${JSON.stringify({ conversations: [], user: null })});`;
}

const bootstrapPayload = bootstrapScript();

// The actual bootstrap data is injected by the server at build time
// (via next/config or a middleware that replaces this string). For now
// we embed an empty payload so the client cache boots fast without errors.

const themeScript = `
(function () {
  try {
    var host = location.hostname;
    var site =
      host.indexOf('valiyakath') === 0
        ? 'whatsapp'
        : host.indexOf('relay-messengerpro') === 0
          ? 'formal'
          : 'whatsapp';
    document.documentElement.dataset.site = site;

    var storedTheme = localStorage.getItem('relay.theme');
    var dark = storedTheme
      ? storedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    var storedUi = localStorage.getItem('relay.ui');
    var ui =
      storedUi === 'minimal' || storedUi === 'official'
        ? storedUi
        : site === 'formal'
          ? 'minimal'
          : 'official';
    document.documentElement.dataset.ui = ui;
  } catch (error) {}
})();
`;

// -------------------------------------------------------------------------
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootstrapPayload }} />
      </head>
      <body className="min-h-screen bg-app text-ink antialiased">
        <ThemeProvider>
          <UiStyleProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </UiStyleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}