"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getInstitutionLogoSrc } from "@/lib/institution-logo";
import { cn } from "@/lib/utils";

type GlobalLoadingOptions = {
  label?: string;
  detail?: string;
  immediate?: boolean;
  durationMs?: number;
};

type GlobalLoadingResult = {
  phase: "success" | "error";
  label?: string;
  detail?: string;
  durationMs?: number;
};

type GlobalLoadingState = {
  visible: boolean;
  phase: "loading" | "success" | "error";
  label: string;
  detail: string;
};

type GlobalLoadingContextValue = {
  isLoading: boolean;
  startLoading: (options?: GlobalLoadingOptions) => (result?: GlobalLoadingResult) => void;
};

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const DEFAULT_LABEL = "Sedang memproses...";
const DEFAULT_DETAIL = "ALETA sedang menjalankan permintaan. Mohon tunggu sebentar.";
const NAVIGATION_LABEL = "ALETA sedang membuka halaman...";
const NAVIGATION_DETAIL = "Halaman tujuan sedang disiapkan. Mohon tunggu sebentar.";
const SUCCESS_LABEL = "Proses berhasil";
const SUCCESS_DETAIL = "Permintaan selesai diproses oleh ALETA.";
const ERROR_LABEL = "Proses gagal";
const ERROR_DETAIL = "Permintaan belum berhasil diproses. Periksa pesan di halaman lalu coba lagi.";
const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 520;
const RESULT_VISIBLE_MS = 1_700;
const NAVIGATION_FALLBACK_MS = 18_000;
const GLOBAL_LOADING_WATCHDOG_MS = 30_000;
const trackedMutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

function getFetchMethod(input: FetchInput, init?: FetchInit) {
  const methodFromInit = init?.method;
  if (methodFromInit) return methodFromInit.toUpperCase();

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

function getFetchUrl(input: FetchInput) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
}

function readFetchHeader(input: FetchInput, init: FetchInit | undefined, name: string) {
  try {
    const initHeaders = init?.headers ? new Headers(init.headers) : null;
    const initValue = initHeaders?.get(name);
    if (initValue) return initValue;

    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.headers.get(name);
    }
  } catch {
    return null;
  }

  return null;
}

