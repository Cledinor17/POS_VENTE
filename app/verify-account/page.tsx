import AuthShell from "@/components/AuthShell";
import VerifyAccountForm from "./VerifyAccountForm";

export default function VerifyAccountPage() {
  return (
    <AuthShell
      eyebrow="Validation"
      title="Activez votre compte avant de demarrer"
      subtitle="Une fois le compte valide, vous serez dirige vers la creation de votre business pour finaliser votre espace."
    >
      <VerifyAccountForm />
    </AuthShell>
  );
}
