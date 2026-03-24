"use client";

import * as React from "react";
import { Bot, Camera, FileText, Sparkles, PlayCircle, Upload, Wand2, AlertTriangle, Loader2, ScanLine } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getAnime } from "@/components/ui-preferences/anime";
import { useUiPreferences } from "@/components/ui-preferences/ui-preferences-provider";

type Props = {
  currentUserName: string;
  accessLevel: number;
};

type WorkbenchMode = "query" | "document" | "image";

type ImageMeta = {
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  averageColor: string;
  aspect: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function estimateAverageColor(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#777777";

  const sampleW = Math.min(64, img.naturalWidth || 64);
  const sampleH = Math.min(64, img.naturalHeight || 64);
  canvas.width = sampleW;
  canvas.height = sampleH;
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const pixels = ctx.getImageData(0, 0, sampleW, sampleH).data;

  let r = 0;
  let g = 0;
  let b = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
  }

  const rr = Math.round(r / count).toString(16).padStart(2, "0");
  const gg = Math.round(g / count).toString(16).padStart(2, "0");
  const bb = Math.round(b / count).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function buildAspect(w: number, h: number): string {
  if (!w || !h) return "N/A";
  const ratio = w / h;
  if (ratio > 1.75) return "Panorámica";
  if (ratio > 1.2) return "Horizontal";
  if (ratio < 0.8) return "Vertical";
  return "Cuadrada/Balanceada";
}

async function callWorkbench(mode: WorkbenchMode, prompt: string, context: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28000);

  try {
    const res = await fetch("/api/ai/workbench", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, prompt, context }),
      signal: ctrl.signal,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error ?? "No se pudo procesar la solicitud IA.");
    }

    return String(payload?.data ?? "");
  } finally {
    clearTimeout(timer);
  }
}

