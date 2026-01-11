"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hindari hydration error
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Cek apakah Supabase sedang redirect email confirmation
  const isSupabaseAuthRedirect =
    searchParams?.get("type") ||
    searchParams?.get("token") ||
    (typeof window !== "undefined" &&
      window.location.hash &&
      window.location.hash.length > 0);

  const hideSidebar =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth") ||
    isSupabaseAuthRedirect;

  if (hideSidebar) {
    return (
      <>
        <Toaster position="top-right" />
        {children}
      </>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
