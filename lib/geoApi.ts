import { apiFetch } from "./api";

// Listes d'adresses servies par le backend (resources/geo/*.php) : pays
// d'Amerique et de la Caraibe, puis subdivisions (etat / departement /
// province / region) et villes ou communes de chacune.
//
// Les donnees sont statiques : on les met en cache en memoire pour ne pas
// recharger la liste des pays a chaque ouverture du formulaire, et chaque
// pays n'est telecharge qu'a la selection.

export type GeoCountrySummary = {
  code: string;
  name: string;
  subdivision_label: string;
  city_label: string;
};

export type GeoSubdivision = {
  code: string;
  name: string;
  cities: string[];
};

export type GeoCountry = GeoCountrySummary & {
  subdivisions: GeoSubdivision[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeSummary(raw: unknown): GeoCountrySummary {
  const obj = asRecord(raw);
  return {
    code: asString(obj.code),
    name: asString(obj.name),
    subdivision_label: asString(obj.subdivision_label, "Etat / region"),
    city_label: asString(obj.city_label, "Ville"),
  };
}

function normalizeCountry(raw: unknown): GeoCountry {
  const obj = asRecord(raw);
  const subdivisions = Array.isArray(obj.subdivisions) ? obj.subdivisions : [];

  return {
    ...normalizeSummary(obj),
    subdivisions: subdivisions.map((entry) => {
      const sub = asRecord(entry);
      const cities = Array.isArray(sub.cities) ? sub.cities : [];
      return {
        code: asString(sub.code),
        name: asString(sub.name),
        cities: cities.filter((city): city is string => typeof city === "string"),
      };
    }),
  };
}

let countriesCache: Promise<GeoCountrySummary[]> | null = null;
const countryCache = new Map<string, Promise<GeoCountry>>();

export function getGeoCountries(): Promise<GeoCountrySummary[]> {
  if (!countriesCache) {
    countriesCache = apiFetch<{ data: unknown }>("/api/geo/countries")
      .then((res) => (Array.isArray(res.data) ? res.data.map(normalizeSummary) : []))
      .catch((error) => {
        // Un echec ne doit pas figer le cache : le prochain rendu reessaie.
        countriesCache = null;
        throw error;
      });
  }

  return countriesCache;
}

export function getGeoCountry(code: string): Promise<GeoCountry> {
  const key = code.trim().toUpperCase();
  const cached = countryCache.get(key);
  if (cached) return cached;

  const request = apiFetch<{ data: unknown }>(`/api/geo/countries/${encodeURIComponent(key)}`)
    .then((res) => normalizeCountry(res.data))
    .catch((error) => {
      countryCache.delete(key);
      throw error;
    });

  countryCache.set(key, request);
  return request;
}
