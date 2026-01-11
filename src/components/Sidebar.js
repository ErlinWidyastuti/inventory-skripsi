"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase-config";
import {
  Package,
  LayoutDashboard,
  User,
  ChartBarDecreasingIcon,
  PencilRuler,
  CalendarRange,
  Warehouse,
  StretchHorizontal,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  ShoppingCart,
  AlertTriangle,
  LogOut } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch role
  const fetchUserRole = async () => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      setRole(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (error || !data) {
      console.error("Error fetching user role:", error?.message);
      setRole(null);
    } else {
      setRole(data.role);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUserRole();

    // Listen perubahan session (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Sementara loading → jangan render sidebar dulu
  if (loading) return null;

  // Kalau tidak ada role (belum login) → jangan render sidebar
  if (!role) return null;

  const menuItems = [
    { label: "Beranda", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
    ...(role === "admin"
      ? [
          { label: "User", href: "/users", icon: <User size={18} /> },
          { label: "Kategori", href: "/categories", icon: <ChartBarDecreasingIcon size={18} /> },
          { label: "Satuan", href: "/units", icon: <PencilRuler size={18} /> },
          { label: "Periode", href: "/periods", icon: <CalendarRange size={18} /> },
          { label: "Lokasi Penyimpanan", href: "/storages", icon: <Warehouse size={18} /> },
          { label: "Daftar Barang", href: "/items", icon: <StretchHorizontal size={18} /> },
          { label: "Barang Masuk", href: "/incomingItems", icon: <AlignVerticalJustifyStart size={18} /> },
          { label: "Barang Keluar", href: "/outgoingItems", icon: <AlignVerticalJustifyEnd size={18} /> },
          { label: "Usulan Pengadaan Barang", href: "/procurements", icon: <ShoppingCart size={18} /> },
          { label: "Barang Kadaluarsa", href: "/expiredItems", icon: <AlertTriangle size={18} /> },
        ]
      : [
          { label: "Daftar Barang", href: "/items", icon: <StretchHorizontal size={18} /> },
          { label: "Barang Keluar", href: "/outgoingItems", icon: <AlignVerticalJustifyEnd size={18} /> },
          { label: "Usulan Pengadaan Barang", href: "/procurements", icon: <ShoppingCart size={18} /> },
          { label: "Barang Kadaluarsa", href: "/expiredItems", icon: <AlertTriangle size={18} /> },
        ]),
  ];

  return (
    <div className="w-64 bg-white shadow-md h-screen flex flex-col">
      <div className="p-2 flex-1">

        {/* Header Sidebar */}
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg">
            <Package className="h-7 w-7 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground leading-tight">
              Sistem Inventaris
            </h2>
            <p className="text-xs text-sidebar-foreground/70">
              & Perencanaan Pengadaan Barang
            </p>
          </div>
        </div>

        {/* Navigation Sidebar */}
        <nav>
          <ul>
            {menuItems.map((item) => (
              <li key={item.href} className="mb-1">
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out
                    hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
                    ${
                      pathname === item.href
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border-l-2 border-sidebar-primary"
                        : ""
                    }`}
                >
                  <span
                    className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${
                      pathname === item.href
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/70"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate group-hover:font-bold">{item.label}</span>
                  {pathname === item.href && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                  )}
                </Link>
              </li>

            ))}
          </ul>
        </nav>
      </div>
      <div className="p-6">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium 
                    bg-red-100 text-red-600 
                    hover:bg-red-700 hover:text-white 
                    transition-all duration-200 ease-in-out"
        >
          <LogOut size={18} className="h-4 w-4 transition-transform duration-200" />
          <span className="truncate group-hover:scale-110">Logout</span>
        </button>
      </div>
    </div>
  );
}