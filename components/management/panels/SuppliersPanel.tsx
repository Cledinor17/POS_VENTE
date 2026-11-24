"use client";
import type { ManagementPanelProps } from "../types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList, Plus, Search, Upload } from "lucide-react";
import { ApiError } from "@/lib/api";
import ImportModal, { type ImportColumnHelp } from "@/components/ImportModal";
import PhoneField from "@/components/PhoneField";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierItem,
} from "@/lib/suppliersApi";
import { SUPPORTED_CURRENCIES } from "@/lib/businessApi";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
const SUPPLIER_IMPORT_COLUMNS: ImportColumnHelp[] = [
  { name: "department", required: false, description: "Departement (defaut: General)." },
  { name: "name", required: true, description: "Nom du fournisseur." },
  { name: "contact_person", required: false, description: "Personne a contacter." },
  { name: "email", required: false, description: "Sert a mettre a jour un fournisseur existant." },
  { name: "phone", required: false, description: "Numero de telephone." },
  { name: "address", required: false, description: "Adresse." },
  { name: "currency", required: false, description: "Devise." },
  { name: "balance", required: false, description: "Solde initial (applique uniquement a la creation)." },
];

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
export default function SuppliersPanel({ active = true }: ManagementPanelProps = {}) {
  const params = useParams<{ business: string }>();
  const router = useRouter();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("General");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("HTG");
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setPageError("");
      try {
        const res = await listSuppliers(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
        });
        if (!mounted) return;
        setItems(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
      } catch (e) {
        if (mounted) setPageError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, page, query, reloadSeq, active]);
  const resetForm = useCallback(() => {
    setEditingId("");
    setName("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setAddress("");
    setDepartment("General");
    setBalance("");
    setCurrency("HTG");
  }, []);
  function openCreateModal() {
    resetForm();
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }
  const closeFormModal = useCallback(() => {
    if (saving) return;
    setIsFormOpen(false);
    setFormError("");
    resetForm();
  }, [resetForm, saving]);
  useEffect(() => {
    if (!isFormOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        closeFormModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeFormModal, isFormOpen, saving]);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!name.trim()) {
      setFormError("Le nom du fournisseur est obligatoire.");
      return;
    }
    const parsedBalance = balance.trim().length > 0 ? Number(balance) : 0;
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setFormError("Solde invalide.");
      return;
    }
    setSaving(true);
    setFormError("");
    setInfo("");
    try {
      if (editingId) {
        const updated = await updateSupplier(businessSlug, editingId, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          department: department.trim() || "General",
          balance: parsedBalance,
          currency,
        });
        setItems((prev) =>
          prev.map((row) => (row.id === editingId ? updated : row)),
        );
        setInfo("Fournisseur mis a jour.");
      } else {
        await createSupplier(businessSlug, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          department: department.trim() || "General",
          balance: parsedBalance,
          currency,
        });
        setInfo("Fournisseur ajoute.");
        setPage(1);
        setQuery("");
        setQueryInput("");
      }
      resetForm();
      setIsFormOpen(false);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  function beginEdit(item: SupplierItem) {
    setEditingId(item.id);
    setName(item.name);
    setContactPerson(item.contactPerson ?? "");
    setEmail(item.email ?? "");
    setPhone(item.phone ?? "");
    setAddress(item.address ?? "");
    setDepartment(item.department || "General");
    setBalance(String(item.balance));
    setCurrency(item.currency || "HTG");
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }
  return (
    <div className="space-y-6">
      {" "}
      <section className="bg-white p-4 rounded-lg border border-slate-200">
        {" "}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {" "}
          <div>
            {" "}
            <h2 className="text-xl font-semibold text-slate-900">
              Fournisseurs
            </h2>{" "}
            <p className="text-slate-500 mt-1">
              Retrouvez vos fournisseurs, leurs coordonnées et leurs soldes en un seul endroit.
            </p>{" "}
          </div>{" "}
          <div className="text-sm text-slate-600">
            {" "}
            {total} fournisseur(s)
          </div>{" "}
        </div>{" "}
      </section>{" "}
      {pageError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {pageError}{" "}
        </section>
      ) : null}{" "}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {" "}
          {info}{" "}
        </section>
      ) : null}{" "}
      <section aria-label="Recherche et actions fournisseurs" className="flex flex-wrap items-center gap-3">
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput.trim());
            setPage(1);
          }}
        >
          <div className="relative min-w-[200px] flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Nom, téléphone, e-mail ou représentant…"
              aria-label="Rechercher un fournisseur"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Filtrer
          </button>
        </form>
        <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nouveau fournisseur
        </button>
        <Link href={`/${businessSlug}/purchase-orders#new-purchase-order`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ClipboardList aria-hidden="true" className="h-4 w-4" />
          Bon de commande
        </Link>
        <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Upload aria-hidden="true" className="h-4 w-4" />
          Importer
        </button>
      </section>
      <section className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des fournisseurs...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun fournisseur trouve.
            </div>
          ) : (
            <div className="overflow-x-auto">
              {" "}
              <table className="w-full min-w-[880px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-600 bg-slate-50 border-b border-slate-200">
                    <th className="py-3 pr-3 font-semibold">Fournisseur</th>
                    <th className="py-3 pr-3 font-semibold">Téléphone</th>
                    <th className="py-3 pr-3 font-semibold">E-mail</th>
                    <th className="py-3 pr-3 font-semibold">Adresse</th>
                    <th className="py-3 pr-3 font-semibold" title="Produits distincts des commandes confirmées de la succursale active">Produits commandés</th>
                    <th className="py-3 pr-3 font-semibold">Solde enregistré</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="py-3 pr-3 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {item.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "F"}
                          </span>
                          <Link href={`/${businessSlug}/suppliers/${item.id}`} className="hover:text-blue-700 hover:underline">{item.name}</Link>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {formatPhoneDisplay(item.phone) || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.email || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.address || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.orderedProductsCount == null ? "—" : `${item.orderedProductsCount} produit(s)`}
                      </td>
                      <td className="py-3 pr-3 text-slate-800 font-semibold">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.balance > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                          {formatMoney(item.balance, item.currency)}
                        </span>
                      </td>
                      <td className="py-3">
                        <select
                          value=""
                          disabled={saving}
                          aria-label={`Actions pour ${item.name}`}
                          onChange={(event) => {
                            const action = event.currentTarget.value;
                            event.currentTarget.value = "";
                            if (saving) return;
                            if (action === "detail") router.push(`/${businessSlug}/suppliers/${item.id}`);
                            else if (action === "order") router.push(`/${businessSlug}/purchase-orders?supplier=${encodeURIComponent(item.id)}#new-purchase-order`);
                            else if (action === "edit") beginEdit(item);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                        >
                          <option value="" disabled>Actions</option>
                          <option value="detail">Détail</option>
                          <option value="order">Commander</option>
                          <option value="edit">Modifier</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}{" "}
          <div className="flex items-center justify-between">
            {" "}
            <div className="text-xs text-slate-500">
              {" "}
              Page {page}/{Math.max(1, lastPage)}{" "}
            </div>{" "}
            <div className="flex items-center gap-2">
              {" "}
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {" "}
                Precedent{" "}
              </button>{" "}
              <button
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                disabled={page >= lastPage || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {" "}
                Suivant{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      </section>{" "}
      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeFormModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">
                  {editingId ? "Modifier fournisseur" : "Nouveau fournisseur"}
                </h2>
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Fermer
                </button>
              </div>
              {formError ? (
                <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </section>
              ) : null}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={contactPerson}
                onChange={(event) => setContactPerson(event.target.value)}
                placeholder="Representant"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <PhoneField value={phone} onChange={setPhone} />
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Adresse"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Departement"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  placeholder="Solde"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {SUPPORTED_CURRENCIES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving
                    ? editingId
                      ? "Mise a jour..."
                      : "Ajout..."
                    : editingId
                      ? "Mettre a jour"
                      : "Ajouter"}
                </button>
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="cancel-default w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {editingId ? "Annuler modification" : "Annuler"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {businessSlug ? (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          business={businessSlug}
          entityPath="suppliers"
          title="Importer des fournisseurs"
          templateFilename="modele_fournisseurs.csv"
          columnsHelp={SUPPLIER_IMPORT_COLUMNS}
          onImported={() => setReloadSeq((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