function shouldTrackFetch(input: FetchInput, init?: FetchInit) {
  if (typeof window === "undefined") return false;
  if (readFetchHeader(input, init, "x-aleta-silent-loading") === "1") return false;

  const rawUrl = getFetchUrl(input);
  if (!rawUrl) return false;

  let url: URL;
  try {
    url = new URL(rawUrl, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin || !url.pathname.includes("/api/")) {
    return false;
  }

  if (url.pathname.includes("/api/e-kepegawaian/public/employee-lookup")) {
    return false;
  }

  const method = getFetchMethod(input, init);
  if (trackedMutationMethods.has(method)) return true;

  const format = url.searchParams.get("format")?.toLowerCase() ?? "";
  return method === "GET" && ["xlsx", "csv"].includes(format);
}

function getFetchLoadingText(input: FetchInput, init?: FetchInit): Pick<GlobalLoadingOptions, "label" | "detail"> {
  const customLabel = readFetchHeader(input, init, "x-aleta-loading-label");
  const customDetail = readFetchHeader(input, init, "x-aleta-loading-detail");
  if (customLabel || customDetail) {
    return {
      label: customLabel ?? DEFAULT_LABEL,
      detail: customDetail ?? DEFAULT_DETAIL,
    };
  }

  const method = getFetchMethod(input, init);
  const rawUrl = getFetchUrl(input);
  let format = "";

  try {
    format = new URL(rawUrl, window.location.origin).searchParams.get("format")?.toLowerCase() ?? "";
  } catch {
    format = "";
  }

  if (format === "xlsx") {
    return {
      label: "ALETA sedang membuat Excel...",
      detail: "Data sedang dirapikan ke file Excel. Jendela ini akan kembali aktif setelah selesai.",
    };
  }

  if (format === "csv") {
    return {
      label: "ALETA sedang membuat data...",
      detail: "Data sedang disiapkan agar bisa diunduh dengan rapi.",
    };
  }

  if (method === "DELETE") {
    return {
      label: "ALETA sedang menghapus data...",
      detail: "Permintaan hapus sedang diproses dan divalidasi oleh server.",
    };
  }

  if (method === "PATCH" || method === "PUT") {
    return {
      label: "ALETA sedang menyimpan perubahan...",
      detail: "Perubahan sedang dikirim dan disimpan. Mohon tunggu sebentar.",
    };
  }

  return {
    label: DEFAULT_LABEL,
    detail: "Data sedang dikirim ke server. Mohon tunggu sampai proses selesai.",
  };
}

function getFetchResultText(input: FetchInput, init: FetchInit | undefined, ok: boolean): GlobalLoadingResult {
  const method = getFetchMethod(input, init);
  if (!ok) {
    return {
      phase: "error",
      label: ERROR_LABEL,
      detail: ERROR_DETAIL,
    };
  }

  if (method === "DELETE") {
    return {
      phase: "success",
      label: "Data berhasil dihapus",
      detail: "Perubahan penghapusan sudah selesai diproses.",
    };
  }

  if (method === "PATCH" || method === "PUT") {
    return {
      phase: "success",
      label: "Perubahan berhasil disimpan",
      detail: "Data terbaru sudah diproses oleh ALETA.",
    };
  }

  const rawUrl = getFetchUrl(input);
  try {
    const format = new URL(rawUrl, window.location.origin).searchParams.get("format")?.toLowerCase() ?? "";
    if (format === "xlsx" || format === "csv") {
      return {
        phase: "success",
        label: "File berhasil dibuat",
        detail: "File sudah disiapkan dan proses unduhan dilanjutkan oleh browser.",
      };
    }
  } catch {
    // URL yang tidak bisa dibaca tetap memakai pesan umum.
  }

  return {
    phase: "success",
    label: SUCCESS_LABEL,
    detail: SUCCESS_DETAIL,
  };
}

function getNavigationTarget(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement)) return null;
  if (target.dataset.aletaSilentLoading === "true") return null;
  if (target.target && target.target !== "_self") return null;
  if (target.hasAttribute("download")) return null;

  let url: URL;
  try {
    url = new URL(target.href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (["mailto:", "tel:", "javascript:"].includes(url.protocol)) return null;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const targetPath = `${url.pathname}${url.search}`;
  if (targetPath === currentPath) return null;

  return url;
}

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalLoadingState>({
    visible: false,
    phase: "loading",
    label: DEFAULT_LABEL,
    detail: DEFAULT_DETAIL,
  });
  const activeCountRef = useRef(0);
  const visibleRef = useRef(false);
  const visibleSinceRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const latestOptionsRef = useRef<Required<Pick<GlobalLoadingOptions, "label" | "detail">>>({
    label: DEFAULT_LABEL,
    detail: DEFAULT_DETAIL,
  });

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearWatchdogTimer = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const revealLoading = useCallback(() => {
    clearShowTimer();
    visibleRef.current = true;
    visibleSinceRef.current = Date.now();
    setState({
      visible: true,
      phase: "loading",
      label: latestOptionsRef.current.label,
      detail: latestOptionsRef.current.detail,
    });
  }, [clearShowTimer]);

  const hideLoading = useCallback(() => {
    clearHideTimer();
    clearWatchdogTimer();
    visibleRef.current = false;
    visibleSinceRef.current = 0;
    setState((current) => ({ ...current, visible: false }));
  }, [clearHideTimer, clearWatchdogTimer]);

  const showResult = useCallback(
    (result: GlobalLoadingResult) => {
      clearShowTimer();
      clearHideTimer();
      clearWatchdogTimer();
      visibleRef.current = true;
      visibleSinceRef.current = Date.now();
      setState({
        visible: true,
        phase: result.phase,
        label: result.label ?? (result.phase === "success" ? SUCCESS_LABEL : ERROR_LABEL),
        detail: result.detail ?? (result.phase === "success" ? SUCCESS_DETAIL : ERROR_DETAIL),
      });
      const durationMs = Math.min(Math.max(Number(result.durationMs || RESULT_VISIBLE_MS), 800), 5_000);
      hideTimerRef.current = window.setTimeout(hideLoading, durationMs);
    },
    [clearHideTimer, clearShowTimer, clearWatchdogTimer, hideLoading]
  );

  const releaseStaleLoading = useCallback(() => {
    if (activeCountRef.current <= 0) return;

    activeCountRef.current = 0;
    console.warn("[ALETA] Global loading dilepas otomatis karena melewati batas waktu watchdog.");
    showResult({
      phase: "error",
      label: "Proses terlalu lama",
      detail:
        "ALETA menghentikan indikator loading karena proses melewati batas waktu. Periksa status halaman lalu coba ulangi bila perlu.",
      durationMs: 2_600,
    });
  }, [showResult]);

  const scheduleWatchdog = useCallback(() => {
    clearWatchdogTimer();
    watchdogTimerRef.current = window.setTimeout(releaseStaleLoading, GLOBAL_LOADING_WATCHDOG_MS);
  }, [clearWatchdogTimer, releaseStaleLoading]);

  const startLoading = useCallback(
    (options?: GlobalLoadingOptions) => {
      activeCountRef.current += 1;
      scheduleWatchdog();
      latestOptionsRef.current = {
        label: options?.label ?? DEFAULT_LABEL,
        detail: options?.detail ?? DEFAULT_DETAIL,
      };

      clearHideTimer();

      if (visibleRef.current) {
        setState({
          visible: true,
          phase: "loading",
          label: latestOptionsRef.current.label,
          detail: latestOptionsRef.current.detail,
        });
      } else if (showTimerRef.current === null) {
        const delay = options?.immediate ? 0 : SHOW_DELAY_MS;
        showTimerRef.current = window.setTimeout(revealLoading, delay);
      }

      let stopped = false;
      return (result?: GlobalLoadingResult) => {
        if (stopped) return;
        stopped = true;
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);

        if (activeCountRef.current > 0) return;

        clearWatchdogTimer();
        clearShowTimer();
        if (result) {
          showResult(result);
          return;
        }

        if (!visibleRef.current) return;

        const visibleForMs = Date.now() - visibleSinceRef.current;
        const remainingMs = Math.max(0, MIN_VISIBLE_MS - visibleForMs);
        hideTimerRef.current = window.setTimeout(hideLoading, remainingMs);
      };
    },
    [clearHideTimer, clearShowTimer, clearWatchdogTimer, hideLoading, revealLoading, scheduleWatchdog, showResult]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.fetch !== "function") return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: FetchInput, init?: FetchInit) => {
      const stopLoading = shouldTrackFetch(input, init)
        ? startLoading({ ...getFetchLoadingText(input, init), immediate: false })
        : null;

      try {
        const response = await originalFetch(input, init);
        stopLoading?.(getFetchResultText(input, init, response.ok));
        return response;
      } catch (error) {
        stopLoading?.({
          phase: "error",
          label: ERROR_LABEL,
          detail: "Koneksi ke server gagal atau proses dibatalkan. Coba ulangi permintaan.",
        });
        throw error;
      }
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
      clearShowTimer();
      clearHideTimer();
      clearWatchdogTimer();
    };
  }, [clearHideTimer, clearShowTimer, clearWatchdogTimer, startLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleManualLoading = (event: Event) => {
      const detail = (event as CustomEvent<GlobalLoadingOptions>).detail ?? {};
      const durationCandidate = Number(detail.durationMs);
      const durationMs = Number.isFinite(durationCandidate)
        ? Math.min(Math.max(durationCandidate, 250), 30_000)
        : 1_400;
      const stopLoading = startLoading({
        label: detail.label,
        detail: detail.detail,
        immediate: detail.immediate ?? true,
      });
      window.setTimeout(stopLoading, durationMs);
    };
    const handleManualResult = (event: Event) => {
      const detail = (event as CustomEvent<GlobalLoadingResult>).detail;
      if (!detail?.phase) return;
      activeCountRef.current = 0;
      showResult(detail);
    };
    const handleManualHide = () => {
      activeCountRef.current = 0;
      clearWatchdogTimer();
      clearShowTimer();
      hideLoading();
    };

    window.addEventListener("aleta:show-loading", handleManualLoading);
    window.addEventListener("aleta:show-result", handleManualResult);
    window.addEventListener("aleta:hide-loading", handleManualHide);

    return () => {
      window.removeEventListener("aleta:show-loading", handleManualLoading);
      window.removeEventListener("aleta:show-result", handleManualResult);
      window.removeEventListener("aleta:hide-loading", handleManualHide);
    };
  }, [clearShowTimer, clearWatchdogTimer, hideLoading, showResult, startLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let stopNavigationLoading: (() => void) | null = null;
    let fallbackTimer: number | null = null;
    let stopTimer: number | null = null;

    const clearNavigationTimers = () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
    };

    const stopCurrentNavigation = () => {
      clearNavigationTimers();
      stopNavigationLoading?.();
      stopNavigationLoading = null;
    };

    const scheduleNavigationComplete = () => {
      if (!stopNavigationLoading) return;
      if (stopTimer !== null) {
        window.clearTimeout(stopTimer);
      }
      stopTimer = window.setTimeout(stopCurrentNavigation, 120);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const url = getNavigationTarget(event);
      if (!url) return;

      stopCurrentNavigation();
      stopNavigationLoading = startLoading({
        label: NAVIGATION_LABEL,
        detail: NAVIGATION_DETAIL,
        immediate: true,
      });
      fallbackTimer = window.setTimeout(stopCurrentNavigation, NAVIGATION_FALLBACK_MS);
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStateWithAletaLoading(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event("aleta:navigation-change"));
      return result;
    };

    window.history.replaceState = function replaceStateWithAletaLoading(...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event("aleta:navigation-change"));
      return result;
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("aleta:navigation-change", scheduleNavigationComplete);
    window.addEventListener("popstate", scheduleNavigationComplete);
    window.addEventListener("pageshow", stopCurrentNavigation);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("aleta:navigation-change", scheduleNavigationComplete);
      window.removeEventListener("popstate", scheduleNavigationComplete);
      window.removeEventListener("pageshow", stopCurrentNavigation);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      stopCurrentNavigation();
    };
  }, [startLoading]);

  const value = useMemo<GlobalLoadingContextValue>(
    () => ({
      isLoading: state.visible,
      startLoading,
    }),
    [startLoading, state.visible]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <GlobalLoadingOverlay visible={state.visible} phase={state.phase} label={state.label} detail={state.detail} />
    </GlobalLoadingContext.Provider>
  );
}

