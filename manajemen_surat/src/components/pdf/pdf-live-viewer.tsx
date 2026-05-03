"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadPdfBinary } from "@/lib/pdf-binary";
import { loadPdfJsModule, type PdfDocumentLoadingTask, type PdfDocumentProxy } from "@/lib/pdfjs-client";
import { buildPdfBinaryRoute } from "@/lib/pdf-viewer-route";
import { cn } from "@/lib/utils";

const BASE_DOCUMENT_WIDTH = 960;
const FALLBACK_MIN_SCALE = 0.42;
const ORIGINAL_MIN_SCALE = 0.5;
const FALLBACK_MAX_SCALE = 1.28;
const ORIGINAL_MAX_SCALE = 2.2;

function clampScale(value: number, mode: "original" | "fallback") {
  const minScale = mode === "original" ? ORIGINAL_MIN_SCALE : FALLBACK_MIN_SCALE;
  const maxScale = mode === "original" ? ORIGINAL_MAX_SCALE : FALLBACK_MAX_SCALE;

  return Math.min(Math.max(value, minScale), maxScale);
}

export function PdfLiveViewer({
  documentUrl,
  documentFileName,
  embedded = false,
  showToolbar = !embedded,
  mode = "original",
}: {
  documentUrl: string;
  documentFileName?: string;
  embedded?: boolean;
  showToolbar?: boolean;
  mode?: "original" | "fallback";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [fitScale, setFitScale] = useState(1);
  const [manualScale, setManualScale] = useState(1);
  const [scaleMode, setScaleMode] = useState<"fit-width" | "manual">("fit-width");
  const [scaleInput, setScaleInput] = useState("100");
  const [pageInput, setPageInput] = useState("1");
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const activeScale = scaleMode === "manual" ? manualScale : fitScale;
  const scalePercentage = Math.round(activeScale * 100);
  const binaryRoute = buildPdfBinaryRoute(documentUrl);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const recalculateScale = () => {
      const rect = viewport.getBoundingClientRect();
      const nextScale = clampScale((rect.width - 56) / BASE_DOCUMENT_WIDTH, mode);

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
  }, [mode]);

  useEffect(() => {
    setManualScale((currentScale) => clampScale(currentScale, mode));
    setFitScale((currentScale) => clampScale(currentScale, mode));
  }, [mode]);

  useEffect(() => {
    setScaleInput(`${scalePercentage}`);
  }, [scalePercentage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [documentUrl]);

  useEffect(() => {
    setPageInput(`${currentPage}`);
  }, [currentPage]);

  useEffect(() => {
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
          setPdfError(error instanceof Error ? error.message : "Preview PDF tidak dapat dimuat.");
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
  }, [documentUrl]);

  const statusText = useMemo(() => {
    if (pdfDocument && pageCount > 0) return `${pageCount} halaman aktif`;
    if (isLoadingPdf) return "Memuat PDF";
    if (pdfError) return "Preview gagal dimuat";

    return "Menunggu PDF";
  }, [isLoadingPdf, pageCount, pdfDocument, pdfError]);
  const modeTitle = mode === "original" ? "PDF Asli" : "Mode Cadangan PDF";
  const modeHint =
    mode === "original"
      ? "Tampilan dokumen asli tanpa watermark, cocok untuk baca detail, seleksi teks, dan navigasi halaman."
      : "Mode cadangan otomatis saat pratinjau utama belum cocok dengan browser yang digunakan.";

  useEffect(() => {
    if (!pdfDocument || pageCount <= 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateCurrentPage = () => {
      const containerTop = viewport.getBoundingClientRect().top;
      let nearestPage = 1;
      let smallestDistance = Number.POSITIVE_INFINITY;

      pageRefs.current.forEach((node, index) => {
        if (!node) return;
        const distance = Math.abs(node.getBoundingClientRect().top - containerTop - 24);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nearestPage = index + 1;
        }
      });

      setCurrentPage(nearestPage);
    };

    updateCurrentPage();
    viewport.addEventListener("scroll", updateCurrentPage, { passive: true });

    return () => viewport.removeEventListener("scroll", updateCurrentPage);
  }, [pageCount, pdfDocument, scalePercentage]);

  const scrollToPage = (pageNumber: number) => {
    const normalizedPage = Math.min(Math.max(pageNumber, 1), Math.max(pageCount, 1));
    pageRefs.current[normalizedPage - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setCurrentPage(normalizedPage);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{documentFileName || "dokumen.pdf"}</p>
            <p className="text-xs text-muted-foreground">
              {modeTitle} - {statusText}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{modeHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Halaman sebelumnya"
              disabled={!pdfDocument || currentPage <= 1}
              onClick={() => scrollToPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
              <Input
                value={pageInput}
                inputMode="numeric"
                aria-label="Nomor halaman"
                disabled={!pdfDocument}
                className="h-8 w-16 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "");
                  setPageInput(raw);
                }}
                onBlur={() => {
                  const nextPage = Number(pageInput);
                  if (!Number.isFinite(nextPage) || nextPage <= 0) {
                    setPageInput(`${currentPage}`);
                    return;
                  }

                  scrollToPage(nextPage);
                }}
              />
              <span className="text-sm font-medium text-muted-foreground">/ {pageCount || "-"}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Halaman berikutnya"
              disabled={!pdfDocument || currentPage >= pageCount}
              onClick={() => scrollToPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Kurangi zoom"
              disabled={!pdfDocument}
              onClick={() => {
                const nextScale = clampScale((scaleMode === "manual" ? manualScale : fitScale) - 0.08, mode);

                setScaleMode("manual");
                setManualScale(nextScale);
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
              <Input
                value={scaleInput}
                inputMode="numeric"
                aria-label="Persentase zoom"
                disabled={!pdfDocument}
                className="h-8 w-20 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "");
                  setScaleInput(raw);

                  const nextValue = Number(raw);
                  if (!Number.isFinite(nextValue) || nextValue <= 0) return;

                  setScaleMode("manual");
                  setManualScale(clampScale(nextValue / 100, mode));
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
              disabled={!pdfDocument}
              onClick={() => {
                const nextScale = clampScale((scaleMode === "manual" ? manualScale : fitScale) + 0.08, mode);

                setScaleMode("manual");
                setManualScale(nextScale);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!pdfDocument} onClick={() => setScaleMode("fit-width")}>
              Fit to Width
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={binaryRoute} download={documentFileName}>
                <Download className="mr-2 h-4 w-4" />
                Unduh
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={cn(
          "relative flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(148,163,184,0.10),rgba(15,23,42,0.03))]",
          embedded ? "h-full rounded-[1.5rem]" : "min-h-[calc(100vh-80px)]"
        )}
      >
        <div className="flex min-h-full min-w-full items-start justify-center p-4 sm:p-6">
          <div className={cn("flex w-full flex-col gap-5", mode === "original" ? "max-w-[92rem]" : "max-w-5xl")}>
            {pdfError ? (
              <PdfLiveMessage title="Preview PDF tidak tersedia" description={pdfError} documentUrl={binaryRoute} />
            ) : isLoadingPdf && !pdfDocument ? (
              <PdfLiveMessage
                title="Memuat PDF"
                description="Dokumen sedang diproses agar dapat ditampilkan langsung di browser."
                loading
              />
            ) : pdfDocument && pageCount > 0 ? (
              Array.from({ length: pageCount }, (_, index) => (
                <PdfLivePageCanvas
                  key={`${documentUrl}-page-${index + 1}`}
                  setContainerRef={(node) => {
                    pageRefs.current[index] = node;
                  }}
                  pdfDocument={pdfDocument}
                  pageNumber={index + 1}
                  scale={activeScale}
                  mode={mode}
                />
              ))
            ) : (
              <PdfLiveMessage
                title="PDF belum tersedia"
                description="Dokumen belum dapat dibaca oleh viewer."
                documentUrl={binaryRoute}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfLivePageCanvas({
  pdfDocument,
  pageNumber,
  scale,
  mode,
  setContainerRef,
}: {
  pdfDocument: PdfDocumentProxy;
  pageNumber: number;
  scale: number;
  mode: "original" | "fallback";
  setContainerRef?: (node: HTMLDivElement | null) => void;
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

        const basePixelRatio = window.devicePixelRatio || 1;
        const renderPixelRatio = mode === "original" ? Math.max(basePixelRatio, 2) : basePixelRatio;
        canvas.width = Math.ceil(viewport.width * renderPixelRatio);
        canvas.height = Math.ceil(viewport.height * renderPixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        setPageHeight(viewport.height);

        renderTask = page.render({
          canvas,
          canvasContext: context,
          transform:
            renderPixelRatio !== 1 ? [renderPixelRatio, 0, 0, renderPixelRatio, 0, 0] : undefined,
          viewport,
        });

        await renderTask.promise;
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
  }, [mode, pageNumber, pdfDocument, scale, shouldRender]);

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setContainerRef?.(node);
      }}
      className={cn(
        "relative rounded-[1.8rem] border border-slate-200 bg-white",
        mode === "original" ? "shadow-[0_16px_42px_rgba(15,23,42,0.10)]" : "shadow-[0_26px_64px_rgba(15,23,42,0.14)]"
      )}
      style={{ minHeight: `${pageHeight ?? 360}px` }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>Halaman {pageNumber}</span>
        <span>{mode === "original" ? "Dokumen Asli" : "PDF Live"}</span>
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

function PdfLiveMessage({
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
          <a href={documentUrl} download>
            <Download className="mr-2 h-4 w-4" />
            Unduh PDF
          </a>
        </Button>
      ) : null}
    </div>
  );
}
