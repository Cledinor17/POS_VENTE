import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Compte et connexion",
    items: [
      {
        question: "Comment creer mon compte et mon entreprise ?",
        answer:
          "Depuis la page de connexion, cliquez sur \"Creer un etablissement\". Vous recevrez un code de validation par e-mail a saisir avant de pouvoir configurer votre entreprise.",
      },
      {
        question: "Ou saisir mon code de validation ?",
        answer:
          "Sur la page de connexion, le lien \"J'ai deja un code de validation\" vous amene a l'ecran de verification ou saisir le code recu par e-mail.",
      },
      {
        question: "Puis-je gerer plusieurs entreprises avec un seul compte ?",
        answer:
          "Oui. Un meme compte peut appartenir a plusieurs entreprises (par exemple en tant que proprietaire d'une et employe d'une autre) ; chaque entreprise dispose de son propre espace, de ses propres donnees et de son propre catalogue.",
      },
      {
        question: "Comment voir l'historique de mes connexions ?",
        answer:
          "Le menu du haut affiche \"Mes connexions\" : vous y retrouvez la date, l'adresse IP, le navigateur et l'appareil de chaque connexion recente a votre compte.",
      },
    ],
  },
  {
    title: "Point de vente (caisse)",
    items: [
      {
        question: "Dois-je ouvrir la caisse avant de pouvoir vendre ?",
        answer:
          "Oui. Chaque caissier doit ouvrir sa propre session de caisse (avec un fonds de depart) avant d'encaisser une vente. Si la caisse est fermee, un bandeau s'affiche sur l'ecran de vente avec un bouton pour l'ouvrir immediatement.",
      },
      {
        question: "Comment scanner un code-barres ?",
        answer:
          "L'ecran de caisse et les fiches produit proposent un bouton camera qui active le scanner de code-barres directement depuis le navigateur, sans materiel supplementaire.",
      },
      {
        question: "Comment imprimer le ticket de caisse ?",
        answer:
          "Vous pouvez configurer une imprimante thermique reseau ou une imprimante USB (via QZ Tray). Une fois une imprimante par defaut definie, chaque vente s'imprime automatiquement ; en cas d'echec, l'application propose une impression navigateur de secours.",
      },
      {
        question: "Puis-je vendre si la connexion internet coupe ?",
        answer:
          "Oui, l'ecran de caisse fonctionne en mode hors-ligne : le catalogue reste disponible depuis le dernier chargement, la vente est enregistree localement avec un ticket provisoire, puis synchronisee automatiquement des que la connexion revient. Les fonctions necessitant des donnees a jour (selection client, points de fidelite, codes promo) sont temporairement desactivees pendant la coupure.",
      },
      {
        question: "Comment appliquer un rabais ou un code promo ?",
        answer:
          "Un rabais (pourcentage ou montant fixe) peut s'appliquer sur l'ensemble de la vente ou sur une ligne d'article precise. Un code promo se saisit dans le panneau de paiement et est verifie automatiquement (validite, montant minimum, nombre d'utilisations).",
      },
    ],
  },
  {
    title: "Clients et fidelite",
    items: [
      {
        question: "Comment fonctionne le programme de points de fidelite ?",
        answer:
          "Un client gagne des points a chaque achat et peut les utiliser pour reduire le montant d'une vente future, dans la limite d'un plafond configurable par l'entreprise.",
      },
      {
        question: "Comment associer un client a une vente ?",
        answer:
          "Dans le panneau de paiement de la caisse, recherchez le client par nom ou telephone ; sans selection, la vente est enregistree au client comptoir par defaut.",
      },
    ],
  },
  {
    title: "Stock, facturation et rapports",
    items: [
      {
        question: "Comment suivre mon stock ?",
        answer:
          "Chaque vente met a jour le stock automatiquement, et une alerte est generee lorsque le stock d'un produit passe sous son seuil de reappro configure.",
      },
      {
        question: "Ou consulter mes ventes du jour et cloturer ma caisse ?",
        answer:
          "\"Mon rapport du jour\" recapitule vos ventes et encaissements de la journee et permet d'enregistrer la remise de caisse et de fermer votre session de caisse en fin de service.",
      },
    ],
  },
  {
    title: "Hotel, restaurant et autres secteurs",
    items: [
      {
        question: "L'application gere-t-elle uniquement les hotels ?",
        answer:
          "Non. Le coeur de l'application (caisse, stock, facturation, clients) convient a tout type de commerce. Le module hotel (reservations, chambres, housekeeping, night audit) est une option supplementaire pour les entreprises qui en ont besoin.",
      },
    ],
  },
  {
    title: "Securite",
    items: [
      {
        question: "Mes donnees sont-elles isolees des autres entreprises ?",
        answer:
          "Oui. Chaque entreprise est cloisonnee : les utilisateurs, produits, ventes et rapports d'une entreprise ne sont jamais visibles depuis une autre entreprise, meme sur un compte partage.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        question: "Ma question n'est pas dans cette liste, que faire ?",
        answer:
          "Contactez la personne responsable de votre espace FC Manager (proprietaire ou administrateur de votre entreprise) pour obtenir de l'aide ou faire remonter votre question.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.1),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-semibold tracking-tight text-[#0f172a]">
            FC <span className="text-[#d4af37]">Manager</span>
          </span>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la connexion
          </Link>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold text-[#0f172a] sm:text-3xl">Foire aux questions</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Les reponses aux questions les plus frequentes sur la caisse, le stock, la facturation et
            les autres fonctionnalites de la plateforme.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#d4af37]">
                {section.title}
              </h2>
              <div className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-xl border border-slate-200 bg-white px-4 py-3 open:shadow-sm"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 marker:content-none">
                      <span className="flex items-center justify-between gap-3">
                        {item.question}
                        <span className="shrink-0 text-slate-400 transition group-open:rotate-45">+</span>
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e293b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
