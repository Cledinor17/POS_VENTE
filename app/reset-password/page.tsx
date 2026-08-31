import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Securite"
      title="Choisissez un nouveau mot de passe"
      subtitle="Entrez le code recu par email pour finaliser la reinitialisation."
    >
      <Suspense
        fallback={
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <p className="text-slate-500">Chargement...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
