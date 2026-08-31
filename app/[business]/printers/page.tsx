"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createPrinter,
  deletePrinter,
  listPrinters,
  openCashDrawer,
  updatePrinter,
  type PrinterConnectionType,
  type PrinterItem,
  type PrinterPaperWidth,
} from "@/lib/printersApi";
import { printRawEscposViaQz } from "@/lib/qzPrint";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function PrintersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<PrinterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>("network");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("9100");
  const [qzPrinterName, setQzPrinterName] = useState("");
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>("80");
  const [cashDrawerEnabled, setCashDrawerEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setPageError("");
      try {
        const res = await listPrinters(businessSlug);
        if (!mounted) return;
        setItems(res);
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
  }, [businessSlug, reloadSeq]);

  const resetForm = useCallback(() => {
    setEditingId("");
    setName("");
    setConnectionType("network");
    setIpAddress("");
    setPort("9100");
    setQzPrinterName("");
    setPaperWidth("80");
    setCashDrawerEnabled(true);
    setIsDefault(false);
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

  function beginEdit(item: PrinterItem) {
    setEditingId(item.id);
    setName(item.name);
    setConnectionType(item.connectionType);
    setIpAddress(item.ipAddress ?? "");
    setPort(item.port ? String(item.port) : "9100");
    setQzPrinterName(item.qzPrinterName ?? "");
    setPaperWidth(item.paperWidth);
    setCashDrawerEnabled(item.cashDrawerEnabled);
    setIsDefault(item.isDefault);
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!name.trim()) {
      setFormError("Le nom de l'imprimante est obligatoire.");
      return;
    }
    if (connectionType === "network" && !ipAddress.trim()) {
      setFormError("L'adresse IP est obligatoire pour une imprimante reseau.");
      return;
    }
    if (connectionType === "qz" && !qzPrinterName.trim()) {
      setFormError("Le nom d'imprimante systeme (QZ) est obligatoire pour une imprimante USB.");
      return;
    }

    setSaving(true);
    setFormError("");
    setInfo("");
    try {
      const payload = {
        name: name.trim(),
        connectionType,
        ipAddress: connectionType === "network" ? ipAddress.trim() : null,
        port: connectionType === "network" ? Number(port) || 9100 : null,
        qzPrinterName: connectionType === "qz" ? qzPrinterName.trim() : null,
        paperWidth,
        cashDrawerEnabled,
        isDefault,
      };

      if (editingId) {
        const updated = await updatePrinter(businessSlug, editingId, payload);
        setItems((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
        setInfo("Imprimante mise a jour.");
      } else {
        await createPrinter(businessSlug, payload);
        setInfo("Imprimante ajoutee.");
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

  async function handleDelete(item: PrinterItem) {
    if (!businessSlug) return;
    if (!window.confirm(`Supprimer l'imprimante "${item.name}" ?`)) return;
    setPageError("");
    setInfo("");
    try {
      await deletePrinter(businessSlug, item.id);
      setInfo("Imprimante supprimee.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setPageError(getErrorMessage(e));
    }
  }

  async function handleTest(item: PrinterItem) {
    if (!businessSlug) return;
    setTestingId(item.id);
    setPageError("");
    setInfo("");
    try {
      const result = await openCashDrawer(businessSlug, item.id);
      if (result.opened) {
        setInfo(`Tiroir ouvert sur "${item.name}".`);
      } else if (result.qzPrinterName) {
        await printRawEscposViaQz(result.qzPrinterName, result.data);
        setInfo(`Commande envoyee a "${item.name}" via QZ Tray.`);
      }
    } catch (e) {
      setPageError(getErrorMessage(e));
    } finally {
      setTestingId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Imprimantes</h1>
            <p className="text-slate-500 mt-1">
              Configure les imprimantes de tickets et l&apos;ouverture du tiroir-caisse.
            </p>
          </div>
          <div className="text-sm text-slate-600">{items.length} imprimante(s)</div>
        </div>
      </section>

      {pageError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError}
        </section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </section>
      ) : null}

      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Une imprimante reseau s&apos;utilise directement (aucun logiciel a installer). Une
            imprimante USB passe par QZ Tray, a installer sur ce poste.
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
          >
            Nouvelle imprimante
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des imprimantes...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucune imprimante configuree.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 font-semibold">Nom</th>
                  <th className="py-3 pr-3 font-semibold">Connexion</th>
                  <th className="py-3 pr-3 font-semibold">Cible</th>
                  <th className="py-3 pr-3 font-semibold">Papier</th>
                  <th className="py-3 pr-3 font-semibold">Tiroir</th>
                  <th className="py-3 pr-3 font-semibold">Defaut</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.connectionType === "network" ? "Reseau" : "USB (QZ Tray)"}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.connectionType === "network"
                        ? `${item.ipAddress ?? "-"}:${item.port ?? 9100}`
                        : item.qzPrinterName ?? "-"}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{item.paperWidth}mm</td>
                    <td className="py-3 pr-3 text-slate-600">{item.cashDrawerEnabled ? "Oui" : "Non"}</td>
                    <td className="py-3 pr-3 text-slate-600">{item.isDefault ? "Oui" : "-"}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTest(item)}
                          disabled={testingId === item.id || !item.cashDrawerEnabled}
                          title="Tester (ouvre le tiroir)"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {testingId === item.id ? "..." : "Tester"}
                        </button>
                        <button
                          onClick={() => beginEdit(item)}
                          title="Modifier"
                          aria-label="Modifier"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          title="Supprimer"
                          aria-label="Supprimer"
                          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                  {editingId ? "Modifier l'imprimante" : "Nouvelle imprimante"}
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
                placeholder="Nom (ex: Caisse principale) *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConnectionType("network")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    connectionType === "network"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Reseau (Ethernet/WiFi)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionType("qz")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    connectionType === "qz"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  USB (via QZ Tray)
                </button>
              </div>

              {connectionType === "network" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                  <input
                    value={ipAddress}
                    onChange={(event) => setIpAddress(event.target.value)}
                    placeholder="Adresse IP (ex: 192.168.1.50) *"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                    placeholder="Port"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              ) : (
                <input
                  value={qzPrinterName}
                  onChange={(event) => setQzPrinterName(event.target.value)}
                  placeholder="Nom de l'imprimante systeme (tel que vu dans QZ Tray) *"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              )}

              <select
                value={paperWidth}
                onChange={(event) => setPaperWidth(event.target.value as PrinterPaperWidth)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="80">Papier 80mm</option>
                <option value="58">Papier 58mm</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={cashDrawerEnabled}
                  onChange={(event) => setCashDrawerEnabled(event.target.checked)}
                />
                Tiroir-caisse relie a cette imprimante
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                />
                Utiliser par defaut a la caisse
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (editingId ? "Mise a jour..." : "Ajout...") : editingId ? "Mettre a jour" : "Ajouter"}
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
    </div>
  );
}
