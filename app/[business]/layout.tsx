// app/[business]/layout.tsx
import BusinessShell from "../../components/BusinessShell";
import { Suspense } from "react";
import { BranchProvider } from "../../context/BranchContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <BranchProvider>
      <BusinessShell><Suspense fallback={<p className="p-6">Chargement…</p>}>{children}</Suspense></BusinessShell>
    </BranchProvider>
  );
}
