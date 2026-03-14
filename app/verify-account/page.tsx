import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import VerifyAccountForm from "./VerifyAccountForm";

export default function VerifyAccountPage() {
  return (
    <AuthShell
      eyebrow="Validation"
      title="Activez votre compte avant de demarrer"
      subtitle="Une fois le compte valide, vous serez dirige vers la creation de votre business pour finaliser votre espace."
    >
      <Suspense
        fallback={
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <p className="text-slate-500">Chargement de la verification...</p>
          </div>
        }
      >
        <VerifyAccountForm />
      </Suspense>
    </AuthShell>
  );
}
