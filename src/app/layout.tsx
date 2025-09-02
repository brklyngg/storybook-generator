import './globals.css';
import type { Metadata } from 'next';

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
      <body className="font-sans">{children}</body>
    </html>
  );
}