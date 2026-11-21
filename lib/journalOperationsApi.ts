import { apiFetch } from "./api";

export type JournalOperationType = "income" | "expense" | "receipt" | "refund" | "reversal" | "transfer" | "other";

export type JournalOperation = {
  id: string;
  date: string;
  operation: string;
  type: JournalOperationType;
  direction: -1 | 0 | 1;
  amount: number;
  currency: string;
};

export type JournalOperationsResult = {
  data: JournalOperation[];
  meta: { current_page: number; last_page: number; total: number };
};

export function listJournalOperations(business: string, page = 1): Promise<JournalOperationsResult> {
  const query = new URLSearchParams({ page: String(page), per_page: "20" });
  return apiFetch<JournalOperationsResult>(
    `/api/app/${encodeURIComponent(business)}/accounting/operations?${query}`,
  );
}
