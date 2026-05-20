import { Suspense } from "react";
import LoginClient from "@/components/auth/LoginClient";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";

function Fallback() {
  return <LaundraRouteLoader title="Login" subtitle="Preparing your account…" />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginClient />
    </Suspense>
  );
}
