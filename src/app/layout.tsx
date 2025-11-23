import './globals.css';
import type { Metadata } from 'next';
import { Outfit, Inter } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AI Children\'s Picture Book Generator',
  description: 'Transform any story into a beautifully illustrated children\'s picture book using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}