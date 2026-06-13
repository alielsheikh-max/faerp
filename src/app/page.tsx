import LoginPageClient from "@/components/login-page-client";

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  return <LoginPageClient error={searchParams?.error} />;
}
