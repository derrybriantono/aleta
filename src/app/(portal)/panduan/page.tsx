"use client";

import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { APP_VERSION } from "@/lib/patch-notes";
import { getEffectiveRoleId, getUserPositionLabel, getUserRoleBadge } from "@/lib/permissions";
import { GUIDE_MODULE_LABELS, USER_GUIDES, type GuideAudience, type GuideModule, type UserGuide } from "@/lib/user-guides";

function audiencesForUser(roleId: string | null | undefined, positionLabel: string): GuideAudience[] {
  const normalizedPosition = positionLabel.toLowerCase();
  const audiences = new Set<GuideAudience>(["all", "pegawai"]);

  if (roleId === "super-admin") {
    return ["all", "super_admin", "admin", "pimpinan", "hakim", "panitera", "jurusita", "ptsp", "pegawai"];
  }
  if (roleId === "admin") audiences.add("admin");
  if (roleId === "ketua" || roleId === "wakil-ketua") audiences.add("pimpinan");
  if (roleId === "hakim") audiences.add("hakim");
  if (roleId === "panitera") audiences.add("panitera");
  if (roleId === "sekretaris" || roleId === "pejabat-struktural") audiences.add("admin");

  if (normalizedPosition.includes("panmud") || normalizedPosition.includes("panitera muda")) audiences.add("panitera");
  if (normalizedPosition.includes("jurusita")) audiences.add("jurusita");
  if (normalizedPosition.includes("ptsp")) audiences.add("ptsp");
  if (normalizedPosition.includes("kasubag")) audiences.add("admin");

  return Array.from(audiences);
}

function guideMatchesAudience(guide: UserGuide, audiences: GuideAudience[]) {
  return guide.audiences.some((audience) => audience === "all" || audiences.includes(audience));
}

function guideMatchesSearch(guide: UserGuide, search: string) {
  if (!search.trim()) return true;
  const normalized = search.toLowerCase();
  return [
    guide.title,
    guide.summary,
    GUIDE_MODULE_LABELS[guide.module],
    ...guide.steps,
    ...guide.notes,
    ...guide.troubleshooting,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export default function UserGuidePage() {
  const { currentUser } = usePortal();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<GuideModule | "all">("all");
  const roleLabel = getUserRoleBadge(currentUser);
  const positionLabel = getUserPositionLabel(currentUser);
  const roleId = getEffectiveRoleId(currentUser);
  const audiences = useMemo(() => audiencesForUser(roleId, positionLabel), [roleId, positionLabel]);

  const visibleGuides = useMemo(() => {
    return USER_GUIDES.filter((guide) => guideMatchesAudience(guide, audiences))
      .filter((guide) => moduleFilter === "all" || guide.module === moduleFilter)
      .filter((guide) => guideMatchesSearch(guide, search));
  }, [audiences, moduleFilter, search]);

  const guideCountByModule = useMemo(() => {
    return USER_GUIDES.filter((guide) => guideMatchesAudience(guide, audiences)).reduce<Record<GuideModule, number>>((acc, guide) => {
      acc[guide.module] = (acc[guide.module] ?? 0) + 1;
      return acc;
    }, {
      general: 0,
      mail: 0,
      bot: 0,
      ai: 0,
      admin: 0,
      troubleshooting: 0,
    });
  }, [audiences]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Panduan Internal"
        title="Panduan Penggunaan ALETA"
        description="Panduan singkat dan lengkap untuk menggunakan aplikasi sesuai peran Anda."
        actions={
          <Link href="/patch-notes" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Lihat Patch Notes
          </Link>
        }
      />

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">ALETA v{APP_VERSION}</Badge>
            <Badge variant="outline">Role aktif: {roleLabel}</Badge>
            <Badge variant="muted">{positionLabel}</Badge>
          </div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Panduan untuk Anda
          </CardTitle>
          <CardDescription>
            Halaman ini hanya menampilkan panduan yang relevan dengan role dan jabatan aktif Anda. Panduan teknis seperti database, kueri, migrasi, dan AI Bridge hanya muncul untuk role yang berwenang.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Cari panduan</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari: surat masuk, QR WhatsApp, AI, disposisi..." className="pl-9" />
            </div>
          </label>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">Ringkasan aplikasi</p>
            <p className="mt-1">
              ALETA membantu pekerjaan persuratan, disposisi, arsip, notifikasi, dan layanan WhatsApp internal melalui Manajemen Surat dan ALETA Bot.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardContent className="flex flex-wrap gap-2 p-4">
          <button
            type="button"
            onClick={() => setModuleFilter("all")}
            className={`rounded-full border px-3 py-1 text-sm transition ${moduleFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            Semua ({Object.values(guideCountByModule).reduce((count, value) => count + value, 0)})
          </button>
          {(Object.keys(GUIDE_MODULE_LABELS) as GuideModule[]).map((module) => (
            <button
              key={module}
              type="button"
              onClick={() => setModuleFilter(module)}
              className={`rounded-full border px-3 py-1 text-sm transition ${moduleFilter === module ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {GUIDE_MODULE_LABELS[module]} ({guideCountByModule[module]})
            </button>
          ))}
        </CardContent>
      </Card>

      {visibleGuides.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/30">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Tidak ada panduan yang cocok. Coba hapus kata pencarian atau pilih kategori lain.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleGuides.map((guide) => (
            <details key={guide.id} id={guide.id} className="group rounded-2xl border border-border bg-card open:shadow-panel">
              <summary className="cursor-pointer list-none p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <Badge variant="outline">{GUIDE_MODULE_LABELS[guide.module]}</Badge>
                    <h2 className="text-lg font-semibold text-foreground">{guide.title}</h2>
                    <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{guide.summary}</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground group-open:bg-primary group-open:text-primary-foreground">
                    Buka panduan
                  </span>
                </div>
              </summary>
              <div className="grid gap-4 border-t border-border p-5 lg:grid-cols-3">
                <GuideList title="Langkah" items={guide.steps} ordered />
                <GuideList title="Catatan" items={guide.notes} />
                <GuideList title="Jika Bermasalah" items={guide.troubleshooting} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <ListTag className={ordered ? "mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground" : "mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ListTag>
    </section>
  );
}
