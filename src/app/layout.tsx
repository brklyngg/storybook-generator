import './globals.css';
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Storybook - Create Beautiful Picture Books',
  description: 'Transform any story into a beautifully illustrated children\'s picture book using AI. Sign in to save your creations.',
  openGraph: {
    title: 'Storybook - Create Beautiful Picture Books',
    description: 'Transform any story into a beautifully illustrated children\'s picture book using AI',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
