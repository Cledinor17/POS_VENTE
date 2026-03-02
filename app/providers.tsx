"use client";

import { AuthProvider } from "@/context/AuthContext";
import AppToaster from "@/components/AppToaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AppToaster />
    </AuthProvider>
  );
}
