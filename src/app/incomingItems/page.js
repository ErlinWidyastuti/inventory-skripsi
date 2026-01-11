"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pagination from "../../components/Pagination";
import { Plus, Pencil, Trash2, Search} from "lucide-react";

export default function IncomingItems() {
  // State data
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [storages, setStorages] = useState([]);
  const [user, setUser] = useState(null);
  // State form
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [storageId, setStorageId] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [incomingDate, setIncomingDate] = useState("");
  const [editItem, setEditItem] = useState(null);
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
  const [loading, setLoading] = useState(false);
  // State UI kontrol
  const [isModalOpen, setIsModalOpen] = useState(false);
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

        // Akses dibatasi hanyak untuk admin
        if (userData.role !== "admin") {
          setError("Akses ditolak. Hanya admin yang dapat mengelola pengguna.");
          router.push("/dashboard");
          return;
        }

        setUser(userData);

        // Ambil data barang masuk
        const { data: itemsData, error: itemsError } = await supabase
          .from("incoming_items")
          .select("*, categories(name), units(name), periods(name), storages(name)")
          .order("incoming_date", { ascending: false }); 
          if (itemsError) throw itemsError;
        setItems(itemsData);

        // Ambil data kategori
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("id, name");
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData);

        // Ambil data satuan
        const { data: unitsData, error: unitsError } = await supabase
          .from("units")
          .select("id, name");
        if (unitsError) throw unitsError;
        setUnits(unitsData);

        // Ambil data periode
        const { data: periodsData, error: periodsError } = await supabase
          .from("periods")
          .select("id, name");
        if (periodsError) throw periodsError;
        setPeriods(periodsData);

        // Ambil data storages (Lokasi penyimpanan)
        const { data: storagesData, error: storagesError } = await supabase
          .from("storages")
          .select("id, name");
        if (storagesError) throw storagesError;
        setStorages(storagesData);

        setSessionLoading(false);
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

  // Fungsi ambil ulang data barang masuk
  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("incoming_items")
      .select("*, categories(name), units(name), periods(name), storages(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setItems(data);
  };

  // Ambil inisial dari nama storage
  function getInitials(storageName) {
    return storageName
      .trim()
      .split(/\s+/)
      .map(word => word[0].toUpperCase())
      .join("");
  }

  // Mendapatkan nomor random
  function generateRandomNumber(length = 4) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate label lengkap
  async function generateLabel(storageId) {
    // Ambil nama storage
    const { data: storageData, error: storageError } = await supabase
      .from("storages")
      .select("name")
      .eq("id", storageId)
      .single();

    if (storageError) {
      console.error(storageError);
      return null;
    }

    const initials = getInitials(storageData.name);
    const number = generateRandomNumber();

    if (!number) return null;

    return number + initials;
  }

  // Fungsi untuk membuka modal tambah barang masuk baru
  const handleAdd = () => {
    setName("");
    setCategoryId("");
    setQuantity("");
    setUnitId("");
    setPeriodId("");
    setStorageId("");
    setExpirationDate("");
    setIncomingDate("");
    setEditItem(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (item) => {
    setEditItem(item);
    setName(item.name);
    setCategoryId(item.category_id);
    setUnitId(item.unit_id);
    setPeriodId(item.period_id);
    setStorageId(item.storage_id);
    setExpirationDate(item.expiration_date ? new Date(item.expiration_date).toISOString().split("T")[0] : "");
    setIncomingDate(new Date(item.incoming_date).toISOString().split("T")[0]);
    setIsModalOpen(true);
  };

  // Tambah atau update data barang masuk
  const handleAddOrUpdateItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const dataUpdate = {
        name,
        category_id: categoryId,
        unit_id: unitId,
        period_id: periodId,
        storage_id: storageId,
        expiration_date: expirationDate || null,
        incoming_date: incomingDate,
        status: "active",
      };

      if (!name || !categoryId || !unitId || !periodId || !storageId || !incomingDate) {
        throw new Error("Semua kolom wajib diisi kecuali Tanggal Kadaluarsa.");
      }

      if (editItem) {
        // Update data barang masuk
        const { error } = await supabase
          .from("incoming_items")
          .update(dataUpdate)
          .eq("id", editItem.id);
        if (error) throw error;
        setSuccess("Barang Masuk berhasil diperbarui!");
      } 
      else {
        const autoLabel = await generateLabel(storageId);

        const newItemData = {
          ...dataUpdate,
          quantity: parseInt(quantity),
          quantity_items_in: parseInt(quantity),
          label: autoLabel,
        };

        // Tambah data barang masuk baru untuk input ke supabase
        const { error } = await supabase
          .from("incoming_items")
          .insert([newItemData])
        if (error) throw error;
        
        setSuccess("Barang Masuk berhasil ditambahkan!");
      }

      await fetchItems();

      // Reset form
      setName("");
      setCategoryId("");
      setQuantity("");
      setUnitId("");
      setPeriodId("");
      setStorageId("");
      setExpirationDate("");
      setIncomingDate("");
      setEditItem(null);
      setIsModalOpen(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm('Yakin ingin menghapus barang ini?')) {
      setError(null);
      setSuccess(null);
      try {
        const { error } = await supabase.from('incoming_items').delete().eq('id', id);
        if (error) throw error;
        setSuccess('Barang berhasil dihapus!');
        fetchItems();
      } catch (error) {
        if (error.message.includes("violates foreign key")) {
          setError(`Data "${name}" pada barang masuk tidak dapat dihapus karena telah dilakukan transaksi.`);
        } else {
          setError(error.message);
        }
      }
    }
  };

  // Filter untuk melakukan pencarian data
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredItems(items);
    } else {
      const keywordLower = searchQuery.toLowerCase();
      const results = items.filter((item) => {
        const itemName = item.name?.toLowerCase() || "";
        const label = item.label?.toLowerCase() || "";
        const categoryName = item.categories?.name?.toLowerCase() || "";
        const quantity = String(item.quantity_items_in || item.quantity || "").toLowerCase();
        const unitName = item.units?.name?.toLowerCase() || "";
        const periodName = item.periods?.name?.toLowerCase() || "";
        const storageName = item.storages?.name?.toLowerCase() || "";
        const expirationDate = item.expiration_date
          ? new Date(item.expiration_date).toLocaleDateString("id-ID").toLowerCase()
          : "";
        const incomingDate = item.incoming_date
          ? new Date(item.incoming_date).toLocaleDateString("id-ID").toLowerCase()
          : "";
        
        return (
          itemName.includes(keywordLower) ||
          label.includes(keywordLower) ||
          categoryName.includes(keywordLower) ||
          quantity.includes(keywordLower) ||
          unitName.includes(keywordLower) ||
          periodName.includes(keywordLower) ||
          storageName.includes(keywordLower) ||
          expirationDate.includes(keywordLower) ||
          incomingDate.includes(keywordLower)
        );
      });
      setFilteredItems(results);
    }
  }, [searchQuery, items]);

  // Jika masih loading session, tampilkan loading
  if (sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Menampilkan pesan error, jika terdapat error
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Barang Masuk - Selamat Datang, {user?.username}!</h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {/* Search dan tambah barang masuk */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Daftar Barang Masuk</h2>
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
            {/* Button tambah barang masuk */}
            <button onClick={handleAdd} className="flex gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transform transition-transform duration-200 ease-in-out hover:scale-105">
              <Plus size={22}/> Tambah Barang Masuk
            </button>
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}

          {/* Tabel data barang masuk */}
          {items.length === 0 ? (
            <p className="text-gray-700">Belum ada barang masuk.</p>
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
                    <td className="px-4 py-2 text-gray-700">{item.categories?.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.quantity_items_in}</td>
                    <td className="px-4 py-2 text-gray-700">{item.units?.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.periods?.name}</td>
                    <td className="px-4 py-2 text-gray-700">{item.storages?.name}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(item.incoming_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="flex gap-2 px-4 py-2">
                      {item.expiration_date && new Date(item.expiration_date) < new Date() ? (
                        <p className="text-gray-400 text-sm font-bold text-center">Kadaluarsa</p>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(item)} className="bg-blue-400 text-white px-2 py-1 rounded-lg hover:bg-blue-500 transform transition-transform duration-200 ease-in-out hover:scale-110">
                            <Pencil size={18}/>
                          </button>
                          <button onClick={() => handleDelete(item.id, item.name)} className="bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 transform transition-transform duration-200 ease-in-out hover:scale-110">
                            <Trash2 size={18}/>
                          </button>
                        </>
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
        {/* Modal tambah dan update data barang masuk */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md my-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4 text-gray-700">{editItem ? "Edit Barang Masuk" : "Tambah Barang Masuk"}</h2>
              
              <form onSubmit={handleAddOrUpdateItem}>
                {/* Nama Barang */}
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

                {/* Kategori */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="categoryId">
                    Kategori
                  </label>
                  <select
                    id="categoryId"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
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
                    min="0"
                    required
                    readOnly={!!editItem} // <-- selalu read-only saat edit
                    className={`w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500
                      ${editItem ? "bg-gray-200 cursor-not-allowed text-gray-500" : ""}`}
                  />
                  {editItem && (
                    <p className="text-sm text-gray-500 mt-1">
                      Jumlah tidak bisa diubah
                    </p>
                  )}
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
                
                {/* Periode */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="periodId">
                    Periode
                  </label>
                  <select
                    id="periodId"
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  >
                    <option value="">Pilih Periode</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Storages (Lokasi penyimpanan) */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="storageId">
                    Lokasi Penyimpanan
                  </label>
                  <select
                    id="storageId"
                    value={storageId}
                    onChange={(e) => setStorageId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md"
                    required
                  >
                    <option value="">Pilih Lokasi Penyimpanan</option>
                    {storages.map((storage) => (
                      <option key={storage.id} value={storage.id}>
                        {storage.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tanggal kadaluarsa */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="expirationDate">
                    Tanggal Kadaluarsa (Opsional)
                  </label>
                  <input
                    type="date"
                    id="expirationDate"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                  />
                </div>

                {/* Tanggal barang masuk */}
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="incomingDate">
                    Tanggal Barang Masuk
                  </label>
                  <input
                    type="date"
                    id="incomingDate"
                    value={incomingDate}
                    onChange={(e) => setIncomingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mr-4 text-gray-600 hover:underline cursor-pointer transform transition-transform duration-200 ease-in-out hover:scale-110"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 cursor-pointer transform transition-transform duration-200 ease-in-out hover:scale-110"
                    disabled={loading}
                  >
                    {loading ? "Menyimpan..." : editItem ? "Perbarui" : "Tambah"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}