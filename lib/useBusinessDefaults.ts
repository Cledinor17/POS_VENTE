"use client";

import { useEffect, useState } from "react";
import { getBusinessSettings } from "./businessApi";

export type BusinessDefaults = {
  currency: string;       // devise de reporting (USD ou HTG)
  exchangeRate: number;   // taux USD→HTG au moment du chargement
  loading: boolean;
};

const cache: Record<string, BusinessDefaults> = {};

export function useBusinessDefaults(business: string): BusinessDefaults {
  const [state, setState] = useState<BusinessDefaults>(() =>
    cache[business] ?? { currency: "HTG", exchangeRate: 1, loading: true }
  );

  useEffect(() => {
    if (!business) return;
    if (cache[business] && !cache[business].loading) {
      const timeout = window.setTimeout(() => setState(cache[business]), 0);
      return () => window.clearTimeout(timeout);
    }

    let mounted = true;
    getBusinessSettings(business)
      .then((data) => {
        if (!mounted) return;
        const defaults: BusinessDefaults = {
          currency: data.currency || "HTG",
          exchangeRate: data.usd_to_htg_rate || 1,
          loading: false,
        };
        cache[business] = defaults;
        setState(defaults);
      })
      .catch(() => {
        if (!mounted) return;
        const defaults: BusinessDefaults = { currency: "HTG", exchangeRate: 1, loading: false };
        cache[business] = defaults;
        setState(defaults);
      });

    return () => { mounted = false; };
  }, [business]);

  return state;
}
