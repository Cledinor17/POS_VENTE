export type AppToastTone = "success" | "info" | "warning" | "error";

export type AppToastPayload = {
  id?: number;
  tone: AppToastTone;
  message: string;
  durationMs?: number;
};

export const APP_TOAST_EVENT = "app-toast";

function dispatchToast(payload: AppToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppToastPayload>(APP_TOAST_EVENT, {
      detail: payload,
    }),
  );
}

export function toast(payload: AppToastPayload) {
  dispatchToast(payload);
}

export function toastSuccess(message: string, durationMs?: number) {
  dispatchToast({ tone: "success", message, durationMs });
}

export function toastInfo(message: string, durationMs?: number) {
  dispatchToast({ tone: "info", message, durationMs });
}

export function toastWarning(message: string, durationMs?: number) {
  dispatchToast({ tone: "warning", message, durationMs });
}

export function toastError(message: string, durationMs?: number) {
  dispatchToast({ tone: "error", message, durationMs });
}
