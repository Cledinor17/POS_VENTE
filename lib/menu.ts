import type { Permission } from "./rbac";

export type MenuItem = {
  label: string;
  href: (business: string) => string;
  icon: string; // FontAwesome class
  permission?: Permission;
};

export type MenuGroup = {
  title: string;
  items: MenuItem[];
};

export const menuGroups: MenuGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: (b) => `/${b}/dashboard`, icon: "fa-solid fa-th-large", permission: "dashboard.read" },
      { label: "Caisse (POS)", href: (b) => `/${b}/pos`, icon: "fa-solid fa-cash-register", permission: "pos.use" },
      { label: "Commandes / Tickets", href: (b) => `/${b}/orders`, icon: "fa-solid fa-receipt", permission: "orders.read" },
      { label: "Retours / Avoirs", href: (b) => `/${b}/returns`, icon: "fa-solid fa-rotate-left", permission: "returns.manage" },
      { label: "Sessions de caisse", href: (b) => `/${b}/cash-shifts`, icon: "fa-solid fa-user-clock", permission: "cash_shifts.manage" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Produits", href: (b) => `/${b}/products`, icon: "fa-solid fa-box", permission: "products.read" },
      { label: "Catégories", href: (b) => `/${b}/categories`, icon: "fa-solid fa-tags", permission: "products.manage" },
      { label: "Marques", href: (b) => `/${b}/brands`, icon: "fa-solid fa-certificate", permission: "products.manage" },
      { label: "Variantes / Attributs", href: (b) => `/${b}/variants`, icon: "fa-solid fa-layer-group", permission: "products.manage" },
      { label: "Taxes", href: (b) => `/${b}/taxes`, icon: "fa-solid fa-percent", permission: "settings.manage" },
      { label: "Promotions / Remises", href: (b) => `/${b}/discounts`, icon: "fa-solid fa-ticket", permission: "settings.manage" },
      { label: "Unités", href: (b) => `/${b}/units`, icon: "fa-solid fa-ruler-combined", permission: "products.manage" },
      { label: "Étiquettes / Codes-barres", href: (b) => `/${b}/labels`, icon: "fa-solid fa-barcode", permission: "products.manage" },
    ],
  },
  {
    title: "Stock",
    items: [
      { label: "Inventaire", href: (b) => `/${b}/inventory`, icon: "fa-solid fa-warehouse", permission: "inventory.read" },
      { label: "Mouvements stock", href: (b) => `/${b}/stock-movements`, icon: "fa-solid fa-right-left", permission: "inventory.manage" },
      { label: "Ajustements", href: (b) => `/${b}/adjustments`, icon: "fa-solid fa-sliders", permission: "inventory.manage" },
      { label: "Transferts", href: (b) => `/${b}/transfers`, icon: "fa-solid fa-truck-fast", permission: "inventory.manage" },
      { label: "Dépôts / Entrepôts", href: (b) => `/${b}/warehouses`, icon: "fa-solid fa-building", permission: "inventory.manage" },
    ],
  },
  {
    title: "Achats",
    items: [
      { label: "Fournisseurs", href: (b) => `/${b}/suppliers`, icon: "fa-solid fa-people-carry-box", permission: "suppliers.read" },
      { label: "Bons de commande", href: (b) => `/${b}/purchase-orders`, icon: "fa-solid fa-file-signature", permission: "purchases.manage" },
      { label: "Réceptions (Achats)", href: (b) => `/${b}/purchases`, icon: "fa-solid fa-truck-ramp-box", permission: "purchases.manage" },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Clients", href: (b) => `/${b}/customers`, icon: "fa-solid fa-users", permission: "customers.read" },
      { label: "Fidélité / Points", href: (b) => `/${b}/loyalty`, icon: "fa-solid fa-star", permission: "customers.read" },
      { label: "Cartes cadeaux", href: (b) => `/${b}/gift-cards`, icon: "fa-solid fa-gift", permission: "customers.read" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Dépenses", href: (b) => `/${b}/expenses`, icon: "fa-solid fa-money-bill-wave", permission: "expenses.manage" },
      { label: "Paiements", href: (b) => `/${b}/payments`, icon: "fa-solid fa-credit-card", permission: "expenses.manage" },
      { label: "Exports", href: (b) => `/${b}/exports`, icon: "fa-solid fa-file-export", permission: "reports.read" },
    ],
  },
  {
    title: "Analyse",
    items: [
      { label: "Rapports", href: (b) => `/${b}/reports`, icon: "fa-solid fa-chart-line", permission: "reports.read" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "My Business", href: (b) => `/${b}/business`, icon: "fa-solid fa-building", permission: "settings.manage" },
      { label: "Utilisateurs", href: (b) => `/${b}/users`, icon: "fa-solid fa-user-gear", permission: "users.manage" },
      { label: "Employes", href: (b) => `/${b}/employees`, icon: "fa-solid fa-id-badge", permission: "users.manage" },
      { label: "Rôles & permissions", href: (b) => `/${b}/roles`, icon: "fa-solid fa-shield-halved", permission: "roles.manage" },
      { label: "Business / Branches", href: (b) => `/${b}/business`, icon: "fa-solid fa-sitemap", permission: "business.manage" },
      { label: "Paramètres", href: (b) => `/${b}/settings`, icon: "fa-solid fa-gear", permission: "settings.manage" },
      { label: "Journal d’audit", href: (b) => `/${b}/audit-logs`, icon: "fa-solid fa-clipboard-list", permission: "audit.read" },
    ],
  },
];
