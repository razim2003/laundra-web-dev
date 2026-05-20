import { Suspense } from "react";
import LaundraRouteLoader from "@/components/LaundraRouteLoader";
import BookingClient from "./BookingClient";

export default function BookingPage() {
  return (
    <Suspense fallback={<LaundraRouteLoader title="New booking" subtitle="Preparing the booking flow…" />}>
      <BookingClient />
    </Suspense>
  );
}

