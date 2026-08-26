"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  FileStack,
  Inbox,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { LetterRegistrationPanel } from "@/components/portal/letter-registration-panel";
import { LetterList } from "@/components/portal/letter-list";
import { LetterTemplateManager } from "@/components/portal/letter-template-manager";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { canCreateIncomingLetter, canCreateOutgoingLetter } from "@/lib/permissions";
import { type LetterDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeMeta = {
  semua: {
    title: "Kumpulan Surat",
    description: "Lihat semua surat yang bisa Anda akses. Gunakan pencarian atau pilihan penyaring bila perlu.",
  },
  masuk: {
    title: "Surat Masuk",
    description: "Catat surat masuk, cari data, dan ikuti tindak lanjutnya.",
  },
  keluar: {
    title: "Surat Keluar",
    description: "Catat surat keluar, cari data, dan pantau prosesnya.",
  },
} as const;

type LetterPageSize = 5 | 10 | 25 | 50 | 100 | "all";

type SuratListPayload = {
  items?: LetterDetail[];
  data?: LetterDetail[];
  pagination?: {
    page: number;
    pageSize: LetterPageSize;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  error?: {
    message?: string;
  };
};

const pageSizeOptions: Array<{ value: LetterPageSize; label: string }> = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: "all", label: "Semua" },
];

function readPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readPageSize(value: string | null): LetterPageSize {
  if (value === "all") return "all";
  const numeric = Number(value);
  return [5, 10, 25, 50, 100].includes(numeric) ? (numeric as LetterPageSize) : 25;
}

function getRangeLabel(page: number, pageSize: LetterPageSize, total: number, visibleCount: number) {
  if (total === 0 || visibleCount === 0) return "Menampilkan 0 surat";
  if (pageSize === "all") return `Menampilkan semua ${total} surat`;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + visibleCount - 1, total);
  return `Menampilkan ${start}-${end} dari ${total} surat`;
}

function buildMetricButtonMeta(metric: "visible" | "inbox" | "completed", active: boolean) {
  if (metric === "inbox") {
    return {
      icon: Inbox,
      label: "Tugas Aktif",
      className: active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
    };
  }

  if (metric === "completed") {
    return {
      icon: CheckCircle2,
      label: "Sudah Selesai",
      className: active ? "border-emerald-400/40 bg-emerald-500/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
    };
  }

  return {
    icon: FileStack,
    label: "Semua Surat",
    className: active ? "border-sky-400/40 bg-sky-500/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
  };
}

