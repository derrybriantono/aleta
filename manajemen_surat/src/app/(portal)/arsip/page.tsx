"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Filter, FolderArchive, Search, SlidersHorizontal } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { LetterList } from "@/components/portal/letter-list";
import { MetricLinkCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(`2026-${value}-01T08:00:00`));
}

export default function ArsipPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessibleLetters, aiConfig, currentUser, deleteLetter, metrics, retryWhatsappDelivery } = usePortal();
  const query = searchParams.get("query") ?? "";
  const aiQuery = searchParams.get("aiQuery") ?? "";
  const typeFilter = searchParams.get("type") ?? "Semua";
  const classificationFilter = searchParams.get("classification") ?? "Semua";
  const yearFilter = searchParams.get("year") ?? "Semua";
  const monthFilter = searchParams.get("month") ?? "Semua";
  const originFilter = searchParams.get("origin") ?? "Semua";
  const codeFilter = searchParams.get("code") ?? "Semua";
  const statusFilter = searchParams.get("status") ?? "Semua";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const deleteLabel = currentUser?.roleId === "super-admin" ? "Hapus Permanen" : "Hapus";
  const canDelete = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const classificationOptions = Array.from(new Set(accessibleLetters.map((letter) => letter.klasifikasi))).sort();
  const yearOptions = Array.from(
    new Set(accessibleLetters.map((letter) => new Date(letter.tanggalAdministratif ?? letter.tanggal).getFullYear().toString()))
  ).sort();
  const originOptions = Array.from(new Set(accessibleLetters.map((letter) => letter.asalSurat))).sort();
  const codeOptions = Array.from(new Set(accessibleLetters.map((letter) => letter.kodeKlasifikasi ?? "-").filter(Boolean))).sort();
  const monthOptions = Array.from(
    new Set(
      accessibleLetters.map((letter) =>
        String(new Date(letter.tanggalAdministratif ?? letter.tanggal).getMonth() + 1).padStart(2, "0")
      )
    )
  ).sort();
  const hasAdvancedFilters = Boolean(
    classificationFilter !== "Semua" ||
      yearFilter !== "Semua" ||
      monthFilter !== "Semua" ||
      originFilter !== "Semua" ||
      codeFilter !== "Semua" ||
      dateFrom ||
      dateTo
  );
  const [manualSearchMode, setManualSearchMode] = useState<"simple" | "advanced">(hasAdvancedFilters ? "advanced" : "simple");
  const searchMode = hasAdvancedFilters ? "advanced" : manualSearchMode;

  const replaceParams = (params: URLSearchParams) => {
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "Semua") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    replaceParams(params);
  };

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "Semua") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    replaceParams(params);
  };

  const switchMode = (mode: "simple" | "advanced") => {
    setManualSearchMode(mode);

    if (mode === "simple") {
      updateParams({
        classification: "",
        year: "",
        month: "",
        origin: "",
        code: "",
        dateFrom: "",
        dateTo: "",
      });
    }
  };

  const filteredLetters = useMemo(() => {
    const aiTokens = aiConfig.enabled ? tokenize(aiQuery) : [];

    return accessibleLetters.filter((letter) => {
      const administrativeDate = letter.tanggalAdministratif ?? letter.tanggal;
      const letterDate = new Date(administrativeDate);
      const administrativeYear = letterDate.getFullYear().toString();
      const monthValue = String(letterDate.getMonth() + 1).padStart(2, "0");
      const joinedText = [
        letter.perihal,
        letter.nomorSurat,
        letter.nomorUrut ?? "",
        letter.pengirim,
        letter.asalSurat,
        letter.tujuanSurat,
        letter.klasifikasi,
        letter.kodeKlasifikasi ?? "",
        letter.ringkasan,
        ...letter.tags,
        ...(letter.klasifikasiTags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query.trim() || joinedText.includes(query.toLowerCase());
      const matchesAiQuery = aiTokens.length === 0 || aiTokens.every((token) => joinedText.includes(token));
      const matchesType = typeFilter === "Semua" || letter.type === typeFilter;
      const matchesClassification = classificationFilter === "Semua" || letter.klasifikasi === classificationFilter;
      const matchesYear = yearFilter === "Semua" || administrativeYear === yearFilter;
      const matchesMonth = monthFilter === "Semua" || monthValue === monthFilter;
      const matchesOrigin = originFilter === "Semua" || letter.asalSurat === originFilter;
      const matchesCode = codeFilter === "Semua" || letter.kodeKlasifikasi === codeFilter;
      const matchesStatus = statusFilter === "Semua" || letter.status === statusFilter;
      const matchesDateFrom = !dateFrom || letterDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || letterDate <= new Date(`${dateTo}T23:59:59`);

      return (
        matchesQuery &&
        matchesAiQuery &&
        matchesType &&
        matchesClassification &&
        matchesYear &&
        matchesMonth &&
        matchesOrigin &&
        matchesCode &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    accessibleLetters,
    aiConfig.enabled,
    aiQuery,
    classificationFilter,
    codeFilter,
    dateFrom,
    dateTo,
    monthFilter,
    originFilter,
    query,
    statusFilter,
    typeFilter,
    yearFilter,
  ]);

  const aiSummary = useMemo(() => {
    if (!aiConfig.enabled) return "";
    if (filteredLetters.length === 0) {
      return "Tidak ada surat yang cocok, jadi AI belum menemukan pola arsip yang bisa diringkas.";
    }

    const dominantOrigin = [...filteredLetters]
      .reduce<Map<string, number>>((map, letter) => {
        map.set(letter.asalSurat, (map.get(letter.asalSurat) ?? 0) + 1);
        return map;
      }, new Map())
      .entries();
    const topOrigin = Array.from(dominantOrigin).sort((left, right) => right[1] - left[1])[0];
    const activeCount = filteredLetters.filter((letter) => letter.status !== "Selesai").length;

    return `${filteredLetters.length} surat cocok dengan filter aktif. Sumber dominan berasal dari ${topOrigin?.[0] ?? "arsip internal"}, dan ${activeCount} surat masih berada pada status kerja aktif.`;
  }, [aiConfig.enabled, filteredLetters]);

  const activeBadges = useMemo(() => {
    const badges: string[] = [];

    if (typeFilter !== "Semua") badges.push(typeFilter === "masuk" ? "Surat Masuk" : "Surat Keluar");
    if (statusFilter !== "Semua") badges.push(`Status ${statusFilter}`);
    if (classificationFilter !== "Semua") badges.push(classificationFilter);
    if (codeFilter !== "Semua") badges.push(`Kode ${codeFilter}`);
    if (originFilter !== "Semua") badges.push(originFilter);
    if (yearFilter !== "Semua") badges.push(`Tahun ${yearFilter}`);
    if (monthFilter !== "Semua") badges.push(monthLabel(monthFilter));
    if (dateFrom || dateTo) {
      badges.push(
        `Periode ${dateFrom ? new Date(dateFrom).toLocaleDateString("id-ID") : "..."} - ${
          dateTo ? new Date(dateTo).toLocaleDateString("id-ID") : "..."
        }`
      );
    }
    if (aiConfig.enabled && aiQuery.trim()) badges.push("AI Search");

    return badges;
  }, [
    aiConfig.enabled,
    aiQuery,
    classificationFilter,
    codeFilter,
    dateFrom,
    dateTo,
    monthFilter,
    originFilter,
    statusFilter,
    typeFilter,
    yearFilter,
  ]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Arsip"
        title="Kumpulan Surat"
        description="Arsip terpadu surat masuk dan keluar dengan pencarian cepat, filter terarah, dan AI Search yang hanya muncul saat layanan AI aktif."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricLinkCard
            key={metric.id}
            metric={metric}
            href={
              metric.label === "Surat Terlihat"
                ? "/arsip"
                : metric.label === "Inbox Aktif"
                  ? "/arsip?status=Dalam%20Disposisi"
                  : "/arsip?status=Selesai"
            }
          />
        ))}
      </div>

      <Card className="border-border/90">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Pencarian Arsip
            </CardTitle>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/35 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${searchMode === "simple" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchMode("simple")}
              >
                Simple Search
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${searchMode === "advanced" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchMode("advanced")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtered Search
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <Input
              value={query}
              onChange={(event) => updateParam("query", event.target.value)}
              placeholder="Cari nomor, perihal, pengirim, tujuan, atau tag surat..."
              className="h-12 text-base lg:col-span-2"
            />
            <NativeSelect value={typeFilter} onChange={(event) => updateParam("type", event.target.value)} className="h-12 text-base">
              {["Semua", "masuk", "keluar"].map((option) => (
                <option key={option} value={option}>
                  {option === "Semua" ? "Semua Jenis Surat" : option === "masuk" ? "Surat Masuk" : "Surat Keluar"}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={statusFilter} onChange={(event) => updateParam("status", event.target.value)} className="h-12 text-base">
              {["Semua", "Baru", "Dalam Disposisi", "Selesai"].map((option) => (
                <option key={option} value={option}>
                  {option === "Semua" ? "Semua Status" : option}
                </option>
              ))}
            </NativeSelect>
          </div>

          {aiConfig.enabled ? (
            <Input
              value={aiQuery}
              onChange={(event) => updateParam("aiQuery", event.target.value)}
              placeholder="AI Search: contoh 'surat audit keamanan tahun 2026 yang masih aktif'"
              className="h-12 text-base"
            />
          ) : (
            <div className="flex items-center rounded-[1.1rem] border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
              AI Search disembunyikan karena ALETA Intelligence Service sedang nonaktif.
            </div>
          )}

          {searchMode === "advanced" ? (
            <div className="grid gap-4 rounded-[1.3rem] border border-border bg-muted/28 p-4 lg:grid-cols-4">
              <NativeSelect
                value={classificationFilter}
                onChange={(event) => updateParam("classification", event.target.value)}
                className="h-12 text-base"
              >
                <option value="Semua">Semua Klasifikasi</option>
                {classificationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={codeFilter} onChange={(event) => updateParam("code", event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Kode Klasifikasi</option>
                {codeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={originFilter} onChange={(event) => updateParam("origin", event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Asal Surat</option>
                {originOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={yearFilter} onChange={(event) => updateParam("year", event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Tahun</option>
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={monthFilter} onChange={(event) => updateParam("month", event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Bulan</option>
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {monthLabel(option)}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => updateParam("dateFrom", event.target.value)}
                className="h-12 text-base"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => updateParam("dateTo", event.target.value)}
                className="h-12 text-base"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/90">
          <CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span>{filteredLetters.length} surat cocok dengan filter aktif.</span>
            {activeBadges.length > 0 ? (
              activeBadges.map((badge) => (
                <Badge key={badge} variant={badge === "AI Search" ? "warning" : "outline"}>
                  {badge}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Mode cepat aktif</Badge>
            )}
          </CardContent>
        </Card>

        {aiConfig.enabled ? (
          <Card className="border-border/80 bg-primary/5">
            <CardContent className="p-5">
              <AletaAIMark label="AI Search Arsip" />
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{aiSummary}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <LetterList
        letters={filteredLetters}
        title="Arsip Terpadu Surat"
        onDelete={
          canDelete
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

      <Card className="border-border/80">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <FolderArchive className="h-4 w-4 text-primary" />
          Halaman ini menyatukan arsip surat masuk dan keluar dalam satu alur, tanpa memecah detail surat dan workflow yang sudah berjalan.
        </CardContent>
      </Card>
    </div>
  );
}
