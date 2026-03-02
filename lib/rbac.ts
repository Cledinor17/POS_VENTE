export type Permission =
  | "dashboard.read"
  | "pos.use"
  | "orders.read"
  | "returns.manage"
  | "cash_shifts.manage"
  | "products.read"
  | "products.manage"
  | "inventory.read"
  | "inventory.manage"
  | "purchases.manage"
  | "customers.read"
  | "suppliers.read"
  | "expenses.manage"
  | "reports.read"
  | "users.manage"
  | "roles.manage"
  | "settings.manage"
  | "business.manage"
  | "audit.read";

export type UserSession = {
  name: string;
  initials: string;
  permissions: Permission[];
};

// ⚠️ Placeholder : remplace par les données venant de Laravel (Sanctum/JWT)
export function getMockSession(): UserSession {
  return {
    name: "Fredlin",
    initials: "FC",
    permissions: [
      "dashboard.read",
      "pos.use",
      "orders.read",
      "products.manage",
      "inventory.manage",
      "customers.read",
      "reports.read",
      "settings.manage",
      "users.manage",
      "roles.manage",
      "business.manage",
      "audit.read",
      "expenses.manage",
      "returns.manage",
      "cash_shifts.manage",
      "purchases.manage",
      "suppliers.read",
    ],
  };
}
