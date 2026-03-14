export const ROLE_OPTIONS = [
  "owner",
  "admin",
  "manager",
  "supervisor",
  "receptionist",
  "cashier",
  "barman",
  "barwoman",
  "housekeeping",
  "accountant",
  "staff",
] as const;

export type BusinessRole = (typeof ROLE_OPTIONS)[number];

export const STATUS_OPTIONS = ["active", "disabled"] as const;
export type BusinessUserStatus = (typeof STATUS_OPTIONS)[number];

export const ALL_PERMISSIONS = [
  "dashboard.read",
  "billing.read",
  "billing.manage",
  "catalog.read",
  "billing.discount",
  "billing.refund",
  "billing.void",
  "hotel.orders.read",
  "hotel.orders.manage",
  "customers.read",
  "customers.create",
  "customers.edit",
  "customers.manage",
  "reservations.read",
  "reservations.create",
  "reservations.edit",
  "reservations.manage",
  "moments.read",
  "moments.create",
  "moments.edit",
  "moments.manage",
  "housekeeping.read",
  "housekeeping.manage",
  "supplies.read",
  "products.create",
  "products.edit",
  "supplies.manage",
  "inventory.read",
  "inventory.manage",
  "room_setup.read",
  "room_setup.manage",
  "expenses.read",
  "expenses.manage",
  "accounting.read",
  "accounting.manage",
  "reports.read",
  "audit.read",
  "users.read",
  "users.manage",
  "business.read",
  "business.manage",
] as const;

export type BusinessPermission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Proprietaire",
  admin: "Administrateur",
  manager: "Manager",
  supervisor: "Superviseur",
  receptionist: "Receptioniste",
  cashier: "Caissiere",
  barman: "Barman",
  barwoman: "Barwoman",
  housekeeping: "Housekeeping",
  accountant: "Comptable",
  staff: "Staff",
};

export const PERMISSION_LABELS: Record<BusinessPermission, string> = {
  "dashboard.read": "Voir le tableau de bord",
  "billing.read": "Voir tickets, ventes, devis et factures",
  "billing.manage": "Vendre et encaisser",
  "catalog.read": "Charger le catalogue produits dans le POS",
  "billing.discount": "Appliquer un rabais",
  "billing.refund": "Rembourser une vente",
  "billing.void": "Annuler un ticket",
  "hotel.orders.read": "Voir les commandes hotel",
  "hotel.orders.manage": "Confirmer et traiter les commandes hotel",
  "customers.read": "Consulter les clients",
  "customers.create": "Ajouter des clients",
  "customers.edit": "Modifier les clients",
  "customers.manage": "Gerer completement les clients",
  "reservations.read": "Consulter les reservations",
  "reservations.create": "Ajouter des reservations",
  "reservations.edit": "Modifier les reservations",
  "reservations.manage": "Gerer completement les reservations",
  "moments.read": "Consulter les moments",
  "moments.create": "Ajouter des moments",
  "moments.edit": "Modifier les moments",
  "moments.manage": "Gerer completement les moments",
  "housekeeping.read": "Consulter le housekeeping",
  "housekeeping.manage": "Gerer le housekeeping",
  "supplies.read": "Consulter produits et fournitures",
  "products.create": "Ajouter des produits",
  "products.edit": "Modifier les produits",
  "supplies.manage": "Gerer categories, fournisseurs et produits",
  "inventory.read": "Consulter le stock",
  "inventory.manage": "Gerer le stock",
  "room_setup.read": "Consulter le parametrage hotel",
  "room_setup.manage": "Modifier le parametrage hotel",
  "expenses.read": "Consulter les depenses",
  "expenses.manage": "Gerer les depenses",
  "accounting.read": "Consulter la comptabilite",
  "accounting.manage": "Gerer la comptabilite",
  "reports.read": "Consulter les rapports",
  "audit.read": "Consulter l'audit",
  "users.read": "Consulter l'equipe",
  "users.manage": "Gerer les utilisateurs",
  "business.read": "Consulter l'entreprise",
  "business.manage": "Modifier l'entreprise",
};

export const PERMISSION_HINTS: Record<BusinessPermission, string> = {
  "dashboard.read": "Acces aux indicateurs et syntheses du business.",
  "billing.read": "Voir l historique des ventes, tickets, devis et factures.",
  "billing.manage": "Encaisser, vendre et finaliser une operation en caisse.",
  "catalog.read": "Charger les produits du POS et utiliser le scan code-barres.",
  "billing.discount": "Autoriser ou demander un rabais sur une vente.",
  "billing.refund": "Autoriser ou traiter un remboursement.",
  "billing.void": "Autoriser ou annuler un ticket.",
  "hotel.orders.read": "Suivre les commandes envoyees par les reservations.",
  "hotel.orders.manage": "Confirmer, preparer ou cloturer une commande hotel.",
  "customers.read": "Voir la liste et les fiches clients.",
  "customers.create": "Creer une nouvelle fiche client.",
  "customers.edit": "Modifier une fiche client existante.",
  "customers.manage": "Supprimer ou gerer completement les clients.",
  "reservations.read": "Voir les reservations et leur etat.",
  "reservations.create": "Creer une nouvelle reservation.",
  "reservations.edit": "Modifier une reservation existante.",
  "reservations.manage": "Check-in, check-out, annulation et actions avancees.",
  "moments.read": "Voir les sejours moments.",
  "moments.create": "Creer un nouveau moment.",
  "moments.edit": "Modifier un moment existant.",
  "moments.manage": "Supprimer ou gerer completement les moments.",
  "housekeeping.read": "Voir les taches et etats de nettoyage.",
  "housekeeping.manage": "Affecter, modifier et cloturer les taches housekeeping.",
  "supplies.read": "Voir les produits, categories et fournisseurs.",
  "products.create": "Ajouter des produits au catalogue.",
  "products.edit": "Modifier les produits existants.",
  "supplies.manage": "Gerer aussi categories, fournisseurs et suppression produit.",
  "inventory.read": "Consulter le stock, les seuils et les mouvements.",
  "inventory.manage": "Ajuster le stock et enregistrer des mouvements.",
  "room_setup.read": "Voir le parametrage hotel et les chambres.",
  "room_setup.manage": "Ajouter ou modifier categories, chambres et parametrage hotel.",
  "expenses.read": "Voir les depenses et categories de depense.",
  "expenses.manage": "Ajouter ou modifier une depense.",
  "accounting.read": "Voir la comptabilite et les periodes.",
  "accounting.manage": "Cloturer ou ajuster les operations comptables.",
  "reports.read": "Voir les rapports et exports.",
  "audit.read": "Consulter les traces et journaux d audit.",
  "users.read": "Voir les utilisateurs et employes.",
  "users.manage": "Ajouter ou modifier les utilisateurs et leurs acces.",
  "business.read": "Voir les informations du business.",
  "business.manage": "Modifier les reglages du business.",
};

