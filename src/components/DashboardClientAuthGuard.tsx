"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardClientAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Client-side: try to fetch instances; if 401 redirect to /login
    async function check() {
      try {
        const res = await fetch('/api/instances');
        if (res.status === 401) router.push('/login');
      } catch (e) {
        // network or server error; allow client to handle
      }
    }
    check();
  }, [router]);

  return <>{children}</>;
}
