import { apiFetch } from "./api";

export type UnpostedDepositMemo = {
  id: string;
  cart_reference: string;
  amount: string;
  currency: "HTG" | "USD";
  note: string | null;
  recorded_at: string;
};
export type UnpostedDepositSummary = {
  data: UnpostedDepositMemo[];
  totals: { HTG: string; USD: string };
  accounting_status: "unposted";
  more_records: boolean;
};

export async function listUnpostedDeposits(business: string): Promise<UnpostedDepositSummary> {
  return apiFetch<UnpostedDepositSummary>(
    `/api/app/${encodeURIComponent(business)}/pos/pending-deposit-memos`,
  );
}
export async function recordUnpostedDeposit(
  business: string,
  input: {
    cart_reference: string;
    amount: string;
    currency: "HTG" | "USD";
    request_key: string;
    note?: string;
  },
): Promise<UnpostedDepositMemo> {
  const response = await apiFetch<{ data: UnpostedDepositMemo; accounting_status: "unposted" }>(
    `/api/app/${encodeURIComponent(business)}/pos/pending-deposit-memos`,
    { method: "POST", json: input },
  );
  return response.data;
}
