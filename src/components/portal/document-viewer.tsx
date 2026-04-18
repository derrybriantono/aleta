"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Eye, FileText, Info, Minus, Plus, Printer, QrCode, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PdfLiveViewer } from "@/components/pdf/pdf-live-viewer";
import { loadPdfBinary } from "@/lib/pdf-binary";
import { loadPdfJsModule, type PdfDocumentLoadingTask, type PdfDocumentProxy } from "@/lib/pdfjs-client";
import { buildPdfBinaryRoute, buildPdfViewerRoute, normalizePdfDocumentPath } from "@/lib/pdf-viewer-route";
import { type LetterDetail, type UserPersona } from "@/lib/types";
import { cn } from "@/lib/utils";

const BASE_DOCUMENT_WIDTH = 960;
const MIN_SCALE = 0.42;
const MAX_SCALE = 1.18;
const securityExplanation =
  "Dokumen ini dilindungi watermark dinamis dan QR validasi internal untuk mencegah pemalsuan.";

function clampScale(value: number) {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
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
  const canAdjustSmartScale = viewMode === "smart" && !!pdfDocument && !pdfError;
  const safeDocumentUrl = normalizePdfDocumentPath(letter.documentUrl);
  const standaloneViewerUrl = safeDocumentUrl
    ? buildPdfViewerRoute({
        documentUrl: safeDocumentUrl,
        documentFileName: letter.documentFileName,
      })
    : null;
  const downloadDocumentUrl = safeDocumentUrl ? buildPdfBinaryRoute(safeDocumentUrl) : letter.documentUrl;
  const statusText = useMemo(() => {
    if (!letter.documentUrl) return "Dokumen PDF belum tersedia";
    if (viewMode === "original") return "Mode fidelity dokumen asli aktif";
    if (pdfError) return "Preview PDF asli aktif";
    if (pdfDocument && pageCount > 0) return `${pageCount} halaman PDF aktif`;
    if (isLoadingPdf) return "Menyiapkan preview PDF";

    return "Menunggu PDF aktif";
  }, [isLoadingPdf, letter.documentUrl, pageCount, pdfDocument, pdfError, viewMode]);
  const viewerDescription =
    viewMode === "smart"
      ? "Smart Preview difokuskan untuk telaah cepat di workflow surat: watermark aktif, kartu per halaman, dan render bertahap agar tetap ringan."
      : "PDF Asli menampilkan dokumen dengan fidelity lebih utuh: tanpa watermark overlay, dengan navigasi halaman internal untuk membaca detail dokumen.";

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const recalculateScale = () => {
      const rect = viewport.getBoundingClientRect();
      const nextScale = clampScale((rect.width - 56) / BASE_DOCUMENT_WIDTH);

      setFitScale(Number(nextScale.toFixed(3)));
    };

    recalculateScale();

    const observer = new ResizeObserver(recalculateScale);
    observer.observe(viewport);
    window.addEventListener("resize", recalculateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalculateScale);
    };
  }, []);

  useEffect(() => {
    setScaleInput(`${scalePercentage}`);
  }, [scalePercentage]);

  useEffect(() => {
    const documentUrl = letter.documentUrl;

    if (!documentUrl) {
      setPdfDocument(null);
      setPageCount(0);
      setPdfError("Dokumen PDF belum tersedia.");
      return;
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
    <section className={cn("flex h-full flex-col", className)}>
      <div className="flex flex-col gap-4 border-b border-border/80 bg-card/70 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isPreviewOnly ? "warning" : "success"}>
                {isPreviewOnly ? "View Only" : "Unduh Aktif"}
              </Badge>
              <SecurityInfoBadge icon={QrCode} label="Validasi Internal" />
              <SecurityInfoBadge icon={Shield} label="Proteksi Dokumen" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-foreground">Integrated Document Viewer</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                {viewerDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-[1.3rem] border border-border bg-background/80 p-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 rounded-[1rem] px-4 text-xs font-semibold tracking-wide transition-all",
                  viewMode === "smart" ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setViewMode("smart")}
              >
                <Eye className="mr-2 h-3.5 w-3.5" />
                Smart Preview
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 rounded-[1rem] px-4 text-xs font-semibold tracking-wide transition-all",
                  viewMode === "original" ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setViewMode("original")}
              >
                <FileText className="mr-2 h-3.5 w-3.5" />
                PDF Asli
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-[1.3rem] border border-border bg-background/80 p-2 shadow-sm">
              <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Kurangi zoom"
              disabled={!canAdjustSmartScale}
              onClick={() => {
                const nextScale = clampScale((scaleMode === "manual" ? manualScale : fitScale) - 0.08);

                setScaleMode("manual");
                setManualScale(nextScale);
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
              <Input
                value={scaleInput}
                inputMode="numeric"
                aria-label="Persentase zoom"
                disabled={!canAdjustSmartScale}
                className="h-8 w-20 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
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
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tambah zoom"
              disabled={!canAdjustSmartScale}
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
              disabled={!canAdjustSmartScale}
              onClick={() => setScaleMode("fit-width")}
            >
              Fit to Width
            </Button>
            <Button variant="outline" size="sm" disabled={isPreviewOnly || !letter.documentUrl} asChild>
              <a href={downloadDocumentUrl} download={letter.documentFileName}>
                <Download className="h-4 w-4" />
                Unduh
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPreviewOnly || !standaloneViewerUrl}
              onClick={() => {
                if (!standaloneViewerUrl) return;
                window.open(standaloneViewerUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Printer className="h-4 w-4" />
              Cetak
            </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            {canAdjustSmartScale ? (scaleMode === "fit-width" ? "Auto fit-to-width" : "Manual zoom") : "Preview inline"}
          </Badge>
          <span>{canAdjustSmartScale ? `Scale aktif ${scalePercentage}%` : "Zoom canvas tidak aktif"}</span>
          <span className="hidden sm:inline">-</span>
          <span>{statusText}</span>
        </div>
      </div>

      <div className="flex-1 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent)] p-3 sm:p-4">
        <div
          ref={viewportRef}
          className="relative h-[clamp(460px,78vh,940px)] overflow-auto rounded-[1.6rem] border border-border bg-[linear-gradient(180deg,rgba(148,163,184,0.10),rgba(15,23,42,0.03))] shadow-inner"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-4">
            <div className="rounded-full border border-primary/20 bg-primary/10 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80 backdrop-blur">
              Viewer aman - {currentUser?.name ?? "Pengguna aktif"} - {timestamp}
            </div>
            {letter.createdByUserName && (
              <div className="ml-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600 backdrop-blur">
                Diunggah oleh: {letter.createdByUserName} - {formattedLetterDate}
              </div>
            )}
          </div>

          <div className="flex min-h-full min-w-full items-start justify-center p-4 pt-16 sm:p-6 sm:pt-20">
            {viewMode === "smart" ? (
              <div className="flex w-full max-w-5xl flex-col gap-5">
                {!letter.documentUrl ? (
                  <ViewerMessage
                    title="PDF belum tersedia"
                    description="Upload dokumen surat terlebih dahulu untuk melihat preview PDF asli."
                    documentUrl={letter.documentUrl}
                  />
                ) : isLoadingPdf && !pdfDocument ? (
                  <ViewerMessage
                    title="Memuat PDF asli"
                    description="Halaman PDF sedang dirender agar tampil proporsional dan tetap ringan."
                    loading
                  />
                ) : pdfDocument && pageCount > 0 ? (
                  Array.from({ length: pageCount }, (_, index) => (
                    <PdfPageCanvas
                      key={`${letter.id}-page-${index + 1}`}
                      pdfDocument={pdfDocument}
                      pageNumber={index + 1}
                      scale={activeScale}
                      watermark={`${currentUser?.name ?? "Pengguna"} / ${timestamp}`}
                    />
                  ))
                ) : (
                <InlinePdfPreview
                  documentUrl={safeDocumentUrl}
                  documentFileName={letter.documentFileName}
                  mode="fallback"
                  notice={
                      pdfError
                        ? "Smart Preview sedang bermasalah di browser ini. PDF asli tetap ditampilkan langsung di bawah."
                        : undefined
                    }
                  />
                )}
              </div>
            ) : (
              letter.documentUrl ? (
                <InlinePdfPreview
                  documentUrl={safeDocumentUrl}
                  documentFileName={letter.documentFileName}
                  mode="original"
                />
              ) : (
                <ViewerMessage
                  title="PDF belum tersedia"
                  description="Upload dokumen surat terlebih dahulu untuk melihat preview PDF asli."
                />
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function InlinePdfPreview({
  documentUrl,
  documentFileName,
  mode,
  notice,
}: {
  documentUrl: string | null;
  documentFileName?: string;
  mode: "original" | "fallback";
  notice?: string;
}) {
  const modeLabel = mode === "original" ? "Viewer Dokumen Asli" : "Live PDF Viewer";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[1.8rem] border border-border bg-card shadow-2xl",
        mode === "original" ? "max-w-[92rem]" : "max-w-5xl"
      )}
      data-testid="pdf-inline-preview-live"
    >
      {notice ? (
        <div className="border-b border-amber-200 bg-amber-50/80 px-5 py-3 text-sm leading-6 text-amber-800">
          {notice}
        </div>
      ) : null}
      <div className="flex-1 bg-muted/20">
        {documentUrl ? (
          <PdfLiveViewer
            documentUrl={documentUrl}
            documentFileName={documentFileName}
            embedded
            showToolbar={mode === "original"}
            mode={mode}
          />
        ) : (
          <ViewerMessage title="PDF tidak tersedia" description="Tautan dokumen tidak valid untuk ditampilkan di browser." />
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-white px-6 py-4 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-500/10">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{documentFileName || "dokumen-asli.pdf"}</p>
            <p className="text-[11px] text-muted-foreground">{modeLabel}</p>
          </div>
        </div>
        {documentUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a
              href={buildPdfViewerRoute({
                documentUrl,
                documentFileName,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Buka di Jendela Baru
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  scale,
  watermark,
}: {
  pdfDocument: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  watermark: string;
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

        const pixelRatio = window.devicePixelRatio || 1;
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

        context.save();
        context.font = "16px sans-serif";
        context.fillStyle = "rgba(30, 41, 59, 0.14)";
        context.translate(viewport.width / 2, viewport.height / 2);
        context.rotate((-24 * Math.PI) / 180);
        context.textAlign = "center";
        context.fillText(watermark, 0, 0);
        context.restore();
      } catch (error) {
        if (!cancelled) {
          if (error && typeof error === "object" && "name" in error && error.name === "RenderingCancelledException") {
            return;
          }

          setRenderError(error instanceof Error ? error.message : "Halaman PDF gagal dirender.");
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument, scale, shouldRender, watermark]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_26px_64px_rgba(15,23,42,0.14)]"
      style={{ minHeight: `${pageHeight ?? 360}px` }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>Halaman {pageNumber}</span>
        <span>Smart Preview</span>
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
  loading,
}: {
  title: string;
  description: string;
  documentUrl?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-[1.8rem] border border-border bg-card/80 p-8 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className={cn("h-6 w-6", loading && "animate-pulse")} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
      {documentUrl ? (
        <Button className="mt-5" variant="outline" asChild>
          <a href={documentUrl} target="_blank" rel="noopener noreferrer">
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
