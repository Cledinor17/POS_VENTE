// app/[business]/layout.tsx
import BusinessShell from "../../components/BusinessShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BusinessShell>{children}</BusinessShell>;
}