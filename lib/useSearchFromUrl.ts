"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function useSearchFromUrl(setValue: (value: string) => void, setInput?: (value: string) => void) {
  const query = useSearchParams().get("q") ?? "";
  useEffect(() => {
    const timer = window.setTimeout(() => { setValue(query); setInput?.(query); }, 0);
    return () => clearTimeout(timer);
  }, [query, setValue, setInput]);
}
