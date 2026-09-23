"use client";
import { useEffect } from "react";
import { listPendingSales } from "@/lib/offlineDb";

export default function OfflineDataMaintenance() {
  useEffect(() => {
    // Reading also scrubs credentials written by older versions, for all businesses.
    void listPendingSales("").catch(() => { /* The POS reports storage failures when opened. */ });
  }, []);
  return null;
}
