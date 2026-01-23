"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Flashlight, FlashlightOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FacingMode = "environment" | "user";

function isBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as any).BarcodeDetector !== "undefined";
}

function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return true;
  const protocol = window.location?.protocol;
  if (protocol === "https:") return true;
  // Browsers allow camera on localhost over http.
  const host = window.location?.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1";
}

async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

export function CameraScannerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
}) {
  const { open, onOpenChange, onDetected } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const restartingRef = useRef(false);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");

  const supportedBarcodeDetector = useMemo(() => isBarcodeDetectorSupported(), []);
  const secureContext = useMemo(() => isSecureCameraContext(), []);

  const getActiveStream = (): MediaStream | null => {
    const fromRef = streamRef.current;
    if (fromRef) return fromRef;
    const video = videoRef.current as any;
    const src = video?.srcObject as MediaStream | null | undefined;
    return src ?? null;
  };

  const getActiveVideoTrack = (): MediaStreamTrack | null => {
    const stream = getActiveStream();
    const tracks = stream?.getVideoTracks?.() ?? [];
    return tracks[0] ?? null;
  };

  const detectTorchSupport = () => {
    const track: any = getActiveVideoTrack();
    const caps = track && typeof track.getCapabilities === "function" ? track.getCapabilities() : null;
    setTorchSupported(Boolean(caps?.torch));
    setTorchOn(false);
  };

  const applyTorch = async (nextOn: boolean) => {
    const track: any = getActiveVideoTrack();
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextOn }] } as any);
      setTorchOn(nextOn);
    } catch {
      setTorchOn(false);
    }
  };

  const stopStream = () => {
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // ignore
      }
      zxingControlsRef.current = null;
    }

    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    const stream = streamRef.current;
    streamRef.current = null;

    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }

    const video = videoRef.current;
    if (video) {
      try {
        (video as any).srcObject = null;
      } catch {
        // ignore
      }
    }
  };

  const refreshDevices = async () => {
    try {
      const cams = await listVideoDevices();
      setDevices(cams);

      // Pick a default only if not set.
      if (!selectedDeviceId) {
        const preferred = cams.find((d) => /back|rear|environment/i.test(d.label)) ?? cams[0];
        setSelectedDeviceId(preferred?.deviceId ?? "");
      }
    } catch {
      // ignore
    }
  };

  const start = async (opts?: { keepFacingMode?: boolean }) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite acceder a la cámara.");
      return;
    }

    if (!secureContext) {
      setError(
        "La cámara requiere HTTPS (o localhost). Abre el sistema en HTTPS o desde localhost en el PC/móvil."
      );
      return;
    }

    if (restartingRef.current) return;
    restartingRef.current = true;

    setError(null);
    setStarting(true);

    try {
      stopStream();

      const video = videoRef.current;
      if (!video) throw new Error("No se pudo inicializar el video.");

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: opts?.keepFacingMode ? facingMode : facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      // Prefer native BarcodeDetector when available (fast and lightweight).
      if (supportedBarcodeDetector) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        (video as any).srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();

        detectTorchSupport();

        await refreshDevices();

        const Detector = (window as any).BarcodeDetector as any;
        const detector = new Detector({
          formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code", "itf"],
        });

        setScanning(true);

        const scanOnce = async () => {
          if (!open) return;
          if (!videoRef.current) return;
          if (!streamRef.current) return;

          try {
            const results = await detector.detect(videoRef.current);
            const value = String(results?.[0]?.rawValue ?? "").trim();
            if (value) {
              onDetected(value);
              onOpenChange(false);
              return;
            }
          } catch {
            // ignore; keep scanning
          }

          scanTimerRef.current = window.setTimeout(scanOnce, 150);
        };

        scanOnce();
      } else {
        // Fallback for Safari/iOS and others: ZXing decoder.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
          delayBetweenScanSuccess: 500,
        } as any);

        setScanning(true);

        const controls = await reader.decodeFromConstraints(constraints, video, (result: any, err: any) => {
          if (!open) return;

          if (result) {
            const value = String(result.getText?.() ?? result.text ?? "").trim();
            if (value) {
              onDetected(value);
              onOpenChange(false);
            }
          } else {
            // ignore NotFound-like errors; keep scanning
            void err;
          }
        });

        zxingControlsRef.current = controls as any;
        // ZXing internally attaches a stream to the <video>; use it if available.
        streamRef.current = ((video as any).srcObject as MediaStream | null) ?? null;
        detectTorchSupport();
        await refreshDevices();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
      restartingRef.current = false;
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }

    void start();

    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSwitchCamera = async () => {
    // Prefer switching by facingMode (mobile). If user picked a device, cycle devices.
    setError(null);

    if (devices.length > 1 && selectedDeviceId) {
      const idx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
      const next = devices[(idx + 1) % devices.length];
      setSelectedDeviceId(next?.deviceId ?? "");
      await start();
      return;
    }

    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    // Clear deviceId so facingMode takes effect.
    setSelectedDeviceId("");
    await start();
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setError(null);
    await start();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Escanear código</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código de barras. Al detectarlo, se buscará automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!secureContext ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium mb-1">Nota</div>
              <div className="text-muted-foreground">Para usar cámara necesitas HTTPS (o localhost).</div>
            </div>
          ) : null}

          <div className="rounded border bg-black/90 overflow-hidden">
            <video ref={videoRef} className="w-full aspect-video" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {starting ? "Iniciando cámara…" : scanning ? "Escaneando…" : ""}
            </div>

            <div className="flex gap-2">
              {torchSupported ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void applyTorch(!torchOn)}
                  disabled={starting}
                  title={torchOn ? "Apagar flash" : "Encender flash"}
                >
                  {torchOn ? <FlashlightOff className="h-4 w-4 mr-2" /> : <Flashlight className="h-4 w-4 mr-2" />}
                  Flash
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => start()} disabled={starting}>
                Reintentar
              </Button>
              <Button type="button" variant="outline" onClick={handleSwitchCamera} disabled={starting}>
                Cambiar cámara
              </Button>
            </div>
          </div>

          {devices.length > 1 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Cámara</div>
              <select
                className="h-9 rounded-md border px-2 text-sm w-full"
                value={selectedDeviceId}
                onChange={(e) => void handleDeviceChange(e.target.value)}
                disabled={starting}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${d.deviceId.slice(0, 6)}…`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
