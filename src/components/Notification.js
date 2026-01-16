"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../lib/supabase-config";
import ExpiredPopup from "./ExpiredPopup";

export default function Notification() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const fetchData = async () => {
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);

    const { data, error } = await supabase
      .from("incoming_items")
      .select("id, name, expiration_date")
      .not("expiration_date", "is", null)
      .gte("expiration_date", today.toISOString())
      .lte("expiration_date", limit.toISOString());

    if (error || !data) {
      console.error("Error fetch notifikasi:", error);
      setItems([]);
      return;
    }

    const mapped = data.map((item) => {
      const diff =
        (new Date(item.expiration_date) - today) /
        (1000 * 60 * 60 * 24);

      return {
        ...item,
        days: Math.ceil(diff),
      };
    });

    setItems(mapped);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("expired-items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incoming_items",
        },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const danger = items.filter((i) => i.days <= 7).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-sidebar-accent"
      >
        <Bell size={20} />

        {items.length > 0 && (
          <span
            className={`absolute -top-1 -right-1 text-white text-xs px-1.5 rounded-full
              ${danger > 0 ? "bg-red-500" : "bg-orange-400"}`}
          >
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <ExpiredPopup
          items={items}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
