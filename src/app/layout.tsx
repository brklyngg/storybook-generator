import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Source_Serif_4, DM_Sans } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-ui',
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
      <body className={`${playfair.variable} ${sourceSerif.variable} ${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}