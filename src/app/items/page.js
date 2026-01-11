"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pagination from "../../components/Pagination";
import { FolderOutput, Download, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {drawHeader, TableStyle} from "@/components/TableStyle";

export default function ListItems() {
  // State data
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [incomingItems, setIncomingItems] = useState([]);
  const [outgoingItems, setOutgoingItems] = useState([]);
  // State form
  const [quantity, setQuantity] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  // State pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  // State pencarian
  const [searchQuery, setSearchQuery] = useState(""); 
  // State status
  const [error, setError] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  // State UI kontrol
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cek user login
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
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
          setError("Data pengguna tidak ditemukan.");
          return;
        }
        setCurrentUser(userData);

        // Ambil data barang masuk dengan status "aktif atau tidak kadaluarsa"
        const { data: incomingData, error: incomingError } = await supabase
          .from("incoming_items")
          .select("*, categories(name), units(name), periods(name), storages(name)")
          .eq("status", "active");
        if (incomingError) throw incomingError;
        setIncomingItems(incomingData);

        // Ambil data barang keluar
        await fetchOutgoingItems();

        // Ambil daftar barang dengan status barang yang masih aktif dengan quantity > 0
        const { data: itemsData, error: itemsError } = await supabase
          .from("incoming_items")
          .select("*, categories(name), units(name), periods(name), storages(name)")
          .eq("status", "active")
          .gt("quantity", 0)
          .order("incoming_date", { ascending: false });
        if (itemsError) throw itemsError;
        setItems(itemsData);

        setLoading(false);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setError("Terjadi kesalahan: " + err.message);
      }
    };
    fetchData();
  }, [router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  // Fungsi ambil ulang data barang masuk yang masih aktif
  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("incoming_items")
      .select("*, categories(name), units(name), periods(name), storages(name)")
      .gt("quantity", 0)
      .eq("status", "active")
      .order("incoming_date", {ascending:false})
    if (error) {
      setError(error.message);
    } else {
      setItems(data);
      setFilteredItems(data);
    }
  };

    // Refresh data barang saat searchQuery berubah
  useEffect(() => {
    fetchItems();
  }, [searchQuery]);

  // Fungsi untuk ambil data barang keluar
  const fetchOutgoingItems = async () => {
    try {
      // Ambil data dari tabel outgoing_items, termasuk info barang dan user
      const { data, error } = await supabase
        .from("outgoing_items")
        .select("*, incoming_items(*, categories(name), units(name), periods(name), storages(name)), users(username)");

      if (error) {
        setError(error.message);
        return;
      }

      // Simpan data barang keluar, jika data kosong (null), isi dengan array kosong
      setOutgoingItems(data || []);

    } catch (err) {
      setError(err.message);
    }
  };

  // Fungsi ambil barang dengan kombinasi FIFO dan FEFO
  const handleAmbilBarang = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!selectedItemName || !quantity || quantity <= 0) throw new Error(`Pilih item dan jumlah yang valid.`);
      const itemsToTakeFrom = incomingItems.filter(
        (item) => item.name === selectedItemName && item.quantity > 0 && item.status === "active"
      )

      const now = new Date();

      const validItems = itemsToTakeFrom.filter(item => !item.expiration_date || new Date(item.expiration_date) >= now);
      
      if (validItems.length === 0) {
        throw new Error("Seluruh stok barang yang dipilih telah kadaluarsa");
      }

      const totalStock = validItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      if (totalStock < quantity) {
        setIsModalOpen(false);
        throw new Error(`Stok tidak cukup. Stok tersedia: ${totalStock}. Jumlah diminta: ${quantity}.`);
      }

      //Urutkan FEFO (expiration_date lebih dulu), lalu FIFO (incoming_date)
      const MAX_DATE = new Date("9999-12-31");

      validItems.sort((a, b) => {
        const expA = a.expiration_date ? new Date(a.expiration_date) : MAX_DATE;
        const expB = b.expiration_date ? new Date(b.expiration_date) : MAX_DATE;

        if (expA.getTime() === expB.getTime()) {
          return new Date(a.incoming_date) - new Date(b.incoming_date);
        }

        return expA - expB; // yang kadaluarsa lebih dekat, diambil lebih dulu
      });
      
      if (validItems.length === 0) throw new Error("Tidak ada stok untuk item yang dipilih.");

      // penentuan teks notifikasi metode yang digunakan sesuai algoritma yang dijalankan
      const itemsWithExp = validItems.filter(item => item.expiration_date);

      let takingMethodExplanation = "";

      if (itemsWithExp.length === 0) {
        // Tidak ada tanggal kadaluarsa sama sekali
        takingMethodExplanation = "FIFO (tidak ditemukan barang dengan tanggal kadaluarsa)";
      }
      else if (itemsWithExp.length === 1) {
        // Hanya 1 data  yang memiliki tanggal kadaluarsa
        takingMethodExplanation = "FEFO (hanya satu barang yang memiliki tanggal kadaluarsa)";
      }
      else {
        // Lebih dari 1 barang memiliki expiration_date
        const uniqueExpDates = new Set(
          itemsWithExp.map(item => new Date(item.expiration_date).getTime())
        );

        if (uniqueExpDates.size === 1) {
          // Tanggal kadaluarsa sama
          takingMethodExplanation =
            "FEFO → FIFO (tanggal kadaluarsa sama, diurutkan berdasarkan tanggal masuk)";
        } else {
          // Tanggal kadaluarsa berbeda
          takingMethodExplanation =
            "FEFO (barang dengan tanggal kadaluarsa terdekat diambil lebih dulu)";
        }
      }

      const usedLabels = [];
      
      let remainingQuantity = quantity;

      for (const item of validItems) {
        if (remainingQuantity <= 0) break;

        const quantityToTake = Math.min(remainingQuantity, item.quantity);
        remainingQuantity -= quantityToTake;

        const newQuantity = item.quantity - quantityToTake;

        await supabase.from("incoming_items").update({ quantity: newQuantity }).eq("id", item.id);

        if (quantityToTake > 0) {
          await supabase.from("outgoing_items").insert({
            item_id: item.id,
            quantity: quantityToTake,
            taken_at: new Date().toISOString(),
            user_id: currentUser.id,
          });

          // simpan kode barang (label) dan jumlahnya
          usedLabels.push(`${item.label} (${quantityToTake})`);
        }
      }

      setSuccess(`Berhasil mengambil ${quantity} ${selectedItemName} dengan kode barang ${usedLabels.join(", ")} menggunakan metode ${takingMethodExplanation}.`);
      setSelectedItemName("");
      setIsModalOpen(false);

      fetchItems();
      fetchOutgoingItems();
    } catch (error) {
      setError(error.message);
    } finally {
      setQuantity("");
      setLoading(false);
    }
  };

  // Cek apakah tanggalnya sudah masuk masa kadaluarsa atau belum
  const isExpired = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date) && date < new Date();
  };
  
  // Fungsi untuk memindahkan barang yang telah kadaluarsa
  const handleMoveToExpired = async (id) => {
    if (currentUser?.role !== "admin") return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: itemData, error: itemError } = await supabase
        .from("incoming_items")
        .select("*")
        .eq("id", id)
        .single();
      if (itemError || !itemData) throw new Error("Item tidak ditemukan.");

      const currentDate = new Date();
      const expirationDate = new Date(itemData.expiration_date);
      if (!itemData.expiration_date || isNaN(expirationDate.getTime()) || expirationDate > currentDate) {
        setError("Item ini belum kadaluarsa.");
        return;
      }

      const expiredItemData = {
        name: itemData.name,
        label: itemData.label,
        category_id: itemData.category_id,
        quantity: itemData.quantity,
        unit_id: itemData.unit_id,
        period_id: itemData.period_id,
        storage_id: itemData.storage_id,
        expiration_date: itemData.expiration_date,
        incoming_date: itemData.incoming_date,
        moved_by: currentUser.id,
        incoming_item_id : itemData.id
      };
      
      const {data: inserted, error: insertError} = await supabase
        .from("expired_items")
        .insert([expiredItemData])
        .select();

      if (insertError) throw insertError;
      console.log("Inserted expired:", inserted);
      
      await supabase.from("incoming_items").update({ status: "expired" }).eq("id", id);

      setItems(items.filter((item) => item.id !== id));
      setSuccess("Barang berhasil dipindahkan ke kadaluarsa.");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter untuk melakukan pencarian data
  useEffect(() => {
    if(searchQuery.trim() === "") {
      setFilteredItems(items);
    } else {
      const keyword = searchQuery.toLowerCase();
      const results = items.filter((item) => {
        return (
          item.name.toLowerCase().includes(keyword)||
          item.label.toLowerCase().includes(keyword)||
          item.categories?.name?.toLowerCase().includes(keyword) ||
          item.units?.name?.toLowerCase().includes(keyword) ||
          item.periods?.name?.toLowerCase().includes(keyword) ||
          item.storages?.name?.toLowerCase().includes(keyword) ||
          String(item.quantity).toLowerCase().includes(keyword) ||
          (item.expiration_date
            ? new Date(item.expiration_date).toLocaleDateString("id-ID").toLowerCase().includes(keyword)
            : false) ||
          (item.incoming_date
            ? new Date(item.incoming_date).toLocaleDateString("id-ID").toLowerCase().includes(keyword)
            : false)
        );
      });
      setFilteredItems(results);
    }
  }, [searchQuery, items]);

  // Fungsi unduh data dengan format PDF
  const handleDownload = () => {
    let dataToDownload =  items;

    // Filter unduh berdasarkan kategori dan periode
    if (selectedCategory) {
      dataToDownload = dataToDownload.filter(item => item.categories.name === selectedCategory);
    }
    if (selectedPeriod) {
      dataToDownload = dataToDownload.filter(item => item.periods.name === selectedPeriod);
    }

    if (dataToDownload.length === 0) {
      alert("Tidak ada data untuk diunduh sesuai filter.");
      setIsDownloadModalOpen(false);
      return;
    }

    const doc = new jsPDF();
    
    drawHeader(doc);

    // Judul Laporan
    doc.setFontSize(12);
    doc.setFont("times", "bold");
    doc.text (`Daftar Barang`, 105, 50, { align: "center"});

    // Tabel
    autoTable(doc, {
      head: [["Nama Barang", "Kategori", "Jumlah", "Satuan", "Periode", "Lokasi Penyimpanan", "Tanggal Kadaluarsa", "Tanggal Barang Masuk"]],
      body: dataToDownload.map((item) => [
        item.name,
        item.categories.name,
        item.quantity,
        item.units.name,
        item.periods.name,
        item.storages.name,
        item.expiration_date ? new Date(item.expiration_date).toLocaleDateString("id-ID") : "-",
        new Date(item.incoming_date).toLocaleDateString("id-ID")
      ]),
      startY: 60,
      theme: TableStyle.theme,
      styles: TableStyle.styles,
      headStyles: TableStyle.headStyles,
      bodyStyles: TableStyle.bodyStyles
    });

    doc.save("Daftar-Barang.pdf");
    setIsDownloadModalOpen(false);
  };
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (sessionError) {
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Daftar Barang - Selamat Datang, {currentUser?.username}!</h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {/* Search, fitur unduh, dan fitur ambil barang */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700">Daftar Barang Tersedia</h2>
              <p className="text-base text-gray-600 mb-4">Kelola data daftar barang</p>
              {/* Search*/}
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
            {/* Button untuk fitur unduh data (hanya untuk admin) */}
            <div className="flex flex-col  gap-2">
              {currentUser?.role === "admin" && (
                <button onClick={() => setIsDownloadModalOpen(true)} 
                  className="flex gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 
                            transform transition-transform duration-200 ease-in-out hover:scale-105 w-fit self-end">
                  <Download size={22}/> Unduh PDF
                </button>
              ) }
              {/* Button untuk fitur ambil barang */}
              <button onClick={() => setIsModalOpen(true)} 
                className="flex gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500
                          transform transition-transform duration-200 ease-in-out hover:scale-105">
                <FolderOutput size={22}/>Ambil Barang
              </button>
            </div> 
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}

          {/* Tabel data daftar barang */}
          {items.length === 0 ? (
            <p className="text-gray-700">Belum ada barang dalam daftar.</p>
          ) : (
            <>
            <table className="w-full table-auto">
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
                  <th className="px-4 py-2 text-left">Tanggal Barang Masuk</th>
                  <th className="px-4 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-2 text-gray-700">{item.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.label}</td>
                    <td className="px-4 py-2 text-gray-700">{item.categories.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2 text-gray-700">{item.units.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.periods.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.storages.name}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {item.expiration_date
                        ? new Date(item.expiration_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(item.incoming_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2">
                      {/* Button untuk pindah barang ke menu kadaluarsa (hanya untun admin) */}
                      {currentUser?.role === "admin" ? (
                        <>
                          {isExpired(item.expiration_date) ? (
                            <button
                              onClick={() => handleMoveToExpired(item.id)}
                              className="bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600
                                        transform transition-transform duration-200 ease-in-out hover:scale-105"
                              disabled={loading}
                            >
                              {loading ? "Memproses..." : "Pindah ke Kadaluarsa"}
                            </button>
                          ) : (
                            "-"
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {filteredItems.length > 0 && ( 
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))}
              />
            )}

            {/* Menampilkan jumlah data, termasuk saat pencarian */}
            <div className="mt-2 text-gray-600 text-sm text-center">
              {filteredItems.length === 0 ? (
                <>Tidak terdapat data ditemukan</>
              ) : (
                <>Menampilkan {indexOfFirstItem + 1} s/d {Math.min(indexOfLastItem, filteredItems.length)} dari {filteredItems.length} data</>
              )}
            </div>
            </>
          )}
        </div>
        
        {/* Modal ambil barang */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Ambil Barang</h2>
              <form onSubmit={(e) => { 
                e.preventDefault(); // supaya tidak reload halaman
                handleAmbilBarang(e); }}
              >
                {/* Pilih barang */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="itemName">
                    Pilih Barang
                  </label>
                  <select
                    id="itemName"
                    value={selectedItemName} // barang yang dipilih
                    onChange={(e) => setSelectedItemName(e.target.value)} // update state saat memilih barang
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  >
                    <option value="">Pilih Barang</option>

                    {/* Looping daftar barang yang jumlahnya > 0 dengan status "aktif" */}
                    {Array.from(
                      new Set(
                        incomingItems
                          .filter(
                            item =>
                              item.quantity > 0 &&
                              item.status === "active" &&
                              (!item.expiration_date || new Date(item.expiration_date) >= new Date()) // filter kadaluarsa
                          )
                          .map(item => item.name)
                      )
                    ).map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Input jumlah barang */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="quantity">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    min="1"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mr-4 text-gray-600 hover:underline cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal unduh dengan format pdf */}
        {isDownloadModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Unduh Laporan Daftar Barang</h2>
              <p className="text-sm text-gray-600 mb-4">
                Pilih filter kategori dan periode (opsional). Jika dikosongkan, semua data akan diunduh.
              </p>

              {/* Pilih kategori */}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Kategori</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                >
                  <option value="">Semua Kategori</option>
                  {Array.from(new Set(items.map(item => item.categories.name))).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Pilih periode */}
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Periode</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                >
                  <option value="">Semua Periode</option>
                  {Array.from(new Set(items.map(item => item.periods.name))).map(period => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="mr-4 text-gray-600 hover:underline cursor-pointer"
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