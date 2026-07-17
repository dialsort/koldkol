import { Suspense } from "react";
import { getBillingData } from "./billingActions";
import BillingView from "./BillingView";

export default async function BillingPage() {
  const data = await getBillingData();
  return (
    <Suspense>
      <BillingView {...data} />
    </Suspense>
  );
}
