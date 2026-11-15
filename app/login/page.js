import AuthForm from "../../components/auth-form.js";

export const metadata = {
  title: "Sign in | DataScope",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
