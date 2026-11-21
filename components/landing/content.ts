import type { BusinessType } from "@/lib/businessApi";

// School and clinic categories are intentionally omitted from the public homepage.
// Display copy is translated in messages/landing/*.json.
export const solutions = [
  { businessType: "retail", emoji: "🛍️" },
  { businessType: "hotel", emoji: "🏨" },
  { businessType: "restaurant", emoji: "🍽️" },
  { businessType: "bar_cafe", emoji: "☕" },
  { businessType: "hardware_store", emoji: "🛠️" },
  { businessType: "pharmacy", emoji: "💊" },
  { businessType: "supermarket", emoji: "🛒" },
  { businessType: "salon_beauty", emoji: "💇" },
  { businessType: "garage", emoji: "🔧" },
  { businessType: "real_estate", emoji: "🏠" },
  { businessType: "fashion", emoji: "👗" },
  { businessType: "electronics", emoji: "💻" },
  { businessType: "professional_services", emoji: "💼" },
  { businessType: "other", emoji: "🧩" },
] satisfies Array<{ businessType: Exclude<BusinessType, "school" | "clinic">; emoji: string }>;

// Match the modules exposed by Sidebar.tsx and the API, not hypothetical services.
export const applications = ["commerce", "billing", "hotel", "restaurant", "services", "finance"] as const;

export const faqs = [
  {
    "q": "Que se passe-t-il si la connexion Internet est coupée ?",
    "a": "Le logiciel fonctionne normalement sans Internet. Vous continuez d'encaisser, d'émettre des reçus et d'enregistrer des ventes. Dès que votre réseau revient, les données se synchronisent de manière transparente sur le Cloud."
  },
  {
    "q": "Peut-on gérer les paiements en Gourdes (HTG) et Dollars (USD) ?",
    "a": "Absolument. Vous pouvez fixer vos prix dans la devise de votre choix, définir un taux du jour et accepter un paiement combiné (par exemple une partie en cash USD et la monnaie rendue en HTG)."
  },
  {
    "q": "Comment démarrer et former mon équipe ?",
    "a": "La création de compte prend moins de 2 minutes. Nous fournissons des tutoriels vidéo courts et une session d'assistance WhatsApp directe pour vous aider à importer vos produits."
  },
  {
    "q": "Mes données financières sont-elles en sécurité ?",
    "a": "Toutes les communications sont chiffrées selon les standards TLS. Vos sauvegardes sont dupliquées quotidiennement sur plusieurs serveurs sécurisés."
  }
];
