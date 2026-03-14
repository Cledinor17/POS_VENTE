"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import IdentityDocumentField from "@/components/IdentityDocumentField";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/businessAccess";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CustomerAddress,
  type CustomerItem,
} from "@/lib/customersApi";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

type CustomerAddressDraft = Record<keyof CustomerAddress, string>;

type CreateCustomerFormState = {
  code: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxNumber: string;
  currency: string;
  paymentTermsDays: string;
  creditLimit: string;
  notes: string;
  billingAddress: CustomerAddressDraft;
  shippingAddress: CustomerAddressDraft;
  identityDocumentFile: File | null;
};

function createEmptyAddressDraft(): CustomerAddressDraft {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  };
}

function createEmptyCustomerForm(): CreateCustomerFormState {
  return {
    code: "",
    name: "",
    companyName: "",
    email: "",
    phone: "",
    taxNumber: "",
    currency: "",
    paymentTermsDays: "",
    creditLimit: "",
    notes: "",
    billingAddress: createEmptyAddressDraft(),
    shippingAddress: createEmptyAddressDraft(),
    identityDocumentFile: null,
  };
}

function createAddressDraftFromCustomer(address: CustomerAddress | null | undefined): CustomerAddressDraft {
  return {
    line1: address?.line1 ?? "",
    line2: address?.line2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    zip: address?.zip ?? "",
    country: address?.country ?? "",
  };
}

function createCustomerFormFromItem(item: CustomerItem): CreateCustomerFormState {
  return {
    code: item.code ?? "",
    name: item.name ?? "",
    companyName: item.companyName ?? "",
    email: item.email ?? "",
    phone: item.phone ?? "",
    taxNumber: item.taxNumber ?? "",
    currency: item.currency ?? "",
    paymentTermsDays:
      item.paymentTermsDays !== null && item.paymentTermsDays !== undefined
        ? String(item.paymentTermsDays)
        : "",
    creditLimit:
      item.creditLimit !== null && item.creditLimit !== undefined
        ? String(item.creditLimit)
        : "",
    notes: item.notes ?? "",
    billingAddress: createAddressDraftFromCustomer(item.billingAddress),
    shippingAddress: createAddressDraftFromCustomer(item.shippingAddress),
    identityDocumentFile: null,
  };
}

