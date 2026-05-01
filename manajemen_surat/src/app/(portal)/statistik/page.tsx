"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ChartColumn, LineChart, PieChart, SlidersHorizontal, TrendingUp } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { MetricLinkCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";

const LazyStatisticsChart = dynamic(
  () => import("@/components/portal/statistics-chart").then((module) => module.StatisticsChart),
  {
    ssr: false,
    loading: () => <div className="min-h-[320px] rounded-[1.4rem] border border-border bg-muted/30" />,
  }
);

type SlaStats = {
  totalActive: number;
  overdue: number;
  dueToday: number;
  unread: number;
  averageReadHours: number | null;
  averageCompletionHours: number | null;
  urgentActive: number;
  byOverdueUnit: Array<{ label: string; count: number }>;
};

type LeadershipKpiStats = {
  periodDays: number;
  lettersInThisWeek: number;
  lettersOutThisWeek: number;
  activeDispositions: number;
  overdueDispositions: number;
  dueTodayDispositions: number;
  unreadDispositions: number;
  failedWhatsappMessages: number;
  publicQaPendingReview: number;
  newFeedback: number;
  aletaBotStatus: "normal" | "warning" | "blocked";
};

const KPI_ALLOWED_ROLES = new Set(["super-admin", "admin", "ketua", "wakil-ketua", "panitera", "sekretaris"]);

function quarterFromDate(dateValue: string) {
  const month = new Date(dateValue).getMonth();
  return `TW ${Math.floor(month / 3) + 1}`;
}

function monthValueFromDate(dateValue: string) {
  return String(new Date(dateValue).getMonth() + 1).padStart(2, "0");
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(`2026-${value}-01T08:00:00`));
}

