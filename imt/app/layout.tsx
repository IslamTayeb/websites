import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Open_Sans } from 'next/font/google';
import { PageviewScript } from '@/components/site/pageview-script';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { siteMetadata } from '@/data/site-metadata';
import './globals.css';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
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

  function themedHarmoniaSrc(src, theme) {
    try {
      var url = new URL(src, window.location.href);
      url.searchParams.set('theme', theme);
      return url.href;
    } catch (_) {
      return src;
    }
  }

  function syncHarmoniaIframes() {
    var theme = currentTheme();
    document
      .querySelectorAll('iframe[data-harmonia-iframe="true"]')
      .forEach(function (iframe) {
        var baseSrc = iframe.getAttribute('data-harmonia-src');

        if (!baseSrc) {
          return;
        }

        var nextSrc = themedHarmoniaSrc(baseSrc, theme);

        if (iframe.getAttribute('src') !== nextSrc) {
          iframe.setAttribute('src', nextSrc);
        }

        if (iframe.getAttribute('data-harmonia-theme') !== theme) {
          iframe.setAttribute('data-harmonia-theme', theme);
        }
      });
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

  if (window.MutationObserver && document.body) {
    new MutationObserver(syncHarmoniaIframes).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncHarmoniaIframes);
  } else {
    syncHarmoniaIframes();
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={openSans.variable}>
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
