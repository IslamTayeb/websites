import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Open_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { PageviewScript } from '@/components/site/pageview-script';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { siteMetadata } from '@/data/site-metadata';
import './globals.css';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

// Open Sans has no U+2192. These subsets hold only IBM Plex Sans's arrow (under 1 KB each).
// Loading them through next/font preloads them like Open Sans, so the arrow is ready at first
// paint instead of swapping in a frame later and nudging the title's width.
const plexArrow = localFont({
  variable: '--font-plex-arrow',
  src: [
    {
      path: '../public/static/fonts/ibm-plex-sans-arrow-400.woff2',
      weight: '400',
    },
    {
      path: '../public/static/fonts/ibm-plex-sans-arrow-600.woff2',
      weight: '600',
    },
    {
      path: '../public/static/fonts/ibm-plex-sans-arrow-700.woff2',
      weight: '700',
    },
  ],
  display: 'block',
  preload: true,
  fallback: [],
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+2192' }],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.url),
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.title}`,
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    shortcut: [{ url: '/favicon.ico', sizes: '32x32' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: siteMetadata.title,
    url: siteMetadata.url,
    siteName: siteMetadata.title,
    type: 'website',
    images: [siteMetadata.socialImage],
  },
  twitter: {
    card: 'summary',
    title: siteMetadata.title,
    images: [siteMetadata.socialImage],
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d5d1c7' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

const themeInitScript = `
(function () {
  function currentTheme() {
    return document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  }

  var harmoniaOrigin = 'https://islamtayeb.github.io';

  // Harmonia embeds restyle themselves from a postMessage, so a theme change
  // never reloads them. Each embed announces itself once its plot is drawn.
  function postHarmoniaTheme(iframe) {
    var theme = currentTheme();
    iframe.setAttribute('data-harmonia-theme', theme);

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ harmoniaTheme: theme }, harmoniaOrigin);
    }
  }

  function syncHarmoniaIframes() {
    document
      .querySelectorAll('iframe[data-harmonia-iframe="true"]')
      .forEach(postHarmoniaTheme);
  }

  try {
    var saved = window.localStorage.getItem('theme');
    var theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }

  window.__syncHarmoniaIframes = syncHarmoniaIframes;

  window.addEventListener('message', function (event) {
    if (
      event.origin !== harmoniaOrigin ||
      !event.data ||
      event.data.harmoniaReady !== true
    ) {
      return;
    }

    document
      .querySelectorAll('iframe[data-harmonia-iframe="true"]')
      .forEach(function (iframe) {
        if (iframe.contentWindow === event.source) {
          postHarmoniaTheme(iframe);
        }
      });
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${openSans.variable} ${plexArrow.variable}`}
    >
      <body className="font-sans text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div data-testid="site-page" className="site-page flex flex-col px-5">
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </div>
        {process.env.NODE_ENV === 'production' && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
        <PageviewScript />
      </body>
    </html>
  );
}
