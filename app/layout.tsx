import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synthetic Audience Tester',
  description: 'Test messaging effectiveness against AI-powered buyer personas before spending a dollar on media.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
