"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierItem,
} from "@/lib/suppliersApi";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}
export default function SuppliersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [department, setDepartment] = useState("General");
  const [balance, setBalance] = useState("");
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
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
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, page, query, reloadSeq]);
  const totalBalance = useMemo(
    () => items.reduce((sum, item) => sum + item.balance, 0),
    [items],
  );
  function resetForm() {
    setEditingId("");
    setName("");
    setContactPerson("");
    setPhone("");
    setAddress("");
    setDepartment("General");
    setBalance("");
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!name.trim()) {
      setError("Le nom du fournisseur est obligatoire.");
      return;
    }
    const parsedBalance = balance.trim().length > 0 ? Number(balance) : 0;
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setError("Solde invalide.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      if (editingId) {
        const updated = await updateSupplier(businessSlug, editingId, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          department: department.trim() || "General",
          balance: parsedBalance,
        });
        setItems((prev) =>
          prev.map((row) => (row.id === editingId ? updated : row)),
        );
        setInfo("Fournisseur mis a jour.");
      } else {
        await createSupplier(businessSlug, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          department: department.trim() || "General",
          balance: parsedBalance,
        });
        setInfo("Fournisseur ajoute.");
        setPage(1);
        setQuery("");
        setQueryInput("");
      }
      resetForm();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  function beginEdit(item: SupplierItem) {
    setEditingId(item.id);
    setName(item.name);
    setContactPerson(item.contactPerson ?? "");
    setPhone(item.phone ?? "");
    setAddress(item.address ?? "");
    setDepartment(item.department || "General");
    setBalance(String(item.balance));
    setError("");
    setInfo("");
  }
  return (
    <div className="space-y-6">
      {" "}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <div className="flex items-center justify-between">
          {" "}
          <div>
            {" "}
            <h1 className="text-2xl font-bold text-slate-900">
              Fournisseurs
            </h1>{" "}
            <p className="text-slate-500 mt-1">
              Gestion fournisseurs reliee au backend.
            </p>{" "}
          </div>{" "}
          <div className="text-sm text-slate-600">
            {" "}
            {total} fournisseur(s) | solde page:{" "}
            {formatMoney(totalBalance)}{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {error}{" "}
        </section>
      ) : null}{" "}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {" "}
          {info}{" "}
        </section>
      ) : null}{" "}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {" "}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3"
        >
          {" "}
          <h2 className="font-bold text-slate-900">
            {" "}
            {editingId ? "Modifier fournisseur" : "Nouveau fournisseur"}{" "}
          </h2>{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            value={contactPerson}
            onChange={(event) => setContactPerson(event.target.value)}
            placeholder="Representant"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Telephone"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Adresse"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Departement"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            type="number"
            min="0"
            step="0.01"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder="Solde"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <div className="grid grid-cols-1 gap-2">
            {" "}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {" "}
              {saving
                ? editingId
                  ? "Mise a jour..."
                  : "Ajout..."
                : editingId
                  ? "Mettre a jour"
                  : "Ajouter"}{" "}
            </button>{" "}
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="cancel-default w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {" "}
                Annuler modification{" "}
              </button>
            ) : null}{" "}
          </div>{" "}
        </form>{" "}
        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          {" "}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            {" "}
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Rechercher (nom, representant, phone, adresse, departement)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
            <button
              onClick={() => {
                setQuery(queryInput.trim());
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {" "}
              Filtrer{" "}
            </button>{" "}
          </div>{" "}
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
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Nom</th>
                    <th className="py-3 pr-3 font-semibold">Representant</th>
                    <th className="py-3 pr-3 font-semibold">Telephone</th>
                    <th className="py-3 pr-3 font-semibold">Adresse</th>
                    <th className="py-3 pr-3 font-semibold">Departement</th>
                    <th className="py-3 pr-3 font-semibold">Business</th>
                    <th className="py-3 pr-3 font-semibold">Solde</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.contactPerson || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.phone || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.address || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.department}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.businessSlug ||
                          item.businessName ||
                          item.businessId ||
                          "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-800 font-semibold">
                        {formatMoney(item.balance)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              beginEdit(item);
                            }}
                            disabled={saving}
                            title="Modifier"
                            aria-label="Modifier"
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <i
                              className="fa-solid fa-pen-to-square"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
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
        </div>{" "}
      </section>{" "}
    </div>
  );
}
