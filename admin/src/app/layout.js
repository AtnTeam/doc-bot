import './globals.css';

export const metadata = {
  title: 'Doc AI Bot — Admin',
  description: 'Admin panel for Doc AI Telegram Bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 antialiased">{children}</body>
    </html>
  );
}
