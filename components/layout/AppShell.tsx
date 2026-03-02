"use client";

import { useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import TopbarMobile from "./TopbarMobile";
import HeaderDesktop from "./HeaderDesktop";
import { getMockSession } from "@/lib/rbac";

export default function AppShell({
  children,
  business,
}: {
  children: React.ReactNode;
  business: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Remplace ça par ta vraie session (API Laravel)
  const session = useMemo(() => getMockSession(), []);

  return (
    <div className="bg-slate-50 h-screen overflow-hidden">
      <TopbarMobile
        brand="POS Pro"
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex overflow-hidden h-[calc(100vh)]">
        <Sidebar
          brand="POS Pro"
          business={business}
          permissions={session.permissions}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto">
          <HeaderDesktop
            username={session.name}
            initials={session.initials}
            onNewSale={() => {
              // Exemple : rediriger vers POS
              window.location.href = `/${business}/pos`;
            }}
          />
          <div className="p-4 lg:p-8 space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
