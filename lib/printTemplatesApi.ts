import { apiFetch } from "./api";
import { defaultPrintTemplate, PRINT_PAPERS, safePrintTemplate,
  type PrintPaper, type PrintTemplate } from "./printTemplateModel";

function url(business: string) {
  return `/api/app/${encodeURIComponent(business)}/print-templates`;
}

export type PrintTemplatesResponse = {
  data: PrintTemplate[];
  effective: Record<PrintPaper, PrintTemplate>;
};

function normalize(raw: { data?: PrintTemplate[]; effective?: Partial<Record<PrintPaper, PrintTemplate>> }): PrintTemplatesResponse {
  const data = Array.isArray(raw.data)
    ? raw.data.filter(item => PRINT_PAPERS.includes(item?.paper))
      .map(item => safePrintTemplate(item, item.paper))
    : [];
  const effective = Object.fromEntries(
    PRINT_PAPERS.map(paper => [paper, safePrintTemplate(raw.effective?.[paper] ?? defaultPrintTemplate(paper), paper)]),
  ) as Record<PrintPaper, PrintTemplate>;
  return { data, effective };
}

export async function listPrintTemplates(business: string): Promise<PrintTemplatesResponse> {
  const raw = await apiFetch<PrintTemplatesResponse>(url(business));
  return normalize(raw);
}

export async function createPrintTemplate(
  business: string,
  input: Omit<PrintTemplate, "id" | "is_default">,
): Promise<PrintTemplate> {
  const raw = await apiFetch<{ data: PrintTemplate }>(url(business), { method: "POST", json: input });
  return safePrintTemplate(raw.data, input.paper);
}

export async function updatePrintTemplate(
  business: string, template: PrintTemplate,
): Promise<PrintTemplate> {
  if (!template.id) throw new Error("Template must be saved first");
  const raw = await apiFetch<{ data: PrintTemplate }>(`${url(business)}/${template.id}`, {
    method: "PUT",
    json: { ...template, id: undefined, paper: undefined, is_default: undefined },
  });
  return safePrintTemplate(raw.data, template.paper);
}

export async function activatePrintTemplate(
  business: string, template: PrintTemplate,
): Promise<void> {
  if (!template.id) throw new Error("Template must be saved first");
  await apiFetch(`${url(business)}/${template.id}/activate`, { method: "POST" });
}

export async function deletePrintTemplate(business: string, template: PrintTemplate): Promise<void> {
  if (!template.id) return;
  await apiFetch(`${url(business)}/${template.id}`, { method: "DELETE" });
}
