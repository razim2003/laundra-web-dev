import { Suspense } from "react";
import CustomerClient from "./CustomerClient";

export default function CustomerDashboard() {
  return (
    <Suspense>
      <CustomerClient />
    </Suspense>
  );
}