export const FULL_ACCESS_PERMISSIONS = [...ALL_PERMISSIONS] as BusinessPermission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<BusinessRole, BusinessPermission[]> = {
  owner: [...FULL_ACCESS_PERMISSIONS],
  admin: [...FULL_ACCESS_PERMISSIONS],
  manager: [...FULL_ACCESS_PERMISSIONS],
  supervisor: [...FULL_ACCESS_PERMISSIONS],
  receptionist: [
    "dashboard.read",
    "customers.read",
    "customers.create",
    "customers.edit",
    "reservations.read",
    "reservations.create",
    "reservations.edit",
    "reservations.manage",
    "moments.read",
    "moments.create",
    "moments.edit",
    "moments.manage",
  ],
  cashier: [
    "dashboard.read",
    "billing.read",
    "billing.manage",
    "catalog.read",
    "hotel.orders.read",
    "hotel.orders.manage",
    "customers.read",
  ],
  barman: [
    "dashboard.read",
    "billing.read",
    "billing.manage",
    "catalog.read",
    "hotel.orders.read",
    "hotel.orders.manage",
    "customers.read",
  ],
  barwoman: [
    "dashboard.read",
    "billing.read",
    "billing.manage",
    "catalog.read",
    "hotel.orders.read",
    "hotel.orders.manage",
    "customers.read",
  ],
  housekeeping: [
    "dashboard.read",
    "housekeeping.read",
    "housekeeping.manage",
  ],
  accountant: [
    "dashboard.read",
    "billing.read",
    "expenses.read",
    "expenses.manage",
    "accounting.read",
    "accounting.manage",
    "reports.read",
    "audit.read",
  ],
  staff: [
    "dashboard.read",
    "billing.read",
  ],
};

export const PERMISSION_GROUPS: Array<{
  title: string;
  permissions: BusinessPermission[];
}> = [
  {
    title: "Vue generale",
    permissions: ["dashboard.read"],
  },
  {
    title: "Facturation et POS",
    permissions: [
      "billing.read",
      "billing.manage",
      "catalog.read",
      "billing.discount",
      "billing.refund",
      "billing.void",
      "hotel.orders.read",
      "hotel.orders.manage",
    ],
  },
  {
    title: "Clients et sejours",
    permissions: [
      "customers.read",
      "customers.create",
      "customers.edit",
      "customers.manage",
      "reservations.read",
      "reservations.create",
      "reservations.edit",
      "reservations.manage",
      "moments.read",
      "moments.create",
      "moments.edit",
      "moments.manage",
    ],
  },
  {
    title: "Housekeeping",
    permissions: ["housekeeping.read", "housekeeping.manage"],
  },
  {
    title: "Produits et stock",
    permissions: [
      "catalog.read",
      "supplies.read",
      "products.create",
      "products.edit",
      "supplies.manage",
      "inventory.read",
      "inventory.manage",
    ],
  },
  {
    title: "Parametrage hotel",
    permissions: ["room_setup.read", "room_setup.manage"],
  },
  {
    title: "Administration et finance",
    permissions: [
      "expenses.read",
      "expenses.manage",
      "accounting.read",
      "accounting.manage",
      "users.read",
      "users.manage",
      "business.read",
      "business.manage",
      "reports.read",
      "audit.read",
    ],
  },
];

export function normalizeBusinessPermissions(values: readonly string[] | null | undefined): BusinessPermission[] {
  const lookup = new Set<string>(ALL_PERMISSIONS);
  const normalized = (values ?? []).filter(
    (value): value is BusinessPermission => typeof value === "string" && lookup.has(value),
  );
  return Array.from(new Set(normalized));
}

export function getDefaultPermissionsForRole(role: BusinessRole): BusinessPermission[] {
  return [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export function hasPermission(
  permissions: readonly string[] | null | undefined,
  required?: BusinessPermission | BusinessPermission[],
): boolean {
  if (!required) return true;
  const active = new Set(normalizeBusinessPermissions(permissions));
  if (Array.isArray(required)) {
    return required.some((item) => active.has(item));
  }
  return active.has(required);
}

export function summarizePermissions(permissions: readonly string[] | null | undefined): string {
  const active = normalizeBusinessPermissions(permissions);
  if (active.length === 0) return "Aucun acces";
  if (active.length === ALL_PERMISSIONS.length) return "Acces complet";
  return `${active.length} droit(s) actifs`;
}
