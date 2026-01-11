"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pagination from "../../components/Pagination";
import { Download, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {drawHeader, TableStyle} from "@/components/TableStyle";

export default function BarangKeluar() {
  // State data
  const [outgoingItems, setOutgoingItems] = useState([]);
  const [items, setItems] = useState([]);
  // State user & auth
  const [currentUser, setCurrentUser] = useState(null);
  // State pencarian dan filter unduh data
  const [searchQuery, setSearchQuery] = useState(""); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredOutgoingItems, setFilteredOutgoingItems] = useState([]);
  // State pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOutgoingItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOutgoingItems.length / itemsPerPage);
  // State status
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  // State UI kontrol
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cek user login
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          console.error("Auth error:", authError?.message);
          setError("Sesi tidak valid. Silakan login kembali.");
          return;
        }

        // Ambil data user
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", authUser.id)
          .single();
        if (userError || !userData) {
          console.error("Error fetching user:", userError?.message);
          setError("Data pengguna tidak ditemukan.");
          return;
        }
        setCurrentUser(userData);

        // Ambil data barang keluar
        const { data: outgoingData, error: outgoingError } = await supabase
          .from("outgoing_items")
          .select("*, incoming_items(*, categories(name), units(name), periods(name), storages(name)), users(username)")
          .order("taken_at", { ascending: false });
        if (outgoingError) throw outgoingError;

        setOutgoingItems(outgoingData);
        setFilteredOutgoingItems(outgoingData);

        setSessionLoading(false);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setError("Terjadi kesalahan: " + err.message);
      }
    };
    fetchData();
  }, [router]);

  // Filter untuk melakukan pencarian data
  useEffect(() => {
    const keywordLower = searchQuery.toLowerCase();
    const results = outgoingItems.filter((item) => {
      const itemName = item.incoming_items?.name?.toLowerCase() || "";
      const label = item.incoming_items?.label?.toLowerCase() || "";
      const category = item.incoming_items?.categories?.name?.toLowerCase() || "";
      const unit = item.incoming_items?.units?.name?.toLowerCase() || "";
      const storage = item.incoming_items?.storages?.name?.toLowerCase() || "";
      const period = item.incoming_items?.periods?.name?.toLowerCase() || "";
      const user = item.users?.username?.toLowerCase() || "";
      const quantity = String(item.quantity || "").toLowerCase();
      const takenDate = item.taken_at 
        ? new Date(item.taken_at).toLocaleDateString("id-ID").toLowerCase() 
        : "";
      const incomingDate = item.incoming_items?.incoming_date
        ? new Date(item.incoming_items.incoming_date).toLocaleDateString("id-ID").toLowerCase()
        : "";
      const expirationDate = item.incoming_items?.expiration_date
        ? new Date(item.incoming_items.expiration_date).toLocaleDateString("id-ID").toLowerCase()
        : "";

      return (
        itemName.includes(keywordLower) ||
        label.includes(keywordLower) ||
        category.includes(keywordLower) ||
        unit.includes(keywordLower) ||
        storage.includes(keywordLower) ||
        period.includes(keywordLower) ||
        user.includes(keywordLower) ||
        quantity.includes(keywordLower) ||
        takenDate.includes(keywordLower) ||
        incomingDate.includes(keywordLower) ||
        expirationDate.includes(keywordLower)
      );
    });
    setFilteredOutgoingItems(results);
    setCurrentPage(1); // reset ke halaman 1 setiap kali search berubah
  }, [searchQuery, outgoingItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  // Fungsi unduh data dengan format PDF
  const handleDownload = () => {
    let dataToDownload = outgoingItems;

    // Filter berdasarkan rentang tanggal
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate + "T00:00:00") : null;
      const end = endDate ? new Date(endDate + "T23:59:59") : null;

      dataToDownload = dataToDownload.filter((item) => {
        const itemDate = new Date(item.taken_at);
        if (isNaN(itemDate.getTime())) return false;

        const afterStart = start ? itemDate >= start : true;
        const beforeEnd = end ? itemDate <= end : true;

        return afterStart && beforeEnd;
      });
    }

    if (dataToDownload.length === 0) {
      alert ("Belum terdapat data yang telah diambil");
      setIsDownloadModalOpen(false);
      return;
    }

    const doc = new jsPDF();
    
    drawHeader(doc);

    // Rentang waktu (Jika ada)
    if (startDate || endDate) {
      let label = "";

      if (startDate && endDate) {
        const startFormatted = new Date(startDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const endFormatted = new Date(endDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        label = `Rentang Waktu : ${startFormatted} - ${endFormatted}`;
      } else if (startDate) {
        const startFormatted = new Date(startDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        label = `Dari Tanggal : ${startFormatted}`;
      } else if (endDate) {
        const endFormatted = new Date(endDate).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        label = `Sampai Tanggal : ${endFormatted}`;
      }

      if (label) {
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.text(label, 105, 56, { align: "center" });
      }
    }

    // Judul Laporan
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text (`Laporan Barang Keluar`, 105, 50, { align: "center"});

    // Tabel
    autoTable(doc, {
      head: [["Nama Barang", "Jumlah", "Kategori", "Satuan", "Lokasi Penyimpanan", "Periode", "Tanggal Kadaluarsa", "Tanggal Barang Masuk", "Tanggal Diambil", "User"]],
      body: dataToDownload.map((item) => [
        item.incoming_items?.name || "-",
        item.quantity,
        item.incoming_items?.categories?.name || "-",
        item.incoming_items?.units?.name || "-",
        item.incoming_items?.storages?.name || "-",
        item.incoming_items?.periods?.name || "-",
        item.incoming_items?.expiration_date
          ? new Date(item.incoming_items.expiration_date).toLocaleDateString("id-ID")
          : "-",
        new Date(item.incoming_items.incoming_date).toLocaleDateString("id-ID"),
        item.taken_at
          ? new Date(item.taken_at).toLocaleDateString("id-ID")
          : "-",
        item.users?.username
      ]),
      startY: 62,
      theme: TableStyle.theme,
      styles: TableStyle.styles,
      headStyles: TableStyle.headStyles,
      bodyStyles: TableStyle.bodyStyles
    });

    doc.save("Laporan-Barang-Keluar.pdf");
    setIsDownloadModalOpen(false);
  };

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
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Barang Keluar - Selamat Datang, {currentUser?.username}!</h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Daftar Barang Keluar</h2>
              
              {/* Search */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari ..." 
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            {/* Button untuk fitur unduh data (Akses khusus admin) */}
            <div className="mt-8">
              {currentUser?.role === "admin" && (
                <button onClick={() => setIsDownloadModalOpen(true)} 
                className="flex gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 w-fit self-end transform transition-transform duration-200 ease-in-out hover:scale-105">
                  <Download size={22}/> Unduh PDF
                </button>
              ) }
            </div> 
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}

          {/* Tabel daftar barang keluar */}
          {outgoingItems.length === 0 ? (
            <p className="text-gray-700">Belum ada barang yang diambil.</p>
          ) : (
            <>
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="px-4 py-2 text-left">Nama Barang</th>
                  <th className="px-4 py-2 text-left">Kode Barang</th>
                  <th className="px-4 py-2 text-left">Jumlah</th>
                  <th className="px-4 py-2 text-left">Kategori</th>
                  <th className="px-4 py-2 text-left">Satuan</th>
                  <th className="px-4 py-2 text-left">Lokasi Penyimpanan</th>
                  <th className="px-4 py-2 text-left">Periode</th>
                  <th className="px-4 py-2 text-left">Tanggal Kadaluarsa</th>
                  <th className="px-4 py-2 text-left">Tanggal Barang Masuk</th>
                  <th className="px-4 py-2 text-left">Tanggal Diambil</th>
                  <th className="px-4 py-2 text-left">User</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.label}</td>
                    <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.categories.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.units.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.storages.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.incoming_items.periods.name}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {item.incoming_items.expiration_date
                        ? new Date(item.incoming_items.expiration_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(item.incoming_items.incoming_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{new Date(item.taken_at).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td className="px-4 py-2 text-gray-700">{item.users.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {filteredOutgoingItems.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))}
              />
            )}

            {/* Menampilkan jumlah data, termasuk saat pencarian */}
            <div className="mt-2 text-gray-600 text-sm text-center">
              {filteredOutgoingItems.length === 0 ? (
                <>Tidak terdapat data ditemukan</>
              ) : (
                <>Menampilkan {indexOfFirstItem + 1} s/d {Math.min(indexOfLastItem, filteredOutgoingItems.length)} dari {filteredOutgoingItems.length} data</>
              )}
            </div>
            </>
          )}
        </div>
        
        {/* Modal unduh data barang keluar */}
        {isDownloadModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Unduh Laporan - Barang Keluar</h2>
              <p className="text-sm text-gray-600 mb-4">
                Pilih rentang tanggal diambil (opsional). Jika dikosongkan,<br/>semua data yang sudah diambil akan diunduh.
              </p>

              {/* Filter tanggal (opsional)*/}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="r-4 text-gray-600 hover:underline cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 cursor-pointer"
                >
                  Unduh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}