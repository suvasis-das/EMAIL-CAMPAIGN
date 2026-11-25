import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Mailqueue — Email Campaign Console',
  description: 'Lead management, template editor, campaign queue, and SMTP delivery monitor.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
        <AuthProvider>
          <div className="min-h-screen flex flex-col md:flex-row">
            <Sidebar />
            <main className="flex-1 min-w-0">
              <div className="max-w-6xl mx-auto px-5 sm:px-8 py-7">
                {children}
              </div>
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
