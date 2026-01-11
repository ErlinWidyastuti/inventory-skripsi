"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2} from "lucide-react";

export default function Kategori() {
  // State data
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  // State form
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
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
          setError("Sesi tidak valid. Silakan login kembali.");
          return;
        }

        // Mendapatkan detail user
        console.log("Auth user ID:", authUser.id);
        const { data, error } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", authUser.id)
          .single();

        if (error || !data) {
          setError("Data pengguna tidak ditemukan.");
          return;
        }

        // Akses dibatasi hanyak untuk admin
        if (data.role !== "admin") {
          setError("Akses ditolak. Hanya admin yang dapat mengelola pengguna.");
          router.push("/dashboard");
          return;
        }

        setUser(data);

        // Ambil seluruh daftar kategori
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("categories")
          .select("*");
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData);

        setSessionLoading(false);
      } catch (err) {
        console.error("Unexpected error:", err.message);
        setError("Terjadi kesalahan: " + err.message);
        router.push("/");
      }
    };
    fetchData();
  }, [router]);

  // Ambil ulang daftar kategori setelah tambah/edit/hapus
  const fetchCategories = async () => {
    const { data, error } = await supabase.from("categories").select("*");
    if (error) {
      setError(error.message);
    } else {
      setCategories(data);
    }
  };

  // Fungsi untuk membuka modal tambah kategori baru
  const handleAdd = () => {
    setName("");
    setEditId(null);
    setError(null)
    setIsModalOpen(true);
  };
  
  const handleEdit = (category) => {
    setEditId(category.id);
    setName(category.name);
    setIsModalOpen(true);
  };

  // Tambah atau update kategori
  const handleAddOrUpdateCategory = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!name) throw new Error("Nama Kategori harus diisi.");
      
      const { data: existingCategory, error: checkError } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", name) // case-insensitive
        .maybeSingle();

      if (checkError) throw checkError;

      if (!editId && existingCategory) {
        throw new Error("Nama kategori sudah tersedia, silakan gunakan nama lain.");
      }

      if (editId && existingCategory && existingCategory.id !== editId) {
        throw new Error("Nama kategori sudah digunakan kategori lain, silakan gunakan nama lain.");
      }

      if (editId) {
        // Update data kategori
        const { error } = await supabase
          .from("categories")
          .update({ name })
          .eq("id", editId);
        if (error) throw error;  
        setSuccess("Kategori berhasil diperbarui!");
      } else {
        // Tambah data kategori baru untuk input ke supabase
        const { error } = await supabase.from("categories").insert([{ name }]);
        if (error) throw error;
        setSuccess("Kategori berhasil ditambahkan!");
      }
      
      // Reset form
      setName("");
      setEditId(null);
      setIsModalOpen(false);
      
      // Refresh data kategori
      fetchCategories();

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm('Yakin ingin menghapus kategori ini?')) {
      try {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        setSuccess('Kategori berhasil dihapus!');
        fetchCategories();
      } catch (error) {
        if (error.message.includes("violates foreign key")) {
          setError(`Kategori "${name}" tidak dapat dihapus karena digunakan pada data barang masuk.`);
        } else {
          setError(error.message);
        }
      }
    }
  };

  // Jika masih loading session, tampilkan loading
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Kategori - Selamat Datang, {user?.username}!
          </h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700">Daftar Kategori</h2>
              <p className="text-base text-gray-600">Kelola data kategori</p>
            </div>
            <button
              onClick={handleAdd}
              className="flex gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600
                        transform transition-transform duration-200 ease-in-out hover:scale-105"
            >
              <Plus size={22}/> Tambah Kategori
            </button>
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}

          {/* Tabel daftar kategori */}
          {categories.length === 0 ? (
            <p className="text-gray-700">Belum ada kategori.</p>
          ) : (
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="px-4 py-2 text-left">Nama Kategori</th>
                  <th className="px-4 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b">
                    <td className="px-4 py-2 text-gray-700">{category.name}</td>
                    <td className="flex gap-2 px-4 py-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="bg-blue-400 text-white px-2 py-1 rounded-lg hover:bg-blue-500
                                  transform transition-transform duration-200 ease-in-out hover:scale-110"
                      >
                        <Pencil size={18}/>
                      </button>
                      <button
                        onClick={() => handleDelete(category.id, category.name)}
                        className="bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700
                                  transform transition-transform duration-200 ease-in-out hover:scale-110"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Modal tambah dan edit kategori */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-700">
                {editId ? "Edit Kategori" : "Tambah Kategori"}
              </h2>
              {error && (
                <p className="text-red-500 mb-4 text-sm">
                  {error}
                </p>
              )}
              <form onSubmit={handleAddOrUpdateCategory}>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="name">
                    Nama Kategori
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
                    {loading ? "Menyimpan..." : editId ? "Perbarui" : "Tambah"}
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