export function AILabClient({ currentUserName, accessLevel }: Props) {
  const { preferences } = useUiPreferences();

  const heroRef = React.useRef<HTMLDivElement | null>(null);
  const orbARef = React.useRef<HTMLDivElement | null>(null);
  const orbBRef = React.useRef<HTMLDivElement | null>(null);
  const cardsRef = React.useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = React.useState("query");

  const [queryPrompt, setQueryPrompt] = React.useState("");
  const [queryResult, setQueryResult] = React.useState("");
  const [queryLoading, setQueryLoading] = React.useState(false);

  const [docText, setDocText] = React.useState("");
  const [docName, setDocName] = React.useState<string>("");
  const [docPrompt, setDocPrompt] = React.useState("Resume, riesgos y acciones recomendadas");
  const [docResult, setDocResult] = React.useState("");
  const [docLoading, setDocLoading] = React.useState(false);

  const [imagePreview, setImagePreview] = React.useState<string>("");
  const [imageMeta, setImageMeta] = React.useState<ImageMeta | null>(null);
  const [imagePrompt, setImagePrompt] = React.useState("Analiza posibles fallas visibles y recomendaciones");
  const [imageResult, setImageResult] = React.useState("");
  const [imageLoading, setImageLoading] = React.useState(false);

  const [cameraOpen, setCameraOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    if (!preferences.enableAnimeJs || prefersReducedMotion()) return;
    let cancelled = false;

    void getAnime().then((anime) => {
      if (!anime || cancelled) return;

      const hero = heroRef.current;
      const orbA = orbARef.current;
      const orbB = orbBRef.current;
      const cards = cardsRef.current?.querySelectorAll("[data-ai-card]");
      if (!hero || !orbA || !orbB || !cards) return;

      anime.remove([hero, orbA, orbB, ...Array.from(cards)] as any);

      anime.set(hero, { opacity: 0, translateY: 14 });
      anime.set(cards as any, { opacity: 0, translateY: 16 });

      const tl = anime.createTimeline({ autoplay: true });
      tl.add(hero, {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 500,
        easing: anime.eases.outQuad,
      });

      tl.add(
        cards as any,
        {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 380,
          delay: anime.stagger(70),
          easing: anime.eases.outExpo,
        },
        80
      );

      anime.createTimeline({ loop: true, alternate: true, autoplay: true })
        .add(orbA, {
          translateX: [0, 16],
          translateY: [0, -12],
          scale: [1, 1.08],
          duration: 2400,
          easing: anime.eases.inOutSine,
        })
        .add(orbB, {
          translateX: [0, -14],
          translateY: [0, 10],
          scale: [1, 0.92],
          duration: 2200,
          easing: anime.eases.inOutSine,
        }, 0);
    }).catch(() => {
      // fail-safe
    });

    return () => {
      cancelled = true;
    };
  }, [preferences.enableAnimeJs, activeTab]);

  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
    };
  }, []);

  async function runQuery() {
    if (!queryPrompt.trim()) return;
    setQueryLoading(true);
    try {
      const result = await callWorkbench(
        "query",
        queryPrompt,
        `Usuario: ${currentUserName}. Nivel acceso: ${accessLevel}.`
      );
      setQueryResult(result);
    } catch (e: any) {
      setQueryResult(`Error: ${e?.message ?? "No fue posible generar respuesta."}`);
    } finally {
      setQueryLoading(false);
    }
  }

  async function onLoadDocument(file: File) {
    const name = file.name.toLowerCase();
    const allowed = [".txt", ".md", ".json", ".csv", ".xml", ".log", ".yaml", ".yml"];
    if (!allowed.some((ext) => name.endsWith(ext))) {
      setDocText("");
      setDocName(file.name);
      setDocResult("Formato no soportado en esta fase. Usa TXT, MD, JSON, CSV, XML o LOG.");
      return;
    }

    const text = await file.text();
    setDocName(file.name);
    setDocText(text.slice(0, 16000));
    setDocResult("");
  }

  async function runDocumentAnalysis() {
    if (!docText.trim()) return;
    setDocLoading(true);
    try {
      const result = await callWorkbench(
        "document",
        docPrompt,
        `Documento: ${docName || "sin nombre"}.\nContenido:\n${docText}`
      );
      setDocResult(result);
    } catch (e: any) {
      setDocResult(`Error: ${e?.message ?? "No fue posible analizar el documento."}`);
    } finally {
      setDocLoading(false);
    }
  }

  async function onLoadImage(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ""));
      fr.onerror = () => reject(new Error("No se pudo leer la imagen"));
      fr.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const obj = new Image();
      obj.onload = () => resolve(obj);
      obj.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
      obj.src = dataUrl;
    });

    const meta: ImageMeta = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes: file.size,
      mimeType: file.type || "image/*",
      averageColor: estimateAverageColor(img),
      aspect: buildAspect(img.naturalWidth, img.naturalHeight),
    };

    setImagePreview(dataUrl);
    setImageMeta(meta);
    setImageResult("");
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOpen(true);
    } catch {
      setImageResult("No se pudo abrir la camara. Verifica permisos del navegador.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const obj = new Image();
      obj.onload = () => resolve(obj);
      obj.onerror = () => reject(new Error("No se pudo procesar la foto"));
      obj.src = dataUrl;
    });

    setImagePreview(dataUrl);
    setImageMeta({
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes: Math.round((dataUrl.length * 3) / 4),
      mimeType: "image/jpeg",
      averageColor: estimateAverageColor(img),
      aspect: buildAspect(img.naturalWidth, img.naturalHeight),
    });

    stopCamera();
  }

  async function runImageAnalysis() {
    if (!imageMeta) return;
    setImageLoading(true);
    try {
      const context = [
        `Metadatos imagen: ${JSON.stringify(imageMeta)}`,
        imagePreview ? `Preview disponible (data-url): ${imagePreview.slice(0, 400)}...` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await callWorkbench("image", imagePrompt, context);
      setImageResult(result);
    } catch (e: any) {
      setImageResult(`Error: ${e?.message ?? "No fue posible analizar la imagen."}`);
    } finally {
      setImageLoading(false);
    }
  }


  return (
    <div className="relative min-w-0 overflow-hidden">
      <div
        ref={orbARef}
        className="pointer-events-none absolute -left-16 -top-12 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl"
      />
      <div
        ref={orbBRef}
        className="pointer-events-none absolute -right-20 top-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl"
      />

      <div ref={heroRef} className="mb-6 rounded-2xl border bg-gradient-to-br from-cyan-50 via-background to-emerald-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-cyan-600 text-white">Nuevo modulo</Badge>
          <Badge variant="outline">IA</Badge>
          <Badge variant="outline">Analisis</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">AI Lab</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Entorno integral para consultas, lectura documental y analisis de imagen/foto.
          Usuario activo: <strong>{currentUserName}</strong>.
        </p>
      </div>

      <Alert className="mb-6 border-cyan-300/60 bg-cyan-50/80">
        <ScanLine className="h-4 w-4" />
        <AlertTitle>Reglas y alcance</AlertTitle>
        <AlertDescription>
          Este modulo analiza texto, documentos e imagenes con metadatos/contexto. No ejecuta cambios en base de datos ni acciones administrativas.
          Para decisiones criticas, valida siempre contra los modulos oficiales de inventario y reportes.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="query"><Bot className="mr-2 h-4 w-4" />Consultas</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
          <TabsTrigger value="images"><Camera className="mr-2 h-4 w-4" />Imagenes/Fotos</TabsTrigger>
        </TabsList>

        <div ref={cardsRef} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TabsContent value="query" className="col-span-1 lg:col-span-2" data-ai-card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-cyan-600" />Centro de Consultas</CardTitle>
                <CardDescription>Haz preguntas de negocio, inventario, operaciones y soporte tecnico.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={4}
                  value={queryPrompt}
                  onChange={(e) => setQueryPrompt(e.target.value)}
                  placeholder="Ej: Analiza por que bajo la rentabilidad de filtros hidraulicos este mes"
                />
                <div className="flex gap-2">
                  <Button onClick={runQuery} disabled={queryLoading || !queryPrompt.trim()}>
                    {queryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    Analizar
                  </Button>
                </div>
                <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-3">
                  <pre className="whitespace-pre-wrap text-sm">{queryResult || "Sin resultados aun."}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="col-span-1 lg:col-span-2" data-ai-card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><FileText className="h-5 w-5 text-cyan-600" />Lectura de Documentos</CardTitle>
                <CardDescription>Carga TXT/MD/JSON/CSV/XML/LOG y genera analisis ejecutivo con hallazgos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="file" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLoadDocument(f);
                }} />
                <Input value={docPrompt} onChange={(e) => setDocPrompt(e.target.value)} placeholder="Objetivo del analisis" />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Documento: {docName || "ninguno"}</Badge>
                  {docText ? <Badge variant="secondary">{docText.length} chars cargados</Badge> : null}
                </div>
                <div className="flex gap-2">
                  <Button onClick={runDocumentAnalysis} disabled={docLoading || !docText.trim()}>
                    {docLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Analizar documento
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <ScrollArea className="h-[260px] rounded-md border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap text-xs">{docText || "Vista previa del documento."}</pre>
                  </ScrollArea>
                  <ScrollArea className="h-[260px] rounded-md border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap text-sm">{docResult || "Resultado del analisis."}</pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="col-span-1 lg:col-span-2" data-ai-card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Camera className="h-5 w-5 text-cyan-600" />Analisis de Imagenes y Fotos</CardTitle>
                <CardDescription>Carga una imagen o toma foto, extrae metadatos y ejecuta analisis tecnico asistido.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={startCamera}><Camera className="mr-2 h-4 w-4" />Abrir camara</Button>
                  <Button variant="outline" onClick={stopCamera} disabled={!cameraOpen}>Detener camara</Button>
                  <label className={cn("inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium")}>
                    <Upload className="mr-2 h-4 w-4" /> Subir imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onLoadImage(f);
                      }}
                    />
                  </label>
                </div>

                {cameraOpen ? (
                  <div className="rounded-lg border p-2">
                    <video ref={videoRef} autoPlay playsInline className="h-56 w-full rounded-md object-cover" />
                    <div className="mt-2">
                      <Button onClick={takePhoto}><Camera className="mr-2 h-4 w-4" />Tomar foto</Button>
                    </div>
                  </div>
                ) : null}

                <Input value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Que deseas analizar en la imagen" />

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    {imagePreview ? (
                      <img src={imagePreview} alt="preview" className="h-56 w-full rounded-md object-cover" />
                    ) : (
                      <div className="grid h-56 place-items-center text-sm text-muted-foreground">Sin imagen cargada</div>
                    )}
                    {imageMeta ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Resolucion: {imageMeta.width}x{imageMeta.height}</div>
                        <div>Aspecto: {imageMeta.aspect}</div>
                        <div>Tamano: {Math.round(imageMeta.sizeBytes / 1024)} KB</div>
                        <div>MIME: {imageMeta.mimeType}</div>
                        <div className="col-span-2 flex items-center gap-2">
                          Color promedio:
                          <span className="inline-block h-3 w-3 rounded-full border" style={{ background: imageMeta.averageColor }} />
                          {imageMeta.averageColor}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <ScrollArea className="h-[340px] rounded-md border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap text-sm">{imageResult || "El resultado del analisis aparecera aqui."}</pre>
                  </ScrollArea>
                </div>

                <Button onClick={runImageAnalysis} disabled={imageLoading || !imageMeta}>
                  {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Analizar imagen
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3" data-ai-card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lo que SI puede hacer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Consultas, resumen de datos, analisis documental, analisis tecnico de imagen por metadatos, apoyo de desarrollo.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lo que NO hace</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No modifica base de datos, no ejecuta operaciones transaccionales ni reemplaza validaciones humanas en decisiones criticas.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buenas practicas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Usa preguntas concretas, incluye contexto (bodega, marca, periodo), y contrasta resultados en modulos de inventario/reportes.
          </CardContent>
        </Card>
      </div>

      <Alert className="mt-4 border-amber-300/60 bg-amber-50/70">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Nota tecnica</AlertTitle>
        <AlertDescription>
          El analisis de imagen en esta version usa metadatos + contexto descriptivo. Si deseas vision multimodal profunda, lo siguiente es habilitar una ruta IA multimodal especifica en Amplify.
        </AlertDescription>
      </Alert>
    </div>
  );
}
