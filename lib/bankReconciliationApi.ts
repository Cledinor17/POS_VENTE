import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type BankAccountItem = {
  id: string;
  name: string;
  accountNumberLast4: string | null;
  currency: string;
  ledgerAccountId: string | null;
  ledgerAccountName: string;
  openingBalance: number;
  openingBalanceDate: string | null;
  isActive: boolean;
};

export type BankStatementLineItem = {
  id: string;
  bankAccountId: string;
  txnDate: string;
  description: string | null;
  amount: number;
  externalReference: string | null;
  status: "unmatched" | "matched" | "ignored";
  matchedJournalLineId: string | null;
};

export type MatchSuggestion = {
  journalLineId: string;
  entryDate: string | null;
  memo: string | null;
  action: string | null;
  debit: number;
  credit: number;
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return fallback;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw) || !Array.isArray(raw.data)) return [];
  return raw.data;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/bank-accounts`;
}

function normalizeAccount(raw: unknown): BankAccountItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, ""),
    accountNumberLast4: toString(obj.account_number_last4, "") || null,
    currency: toString(obj.currency, "USD"),
    ledgerAccountId: obj.ledger_account_id != null ? toString(obj.ledger_account_id) : null,
    ledgerAccountName: toString(obj.ledger_account_name, ""),
    openingBalance: toNumber(obj.opening_balance, 0),
    openingBalanceDate: toString(obj.opening_balance_date, "") || null,
    isActive: toBool(obj.is_active, true),
  };
}

function normalizeLine(raw: unknown): BankStatementLineItem {
  const obj = isObject(raw) ? raw : {};
  const status = toString(obj.status, "unmatched");
  return {
    id: toString(obj.id, ""),
    bankAccountId: toString(obj.bank_account_id, ""),
    txnDate: toString(obj.txn_date, ""),
    description: toString(obj.description, "") || null,
    amount: toNumber(obj.amount, 0),
    externalReference: toString(obj.external_reference, "") || null,
    status: status === "matched" ? "matched" : status === "ignored" ? "ignored" : "unmatched",
    matchedJournalLineId: obj.matched_journal_line_id != null ? toString(obj.matched_journal_line_id) : null,
  };
}

function normalizeSuggestion(raw: unknown): MatchSuggestion {
  const obj = isObject(raw) ? raw : {};
  return {
    journalLineId: toString(obj.journal_line_id, ""),
    entryDate: toString(obj.entry_date, "") || null,
    memo: toString(obj.memo, "") || null,
    action: toString(obj.action, "") || null,
    debit: toNumber(obj.debit, 0),
    credit: toNumber(obj.credit, 0),
  };
}

export async function listBankAccounts(business: string): Promise<BankAccountItem[]> {
  const raw = await apiFetch<unknown>(basePath(business));
  return getCollection(raw).map(normalizeAccount);
}

export async function createBankAccount(
  business: string,
  input: { name: string; currency?: string; accountNumberLast4?: string; ledgerAccountId?: number | null; openingBalance?: number; openingBalanceDate?: string }
): Promise<BankAccountItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: {
      name: input.name,
      currency: input.currency ?? "USD",
      account_number_last4: input.accountNumberLast4 ?? null,
      ledger_account_id: input.ledgerAccountId ?? null,
      opening_balance: input.openingBalance ?? 0,
      opening_balance_date: input.openingBalanceDate ?? null,
    },
  });
  return normalizeAccount(raw);
}

export async function listStatementLines(
  business: string,
  bankAccountId: string,
  status?: string
): Promise<BankStatementLineItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(bankAccountId)}/statement-lines${query}`);
  return getCollection(raw).map(normalizeLine);
}

export async function importStatementCsv(
  business: string,
  bankAccountId: string,
  file: File
): Promise<{ imported: number; batchId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(bankAccountId)}/import`, {
    method: "POST",
    body: formData,
  });
  const obj = isObject(raw) ? raw : {};
  return { imported: Math.trunc(toNumber(obj.imported, 0)), batchId: toString(obj.batch_id, "") };
}

export async function suggestMatches(
  business: string,
  bankAccountId: string,
  lineId: string
): Promise<MatchSuggestion[]> {
  const raw = await apiFetch<unknown>(
    `${basePath(business)}/${encodeURIComponent(bankAccountId)}/statement-lines/${encodeURIComponent(lineId)}/suggestions`
  );
  return getCollection(raw).map(normalizeSuggestion);
}

export async function matchStatementLine(
  business: string,
  bankAccountId: string,
  lineId: string,
  journalLineId: string
): Promise<BankStatementLineItem> {
  const raw = await apiFetch<unknown>(
    `${basePath(business)}/${encodeURIComponent(bankAccountId)}/statement-lines/${encodeURIComponent(lineId)}/match`,
    { method: "POST", json: { journal_line_id: Number(journalLineId) } }
  );
  return normalizeLine(raw);
}

export async function unmatchStatementLine(
  business: string,
  bankAccountId: string,
  lineId: string
): Promise<BankStatementLineItem> {
  const raw = await apiFetch<unknown>(
    `${basePath(business)}/${encodeURIComponent(bankAccountId)}/statement-lines/${encodeURIComponent(lineId)}/unmatch`,
    { method: "POST" }
  );
  return normalizeLine(raw);
}

export async function ignoreStatementLine(
  business: string,
  bankAccountId: string,
  lineId: string
): Promise<BankStatementLineItem> {
  const raw = await apiFetch<unknown>(
    `${basePath(business)}/${encodeURIComponent(bankAccountId)}/statement-lines/${encodeURIComponent(lineId)}/ignore`,
    { method: "POST" }
  );
  return normalizeLine(raw);
}
