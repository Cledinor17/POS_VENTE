import { apiFetch } from "./api";

export type BusinessCyclePreview = {
  business: { id: number; name: string; slug: string };
  counts: Record<string, number>;
  blockers: Array<{ code: string; count: number; message: string }>;
  can_start: boolean;
  latest_cycle: { id: number; started_at: string; recovery_id: string } | null;
  preserves: string[];
  mode: string;
  preview_token: string;
};

export type BusinessCycleStartResult = {
  cycle: { id: number; started_at: string; recovery_id: string };
  message: string;
};

export type PlatformBusinessForCycle = { id: number; name: string; slug: string };

function basePath(business: string, platformBusinessId?: number): string {
  return platformBusinessId
    ? `/api/platform/businesses/${platformBusinessId}/cycle`
    : `/api/app/${encodeURIComponent(business)}/business/cycle`;
}

export async function previewBusinessCycle(
  business: string,
  platformBusinessId?: number,
): Promise<BusinessCyclePreview> {
  return apiFetch<BusinessCyclePreview>(`${basePath(business, platformBusinessId)}/preview`);
}

export async function startBusinessCycle(
  business: string,
  input: { previewToken: string; confirmation: string; password: string },
  platformBusinessId?: number,
): Promise<BusinessCycleStartResult> {
  return apiFetch<BusinessCycleStartResult>(`${basePath(business, platformBusinessId)}/start`, {
    method: "POST",
    json: {
      preview_token: input.previewToken,
      confirmation: input.confirmation,
      password: input.password,
    },
  });
}

export async function listPlatformBusinessesForCycle(q = ""): Promise<PlatformBusinessForCycle[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  const raw = await apiFetch<{ data: PlatformBusinessForCycle[] }>(
    `/api/platform/businesses/initialization${query}`,
  );
  return raw.data;
}
