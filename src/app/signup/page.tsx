import { Suspense } from "react";
import SignupClient from "@/components/auth/SignupClient";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";

function Fallback() {
  return <LaundraRouteLoader title="Sign up" subtitle="Setting up your profile…" />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SignupClient />
    </Suspense>
  );
}
