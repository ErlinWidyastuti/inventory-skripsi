"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ExpiredPopup({ items, onClose }) {
  const router = useRouter();

  return (
    <div className="fixed top-20 w-80 bg-white shadow-lg rounded-lg border z-[9999]">
      <div className="p-3 border-b font-semibold text-sm flex justify-between">
        <span>Notifikasi Kadaluarsa</span>
        <button onClick={onClose} className="text-gray-400">✕</button>
      </div>

      {items.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">Tidak ada notifikasi</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              onClick={() => router.push("/expiredItems")}
              className="flex items-center gap-2 px-4 py-2 text-sm 
                         hover:bg-gray-100 cursor-pointer"
            >
              <AlertTriangle
                size={16}
                className={
                  item.days <= 7 ? "text-red-500" : "text-orange-400"
                }
              />
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  Kadaluarsa {item.days} hari lagi
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
