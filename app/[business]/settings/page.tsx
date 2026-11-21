"use client";

import { useParams } from "next/navigation";
import BusinessSettingsHub from "@/components/settings/BusinessSettingsHub";

export default function SettingsPage() {
  const { business = "" } = useParams<{ business: string }>();
  // Reset drafts when moving to another business.
  return <BusinessSettingsHub key={business} business={business} />;
}
