// app/login/page.tsx
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex justify-center">
          <p className="text-slate-500">Chargement du formulaire...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}