import AuthPortalShell from "@/components/AuthPortalShell";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <AuthPortalShell activeTab="register">
      <RegisterForm />
    </AuthPortalShell>
  );
}
