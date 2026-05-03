"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileStack,
  Inbox,
  SendHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { LetterRegistrationPanel } from "@/components/portal/letter-registration-panel";
import { LetterList } from "@/components/portal/letter-list";
import { LetterTemplateManager } from "@/components/portal/letter-template-manager";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { canCreateIncomingLetter, canCreateOutgoingLetter } from "@/lib/permissions";
import { type LetterDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeMeta = {
  semua: {
    title: "Kumpulan Surat",
  description: "Daftar surat lintas jenis dengan filter cepat, status aktif, dan akses registrasi sesuai peran.",
  },
  masuk: {
    title: "Surat Masuk",
    description: "Gunakan halaman ini untuk registrasi, filter cepat, dan tindak lanjut surat masuk dalam satu alur utama.",
  },
  keluar: {
    title: "Surat Keluar",
    description: "Gunakan halaman ini untuk registrasi, filter cepat, dan monitoring surat keluar tanpa berpindah ke halaman duplikat.",
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
      label: "Inbox Aktif",
      className: active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
    };
  }

  if (metric === "completed") {
    return {
      icon: CheckCircle2,
      label: "Tindak Lanjut Selesai",
      className: active ? "border-emerald-400/40 bg-emerald-500/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
    };
  }

  return {
    icon: FileStack,
    label: "Surat Terlihat",
    className: active ? "border-sky-400/40 bg-sky-500/10 text-foreground" : "border-border bg-card/80 text-muted-foreground",
  };
}

export default function SuratIndexPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, deleteLetter, softDeleteLetter, retryWhatsappDelivery } = usePortal();
  const metric = (searchParams.get("metric") ?? "visible") as "visible" | "inbox" | "completed";
  const typeFilter = (searchParams.get("type") ?? "semua") as "semua" | "masuk" | "keluar";
  const statusFilter = searchParams.get("status") ?? "Semua";
  const query = searchParams.get("search") ?? searchParams.get("query") ?? "";
  const page = readPositiveInt(searchParams.get("page"), 1);
  const pageSize = readPageSize(searchParams.get("pageSize"));
  const sortBy = searchParams.get("sortBy") ?? "tanggal";
  const sortDirection = searchParams.get("sortDirection") === "asc" ? "asc" : "desc";
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

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (searchInput === query) return;

    const timeoutId = window.setTimeout(() => {
      updateParam("search", searchInput, { resetPage: true });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchInput, updateParam]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();

    if (typeFilter !== "semua") params.set("type", typeFilter);
    if (statusFilter !== "Semua") params.set("status", statusFilter);
    if (query.trim()) params.set("search", query.trim());
    if (metric === "inbox") params.set("dispositionStatus", "active");
    if (metric === "completed") params.set("dispositionStatus", "completed");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortDirection", sortDirection);

    setIsLoadingLetters(true);
    setLetterError("");

    fetch(`/api/surat?${params.toString()}`, {
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

    return () => controller.abort();
  }, [metric, page, pageSize, query, refreshTick, sortBy, sortDirection, statusFilter, typeFilter]);

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

      {typeFilter !== "semua" ? <LetterRegistrationPanel defaultType={typeFilter} /> : null}
      {typeFilter === "keluar" ? <LetterTemplateManager currentUser={currentUser} /> : null}

      <Card className="border-border/90">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            {quickMetrics.map((item) => {
              const meta = buildMetricButtonMeta(item.id, metric === item.id);
              const Icon = meta.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "inline-flex min-w-[180px] items-center justify-between gap-3 rounded-[1.15rem] border px-4 py-3 text-left shadow-sm transition hover:border-primary/35",
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
                      <span className="block text-xs text-muted-foreground">
                        {item.id === "visible"
                          ? "Semua surat yang sesuai tipe aktif"
                          : item.id === "inbox"
                            ? "Surat yang masih perlu ditindaklanjuti"
                            : "Riwayat yang sudah ditutup"}
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
              placeholder="Cari perihal, nomor surat, asal surat, kode klasifikasi, atau tag..."
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

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Tampilan aktif: {typeFilter === "semua" ? "Semua Surat" : typeFilter === "masuk" ? "Surat Masuk" : "Surat Keluar"}
            </Badge>
            <Badge variant={metric === "inbox" ? "warning" : metric === "completed" ? "success" : "default"}>
              {metric === "visible" ? "Surat yang Dapat Dilihat" : metric === "inbox" ? "Tugas Aktif" : "Tindak Lanjut Selesai"}
            </Badge>
            {canOpenComposer ? (
              <Badge variant="outline">
                Form siap dibuka untuk {typeFilter === "masuk" ? "surat masuk" : "surat keluar"}
              </Badge>
            ) : null}
            {pageSize === "all" ? (
              <Badge variant="warning">Mode Semua dibatasi maksimal 500 surat. Untuk data besar gunakan ekspor laporan.</Badge>
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
          title="Tidak ada surat pada filter ini"
          description="Coba ubah jenis surat, status, atau kata kunci."
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
                    void softDeleteLetter(letter.id).then(() => setRefreshTick((current) => current + 1));
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
                    void deleteLetter(letter.id).then(() => setRefreshTick((current) => current + 1));
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
              <p className="font-semibold text-foreground">Butuh registrasi surat baru?</p>
              <p className="text-sm text-muted-foreground">
                Pilih jenis surat lebih dulu agar form yang sesuai langsung terbuka.
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
