"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase-config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2} from "lucide-react";

export default function Users() {
  // State data
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  // State form
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
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
        // Cek User Login
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          setError("Sesi tidak valid. Silakan login kembali.");
          return;
        }

        // Mendapatkan detail user
        console.log("Auth user ID:", authUser.id);
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, username, role")
          .eq("id", authUser.id)
          .single();

        if (userError || !userData) {
          setError("Data pengguna tidak ditemukan.");
          return;
        }

        // Akses dibatasi hanyak untuk admin
        if (userData.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setCurrentUser(userData);

        // Ambil seluruh daftar user
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*");
        if (usersError) throw usersError;
        setUsers(usersData);

        setSessionLoading(false);
      } catch (err) {
        setError("Terjadi kesalahan: " + err.message);
        router.push("/");
      }
    };
    fetchData();
  }, [router]);

  // Ambil ulang daftar user setelah edit/hapus
  const fetchUsers = async () => {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      setError(error.message);
    } else {
      setUsers(data);
    }
  };
  
  const handleEdit = (user) => {
    setEditId(user.id);
    setUsername(user.username);
    setFullName(user.full_name ?? "");
    setEmail(user.email);
    setRole(user.role);
    setIsModalOpen(true);
  };

  // Update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!username || !email || !role) throw new Error("Semua field harus diisi.");
      // Ambil data user lama dulu supaya dapat dibandingkan role lama dengan yang baru
      const { data: oldUser, error: fetchError } = await supabase
        .from("users")
        .select("role")
        .eq("id", editId)
        .single();
      if (fetchError) throw fetchError;

      // Update data user
      const { error } = await supabase
        .from("users")
        .update({ username, full_name: fullName, email, role })
        .eq("id", editId);
      if (error) throw error;
      setSuccess("Pengguna berhasil diperbarui!");

      // Cek apakah user yang diupdate adalah user yang sedang login dan role-nya memang berubah
      if (editId === currentUser.id && oldUser.role !== role) {
        setCurrentUser((prev) => ({ ...prev, role: role }));
        window.location.reload();
        return;
      }

      // Reset form
      setUsername("");
      setFullName("");
      setEmail("");
      setRole("user");
      setEditId(null);
      setIsModalOpen(false);
      
      // Refresh data user
      fetchUsers();

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, full_name) => {
    if (confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        setSuccess('Pengguna berhasil dihapus!');
        fetchUsers();
      } catch (error) {
        if (error.message.includes("violates foreign key")) {
          setError(`Data pengguna dengan nama "${full_name}" tidak dapat dihapus karena terkoneksi dengan data lain`);
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
            User - Selamat Datang, {currentUser?.username}!
          </h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700">Daftar User</h2>
              <p className="text-base text-gray-600">Kelola data user</p>
            </div>
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {success && <p className="text-green-500 mb-4">{success}</p>}

          {/* Tabel daftar user */}
          {users.length === 0 ? (
            <p className="text-gray-700">Belum ada pengguna.</p>
          ) : (
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="px-4 py-2 text-left">Username</th>
                  <th className="px-4 py-2 text-left">Nama Lengkap</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="px-4 py-2 text-gray-700">{user.username}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {user.full_name}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{user.email}</td>
                    <td className="px-4 py-2 text-gray-700">{user.role}</td>
                    <td className="flex gap-2 px-4 py-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="bg-blue-400 text-white px-2 py-1 rounded-lg hover:bg-blue-500
                                  transform transition-transform duration-200 ease-in-out hover:scale-110"
                      >
                        <Pencil size={18}/>
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.full_name)}
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
        {/* Modal edit user */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/50 via-indigo-500/50 to-gray-500/50 backdrop-blur-md">
            <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-gray-700">
                Edit Pengguna
              </h2>
              <form onSubmit={handleUpdateUser}>
                <div className="mb-4">
                  <label
                    className="block text-gray-700 mb-2"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    className="block text-gray-700 mb-2"
                    htmlFor="fullName"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName ?? ""}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="email">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
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
                    {loading ? "Menyimpan..." : "Perbarui"}
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
