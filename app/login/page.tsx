import { Suspense } from "react";
import AuthPortalShell from "@/components/AuthPortalShell";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <AuthPortalShell activeTab="login">
      <Suspense
        fallback={
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <p className="text-slate-500">Chargement du formulaire...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthPortalShell>
  );
}
