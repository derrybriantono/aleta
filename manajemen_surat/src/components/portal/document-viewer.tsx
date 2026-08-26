"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Eye, FileText, Info, Maximize2, Minus, Plus, Printer, QrCode, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadPdfBinary } from "@/lib/pdf-binary";
import { printPdfDocument } from "@/lib/pdf-print";
import { loadPdfJsModule, type PdfDocumentLoadingTask, type PdfDocumentProxy } from "@/lib/pdfjs-client";
import {
  buildPdfBinaryRoute,
  buildPdfViewerRoute,
  normalizePdfDocumentPath,
} from "@/lib/pdf-viewer-route";
import { type LetterDetail, type UserPersona } from "@/lib/types";
import { cn } from "@/lib/utils";

const BASE_DOCUMENT_WIDTH = 960;
const MIN_SCALE = 0.42;
const MAX_SCALE = 1.18;
const securityExplanation =
  "Dokumen diberi watermark dan tanda validasi agar lebih sulit dipalsukan.";

function clampScale(value: number) {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

function triggerPdfDownload(downloadUrl: string, fileName?: string) {
  const link = document.createElement("a");
  link.href = downloadUrl;
  if (fileName) {
    link.download = fileName;
  }
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function DocumentViewer({
  letter,
  currentUser,
  className,
}: {
  letter: LetterDetail;
  currentUser: UserPersona | null;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [viewMode, setViewMode] = useState<"smart" | "original">("smart");
  const [scaleMode, setScaleMode] = useState<"fit-width" | "manual">("fit-width");
  const [manualScale, setManualScale] = useState(1);
  const [scaleInput, setScaleInput] = useState("100");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const timestamp = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  }, []);
  const isPreviewOnly = letter.viewerMode === "preview";
  const activeScale = scaleMode === "manual" ? manualScale : fitScale;
  const scalePercentage = Math.round(activeScale * 100);
  const formattedLetterDate = useMemo(() => {
    const dateToFormat = letter.tanggal ? new Date(letter.tanggal) : new Date(0);
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(dateToFormat);
  }, [letter.tanggal]);
  const canAdjustCanvasScale = !!pdfDocument && !pdfError;
  const safeDocumentUrl = normalizePdfDocumentPath(letter.documentUrl);
  const standaloneViewerUrl = safeDocumentUrl
    ? buildPdfViewerRoute({
        documentUrl: safeDocumentUrl,
        documentFileName: letter.documentFileName,
      })
    : null;
  const downloadDocumentUrl = safeDocumentUrl
    ? buildPdfBinaryRoute(safeDocumentUrl, {
        download: true,
        fileName: letter.documentFileName,
      })
    : null;
  const canDownloadDocument = !isPreviewOnly && !!downloadDocumentUrl;
  const canPrintDocument = !isPreviewOnly && !!pdfDocument && !pdfError;
  const statusText = useMemo(() => {
    if (!letter.documentUrl) return "Dokumen PDF belum tersedia";
    if (pdfError) return "Tampilan PDF tidak dapat dimuat";
    if (pdfDocument && pageCount > 0) {
      return viewMode === "original" ? `${pageCount} halaman PDF asli aktif` : `${pageCount} halaman PDF aktif`;
    }
    if (isLoadingPdf) return viewMode === "original" ? "Menyiapkan PDF asli" : "Menyiapkan tampilan PDF";

    return "Menunggu PDF aktif";
  }, [isLoadingPdf, letter.documentUrl, pageCount, pdfDocument, pdfError, viewMode]);
  const viewerDescription =
    viewMode === "smart"
      ? "Untuk cek cepat. Dokumen diberi watermark dan dibuat ringan saat dibuka."
      : "Tampilan dokumen asli untuk membaca detail.";

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const recalculateScale = () => {
      const rect = viewport.getBoundingClientRect();
      const nextScale = clampScale((rect.width - 56) / BASE_DOCUMENT_WIDTH);

      setFitScale(Number(nextScale.toFixed(3)));
      if (scaleMode === "fit-width") {
        setScaleInput(`${Math.round(nextScale * 100)}`);
      }
    };

    recalculateScale();

    const observer = new ResizeObserver(recalculateScale);
    observer.observe(viewport);
    window.addEventListener("resize", recalculateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalculateScale);
    };
  }, [scaleMode]);

  useEffect(() => {
    const documentUrl = letter.documentUrl;

    if (!documentUrl) {
      let cancelled = false;

      queueMicrotask(() => {
        if (cancelled) return;
        setPdfDocument(null);
        setPageCount(0);
        setPdfError("Dokumen PDF belum tersedia.");
      });

      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    let loadingTask: PdfDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      setIsLoadingPdf(true);
      setPdfError("");

      try {
        const pdfData = await loadPdfBinary(documentUrl);
        if (cancelled) return;

        const pdfjs = await loadPdfJsModule();
        if (cancelled) return;

        loadingTask = pdfjs.getDocument({
          data: pdfData,
          isEvalSupported: false,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true,
        });
        const loadedDocument = await loadingTask.promise;

        if (cancelled) {
          void loadedDocument.destroy();
          return;
        }

        setPdfDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
      } catch (error) {
        if (!cancelled) {
          setPdfDocument(null);
          setPageCount(0);
          setPdfError(
            error instanceof Error
              ? error.message
              : "PDF asli gagal dimuat. Silakan buka dokumen asli pada jendela baru."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPdf(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [letter.documentUrl]);

  return (
    <section className={cn("flex h-full min-h-[520px] min-w-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/80 bg-card/70 px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-sm font-semibold text-foreground">Pembaca Dokumen</h2>
            <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap">
              <Badge variant="outline">{canAdjustCanvasScale ? `${scalePercentage}%` : "Pratinjau"}</Badge>
              <Badge variant="outline">{statusText}</Badge>
              <Badge variant={isPreviewOnly ? "warning" : "success"}>
                {isPreviewOnly ? "Hanya Lihat" : "Unduh Aktif"}
              </Badge>
              <SecurityInfoBadge icon={QrCode} label="Cek Keaslian" />
              <SecurityInfoBadge icon={Shield} label="Dokumen Terlindungi" />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-1 xl:items-end">
            <div className="flex items-center gap-1 rounded-[1.1rem] border border-border bg-background/80 p-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 rounded-[0.9rem] px-3 text-[11px] font-semibold tracking-wide transition-all",
                  viewMode === "smart" ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setViewMode("smart")}
              >
                <Eye className="mr-2 h-3.5 w-3.5" />
                Preview Cepat
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 rounded-[0.9rem] px-3 text-[11px] font-semibold tracking-wide transition-all",
                  viewMode === "original" ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setViewMode("original")}
              >
                <FileText className="mr-2 h-3.5 w-3.5" />
                PDF Asli
              </Button>
            </div>
            <p className="max-w-[28rem] text-[11px] leading-5 text-muted-foreground xl:text-right">{viewerDescription}</p>
          </div>
        </div>

        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[1.1rem] border border-border bg-background/80 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Kurangi zoom"
              disabled={!canAdjustCanvasScale}
              onClick={() => {
                const nextScale = clampScale((scaleMode === "manual" ? manualScale : fitScale) - 0.08);

                setScaleMode("manual");
                setManualScale(nextScale);
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex h-7 items-center gap-1.5 rounded-xl border border-border bg-card px-2">
              <Input
                value={scaleInput}
                inputMode="numeric"
                aria-label="Persentase zoom"
                disabled={!canAdjustCanvasScale}
                className="h-6 w-12 border-0 bg-transparent px-0 text-center text-xs shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "");
                  setScaleInput(raw);

                  const nextValue = Number(raw);
                  if (!Number.isFinite(nextValue) || nextValue <= 0) return;

                  setScaleMode("manual");
                  setManualScale(clampScale(nextValue / 100));
                }}
                onBlur={() => setScaleInput(`${Math.round(activeScale * 100)}`)}
              />
              <span className="text-xs font-medium text-muted-foreground">%</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Tambah zoom"
              disabled={!canAdjustCanvasScale}
              onClick={() => {
                const nextScale = clampScale((scaleMode === "manual" ? manualScale : fitScale) + 0.08);

                setScaleMode("manual");
                setManualScale(nextScale);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-xl px-2.5 text-xs"
              disabled={!canAdjustCanvasScale}
              onClick={() => {
                setScaleMode("fit-width");
                setScaleInput(`${Math.round(fitScale * 100)}`);
              }}
            >
              Fit to Width
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-xl px-2.5 text-xs"
              disabled={!standaloneViewerUrl}
              onClick={() => {
                if (!standaloneViewerUrl) return;
                window.open(standaloneViewerUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Maximize2 className="h-4 w-4" />
              Layar Penuh
            </Button>
            {canDownloadDocument ? (
              <Button
                type="button"
                size="sm"
                className="h-7 rounded-xl border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/25 hover:text-primary"
                onClick={() => {
                  if (!downloadDocumentUrl) return;
                  triggerPdfDownload(downloadDocumentUrl, letter.documentFileName);
                }}
              >
                <Download className="h-4 w-4" />
                Unduh
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-7 rounded-xl px-2.5 text-xs" disabled>
                <Download className="h-4 w-4" />
                Unduh
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-600 shadow-sm hover:bg-emerald-500/25 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
              disabled={!canPrintDocument}
              onClick={() => {
                if (!pdfDocument) return;
                void printPdfDocument(pdfDocument, {
                  title: letter.documentFileName,
                  mode: viewMode,
                  watermark: viewMode === "smart" ? `${currentUser?.name ?? "Pengguna"} / ${timestamp}` : undefined,
                });
              }}
            >
              <Printer className="h-4 w-4" />
              Cetak
            </Button>
          </div>
        </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent)] p-2 sm:p-2.5">
        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-auto rounded-[1.4rem] border border-border bg-[linear-gradient(180deg,rgba(148,163,184,0.10),rgba(15,23,42,0.03))] shadow-inner"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-3">
            <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 backdrop-blur">
              Tampilan aman - {currentUser?.name ?? "Pengguna aktif"} - {timestamp}
            </div>
            {letter.createdByUserName && (
              <div className="ml-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-600 backdrop-blur">
                Diunggah oleh: {letter.createdByUserName} - {formattedLetterDate}
              </div>
            )}
          </div>

          <div className="flex min-h-full min-w-full items-start justify-center p-3 pt-12 sm:p-4 sm:pt-14">
            <div className={cn("flex w-full flex-col gap-5", viewMode === "original" ? "max-w-[92rem]" : "max-w-5xl")}>
              {!letter.documentUrl ? (
                <ViewerMessage
                  title="PDF belum tersedia"
                  description="Unggah dokumen surat terlebih dahulu untuk melihat PDF."
                />
              ) : isLoadingPdf && !pdfDocument ? (
                <ViewerMessage
                  title={viewMode === "original" ? "Memuat PDF asli" : "Memuat PDF"}
                  description="Dokumen sedang diproses agar dapat ditampilkan langsung di aplikasi."
                  loading
                />
              ) : pdfDocument && pageCount > 0 ? (
                Array.from({ length: pageCount }, (_, index) => (
                  <PdfPageCanvas
                    key={`${letter.id}-${viewMode}-page-${index + 1}`}
                    pdfDocument={pdfDocument}
                    pageNumber={index + 1}
                    scale={activeScale}
                    mode={viewMode}
                    watermark={viewMode === "smart" ? `${currentUser?.name ?? "Pengguna"} / ${timestamp}` : undefined}
                  />
                ))
              ) : (
                <ViewerMessage
                  title="Tampilan PDF tidak tersedia"
                  description={pdfError || "Dokumen belum dapat dibaca oleh aplikasi."}
                  documentHref={standaloneViewerUrl ?? undefined}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  scale,
  mode,
  watermark,
}: {
  pdfDocument: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  mode: "smart" | "original";
  watermark?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    const node = containerRef.current;
    if (!node || shouldRender) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    const renderPage = async () => {
      try {
        setRenderError("");
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const pixelRatio = mode === "original" ? Math.max(window.devicePixelRatio || 1, 2) : window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        setPageHeight(viewport.height);

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;

        if (cancelled) return;

        if (watermark) {
          context.save();
          context.font = "16px sans-serif";
          context.fillStyle = "rgba(30, 41, 59, 0.14)";
          context.translate(viewport.width / 2, viewport.height / 2);
          context.rotate((-24 * Math.PI) / 180);
          context.textAlign = "center";
          context.fillText(watermark, 0, 0);
          context.restore();
        }
      } catch (error) {
        if (!cancelled) {
          if (error && typeof error === "object" && "name" in error && error.name === "RenderingCancelledException") {
            return;
          }

          setRenderError(error instanceof Error ? error.message : "Halaman PDF gagal ditampilkan.");
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [mode, pageNumber, pdfDocument, scale, shouldRender, watermark]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-[1.8rem] border border-slate-200 bg-white",
        mode === "original" ? "shadow-[0_16px_42px_rgba(15,23,42,0.10)]" : "shadow-[0_26px_64px_rgba(15,23,42,0.14)]"
      )}
      style={{ minHeight: `${pageHeight ?? 360}px` }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>Halaman {pageNumber}</span>
        <span>{mode === "original" ? "Dokumen Asli" : "Preview Cepat"}</span>
      </div>
      {renderError ? (
        <div className="flex min-h-[280px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {renderError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-b-[1.8rem]">
          <canvas ref={canvasRef} className="mx-auto block bg-white" />
        </div>
      )}
    </div>
  );
}

function ViewerMessage({
  title,
  description,
  documentUrl,
  documentHref,
  loading,
}: {
  title: string;
  description: string;
  documentUrl?: string;
  documentHref?: string;
  loading?: boolean;
}) {
  const resolvedDocumentHref = documentHref ?? (documentUrl ? buildPdfViewerRoute({ documentUrl }) : undefined);

  return (
    <div className="rounded-[1.8rem] border border-border bg-card/80 p-8 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className={cn("h-6 w-6", loading && "animate-pulse")} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
      {resolvedDocumentHref ? (
        <Button className="mt-5" variant="outline" asChild>
          <a href={resolvedDocumentHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Buka PDF Asli
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function SecurityInfoBadge({
  icon: Icon,
  label,
}: {
  icon: typeof QrCode;
  label: string;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-3 text-xs leading-6 text-muted-foreground opacity-0 shadow-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        {securityExplanation}
      </div>
    </div>
  );
}
