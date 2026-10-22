import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="Password resets are handled by your administrator"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        Ask your administrator to set a temporary password. After signing in, change it from your account settings.
      </p>
    </AuthLayout>
  );
}
