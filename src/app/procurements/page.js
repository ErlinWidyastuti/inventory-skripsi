"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pagination from "../../components/Pagination";
import { Plus, Check, X, Trash2, Download, Search} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {drawHeader, TableStyle} from "@/components/TableStyle";

export default function Pengadaan() {
  // State data
  const [procurements, setProcurements] = useState([]);
  const [filteredProcurements, setFilteredProcurements] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  // State form
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  // State pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProcurements.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProcurements.length / itemsPerPage);
  // State pencarian dan filter unduh data
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // State status
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  // State UI kontrol
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

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

        // Ambil data pengadaan
        await fetchProcurements();

        // Ambil data satuan
        const { data: unitsData, error: unitsError } = await supabase
          .from("units")
          .select("id, name");
        if (unitsError) throw unitsError;
        setUnits(unitsData);

        // Ambil data user
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, username");
        if (usersError) throw usersError;
        setUsers(usersData);

        setSessionLoading(false);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setError("Terjadi kesalahan: " + err.message);
      }
    };
    fetchData();
  }, [router]);

  // Reset ke halaman pertama setiap data pengadaan berubah
  useEffect(() => {
      setCurrentPage(1);
    }, [procurements]);
  
  // Refresh data pengadaan ketika searchQuery berubah
  useEffect(() => {
    fetchProcurements();
  }, [searchQuery]);

  // Fungsi ambil data pengadaan dari Supabase
  const fetchProcurements = async () => {
    let { data, error } = await supabase
      .from("procurements")
      .select(`
        id,
        name,
        quantity,
        status,
        requested_at,
        requested_by,
        confirmed_at,
        confirmed_by,
        units:unit_id (id,name),
        requested_user:requested_by (id,username),
        confirmed_user:confirmed_by (id,username)
      `)
      .order("requested_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      console.log("Type of data:", Array.isArray(data), data);
      setProcurements(data);
      setFilteredProcurements(data);
    }
  };

  // Filter untuk melakukan pencarian data
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProcurements(procurements);
    } else {
      const keywordLower = searchQuery.toLowerCase();
      const results = procurements.filter((item) => {
        const unitName = item.units?.name?.toLowerCase() || "";
        const userName = item.requested_user?.username?.toLowerCase() || "";
        const itemName = item.name?.toLowerCase() || "";
        const status = (item.status || "").toLowerCase();
        const quantity = String(item.quantity || "").toLowerCase();
        const requestedDate = item.requested_at
          ? new Date(item.requested_at).toLocaleDateString("id-ID").toLowerCase()
          : "";

        return (
          unitName.includes(keywordLower) ||
          userName.includes(keywordLower) ||
          itemName.includes(keywordLower) ||
          status.includes(keywordLower) ||
          quantity.includes(keywordLower) ||
          requestedDate.includes(keywordLower) 
        );
      });
      setFilteredProcurements(results);
    }
  }, [searchQuery, procurements]);

  // Fungsi tambah data usulan pengadaan barang
  const handleAddProcurement = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!name || !quantity || !unitId) {
        throw new Error("Semua kolom wajib diisi.");
      }

      const procurementData = {
        name,
        quantity: parseInt(quantity),
        unit_id: unitId,
        requested_by: currentUser.id,
        status: "pending",
      };

      const { error } = await supabase.from("procurements").insert([procurementData]);

      if (error) throw error;

      setSuccess("Usulan Pengadaan Barang Berhasil Diajukan dan Menunggu Konfirmasi Admin.");
      setName("");
      setQuantity("");
      setUnitId("");
      setIsModalOpen(false);
      fetchProcurements();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi konfirmasi ajuan pengadaan (Akses khusus admin)
  const handleConfirmProcurement = async (id) => {
    if (currentUser.role !== "admin") return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Cek data pengadaan
      const { data: procurement, error: fetchError } = await supabase
        .from("procurements")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError || !procurement) throw new Error("Pengadaan tidak ditemukan.");

      // Warning ketika statusnya bukan "pending"
      if (procurement.status !== "pending") {
        setError("Pengadaan ini sudah diproses.");
        return;
      }

      // Update status menjadi "confirmed"
      await supabase
        .from("procurements")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: currentUser.id,
        })
      .eq("id", id);

      setSuccess("Pengadaan berhasil dikonfirmasi.");
      fetchProcurements();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi tolak ajuan pengadaan (Akses khusus admin)
  const handleRejectProcurement = async (id) => {
    if (currentUser.role !== "admin") return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from("procurements")
        .update({
          status: "rejected",
          confirmed_at: new Date().toISOString(),
          confirmed_by: currentUser.id,
        })
        .eq("id", id);
      if (error) throw error;

      setSuccess("Pengadaan berhasil ditolak.");
      fetchProcurements();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi render status (versi if else)
  const renderStatus = (status) => {
    if (status === "rejected") {
      return (
        <span className="px-2 py-1 rounded-lg text-white text-sm font-medium bg-red-600">
          Ditolak
        </span>
      );
    } else if (status === "confirmed") {
      return (
        <span className="px-2 py-1 rounded-lg text-white text-sm font-medium bg-blue-400">
          Disetujui
        </span>
      );
    } else if (status === "pending") {
      return (
        <span className="px-2 py-1 rounded-lg text-white text-sm font-medium bg-yellow-500">
          Menunggu Konfirmasi
        </span>
      );
    }
  };

  // Fungsi hapus ajuan pengadaan 
  const handleDeleteProcurement = async (id) => {
    if (currentUser.role !== "admin") return;

    if (confirm("Yakin ingin menghapus ajuan ini?")) {
      try {
        const { error } = await supabase.from("procurements").delete().eq("id", id);
        if (error) throw error;
        setProcurements(procurements.filter((proc) => proc.id !== id));
        setSuccess("Data usulan berhasil dihapus.");
      } catch (error) {
        setError(error.message);
      }
    }
  };

  // Fungsi untuk membuka modal tambah ajuan pengadaan
  const handleAdd = () => {
    setName("");
    setQuantity("");
    setUnitId("");
    setIsModalOpen(true);
  };

  // Fungsi unduh data dengan format PDF
  const handleDownload = () => {
    // Hanya mengunduh data yang telah dikonfirmasi
    let confirmedData = procurements.filter((procurement) => procurement.status === "confirmed");

    // Filter berdasarkan rentang tanggal (jika ada)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate + "T00:00:00") : null;
      const end = endDate ? new Date(endDate + "T23:59:59") : null;

      confirmedData = confirmedData.filter((procurement) => {
        const itemDate = new Date(procurement.confirmed_at);

        const afterStart = start ? itemDate >= new Date(start) : true;
        const beforeEnd = end ? itemDate <= new Date(end) : true;

        return afterStart && beforeEnd;
      });
    }

    if (confirmedData.length === 0) {
      alert ("Ajuan Pengadaan Barang Tidak/Belum Terkonfirmasi");
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
    doc.text (`Laporan Usulan Pengadaan Barang`, 105, 50, { align: "center"});

    // Tabel
    autoTable(doc, {
      head: [["Nama Barang", "Jumlah", "Satuan", "User", "Tanggal Konfirmasi"]],
      body: confirmedData.map((procurement) => [
        procurement.name,
        procurement.quantity,
        procurement.units?.name || "-",
        procurement.requested_user?.username || "-",
        procurement.confirmed_at
        ? new Date(procurement.confirmed_at).toLocaleDateString("id-ID")
        :"-",
      ]),
      startY: 62,
      theme: TableStyle.theme,
      styles: TableStyle.styles,
      headStyles: TableStyle.headStyles,
      bodyStyles: TableStyle.bodyStyles
    });

    doc.save("Laporan-Usulan-Pengadaan.pdf");
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
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Usulan Pengadaan Barang - Selamat Datang, {currentUser?.username}!</h1>
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}

        {/* Jika belum terdapat data pengadaan */}
        {procurements.length === 0 ? (
          <p className="text-gray-700">Belum ada pengadaan.</p>
        ) : (
          <>
          {/* Tabel riwayat pengajuan (Akses khusus user) */}
          {currentUser?.role === "user" && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-700">Riwayat Usulan Saya</h2>
                  <p className="text-base text-gray-600 mb-4">Riwayat Usulan Pengadaan Barang Oleh {currentUser?.username} </p>    
                </div>
                {/* button tambah ajuan untuk  user */}
                <button onClick={handleAdd} className="flex items-center gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transform transition-transform duration-200 ease-in-out hover:scale-105">
                  <Plus size={22}/> Ajukan Pengadaan
                </button>
              </div> 

              {/* Tabel riwayat ajuan pengadaan oleh user */}
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-200 text-gray-700">
                    <th className="px-4 py-2 text-left">Nama Barang</th>
                    <th className="px-4 py-2 text-left">Jumlah</th>
                    <th className="px-4 py-2 text-left">Satuan</th>
                    <th className="px-4 py-2 text-left">Status Ajuan</th>
                    <th className="px-4 py-2 text-left">Tanggal Diminta</th>
                  </tr>
                </thead>
                <tbody>
                  {procurements
                    .filter((procurement) => procurement.requested_by === currentUser.id) // menampilkan data milik user
                    .map((procurement) => (
                      <tr key={procurement.id} className="border-b">
                        <td className="px-4 py-2 text-gray-700">{procurement.name}</td>
                        <td className="px-4 py-2 text-gray-700">{procurement.quantity}</td>
                        <td className="px-4 py-2 text-gray-700">{procurement.units?.name || "Tidak diketahui"}</td>
                        <td className="px-4 py-2 text-gray-700">{renderStatus(procurement.status)}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {new Date(procurement.requested_at).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tabel utama semua usulan */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-700">Daftar Usulan Pengadaan Barang</h2>
                <p className="text-base text-gray-600 mb-4">Kelola data usulan pengadaan barang</p>
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
              <div className="flex flex-col  gap-2">
                {/* Button untuk fitur unduh data (Akses khusus admin) dan pengajuan pengadaan */}
                {currentUser?.role === "admin" && (
                  <>
                    <button onClick={() => setIsDownloadModalOpen(true)} 
                      className="flex gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transform transition-transform duration-200 ease-in-out hover:scale-105 w-fit self-end ">
                      <Download size={22}/> Unduh PDF
                    </button>
                    <button onClick={handleAdd} className="flex gap-2 bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transform transition-transform duration-200 ease-in-out hover:scale-105">
                      <Plus size={22}/> Ajukan Pengadaan
                    </button>
                  </>
                )}                
              </div> 
            </div>

            {/* Tabel data semua usulan pengadaan barang */}
            <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="px-4 py-2 text-left">Nama Barang</th>
                <th className="px-4 py-2 text-left">Jumlah</th>
                <th className="px-4 py-2 text-left">Satuan</th>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Status Ajuan</th>
                <th className="px-4 py-2 text-left">Tanggal Diminta</th>
                <th className="px-4 py-2 text-left">Tanggal Konfirmasi</th>
                {currentUser.role === "admin" && (
                  <th className="px-4 py-2 text-left">Aksi</th> // Aksi hanya untuk admin
                )}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-2 text-gray-700">{p.name}</td>
                  <td className="px-4 py-2 text-gray-700">{p.quantity}</td>
                  <td className="px-4 py-2 text-gray-700">{p.units?.name || "Tidak diketahui"}</td>
                  <td className="px-4 py-2 text-gray-700">{p.requested_user?.username || "Tidak diketahui"}</td>
                  <td className="px-4 py-2 text-gray-700">{renderStatus(p.status)}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {new Date(p.requested_at).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {p.confirmed_at
                      ? new Date(p.confirmed_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "-"}
                  </td>
                  {currentUser.role === "admin" && (
                    <td className="px-4 py-2">
                      {/* tombol aksi admin */}
                      {p.status === "pending" && (
                        <>
                          {/* Button confirmed (setuju) */}
                          <button
                            onClick={() => handleConfirmProcurement(p.id)}
                            className="bg-blue-400 text-white px-2 py-1 rounded-lg hover:bg-blue-500 transform transition-transform duration-200 ease-in-out hover:scale-110 mr-2"
                            disabled={loading}
                          >
                            {loading ? "Memproses..." : <Check size={18} />}
                          </button>
                          {/* Button rejected (tolak) */}
                          <button
                            onClick={() => handleRejectProcurement(p.id)}
                            className="bg-yellow-500 text-white px-2 py-1 rounded-lg hover:bg-yellow-600 transform transition-transform duration-200 ease-in-out hover:scale-110 mr-2"
                            disabled={loading}
                          >
                            {loading ? "Memproses..." : <X size={18} />}
                          </button>
                        </>
                      )}
                      {/* Button delete (hapus) */}
                      <button
                        onClick={() => handleDeleteProcurement(p.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 transform transition-transform duration-200 ease-in-out hover:scale-110"
                        disabled={loading}
                      >
                        {loading ? "Memproses..." : <Trash2 size={18} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          {filteredProcurements.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) =>
                setCurrentPage(Math.max(1, Math.min(page, totalPages)))
              }
            />
          )}

          {/* Menampilkan jumlah data, termasuk saat pencarian */}
          <div className="mt-2 text-gray-600 text-sm text-center">
            {filteredProcurements.length === 0 ? (
              <>Tidak terdapat data ditemukan</>
            ) : (
              <>Menampilkan {indexOfFirstItem + 1} s/d {Math.min(indexOfLastItem, filteredProcurements.length)} dari {filteredProcurements.length} data</>
            )}
          </div>
          </div>
          </>
        )}

        {/* Modal tambah ajuan pengadaan barang */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Ajukan Pengadaan</h2>
              <form onSubmit={handleAddProcurement}>
                {/* Nama barang */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="name">
                    Nama Barang
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  />
                </div>
                {/* Jumlah */}
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
                {/* Satuan */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="unitId">
                    Satuan
                  </label>
                  <select
                    id="unitId"
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  >
                    <option value="">Pilih Satuan</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
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
                    {loading ? "Mengajukan..." : "Ajukan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal unduh data ajuan pengadaan */}
        {isDownloadModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Unduh Laporan - Usulan Pengadaan Barang</h2>
              <p className="text-sm text-gray-600 mb-4">
                Pilih rentang tanggal konfirmasi (opsional). Jika dikosongkan,<br/>semua data yang sudah dikonfirmasi akan diunduh.
              </p>

              {/* Filter tanggal */}
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