export default function StatistikPage() {
  const { accessibleLetters, aiConfig, currentUser, metrics } = usePortal();
  const [manualFilterMode, setManualFilterMode] = useState<"simple" | "advanced">("simple");
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [dimension, setDimension] = useState<"jenis" | "tahun" | "triwulan" | "klasifikasi" | "asal" | "status">(
    "jenis"
  );
  const [typeFilter, setTypeFilter] = useState("Semua");
  const [yearFilter, setYearFilter] = useState("Semua");
  const [monthFilter, setMonthFilter] = useState("Semua");
  const [quarterFilter, setQuarterFilter] = useState("Semua");
  const [classificationFilter, setClassificationFilter] = useState("Semua");
  const [originFilter, setOriginFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [slaStats, setSlaStats] = useState<SlaStats | null>(null);
  const [kpiPeriodDays, setKpiPeriodDays] = useState("7");
  const [kpiStats, setKpiStats] = useState<LeadershipKpiStats | null>(null);
  const canViewLeadershipKpi = Boolean(currentUser?.roleId && KPI_ALLOWED_ROLES.has(currentUser.roleId));

  useEffect(() => {
    let active = true;
    void fetch("/api/stats/surat/sla", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.ok && payload.data) {
          setSlaStats(payload.data as SlaStats);
        }
      })
      .catch(() => {
        if (active) setSlaStats(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canViewLeadershipKpi) {
      return;
    }
    let active = true;
    void fetch(`/api/stats/kpi?periodDays=${encodeURIComponent(kpiPeriodDays)}`, { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.ok && payload.data) {
          setKpiStats(payload.data as LeadershipKpiStats);
        }
      })
      .catch(() => {
        if (active) setKpiStats(null);
      });
    return () => {
      active = false;
    };
  }, [canViewLeadershipKpi, kpiPeriodDays]);

  const classificationOptions = Array.from(new Set(accessibleLetters.map((letter) => letter.klasifikasi))).sort();
  const yearOptions = Array.from(
    new Set(accessibleLetters.map((letter) => new Date(letter.tanggalAdministratif ?? letter.tanggal).getFullYear().toString()))
  ).sort();
  const monthOptions = Array.from(
    new Set(accessibleLetters.map((letter) => monthValueFromDate(letter.tanggalAdministratif ?? letter.tanggal)))
  ).sort();
  const originOptions = Array.from(new Set(accessibleLetters.map((letter) => letter.asalSurat))).sort();
  const hasAdvancedFilters =
    monthFilter !== "Semua" ||
    quarterFilter !== "Semua" ||
    classificationFilter !== "Semua" ||
    originFilter !== "Semua";
  const filterMode = hasAdvancedFilters ? "advanced" : manualFilterMode;

  const filteredLetters = useMemo(
    () =>
      accessibleLetters.filter((letter) => {
        const administrativeDate = letter.tanggalAdministratif ?? letter.tanggal;
        const monthValue = monthValueFromDate(administrativeDate);
        const matchesType = typeFilter === "Semua" || letter.type === typeFilter;
        const matchesYear = yearFilter === "Semua" || new Date(administrativeDate).getFullYear().toString() === yearFilter;
        const matchesMonth = monthFilter === "Semua" || monthValue === monthFilter;
        const matchesQuarter = quarterFilter === "Semua" || quarterFromDate(administrativeDate) === quarterFilter;
        const matchesClassification = classificationFilter === "Semua" || letter.klasifikasi === classificationFilter;
        const matchesOrigin = originFilter === "Semua" || letter.asalSurat === originFilter;
        const matchesStatus = statusFilter === "Semua" || letter.status === statusFilter;

        return (
          matchesType &&
          matchesYear &&
          matchesMonth &&
          matchesQuarter &&
          matchesClassification &&
          matchesOrigin &&
          matchesStatus
        );
      }),
    [accessibleLetters, classificationFilter, monthFilter, originFilter, quarterFilter, statusFilter, typeFilter, yearFilter]
  );

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredLetters.forEach((letter) => {
      const dateValue = letter.tanggalAdministratif ?? letter.tanggal;
      const key =
        dimension === "jenis"
          ? letter.type === "masuk"
            ? "Surat Masuk"
            : "Surat Keluar"
          : dimension === "tahun"
            ? new Date(dateValue).getFullYear().toString()
            : dimension === "triwulan"
              ? quarterFromDate(dateValue)
              : dimension === "asal"
                ? letter.asalSurat
                : dimension === "status"
                  ? letter.status
                  : letter.klasifikasi;

      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });

    return Array.from(grouped.entries()).map(([label, value]) => ({ label, value }));
  }, [dimension, filteredLetters]);

  const analyticsSummary = useMemo(() => {
    if (!chartData.length) {
      return "Belum ada data yang cocok dengan filter, sehingga AI Analytics belum menemukan pola yang bisa dibaca.";
    }

    const highest = [...chartData].sort((left, right) => right.value - left.value)[0];
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const activeLetters = filteredLetters.filter((letter) => letter.status !== "Selesai").length;

    return `${highest.label} menjadi kelompok dominan dengan ${highest.value} surat dari total ${total} surat. Dari filter aktif, ${activeLetters} surat masih berada pada fase kerja dan perlu dipantau pada dashboard operasional.`;
  }, [chartData, filteredLetters]);

  const activeBadges = useMemo(() => {
    const badges: string[] = [];

    if (typeFilter !== "Semua") badges.push(typeFilter === "masuk" ? "Surat Masuk" : "Surat Keluar");
    if (yearFilter !== "Semua") badges.push(`Tahun ${yearFilter}`);
    if (statusFilter !== "Semua") badges.push(`Status ${statusFilter}`);
    if (monthFilter !== "Semua") badges.push(monthLabel(monthFilter));
    if (quarterFilter !== "Semua") badges.push(quarterFilter);
    if (classificationFilter !== "Semua") badges.push(classificationFilter);
    if (originFilter !== "Semua") badges.push(originFilter);

    return badges;
  }, [classificationFilter, monthFilter, originFilter, quarterFilter, statusFilter, typeFilter, yearFilter]);

  const dimensionLabel =
    dimension === "jenis"
      ? "Kelompok Jenis"
      : dimension === "tahun"
        ? "Kelompok Tahun"
        : dimension === "triwulan"
          ? "Kelompok Triwulan"
          : dimension === "asal"
            ? "Kelompok Asal"
            : dimension === "status"
              ? "Kelompok Status"
              : "Kelompok Klasifikasi";

  const switchFilterMode = (mode: "simple" | "advanced") => {
    setManualFilterMode(mode);

    if (mode === "simple") {
      setMonthFilter("Semua");
      setQuarterFilter("Semua");
      setClassificationFilter("Semua");
      setOriginFilter("Semua");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Statistik"
        title="Statistik Surat"
        description="Visualisasi surat masuk dan keluar dengan pilihan chart, filter yang tetap fokus pada analisis, dan AI Analytics saat layanan AI aktif."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricLinkCard
            key={metric.id}
            metric={metric}
            href={
              metric.label === "Inbox Aktif"
                ? "/surat?metric=inbox"
                : metric.label === "Tindak Lanjut Selesai"
                  ? "/surat?metric=completed"
                  : "/arsip"
            }
          />
        ))}
      </div>

      {canViewLeadershipKpi ? (
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ringkasan Pimpinan
                </CardTitle>
                <CardDescription>KPI ringkas untuk pimpinan dan admin. Data tampil agregat dan tidak membuka detail sensitif.</CardDescription>
              </div>
              <NativeSelect value={kpiPeriodDays} onChange={(event) => setKpiPeriodDays(event.target.value)} className="w-[180px]">
                <option value="1">Hari ini</option>
                <option value="7">7 hari terakhir</option>
                <option value="30">30 hari terakhir</option>
              </NativeSelect>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Surat Masuk", kpiStats?.lettersInThisWeek],
                ["Surat Keluar", kpiStats?.lettersOutThisWeek],
                ["Disposisi Aktif", kpiStats?.activeDispositions],
                ["Terlambat", kpiStats?.overdueDispositions],
                ["Jatuh Tempo Hari Ini", kpiStats?.dueTodayDispositions],
                ["Belum Dibaca", kpiStats?.unreadDispositions],
                ["WA Gagal", kpiStats?.failedWhatsappMessages],
                ["Public Q&A Review", kpiStats?.publicQaPendingReview],
                ["Bug Baru", kpiStats?.newFeedback],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[1.2rem] border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value ?? "-"}</p>
                </div>
              ))}
              <div className="rounded-[1.2rem] border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Status ALETA Bot</p>
                <div className="mt-3">
                  <Badge variant={kpiStats?.aletaBotStatus === "blocked" ? "danger" : kpiStats?.aletaBotStatus === "warning" ? "warning" : "success"}>
                    {kpiStats?.aletaBotStatus === "blocked" ? "Terblokir" : kpiStats?.aletaBotStatus === "warning" ? "Perlu Perhatian" : "Normal"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            SLA Disposisi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.2rem] border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Terlambat</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{slaStats?.overdue ?? "-"}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Jatuh Tempo Hari Ini</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{slaStats?.dueToday ?? "-"}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Belum Dibaca</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{slaStats?.unread ?? "-"}</p>
            </div>
            <div className="rounded-[1.2rem] border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Rata-rata Penyelesaian</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {slaStats?.averageCompletionHours === null || slaStats?.averageCompletionHours === undefined ? "-" : `${slaStats.averageCompletionHours} jam`}
              </p>
            </div>
          </div>
          {(slaStats?.byOverdueUnit ?? []).length > 0 ? (
            <div className="rounded-[1.2rem] border border-border p-4">
              <p className="text-sm font-semibold text-foreground">Unit/Jabatan dengan disposisi terlambat terbanyak</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {slaStats?.byOverdueUnit.slice(0, 4).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{item.label}</span>
                    <Badge variant="warning">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ChartColumn className="h-5 w-5 text-primary" />
              Filter Statistik
            </CardTitle>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/35 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${filterMode === "simple" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchFilterMode("simple")}
              >
                Simple Search
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${filterMode === "advanced" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchFilterMode("advanced")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtered Search
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <NativeSelect value={chartType} onChange={(event) => setChartType(event.target.value as "bar" | "line" | "pie")} className="h-12 text-base">
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
            </NativeSelect>
            <NativeSelect
              value={dimension}
              onChange={(event) =>
                setDimension(event.target.value as "jenis" | "tahun" | "triwulan" | "klasifikasi" | "asal" | "status")
              }
              className="h-12 text-base"
            >
              <option value="jenis">Kelompok Jenis Surat</option>
              <option value="tahun">Kelompok Tahun</option>
              <option value="triwulan">Kelompok Triwulan</option>
              <option value="klasifikasi">Kelompok Klasifikasi</option>
              <option value="asal">Kelompok Asal Surat</option>
              <option value="status">Kelompok Status</option>
            </NativeSelect>
            <NativeSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-12 text-base">
              <option value="Semua">Semua Jenis</option>
              <option value="masuk">Surat Masuk</option>
              <option value="keluar">Surat Keluar</option>
            </NativeSelect>
            <NativeSelect value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-12 text-base">
              <option value="Semua">Semua Tahun</option>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          </div>
          {filterMode === "advanced" ? (
            <div className="grid gap-4 rounded-[1.3rem] border border-border bg-muted/28 p-4 lg:grid-cols-4">
              <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Status</option>
                <option value="Baru">Baru</option>
                <option value="Dalam Disposisi">Dalam Disposisi</option>
                <option value="Selesai">Selesai</option>
              </NativeSelect>
              <NativeSelect value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Bulan</option>
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {monthLabel(option)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={quarterFilter} onChange={(event) => setQuarterFilter(event.target.value)} className="h-12 text-base">
                {["Semua", "TW 1", "TW 2", "TW 3", "TW 4"].map((option) => (
                  <option key={option} value={option}>
                    {option === "Semua" ? "Semua Triwulan" : option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Klasifikasi</option>
                {classificationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={originFilter} onChange={(event) => setOriginFilter(event.target.value)} className="h-12 text-base lg:col-span-2">
                <option value="Semua">Semua Asal Surat</option>
                {originOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-12 text-base">
                <option value="Semua">Semua Status</option>
                <option value="Baru">Baru</option>
                <option value="Dalam Disposisi">Dalam Disposisi</option>
                <option value="Selesai">Selesai</option>
              </NativeSelect>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>{filteredLetters.length} surat terbaca dalam visualisasi aktif.</span>
          <Badge variant="outline">{chartType.toUpperCase()}</Badge>
          <Badge variant="outline">{dimensionLabel}</Badge>
          {activeBadges.length > 0 ? (
            activeBadges.map((badge) => (
              <Badge key={badge} variant="outline">
                {badge}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Filter cepat aktif</Badge>
          )}
        </CardContent>
      </Card>

      <LazyStatisticsChart type={chartType} data={chartData} />

      {aiConfig.enabled ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AletaAIMark compact />
              AI Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">AI aktif</Badge>
              <Badge variant="warning">{dimensionLabel}</Badge>
            </div>
            <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm leading-7 text-muted-foreground">
              {analyticsSummary}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {chartType === "bar" ? (
                <ChartColumn className="h-4 w-4 text-primary" />
              ) : chartType === "line" ? (
                <LineChart className="h-4 w-4 text-primary" />
              ) : (
                <PieChart className="h-4 w-4 text-primary" />
              )}
              <TrendingUp className="h-4 w-4 text-primary" />
              Insight dibaca dari chart aktif dan filter statistik yang sedang dipakai.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
