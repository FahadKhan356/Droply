import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';

export const metadata: Metadata = {
  title: 'DROPly - Local P2P High-Speed File Fabric',
  description:
    'Ultra high-speed local network peer-to-peer file transfer suite.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface flex text-on-surface">
        {/* Global Desktop Sidebar */}
        <Sidebar />

        {/* Main Application Area */}
        <div className="flex-1 ml-72 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-8 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
