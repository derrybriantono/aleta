"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FileStack, Inbox, SendHorizontal } from "lucide-react";
import { useMemo } from "react";

import { LetterRegistrationPanel } from "@/components/portal/letter-registration-panel";
import { LetterList } from "@/components/portal/letter-list";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { canCreateIncomingLetter, canCreateOutgoingLetter } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const typeMeta = {
  semua: {
    title: "Kumpulan Surat",
    description: "Daftar surat lintas tipe dengan filter cepat, status aktif, dan akses ke registrasi surat sesuai role.",
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
  const { accessibleLetters, currentUser, deleteLetter, dispositions, pendingInbox, retryWhatsappDelivery } = usePortal();
  const metric = (searchParams.get("metric") ?? "visible") as "visible" | "inbox" | "completed";
  const typeFilter = (searchParams.get("type") ?? "semua") as "semua" | "masuk" | "keluar";
  const statusFilter = searchParams.get("status") ?? "Semua";
  const query = searchParams.get("query") ?? "";
  const isDeleteAllowed = currentUser?.roleId === "admin" || currentUser?.roleId === "super-admin";
  const deleteLabel = currentUser?.roleId === "super-admin" ? "Hard Delete" : "Delete";
  const pendingLetterIds = useMemo(() => new Set(pendingInbox.map((item) => item.suratId)), [pendingInbox]);
  const completedLetterIds = useMemo(
    () =>
      new Set(
        dispositions
          .filter((item) => item.penerimaId === currentUser?.id && item.status === "Selesai")
          .map((item) => item.suratId)
      ),
    [currentUser?.id, dispositions]
  );
  const scopedLetters = useMemo(
    () => accessibleLetters.filter((letter) => (typeFilter === "semua" ? true : letter.type === typeFilter)),
    [accessibleLetters, typeFilter]
  );
  const canOpenComposer =
    typeFilter === "masuk"
      ? canCreateIncomingLetter(currentUser)
      : typeFilter === "keluar"
        ? canCreateOutgoingLetter(currentUser)
        : false;
  const filteredLetters = useMemo(
    () =>
      scopedLetters.filter((letter) => {
        const matchesMetric =
          metric === "inbox"
            ? pendingLetterIds.has(letter.id)
            : metric === "completed"
              ? completedLetterIds.has(letter.id) || letter.status === "Selesai"
              : true;
        const matchesStatus = statusFilter === "Semua" ? true : letter.status === statusFilter;
        const matchesQuery = [
          letter.perihal,
          letter.nomorSurat,
          letter.nomorUrut ?? "",
          letter.pengirim,
          letter.asalSurat,
          letter.kodeKlasifikasi ?? "",
          ...letter.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());

        return matchesMetric && matchesStatus && matchesQuery;
      }),
    [completedLetterIds, metric, pendingLetterIds, query, scopedLetters, statusFilter]
  );
  const quickMetrics = [
    { id: "visible" as const, count: scopedLetters.length },
    { id: "inbox" as const, count: scopedLetters.filter((letter) => pendingLetterIds.has(letter.id)).length },
    {
      id: "completed" as const,
      count: scopedLetters.filter((letter) => completedLetterIds.has(letter.id) || letter.status === "Selesai").length,
    },
  ];
  const currentMeta = typeMeta[typeFilter];

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "Semua" || value === "visible" || value === "semua") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

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
                            ? "Item yang masih membutuhkan aksi"
                            : "Riwayat yang sudah ditutup"}
                      </span>
                    </span>
                  </span>
                  <span className="text-lg font-bold text-foreground">{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_220px]">
            <Input
              value={query}
              onChange={(event) => updateParam("query", event.target.value)}
              placeholder="Cari perihal, nomor surat, asal surat, kode klasifikasi, atau tag..."
              className="h-12 text-base"
            />
            <NativeSelect
              value={typeFilter}
              onChange={(event) => updateParam("type", event.target.value)}
              className="h-12 text-base"
            >
              <option value="semua">Semua Tipe</option>
              <option value="masuk">Surat Masuk</option>
              <option value="keluar">Surat Keluar</option>
            </NativeSelect>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => updateParam("status", event.target.value)}
              className="h-12 text-base"
            >
              {["Semua", "Baru", "Dalam Disposisi", "Ditindaklanjuti", "Selesai"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Tampilan aktif: {typeFilter === "semua" ? "Semua Surat" : typeFilter === "masuk" ? "Surat Masuk" : "Surat Keluar"}
            </Badge>
            <Badge variant={metric === "inbox" ? "warning" : metric === "completed" ? "success" : "default"}>
              {metric === "visible" ? "Surat Terlihat" : metric === "inbox" ? "Inbox Aktif" : "Tindak Lanjut Selesai"}
            </Badge>
            {canOpenComposer ? (
              <Badge variant="outline">
                Composer siap dibuka untuk {typeFilter === "masuk" ? "surat masuk" : "surat keluar"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {filteredLetters.length === 0 ? (
        <EmptyState
          title="Tidak ada surat pada filter ini"
          description="Coba ubah tipe surat, status, atau kata kunci. Halaman ini sudah menjadi sumber utama untuk daftar surat masuk dan keluar."
        />
      ) : (
        <LetterList
          letters={filteredLetters}
          title={typeFilter === "masuk" ? "Surat Masuk" : typeFilter === "keluar" ? "Surat Keluar" : "Daftar Surat"}
          onDelete={
            isDeleteAllowed
              ? (letter) => {
                  const confirmed = window.confirm(
                    currentUser?.roleId === "super-admin"
                      ? "Hapus surat ini secara permanen? Tindakan ini tidak dapat dibatalkan."
                      : "Hapus surat ini dari daftar aktif?"
                  );

                  if (!confirmed) return;
                  deleteLetter(letter.id);
                }
              : undefined
          }
          deleteLabel={deleteLabel}
          onRetryWhatsapp={(letter, deliveryId) =>
            retryWhatsappDelivery({ scope: "letter", entityId: letter.id, deliveryId })
          }
        />
      )}

      {typeFilter === "semua" ? (
        <Card className="border-border/90">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Butuh registrasi surat baru?</p>
              <p className="text-sm text-muted-foreground">
                Pilih tipe surat lebih dulu agar composer yang sesuai langsung terbuka tanpa berpindah ke halaman duplikat.
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
