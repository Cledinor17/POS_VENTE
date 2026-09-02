// app/[business]/layout.tsx
import BusinessShell from "../../components/BusinessShell";
import { BranchProvider } from "../../context/BranchContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <BranchProvider>
      <BusinessShell>{children}</BusinessShell>
    </BranchProvider>
  );
}