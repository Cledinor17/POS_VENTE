"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type IdentityDocumentFieldProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
};

function isImageFile(file: File | null): file is File {
  return !!file && file.type.startsWith("image/");
}

export default function IdentityDocumentField({
  file,
  onFileChange,
  title = "Piece d'identite (optionnel)",
  description = "Tu peux televerser un fichier, prendre une photo, puis verifier l'apercu avant l'enregistrement.",
  className = "",
  compact = false,
}: IdentityDocumentFieldProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!isImageFile(file)) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!isCameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setCameraError("Impossible de lancer l'apercu camera.");
    });
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function closeCamera() {
    stopCamera();
    setIsCameraOpen(false);
  }

  function handleFileSelection(nextFile: File | null) {
    setCameraError("");
    onFileChange(nextFile);
  }

  function onUploadInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  async function openCamera() {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      stopCamera();
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      captureInputRef.current?.click();
      if (error instanceof Error) {
        setCameraError(error.message);
      } else {
        setCameraError("Acces camera impossible sur cet appareil.");
      }
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) {
      setCameraError("Apercu camera indisponible.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Capture image indisponible.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Impossible de generer la photo.");
          return;
        }

        const capturedFile = new File([blob], `piece-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        handleFileSelection(capturedFile);
        closeCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 ${
        compact ? "p-2.5 space-y-2 sm:p-3 sm:space-y-2.5" : "p-3 space-y-2 sm:p-4 sm:space-y-3"
      } ${className}`.trim()}
    >
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={onUploadInputChange}
        className="hidden"
      />
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onUploadInputChange}
        className="hidden"
      />

      <div className={compact ? "space-y-0.5" : "space-y-1"}>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        {!compact ? <p className="hidden text-xs text-slate-500 sm:block">{description}</p> : null}
      </div>

      <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className={`rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${
            compact ? "px-2.5 py-1.5" : "px-3 py-1.5 sm:py-2 sm:text-sm"
          }`}
        >
          Televerser
        </button>
        <button
          type="button"
          onClick={() => void openCamera()}
          className={`rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${
            compact ? "px-2.5 py-1.5" : "px-3 py-1.5 sm:py-2 sm:text-sm"
          }`}
        >
          Ouvrir la camera
        </button>
        {file ? (
          <button
            type="button"
            onClick={() => handleFileSelection(null)}
            className={`rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${
              compact ? "px-2.5 py-1.5" : "px-3 py-1.5 sm:py-2 sm:text-sm"
            }`}
          >
            Retirer
          </button>
        ) : null}
      </div>

      {cameraError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {cameraError}
        </div>
      ) : null}

      {isCameraOpen ? (
        <div
          className={`rounded-xl border border-slate-200 bg-slate-50 ${
            compact ? "p-2.5 space-y-2" : "p-3 space-y-2 sm:space-y-3"
          }`}
        >
          <div
            className={`mx-auto aspect-[4/3] overflow-hidden rounded-xl bg-slate-900 ${
              compact ? "max-w-[180px] sm:max-w-[220px]" : "max-w-[220px] sm:max-w-xs md:max-w-sm"
            }`}
          >
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
          <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
            <button
              type="button"
              onClick={capturePhoto}
              className={`rounded-xl bg-[#0d63b8] text-xs font-semibold text-white hover:bg-[#0a4d8f] ${
                compact ? "px-2.5 py-1.5" : "px-3 py-1.5 sm:px-4 sm:py-2 sm:text-sm"
              }`}
            >
              Prendre la photo
            </button>
            <button
              type="button"
              onClick={closeCamera}
              className={`rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white ${
                compact ? "px-2.5 py-1.5" : "px-3 py-1.5 sm:px-4 sm:py-2 sm:text-sm"
              }`}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {file ? (
        <div className={`rounded-xl border border-slate-200 bg-slate-50 ${compact ? "p-2.5 space-y-1.5" : "p-3 space-y-2"}`}>
          <div className="text-xs font-medium text-slate-700">Fichier choisi: {file.name}</div>
          {previewUrl ? (
            <div className={`mx-auto ${compact ? "max-w-[180px] sm:max-w-[220px]" : "max-w-[220px] sm:max-w-xs md:max-w-sm"}`}>
              <img
                src={previewUrl}
                alt="Apercu de la piece"
                className={`w-full rounded-lg bg-white object-contain ${
                  compact ? "h-24 sm:h-28" : "h-32 sm:h-40 md:h-48"
                }`}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-sm text-slate-500">
              Apercu indisponible pour ce type de fichier.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