function GlobalLoadingOverlay({
  visible,
  phase,
  label,
  detail,
}: {
  visible: boolean;
  phase: GlobalLoadingState["phase"];
  label: string;
  detail: string;
}) {
  const isLoading = phase === "loading";
  const isSuccess = phase === "success";
  return (
    <div
      aria-busy={visible && isLoading}
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/78 px-5 text-center text-white backdrop-blur-md transition duration-200",
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      data-phase={phase}
      data-testid="global-loading-overlay"
      role="status"
    >
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-white/12 bg-slate-950/55 px-6 py-7 shadow-2xl">
        <div className="relative h-28 w-28">
          <div className={cn("absolute inset-0 rounded-full border", isSuccess ? "border-emerald-300/40" : phase === "error" ? "border-rose-300/40" : "border-sky-300/25")} />
          {isLoading ? (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-r-emerald-300 border-t-sky-300 aleta-loading-spin" />
              <div className="absolute inset-3 rounded-full border border-transparent border-b-amber-300 border-l-sky-200 aleta-loading-spin-reverse" />
            </>
          ) : null}
          <div className="absolute inset-6 flex items-center justify-center p-3">
            {isLoading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Logo ALETA"
                className="h-full w-full object-contain drop-shadow-[0_10px_22px_rgba(125,211,252,0.26)]"
                src={getInstitutionLogoSrc(null)}
              />
            ) : isSuccess ? (
              <CheckCircle2 className="h-12 w-12 animate-pulse text-emerald-300" />
            ) : (
              <XCircle className="h-12 w-12 animate-pulse text-rose-300" />
            )}
          </div>
        </div>

        <p className={cn("mt-6 text-sm font-semibold", isSuccess ? "text-emerald-200" : phase === "error" ? "text-rose-200" : "text-sky-200")}>ALETA</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{label}</h2>
        <p className="mt-3 max-w-xs text-sm leading-6 text-slate-200">{detail}</p>

        <div className={cn("mt-5 flex items-center gap-2", !isLoading && "opacity-0")} aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-sky-300 aleta-loading-dot" />
          <span className="h-2 w-2 rounded-full bg-emerald-300 aleta-loading-dot [animation-delay:160ms]" />
          <span className="h-2 w-2 rounded-full bg-amber-300 aleta-loading-dot [animation-delay:320ms]" />
        </div>
      </div>
    </div>
  );
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);
  if (!context) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }

  return context;
}