function getCustomerDisplayName(item: CustomerItem): string {
  const candidates = [
    item.name,
    item.companyName,
    item.email,
    item.phone,
    item.code,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Client";
}

function getCustomerInitials(item: CustomerItem): string {
  const label = getCustomerDisplayName(item);
  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "CL";
}

const CUSTOMER_FORM_STEPS = [
  {
    id: "identity",
    title: "Identite",
    description: "Coordonnees et informations principales du client.",
  },
  {
    id: "addresses",
    title: "Adresses",
    description: "Facturation et livraison.",
  },
  {
    id: "documents",
    title: "Gestion",
    description: "Conditions, notes et piece d'identite.",
  },
] as const;

export default function CustomersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const { loading: permissionsLoading, permissions: currentPermissions } = useBusinessPermissions(businessSlug);
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "1" | "0">("");
  const [form, setForm] = useState<CreateCustomerFormState>(() => createEmptyCustomerForm());
  const [formError, setFormError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const canReadCustomers = hasPermission(currentPermissions, ["customers.read", "customers.manage"]);
  const canCreateCustomers = hasPermission(currentPermissions, ["customers.create", "customers.manage"]);
  const canEditCustomers = hasPermission(currentPermissions, ["customers.edit", "customers.manage"]);
  const hasCustomerAccess = canReadCustomers || canCreateCustomers || canEditCustomers;
  const isCustomersReadOnly = canReadCustomers && !canCreateCustomers && !canEditCustomers;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug || permissionsLoading) return;
      if (!canReadCustomers) {
        if (!mounted) return;
        setItems([]);
        setLastPage(1);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await listCustomers(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
          isActive: activeFilter === "" ? undefined : activeFilter === "1",
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
  }, [activeFilter, businessSlug, canReadCustomers, page, permissionsLoading, query]);
  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items],
  );
  const editingCustomer = useMemo(
    () => items.find((item) => item.id === editingCustomerId) ?? null,
    [editingCustomerId, items],
  );
  const isEditingCustomer = editingCustomerId !== null;

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCreateModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateModalOpen]);

  async function refreshCustomers(targetPage = page) {
    if (!businessSlug || !canReadCustomers) return;
    const refresh = await listCustomers(businessSlug, {
      page: targetPage,
      perPage: 20,
      q: query || undefined,
      isActive: activeFilter === "" ? undefined : activeFilter === "1",
    });
    setItems(refresh.items);
    setLastPage(refresh.lastPage);
    setTotal(refresh.total);
  }

  function updateFormField<K extends keyof CreateCustomerFormState>(field: K, value: CreateCustomerFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFormAddress(section: "billingAddress" | "shippingAddress", field: keyof CustomerAddressDraft, value: string) {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  function openCreateModal() {
    if (!canCreateCustomers) return;
    setEditingCustomerId(null);
    setForm(createEmptyCustomerForm());
    setFormError("");
    setFormStep(0);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setEditingCustomerId(null);
    setForm(createEmptyCustomerForm());
    setFormStep(0);
    setFormError("");
  }

  function openEditModal(item: CustomerItem) {
    if (!canEditCustomers) return;
    setEditingCustomerId(String(item.id));
    setForm(createCustomerFormFromItem(item));
    setFormError("");
    setFormStep(0);
    setIsCreateModalOpen(true);
  }

  function validateFormStep(step: number): boolean {
    return true;
  }

  function goToFormStep(step: number) {
    if (step < formStep) {
      setFormError("");
      setFormStep(step);
      return;
    }

    for (let current = formStep; current < step; current += 1) {
      if (!validateFormStep(current)) return;
    }

    setFormError("");
    setFormStep(step);
  }

  function goToNextFormStep() {
    if (!validateFormStep(formStep)) return;
    setFormError("");
    setFormStep((prev) => Math.min(prev + 1, CUSTOMER_FORM_STEPS.length - 1));
  }

  function goToPreviousFormStep() {
    setFormError("");
    setFormStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (isEditingCustomer && !canEditCustomers) {
      setFormError("Tu n'as pas l'autorisation de modifier un client.");
      return;
    }
    if (!isEditingCustomer && !canCreateCustomers) {
      setFormError("Tu n'as pas l'autorisation d'ajouter un client.");
      return;
    }
    setSaving(true);
    setFormError("");
    setInfo("");
    try {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        currency: form.currency.trim() || undefined,
        paymentTermsDays: form.paymentTermsDays.trim() ? Number(form.paymentTermsDays) : undefined,
        creditLimit: form.creditLimit.trim() ? Number(form.creditLimit) : undefined,
        notes: form.notes.trim() || undefined,
        billingAddress: form.billingAddress,
        shippingAddress: form.shippingAddress,
        identityDocumentFile: form.identityDocumentFile,
      };

      if (isEditingCustomer && editingCustomerId) {
        await updateCustomer(businessSlug, editingCustomerId, payload);
        closeCreateModal();
        setInfo("Client mis a jour avec succes.");
        await refreshCustomers(page);
      } else {
        await createCustomer(businessSlug, payload);
        closeCreateModal();
        setInfo("Client ajoute avec succes.");
        setPage(1);
        await refreshCustomers(1);
      }
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function handleToggle(item: CustomerItem) {
    if (!businessSlug || !canEditCustomers) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    setInfo("");
    try {
      const updated = await updateCustomer(businessSlug, id, {
        isActive: !item.isActive,
      });
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  const isLastFormStep = formStep === CUSTOMER_FORM_STEPS.length - 1;

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500 mt-1">
              Liste clients reliee au backend.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500">
              {total} client(s) | actifs sur page: {activeCount}
            </div>
            {canCreateCustomers ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white"
              >
                Nouveau client
              </button>
            ) : null}
          </div>
        </div>
      </section>
      {!permissionsLoading && !hasCustomerAccess ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ce profil n&apos;a pas encore d&apos;acces au module clients.
        </section>
      ) : null}
      {!permissionsLoading && !canReadCustomers && canCreateCustomers ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Ce profil peut ajouter des clients, mais ne peut pas consulter la liste complete.
        </section>
      ) : null}
      {!permissionsLoading && isCustomersReadOnly ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Acces en lecture seule: la consultation reste disponible, mais les actions d&apos;ajout et de modification sont masquees.
        </section>
      ) : null}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </section>
      ) : null}
      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
          onClick={closeCreateModal}
        >
          <form
            onSubmit={handleCreate}
            className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-h-[90vh] sm:h-auto sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 id="customer-modal-title" className="text-lg font-bold text-slate-900">
                  {isEditingCustomer ? "Modifier client" : "Nouveau client"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isEditingCustomer
                    ? "Modifie le client avec tous ses champs dans un formulaire en 3 etapes."
                    : "Ajoute le client avec un formulaire en 3 etapes."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            {formError ? (
              <div className="mt-3 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mt-4 sm:px-4 sm:py-3">
                {formError}
              </div>
            ) : null}

            <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3 sm:mt-4 sm:space-y-4">
              <div className="grid shrink-0 grid-cols-3 gap-2">
                {CUSTOMER_FORM_STEPS.map((step, index) => {
                  const isActive = index === formStep;
                  const isCompleted = index < formStep;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => goToFormStep(index)}
                      className={`rounded-xl border px-2 py-2 text-left transition sm:px-4 sm:py-3 ${
                        isActive
                          ? "border-indigo-300 bg-indigo-50"
                          : isCompleted
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
                        Etape {index + 1}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-900 sm:text-sm">{step.title}</div>
                      <div className="mt-1 hidden text-xs text-slate-600 sm:block">{step.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:block">
                <div className="text-sm font-semibold text-slate-900">
                  {CUSTOMER_FORM_STEPS[formStep]?.title}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {CUSTOMER_FORM_STEPS[formStep]?.description}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <div
                  className="flex h-full transition-transform duration-300 ease-out"
                  style={{
                    width: `${CUSTOMER_FORM_STEPS.length * 100}%`,
                    transform: `translateX(-${formStep * (100 / CUSTOMER_FORM_STEPS.length)}%)`,
                  }}
                >
                  <div className="min-h-0 overflow-y-auto pr-1" style={{ width: `${100 / CUSTOMER_FORM_STEPS.length}%` }}>
                    <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                      <input
                        value={form.code}
                        onChange={(event) => updateFormField("code", event.target.value)}
                        placeholder="Code client"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <input
                        value={form.companyName}
                        onChange={(event) => updateFormField("companyName", event.target.value)}
                        placeholder="Entreprise"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <input
                        value={form.name}
                        onChange={(event) => updateFormField("name", event.target.value)}
                        placeholder="Nom (optionnel)"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                      />
                      <input
                        value={form.email}
                        onChange={(event) => updateFormField("email", event.target.value)}
                        placeholder="Email"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                      />
                      <input
                        value={form.phone}
                        onChange={(event) => updateFormField("phone", event.target.value)}
                        placeholder="Telephone"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <input
                        value={form.taxNumber}
                        onChange={(event) => updateFormField("taxNumber", event.target.value)}
                        placeholder="NIF / NINU / ID"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto px-1" style={{ width: `${100 / CUSTOMER_FORM_STEPS.length}%` }}>
                    <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
                      <div className="rounded-xl border border-slate-200 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">Adresse de facturation</h3>
                        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                          <input
                            value={form.billingAddress.line1}
                            onChange={(event) => updateFormAddress("billingAddress", "line1", event.target.value)}
                            placeholder="Ligne 1"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                          />
                          <input
                            value={form.billingAddress.line2}
                            onChange={(event) => updateFormAddress("billingAddress", "line2", event.target.value)}
                            placeholder="Ligne 2"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                          />
                          <input
                            value={form.billingAddress.city}
                            onChange={(event) => updateFormAddress("billingAddress", "city", event.target.value)}
                            placeholder="Ville"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.billingAddress.state}
                            onChange={(event) => updateFormAddress("billingAddress", "state", event.target.value)}
                            placeholder="Etat / Departement"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.billingAddress.zip}
                            onChange={(event) => updateFormAddress("billingAddress", "zip", event.target.value)}
                            placeholder="Code postal"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.billingAddress.country}
                            onChange={(event) => updateFormAddress("billingAddress", "country", event.target.value)}
                            placeholder="Pays"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">Adresse de livraison</h3>
                        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                          <input
                            value={form.shippingAddress.line1}
                            onChange={(event) => updateFormAddress("shippingAddress", "line1", event.target.value)}
                            placeholder="Ligne 1"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                          />
                          <input
                            value={form.shippingAddress.line2}
                            onChange={(event) => updateFormAddress("shippingAddress", "line2", event.target.value)}
                            placeholder="Ligne 2"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                          />
                          <input
                            value={form.shippingAddress.city}
                            onChange={(event) => updateFormAddress("shippingAddress", "city", event.target.value)}
                            placeholder="Ville"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.shippingAddress.state}
                            onChange={(event) => updateFormAddress("shippingAddress", "state", event.target.value)}
                            placeholder="Etat / Departement"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.shippingAddress.zip}
                            onChange={(event) => updateFormAddress("shippingAddress", "zip", event.target.value)}
                            placeholder="Code postal"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            value={form.shippingAddress.country}
                            onChange={(event) => updateFormAddress("shippingAddress", "country", event.target.value)}
                            placeholder="Pays"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto pl-1" style={{ width: `${100 / CUSTOMER_FORM_STEPS.length}%` }}>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start xl:grid-cols-[minmax(0,1fr)_300px] sm:gap-4">
                      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                        <input
                          value={form.currency}
                          onChange={(event) => updateFormField("currency", event.target.value)}
                          placeholder="Devise"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <input
                          type="number"
                          min="0"
                          value={form.paymentTermsDays}
                          onChange={(event) => updateFormField("paymentTermsDays", event.target.value)}
                          placeholder="Delai paiement (jours)"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.creditLimit}
                          onChange={(event) => updateFormField("creditLimit", event.target.value)}
                          placeholder="Limite credit"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                        <div />
                        <textarea
                          value={form.notes}
                          onChange={(event) => updateFormField("notes", event.target.value)}
                          placeholder="Notes"
                          rows={4}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2"
                        />
                      </div>

                      <IdentityDocumentField
                        file={form.identityDocumentFile}
                        onFileChange={(file) => updateFormField("identityDocumentFile", file)}
                        className="h-fit"
                      />
                      {isEditingCustomer && editingCustomer?.identityDocumentUrl && !form.identityDocumentFile ? (
                        <a
                          href={editingCustomer.identityDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Voir la piece actuelle
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-5 sm:pt-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                {formStep > 0 ? (
                  <button
                    type="button"
                    onClick={goToPreviousFormStep}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Precedent
                  </button>
                ) : null}
                {!isLastFormStep ? (
                  <button
                    type="button"
                    onClick={goToNextFormStep}
                    className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? isEditingCustomer
                        ? "Mise a jour..."
                        : "Ajout..."
                      : isEditingCustomer
                        ? "Mettre a jour"
                        : "Ajouter"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        {!canReadCustomers ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
            La liste des clients n&apos;est pas visible avec ce profil.
          </div>
        ) : null}
        {canReadCustomers ? (
          <>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_auto] gap-3">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Rechercher (nom, email, phone...)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value as "" | "1" | "0");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous</option> <option value="1">Actifs</option>
              <option value="0">Inactifs</option>
            </select>
            <button
              onClick={() => {
                setQuery(queryInput.trim());
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Filtrer
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des clients...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun client trouve.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Client</th>
                    <th className="py-3 pr-3 font-semibold">Contact</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-sm font-bold text-white">
                              {getCustomerInitials(item)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">
                                {getCustomerDisplayName(item)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {item.companyName || item.code || "-"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          <div>{item.email || "-"}</div>
                          <div className="text-xs">{item.phone || "-"}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              item.isActive
                                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {item.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {canEditCustomers ? (
                              <>
                                <button
                                  onClick={() => {
                                    openEditModal(item);
                                  }}
                                  disabled={busy}
                                  title="Modifier"
                                  aria-label="Modifier"
                                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  <i
                                    className="fa-solid fa-pen-to-square"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    void handleToggle(item);
                                  }}
                                  disabled={busy}
                                  title={item.isActive ? "Desactiver" : "Activer"}
                                  aria-label={
                                    item.isActive ? "Desactiver" : "Activer"
                                  }
                                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  <i
                                    className={
                                      item.isActive
                                        ? "fa-solid fa-user-slash"
                                        : "fa-solid fa-user-check"
                                    }
                                    aria-hidden="true"
                                  />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">Lecture seule</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Page {page}/{Math.max(1, lastPage)}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Precedent
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                disabled={page >= lastPage || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
