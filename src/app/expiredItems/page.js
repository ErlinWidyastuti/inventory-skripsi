"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pagination from "../../components/Pagination";
import { Search } from "lucide-react";

export default function BarangKadaluarsa() {
  // State data
  const [activeItems, setActiveItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [user, setUser] = useState(null);
  // State pencarian
  const [searchActive, setSearchActive] = useState("");
  const [filteredActiveItems, setFilteredActiveItems] = useState([]);
  const [searchExpired, setSearchExpired] = useState("");
  const [filteredExpiredItems, setFilteredExpiredItems] = useState([]);
  // State pagination
  const [currentPageActive, setCurrentPageActive] = useState(1);
  const [currentPageExpired, setCurrentPageExpired] = useState(1);
  const itemsPerPage = 8;
  // Pagination untuk Active Items
  const indexOfLastActive = currentPageActive * itemsPerPage;
  const indexOfFirstActive = indexOfLastActive - itemsPerPage;
  const currentActiveItems = filteredActiveItems.slice(indexOfFirstActive, indexOfLastActive);
  const totalPagesActive = Math.ceil(filteredActiveItems.length / itemsPerPage);
  // Pagination untuk Expired Items
  const indexOfLastExpired = currentPageExpired * itemsPerPage;
  const indexOfFirstExpired = indexOfLastExpired - itemsPerPage;
  const currentExpiredItems = filteredExpiredItems.slice(indexOfFirstExpired, indexOfLastExpired);
  const totalPagesExpired = Math.ceil(filteredExpiredItems.length / itemsPerPage);
  // State status
  const [error, setError] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const router = useRouter();

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cek user login
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          setError("Sesi tidak valid. Silakan login kembali.");
          return;
        }

        //Mendapatkan detail user
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", authUser.id)
          .single();

        if (userError || !userData) {
          setError("Data pengguna tidak ditemukan.");
          return;
        }
        setUser(userData);

        // Barang aktif (belum kadaluarsa)
        const { data: activeData, error: activeError } = await supabase
          .from("incoming_items")
          .select("*, categories(name), units(name), periods(name), storages(name)")
          .gt("quantity", 0)
          .eq("status", "active")
          .not("expiration_date", "is", null)
          .order("expiration_date", { ascending: true });

        if (activeError) throw activeError;
        setActiveItems(activeData);

        // Barang kadaluarsa
        const { data: expiredData, error: expiredError } = await supabase
          .from("expired_items")
          .select("*, categories(name), units(name), periods(name), storages(name)")
          .order("expired_at", { ascending: false });

        if (expiredError) throw expiredError;
        setExpiredItems(expiredData);

        setSessionLoading(false);
      } catch (err) {
        setError("Terjadi kesalahan: " + err.message);
      }
    };

    fetchData();
  }, [router]);

  // Search untuk Active Items
  useEffect(() => {
    if (searchActive.trim() === "") { // Jika input pencarian kosong, maka akan menampilkan seluruh data barang yang masih aktif
      setFilteredActiveItems(activeItems);
    } else {
      const keyword = searchActive.toLowerCase(); //Ubah keyword ke huruf kecil saat melakukan pencarian
      const results = activeItems.filter((item) => {
        const itemName = item.name?.toLowerCase() || "";
        const label = item.label?.toLowerCase() || "";
        const categoryName = item.categories?.name?.toLowerCase() || "";
        const unitName = item.units?.name?.toLowerCase() || "";
        const periodName = item.periods?.name?.toLowerCase() || "";
        const storageName = item.storages?.name?.toLowerCase() || "";
        const expirationDate = item.expiration_date
          ? new Date(item.expiration_date).toLocaleDateString("id-ID").toLowerCase()
          : "";
        // cek apakah keyword terdapat pada field
        return (
          itemName.includes(keyword) ||
          label.includes(keyword) ||
          categoryName.includes(keyword) ||
          unitName.includes(keyword) ||
          periodName.includes(keyword) ||
          storageName.includes(keyword) ||
          expirationDate.includes(keyword)
        );
      });
      setFilteredActiveItems(results);
      setCurrentPageActive(1); // kembali ke halaman pertama ketika dilakukan pencarian
    }
  }, [searchActive, activeItems]);

  // Search untuk Expired Items
  useEffect(() => {
    if (searchExpired.trim() === "") {  // Jika input pencarian kosong, maka akan menampilkan seluruh data barang yang sudah kadaluarsa
      setFilteredExpiredItems(expiredItems);
    } else {
      const keyword = searchExpired.toLowerCase(); //Ubah keyword ke huruf kecil saat melakukan pencarian
      const results = expiredItems.filter((item) => {
        const itemName = item.name?.toLowerCase() || "";
        const label = item.label?.toLowerCase() || "";
        const categoryName = item.categories?.name?.toLowerCase() || "";
        const unitName = item.units?.name?.toLowerCase() || "";
        const periodName = item.periods?.name?.toLowerCase() || "";
        const storageName = item.storages?.name?.toLowerCase() || "";
        const expirationDate = item.expiration_date
          ? new Date(item.expiration_date).toLocaleDateString("id-ID").toLowerCase()
          : "";

        // cek apakah keyword terdapat pada field
        return (
          itemName.includes(keyword) ||
          label.includes(keyword) ||
          categoryName.includes(keyword) ||
          unitName.includes(keyword) ||
          periodName.includes(keyword) ||
          storageName.includes(keyword) ||
          expirationDate.includes(keyword)
        );
      });
      setFilteredExpiredItems(results);
      setCurrentPageExpired(1); // kembali ke halaman pertama ketika dilakukan pencarian
    }
  }, [searchExpired, expiredItems]);

  // Jika masih loading session, tampilkan loading
  if (sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Menampilkan pesan error, jika terdapat error
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

  return (
    <div className="min-h-screen flex bg-gray-100">
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Barang Kadaluarsa - Selamat Datang, {user?.username}!
        </h1>

        {/* Tabel Active Items */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Daftar Barang (Belum Kadaluarsa)</h2>
          <div className="relative flex-1 max-w-sm">
            {/* fitur search untuk tabel active_items */}
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              value={searchActive}
              onChange={(e) => setSearchActive(e.target.value)}
              placeholder="Cari ..." 
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* kondisi jika tidak terdapat data barang yang masih aktif */}
          {activeItems.length === 0 ? (
            <p className="text-gray-700">Tidak ada barang yang belum kadaluarsa.</p>
          ) : filteredActiveItems.length === 0 ? (
            // kondisi jika hasil pencarian tidak ditemukan
            <div className="mt-2 text-gray-600 text-sm text-center">
              <>Tidak terdapat data ditemukan</>
            </div>
          ) : (
            <>
              <table className="w-full table-auto mt-4 mb-4">
                <thead>
                  <tr className="bg-gray-200 text-gray-700">
                    <th className="px-4 py-2 text-left">Nama Barang</th>
                    <th className="px-4 py-2 text-left">Kode Barang</th>
                    <th className="px-4 py-2 text-left">Kategori</th>
                    <th className="px-4 py-2 text-left">Jumlah</th>
                    <th className="px-4 py-2 text-left">Satuan</th>
                    <th className="px-4 py-2 text-left">Periode</th>
                    <th className="px-4 py-2 text-left">Lokasi Penyimpanan</th>
                    <th className="px-4 py-2 text-left">Tanggal Kadaluarsa</th>
                  </tr>
                </thead>
                <tbody>
                  {currentActiveItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-2 text-gray-700">{item.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.label}</td>
                      <td className="px-4 py-2 text-gray-700">{item.categories.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-2 text-gray-700">{item.units.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.periods.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.storages.name}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {new Date(item.expiration_date).toLocaleDateString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPageActive}
                totalPages={totalPagesActive}
                onPageChange={(page) => setCurrentPageActive(Math.max(1, Math.min(page, totalPagesActive)))}
              />
              <div className="mt-2 text-gray-600 text-sm text-center">
                <>Menampilkan {indexOfFirstActive + 1} s/d {Math.min(indexOfLastActive, filteredActiveItems.length)} dari {filteredActiveItems.length} data</>
              </div>
            </>
          )}
        </div>

        {/* Tabel Expired Items */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Daftar Barang Kadaluarsa</h2>
          <div className="relative flex-1 max-w-sm">
            {/* fitur search untuk tabel expired_items */}
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              value={searchExpired}
              onChange={(e) => setSearchExpired(e.target.value)}
              placeholder="Cari ..." 
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* kondisi jika tidak terdapat data barang yang sudah kadaluarsa*/}
          {expiredItems.length === 0 ? (
            <p className="text-gray-700">Tidak ada barang kadaluarsa.</p>
          ) : filteredExpiredItems.length === 0 ? (
            // kondisi jika hasil pencarian tidak ditemukan
            <div className="mt-2 text-gray-600 text-sm text-center">
              <>Tidak terdapat data ditemukan</>
            </div>
          ) : (
            <>
              <table className="w-full table-auto mt-4 mb-4">
                <thead>
                  <tr className="bg-gray-200 text-gray-700">
                    <th className="px-4 py-2 text-left">Nama Barang</th>
                    <th className="px-4 py-2 text-left">Kode Barang</th>
                    <th className="px-4 py-2 text-left">Kategori</th>
                    <th className="px-4 py-2 text-left">Jumlah</th>
                    <th className="px-4 py-2 text-left">Satuan</th>
                    <th className="px-4 py-2 text-left">Periode</th>
                    <th className="px-4 py-2 text-left">Lokasi Penyimpanan</th>
                    <th className="px-4 py-2 text-left">Tanggal Kadaluarsa</th>
                  </tr>
                </thead>
                <tbody>
                  {currentExpiredItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-2 text-gray-700">{item.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.label}</td>
                      <td className="px-4 py-2 text-gray-700">{item.categories.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-2 text-gray-700">{item.units.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.periods.name}</td>
                      <td className="px-4 py-2 text-gray-700">{item.storages.name}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {new Date(item.expiration_date).toLocaleDateString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPageExpired}
                totalPages={totalPagesExpired}
                onPageChange={(page) => setCurrentPageExpired(Math.max(1, Math.min(page, totalPagesExpired)))}
              />
              <div className="mt-2 text-gray-600 text-sm text-center">
                Menampilkan {indexOfFirstExpired + 1} s/d {Math.min(indexOfLastExpired, filteredExpiredItems.length)} dari {filteredExpiredItems.length} data
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}