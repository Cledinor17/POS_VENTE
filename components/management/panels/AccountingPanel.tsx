"use client";

import { useParams } from "next/navigation";
import JournalOperations from "@/components/accounting/JournalOperations";
import type { ManagementPanelProps } from "../types";

export default function AccountingPanel({ active = true }: ManagementPanelProps = {}) {
  const { business = "" } = useParams<{ business: string }>();

  return <JournalOperations key={business} business={business} active={active} />;
}
