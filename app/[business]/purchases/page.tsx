"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PurchasesPage() {
  const params = useParams<{ business: string }>();
  const router = useRouter();
  const business = params?.business ?? "";

  useEffect(() => {
    if (business) {
      router.replace(`/${business}/purchase-orders`);
    }
  }, [business, router]);

  return null;
}
