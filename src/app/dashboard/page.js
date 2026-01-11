"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import {
  Package,
  User,
  ChartBarDecreasingIcon,
  PencilRuler,
  CalendarRange,
  Warehouse,
  StretchHorizontal,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  ShoppingCart,
  AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cek User Login
        const {data: { user: authUser }, error: authError} = await supabase.auth.getUser();
        if (authError || !authUser) {
          console.error("Auth error:", authError?.message);
          setError("Sesi tidak valid. Silakan login kembali.");
          router.push("/");
          return;
        }

        // Mendapatkan detail user
        const { data, error } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", authUser.id)
          .single();

        if (error || !data) {
          console.error("Error fetching user:", error?.message);
          setError("Data pengguna tidak ditemukan. Silakan login ulang.");
          router.push("/");
          return;
        }

        setUser(data);

        // Ambil data count
        const newCounts = {};

        // Barang Masuk
        const { count: totalIncoming } = await supabase
          .from("incoming_items")
          .select("*", { count: "exact", head: true });
        newCounts["incoming_items_all"] = totalIncoming ?? 0;

        // Daftar Barang
        const { count: activeItems } = await supabase
          .from("incoming_items")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .gt("quantity", 0);
        newCounts["incoming_items_active"] = activeItems ?? 0;

        // Tabel lain
        const tables = [
          "categories",
          "periods",
          "storages",
          "units",
          "users",
          "expired_items",
          "procurements",
          "outgoing_items",
        ];

        for (const table of tables) {
          if (table === "procurements" && data.role !== "admin") {
            // User → hanya hitung pengadaan miliknya
            const { count } = await supabase
              .from("procurements")
              .select("*", { count: "exact", head: true })
              .eq("requested_by", data.id); // filter by user login
            newCounts[table] = count ?? 0;
          } else {
            // Admin → hitung semua data
            const { count } = await supabase
              .from(table)
              .select("*", { count: "exact", head: true });
            newCounts[table] = count ?? 0;
          }
        }

        setCounts(newCounts);
        
        setLoading(false);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setError("Terjadi kesalahan: " + err.message);
        router.push("/");
      }
    };
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-red-500">{error}</p>
          <Link href="/" className="text-blue-500 hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  // Card items (pakai `key` untuk mapping ke counts)
  const cardItems = [
    ...(user?.role === "admin"
      ? [
          { label: "User", key: "users", href: "/users", icon: <User size={40} /> },
          { label: "Kategori", key: "categories", href: "/categories", icon: <ChartBarDecreasingIcon size={35} /> },
          { label: "Satuan", key: "units", href: "/units", icon: <PencilRuler size={35} /> },
          { label: "Periode", key: "periods", href: "/periods", icon: <CalendarRange size={35} /> },
          { label: "Lokasi Penyimpanan", key: "storages", href: "/storages", icon: <Warehouse size={35} /> },
          { label: "Daftar Barang", key: "incoming_items_active", href: "/items", icon: <StretchHorizontal size={35} /> },
          { label: "Barang Masuk", key: "incoming_items_all", href: "/incomingItems", icon: <AlignVerticalJustifyStart size={35} /> },
          { label: "Barang Keluar", key: "outgoing_items", href: "/outgoingItems", icon: <AlignVerticalJustifyEnd size={35} /> },
          { label: "Usulan Pengadaan Barang", key: "procurements", href: "/procurements", icon: <ShoppingCart size={35} /> },
          { label: "Barang Kadaluarsa", key: "expired_items", href: "/expiredItems", icon: <AlertTriangle size={35} /> }
        ]
      : [
          { label: "Daftar Barang", key: "incoming_items_active", href: "/items", icon: <StretchHorizontal size={35} /> },
          { label: "Barang Keluar", key: "outgoing_items", href: "/outgoingItems", icon: <AlignVerticalJustifyEnd size={35} /> },
          { label: "Usulan Pengadaan Barang", key: "procurements", href: "/procurements", icon: <ShoppingCart size={35} /> },
          { label: "Barang Kadaluarsa", key: "expired_items", href: "/expiredItems", icon: <AlertTriangle size={35} /> }
        ]),
  ];

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Selamat Datang, {user?.username}!
          </h1>
        </div>

        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-black/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">
                Sistem Inventaris dan Perencanaan Pengadaan Barang
              </h3>
              <p className="text-sm text-muted-foreground">
                Dashboard Sistem Inventaris dan Perencanaan Pengadaan Barang. Role anda saat ini sebagai {user.role}.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {cardItems.map((item) => (
            <div key={item.href} className="mb-2">
              <Link href={item.href} className="group block">
                <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 group-hover:translate-y-[-2px] group-hover:scale-[1.02]">
                  {/* Background Gradient */}
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"/>
                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                      {/* Icon Placeholder */}
                      <div className="flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:text-primary">
                        <span className="text-lg font-bold">{item.icon}</span>
                      </div>

                      {/* Label + Count */}
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-card-foreground/80 transition-colors duration-300 group-hover:text-card-foreground">{item.label}</h3>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-2xl font-bold text-card-foreground transition-all duration-300 group-hover:scale-110">{counts[item.key] ?? 0}</span>
                          <span className="text-sm font-medium text-muted-foreground">Data</span>
                        </div>
                      </div>
                    </div>

                    {/* Hover indicator */}
                    <div className="absolute bottom-0 left-0 h-1 w-0 bg-blue-300 transition-all duration-300 group-hover:w-full"/>
                  </div>
                </Link>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}