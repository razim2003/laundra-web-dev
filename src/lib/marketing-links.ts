/** Marketing CTAs send guests to login first; after auth, `next` returns them to booking. */
export function loginUrlForBooking(packageId: string = "basic"): string {
  return `/login?next=${encodeURIComponent(`/booking?package=${packageId}`)}`;
}
