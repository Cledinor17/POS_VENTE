"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Keyboard, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

const DUPLICATE_WINDOW_MS = 1500;

export default function BarcodeScannerModal({
  open,
  onClose,
  onDetect,
  continuous = false,
  title = "Scanner un code-barres",
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
  continuous?: boolean;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastDetectionRef = useRef<{ code: string; at: number } | null>(null);

  const [cameraError, setCameraError] = useState("");
  const [starting, setStarting] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const handleDetectedCodeRef = useRef<(code: string) => void>(() => {});
  handleDetectedCodeRef.current = (code: string) => {
    onDetect(code);
    if (!continuous) {
      controlsRef.current?.stop();
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setCameraError("");
    setStarting(true);
    setManualMode(false);
    setManualCode("");
    lastDetectionRef.current = null;

    async function start() {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoEl,
          (result) => {
            if (!result) return;
            const code = result.getText().trim();
            if (!code) return;

            const last = lastDetectionRef.current;
            const now = Date.now();
            if (last && last.code === code && now - last.at < DUPLICATE_WINDOW_MS) {
              return;
            }
            lastDetectionRef.current = { code, at: now };

            handleDetectedCodeRef.current(code);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (error) {
        if (cancelled) return;
        setStarting(false);
        setCameraError(
          error instanceof Error
            ? `Impossible d'acceder a la camera (${error.message}).`
            : "Impossible d'acceder a la camera.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    handleDetectedCodeRef.current(code);
  }

  const portalRoot = typeof document === "undefined" ? null : document.body;
  if (!open || !portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Camera className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {cameraError || manualMode ? (
            <>
              {cameraError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {cameraError}
                </div>
              ) : null}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Saisir le code manuellement
                </label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    placeholder="Code-barres"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Valider
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-slate-900">
                <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
                {starting ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                    Ouverture de la camera...
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
                )}
              </div>
              <p className="text-center text-xs text-slate-500">
                Cadre le code-barres dans la zone {continuous ? "— plusieurs scans possibles" : ""}.
              </p>
              <button
                type="button"
                onClick={() => {
                  controlsRef.current?.stop();
                  setManualMode(true);
                }}
                className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                <Keyboard className="h-3.5 w-3.5" /> Saisir le code manuellement
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
