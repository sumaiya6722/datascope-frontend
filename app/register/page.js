import AuthForm from "../../components/auth-form.js";

export const metadata = {
  title: "Create account | DataScope",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