export default function SuratIndexPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessibleModules, currentUser, deleteLetter, softDeleteLetter, retryWhatsappDelivery } = usePortal();
  const metric = (searchParams.get("metric") ?? "visible") as "visible" | "inbox" | "completed";
  const typeFilter = (searchParams.get("type") ?? "semua") as "semua" | "masuk" | "keluar";
  const statusFilter = searchParams.get("status") ?? "Semua";
  const query = searchParams.get("search") ?? searchParams.get("query") ?? "";
  const page = readPositiveInt(searchParams.get("page"), 1);
  const pageSize = readPageSize(searchParams.get("pageSize"));
  const sortBy = searchParams.get("sortBy") ?? "tanggal";
  const sortDirection = searchParams.get("sortDirection") === "asc" ? "asc" : "desc";
  const uploadedFrom = searchParams.get("uploadedFrom") ?? "";
  const uploadedTo = searchParams.get("uploadedTo") ?? "";
  const [searchInput, setSearchInput] = useState(query);
  const [letters, setLetters] = useState<LetterDetail[]>([]);
  const [pagination, setPagination] = useState<SuratListPayload["pagination"]>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoadingLetters, setIsLoadingLetters] = useState(true);
  const [letterError, setLetterError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const isDeleteAllowed = currentUser?.roleId === "admin" || currentUser?.roleId === "super-admin";
  const deleteLabel = currentUser?.roleId === "super-admin" ? "Hapus Permanen" : "Arsipkan";
  const canOpenComposer =
    typeFilter === "masuk"
      ? canCreateIncomingLetter(currentUser)
      : typeFilter === "keluar"
        ? canCreateOutgoingLetter(currentUser)
        : false;
  const quickMetrics = [
    { id: "visible" as const, count: pagination?.total ?? 0 },
    { id: "inbox" as const, count: metric === "inbox" ? (pagination?.total ?? 0) : undefined },
    { id: "completed" as const, count: metric === "completed" ? (pagination?.total ?? 0) : undefined },
  ];
  const currentMeta = typeMeta[typeFilter];
  const canSeeIncomingLetters = accessibleModules.some((module) => module.id === "surat-masuk");
  const canSeeOutgoingLetters = accessibleModules.some((module) => module.id === "surat-keluar");
  const canAccessCurrentFilter =
    typeFilter === "masuk"
      ? canSeeIncomingLetters
      : typeFilter === "keluar"
        ? canSeeOutgoingLetters
        : canSeeIncomingLetters || canSeeOutgoingLetters;

  const updateParam = useCallback((key: string, value: string, options?: { resetPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "Semua" || value === "visible" || value === "semua") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (options?.resetPage !== false) {
      params.delete("page");
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }, [pathname, router, searchParams]);

  const updatePage = (nextPage: number) => {
    updateParam("page", String(nextPage), { resetPage: false });
  };

  const refreshLettersAfterCreate = useCallback(() => {
    setRefreshTick((current) => current + 1);

    if (page !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    }
  }, [page, pathname, router, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchInput(query);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (searchInput === query) return;

    const timeoutId = window.setTimeout(() => {
      updateParam("search", searchInput, { resetPage: true });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchInput, updateParam]);

  useEffect(() => {
    if (!canAccessCurrentFilter) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();

    if (typeFilter !== "semua") params.set("type", typeFilter);
    if (statusFilter !== "Semua") params.set("status", statusFilter);
    if (query.trim()) params.set("search", query.trim());
    if (metric === "inbox") params.set("dispositionStatus", "active");
    if (metric === "completed") params.set("dispositionStatus", "completed");
    if (uploadedFrom) params.set("uploadedFrom", uploadedFrom);
    if (uploadedTo) params.set("uploadedTo", uploadedTo);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortDirection", sortDirection);

    const timer = window.setTimeout(() => {
      setIsLoadingLetters(true);
      setLetterError("");

      fetch(apiPath(`/api/surat?${params.toString()}`), {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; data?: SuratListPayload; error?: { message?: string } }
            | null;

          if (!response.ok || !payload?.ok || !payload.data) {
            throw new Error(
              payload?.error?.message ?? payload?.data?.error?.message ?? "Daftar surat gagal dimuat."
            );
          }

          setLetters(payload.data.items ?? payload.data.data ?? []);
          setPagination(payload.data.pagination ?? {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          });
        })
        .catch((error) => {
          if ((error as { name?: string }).name === "AbortError") return;
          setLetters([]);
          setPagination({
            page,
            pageSize,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          });
          setLetterError(error instanceof Error ? error.message : "Daftar surat gagal dimuat.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoadingLetters(false);
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canAccessCurrentFilter, metric, page, pageSize, query, refreshTick, sortBy, sortDirection, statusFilter, typeFilter, uploadedFrom, uploadedTo]);

  if (!canAccessCurrentFilter) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Manajemen Surat"
        title={currentMeta.title}
        description={currentMeta.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {(["masuk", "keluar", "semua"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => updateParam("type", type)}
              >
                {type === "masuk" ? "Surat Masuk" : type === "keluar" ? "Surat Keluar" : "Semua Surat"}
              </Button>
            ))}
          </div>
        }
      />

      {typeFilter !== "semua" ? (
        <LetterRegistrationPanel defaultType={typeFilter} onCreated={refreshLettersAfterCreate} />
      ) : null}
      {typeFilter === "keluar" ? <LetterTemplateManager currentUser={currentUser} /> : null}

      <Card className="border-border/90">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {quickMetrics.map((item) => {
              const meta = buildMetricButtonMeta(item.id, metric === item.id);
              const Icon = meta.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "inline-flex w-full items-center justify-between gap-3 rounded-[1rem] border px-3 py-2.5 text-left shadow-sm transition hover:border-primary/35 sm:min-w-[180px] sm:w-auto sm:rounded-[1.15rem] sm:px-4 sm:py-3",
                    meta.className
                  )}
                  onClick={() => updateParam("metric", item.id)}
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-xl bg-background/80 p-2 text-primary shadow-sm">
                      <Icon className="h-4 w-4" />
                    </span>
                      <span>
                        <span className="block text-sm font-semibold">{meta.label}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {item.id === "visible"
                            ? "Surat yang sesuai pilihan saat ini"
                            : item.id === "inbox"
                            ? "Surat yang masih perlu dicek"
                            : "Tindak lanjut yang sudah selesai"}
                      </span>
                    </span>
                  </span>
                  <span className="text-lg font-bold text-foreground">{item.count ?? "-"}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_220px]">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari perihal, nomor surat, asal/tujuan, atau kata kunci..."
              className="h-12 text-base"
            />
            <NativeSelect
              value={typeFilter}
              onChange={(event) => updateParam("type", event.target.value)}
              className="h-12 text-base"
            >
              <option value="semua">Semua Jenis</option>
              <option value="masuk">Surat Masuk</option>
              <option value="keluar">Surat Keluar</option>
            </NativeSelect>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => updateParam("status", event.target.value)}
              className="h-12 text-base"
            >
              {["Semua", "Baru", "Dalam Disposisi", "Selesai"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-3 xl:grid-cols-[180px_220px_minmax(0,1fr)]">
            <NativeSelect
              value={String(pageSize)}
              onChange={(event) => updateParam("pageSize", event.target.value)}
              className="h-11 text-sm"
              aria-label="Jumlah data per halaman"
            >
              {pageSizeOptions.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  Tampilkan {option.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={`${sortBy}:${sortDirection}`}
              onChange={(event) => {
                const [nextSortBy, nextSortDirection] = event.target.value.split(":");
                const params = new URLSearchParams(searchParams.toString());
                params.set("sortBy", nextSortBy);
                params.set("sortDirection", nextSortDirection);
                params.delete("page");
                router.replace(`${pathname}?${params.toString()}`);
              }}
              className="h-11 text-sm"
              aria-label="Urutkan daftar surat"
            >
              <option value="tanggal:desc">Tanggal terbaru</option>
              <option value="tanggal:asc">Tanggal terlama</option>
              <option value="createdAt:desc">Tanggal unggah terbaru</option>
              <option value="createdAt:asc">Tanggal unggah terlama</option>
              <option value="tanggalSurat:desc">Tanggal surat terbaru</option>
              <option value="nomorAgenda:asc">Nomor agenda naik</option>
              <option value="asalTujuan:asc">Asal/tujuan A-Z</option>
              <option value="status:asc">Status A-Z</option>
              <option value="priority:desc">Prioritas tertinggi</option>
              <option value="updatedAt:desc">Terakhir diperbarui</option>
            </NativeSelect>
            <div className="flex items-center rounded-xl border border-border bg-muted/25 px-3 text-sm text-muted-foreground">
              {getRangeLabel(pagination?.page ?? page, pagination?.pageSize ?? pageSize, pagination?.total ?? 0, letters.length)}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_140px]">
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/25 px-3 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">Tanggal unggah surat</span>
            </div>
            <Input
              type="date"
              value={uploadedFrom}
              onChange={(event) => updateParam("uploadedFrom", event.target.value)}
              className="h-11 text-sm"
              aria-label="Tanggal unggah mulai"
            />
            <Input
              type="date"
              value={uploadedTo}
              onChange={(event) => updateParam("uploadedTo", event.target.value)}
              className="h-11 text-sm"
              aria-label="Tanggal unggah sampai"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!uploadedFrom && !uploadedTo}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("uploadedFrom");
                params.delete("uploadedTo");
                params.delete("page");
                router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Yang ditampilkan: {typeFilter === "semua" ? "Semua Surat" : typeFilter === "masuk" ? "Surat Masuk" : "Surat Keluar"}
            </Badge>
            <Badge variant={metric === "inbox" ? "warning" : metric === "completed" ? "success" : "default"}>
              {metric === "visible" ? "Semua Surat" : metric === "inbox" ? "Tugas Aktif" : "Sudah Selesai"}
            </Badge>
            {canOpenComposer ? (
              <Badge variant="outline">
                Formulir tersedia untuk {typeFilter === "masuk" ? "surat masuk" : "surat keluar"}
              </Badge>
            ) : null}
            {pageSize === "all" ? (
              <Badge variant="warning">Tampilan semua dibatasi 500 surat. Untuk data besar gunakan laporan.</Badge>
            ) : null}
            {uploadedFrom || uploadedTo ? (
              <Badge variant="outline">
                Diunggah {uploadedFrom || "awal"} sampai {uploadedTo || "hari ini"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoadingLetters ? (
        <Card className="border-border/90">
          <CardContent className="p-5 text-sm text-muted-foreground">Memuat daftar surat...</CardContent>
        </Card>
      ) : letterError ? (
        <EmptyState
          title="Daftar surat gagal dimuat"
          description={letterError}
        />
      ) : letters.length === 0 ? (
        <EmptyState
          title="Tidak ada surat pada pilihan ini"
          description="Coba ubah jenis surat, status, kata kunci, atau tanggal unggah."
        />
      ) : (
        <div className="space-y-4">
          <LetterList
            letters={letters}
            title={typeFilter === "masuk" ? "Surat Masuk" : typeFilter === "keluar" ? "Surat Keluar" : "Daftar Surat"}
            onSoftDelete={
              currentUser?.roleId === "super-admin"
                ? (letter) => {
                    const confirmed = window.confirm("Arsipkan surat ini dari daftar aktif? Surat masih dapat dipulihkan oleh sistem.");
                    if (!confirmed) return;
                    void softDeleteLetter(letter.id).then((result) => {
                      if (result) {
                        setRefreshTick((current) => current + 1);
                      }
                    });
                  }
                : undefined
            }
            onDelete={
              isDeleteAllowed
                ? (letter) => {
                    const confirmed = window.confirm(
                      currentUser?.roleId === "super-admin"
                        ? "Hapus surat ini secara permanen? Tindakan ini tidak dapat dibatalkan."
                        : "Hapus surat ini dari daftar aktif?"
                    );

                    if (!confirmed) return;
                    void deleteLetter(letter.id).then((result) => {
                      if (result) {
                        setRefreshTick((current) => current + 1);
                      }
                    });
                  }
                : undefined
            }
            deleteLabel={deleteLabel}
            onRetryWhatsapp={(letter, deliveryId) =>
              retryWhatsappDelivery({ scope: "letter", entityId: letter.id, deliveryId })
            }
          />

          <Card className="border-border/90">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-muted-foreground">
                {getRangeLabel(pagination?.page ?? page, pagination?.pageSize ?? pageSize, pagination?.total ?? 0, letters.length)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination?.hasPreviousPage}
                  onClick={() => updatePage(1)}
                  aria-label="Halaman pertama"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination?.hasPreviousPage}
                  onClick={() => updatePage(Math.max(1, (pagination?.page ?? page) - 1))}
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                  Halaman {pagination?.page ?? page} dari {pagination?.totalPages ?? 0}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination?.hasNextPage}
                  onClick={() => updatePage((pagination?.page ?? page) + 1)}
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pagination?.hasNextPage}
                  onClick={() => updatePage(pagination?.totalPages ?? page)}
                  aria-label="Halaman terakhir"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {typeFilter === "semua" ? (
        <Card className="border-border/90">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Mau catat surat baru?</p>
              <p className="text-sm text-muted-foreground">
                Pilih jenis surat lebih dulu agar form yang sesuai terbuka.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/surat?type=masuk&compose=1")}>
                Surat Masuk
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/surat?type=keluar&compose=1")}>
                <SendHorizontal className="h-4 w-4" />
                Surat Keluar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
