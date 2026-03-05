'use client';

import { useAuth } from '@/lib/useAuth';
import Sidebar from './Sidebar';

export default function AdminLayout({ children }) {
  const ready = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
