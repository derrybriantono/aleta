"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Plus, RefreshCw, Save, Scale, ShieldCheck, XCircle } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { message?: string } };

type RegulationType = {
  id: string;
  code: string;
  name: string;
  description: string;
  hierarchyLevel: number;
  issuingScope: string;
  isBinding: boolean;
  isActive: boolean;
  sortOrder: number;
};

type Regulation = {
  id: string;
  regulationTypeId: string;
  regulationTypeName: string;
  title: string;
  shortTitle: string;
  regulationNumber: string;
  regulationYear: number | null;
  issuingBody: string;
  jurisdiction: string;
  subject: string;
  summary: string;
  status: string;
  verificationStatus: string;
  sourceUrl: string;
  sourceName: string;
  updatedAt: string;
};

type Topic = {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  isActive: boolean;
};

type Section = {
  id: string;
  sectionType: string;
  sectionNumber: string;
  title: string;
  content: string;
  normalizedContent: string;
  sortOrder: number;
};

type Version = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  checksum: string;
  textContent: string;
  createdAt: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan Legal Knowledge Base belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfRegulationAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

function can(access: ReturnType<typeof resolveJudiciaLegalFormAccess>, permission: keyof typeof JLF_PERMISSION | string) {
  return hasJudiciaLegalFormPermission(access, permission as (typeof JLF_PERMISSION)[keyof typeof JLF_PERMISSION]);
}

function VerificationBadge({ status }: { status: string }) {
  const variant = status === "verified" ? "success" : status === "rejected" ? "danger" : status === "needs_review" ? "warning" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "success" : status === "archived" || status === "revoked" ? "muted" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function useRegulationLookups(canView: boolean) {
  const [types, setTypes] = useState<RegulationType[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void Promise.all([
        fetch(apiPath("/api/judicia/legal-form/regulations/types"), { cache: "no-store", credentials: "include" }).then((response) => readApi<{ items: RegulationType[] }>(response)),
        fetch(apiPath("/api/judicia/legal-form/regulations/topics"), { cache: "no-store", credentials: "include" }).then((response) => readApi<{ items: Topic[] }>(response)),
      ]).then(([typeData, topicData]) => {
        setTypes(typeData.items ?? []);
        setTopics(topicData.items ?? []);
      }).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canView]);

  return { types, topics };
}

export function JlfRegulationsPage() {
  const { currentUser, access } = useJlfRegulationAccess();
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const canCreate = can(access, JLF_PERMISSION.REGULATION_CREATE);
  const { types, topics } = useRegulationLookups(canView);
  const [items, setItems] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ query: "", typeId: "", year: "", status: "", verificationStatus: "", topicId: "" });

  const loadRegulations = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      const data = await readApi<{ items: Regulation[] }>(await fetch(apiPath(`/api/judicia/legal-form/regulations?${params}`), { cache: "no-store", credentials: "include" }));
      setItems(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat peraturan.");
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRegulations(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadRegulations]);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Legal Knowledge Base"
        title="Database Peraturan"
        description="Peraturan, status verifikasi, topik, pasal/bagian, dan sumber hukum untuk JLF dan AI legal analysis."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={JUDICIA_LEGAL_FORM_ROUTE}><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/verification`}><ShieldCheck className="h-4 w-4" />Verifikasi</Link></Button>
            {canCreate ? <Button asChild><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/new`}><Plus className="h-4 w-4" />Tambah</Link></Button> : null}
          </div>
        }
      />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_120px_160px_180px_auto]">
          <Input placeholder="Cari judul, nomor, subjek" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} />
          <NativeSelect value={filters.typeId} onChange={(event) => setFilters((current) => ({ ...current, typeId: event.target.value }))}>
            <option value="">Semua jenis</option>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </NativeSelect>
          <Input placeholder="Tahun" value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} />
          <NativeSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Semua status</option>
            {["draft", "active", "revoked", "partially_revoked", "superseded", "archived", "unknown"].map((status) => <option key={status} value={status}>{status}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.verificationStatus} onChange={(event) => setFilters((current) => ({ ...current, verificationStatus: event.target.value }))}>
            <option value="">Semua verifikasi</option>
            {["unverified", "needs_review", "verified", "rejected"].map((status) => <option key={status} value={status}>{status}</option>)}
          </NativeSelect>
          <Button type="button" onClick={loadRegulations}><RefreshCw className="h-4 w-4" />Terapkan</Button>
        </CardContent>
      </Card>
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Peraturan</CardTitle>
          <CardDescription>AI legal analysis memakai sumber ini; mode production dapat dibatasi ke status verified.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <JlfLoadingState /> : items.length === 0 ? (
            <EmptyState title="Belum ada peraturan" description="Tambahkan peraturan atau ubah filter pencarian." />
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <Link key={item.id} href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/${encodeURIComponent(item.id)}`} className="rounded-xl border border-border/80 p-4 transition hover:border-primary/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.regulationTypeName} {item.regulationNumber ? `No. ${item.regulationNumber}` : ""} {item.regulationYear ?? ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2"><StatusBadge status={item.status} /><VerificationBadge status={item.verificationStatus} /></div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.summary || item.subject || "Belum ada ringkasan."}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfRegulationFormPage() {
  const { currentUser, access } = useJlfRegulationAccess();
  const canCreate = can(access, JLF_PERMISSION.REGULATION_CREATE);
  const { types } = useRegulationLookups(canCreate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ regulationTypeId: "", title: "", regulationNumber: "", regulationYear: "", issuingBody: "", jurisdiction: "Indonesia", subject: "", summary: "", status: "draft", sourceUrl: "", sourceName: "" });

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await readApi<Regulation>(await fetch(apiPath("/api/judicia/legal-form/regulations"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, regulationYear: form.regulationYear ? Number(form.regulationYear) : undefined }),
      }));
      window.location.assign(apiPath(`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/${encodeURIComponent(saved.id)}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan peraturan.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canCreate) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro eyebrow="Legal Knowledge Base" title="Tambah Peraturan" description="Peraturan baru masuk status unverified/needs_review sampai diverifikasi manusia." actions={<Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}><ArrowLeft className="h-4 w-4" />Peraturan</Link></Button>} />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <Card className="border-border/80">
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <NativeSelect value={form.regulationTypeId} onChange={(event) => setForm((current) => ({ ...current, regulationTypeId: event.target.value }))}>
            <option value="">Pilih jenis peraturan</option>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </NativeSelect>
          <Input placeholder="Nomor peraturan" value={form.regulationNumber} onChange={(event) => setForm((current) => ({ ...current, regulationNumber: event.target.value }))} />
          <Input className="md:col-span-2" placeholder="Judul peraturan" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          <Input placeholder="Tahun" value={form.regulationYear} onChange={(event) => setForm((current) => ({ ...current, regulationYear: event.target.value }))} />
          <Input placeholder="Badan penerbit" value={form.issuingBody} onChange={(event) => setForm((current) => ({ ...current, issuingBody: event.target.value }))} />
          <Input placeholder="Jurisdiksi" value={form.jurisdiction} onChange={(event) => setForm((current) => ({ ...current, jurisdiction: event.target.value }))} />
          <Input placeholder="Sumber" value={form.sourceName} onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))} />
          <Input className="md:col-span-2" placeholder="URL sumber resmi" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} />
          <Textarea className="md:col-span-2" placeholder="Subjek" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
          <Textarea className="md:col-span-2" placeholder="Ringkasan" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} />
          <Button className="md:col-span-2" type="button" disabled={busy || !form.regulationTypeId || !form.title.trim()} onClick={submit}><Save className="h-4 w-4" />Simpan</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfRegulationDetailPage({ regulationId }: { regulationId: string }) {
  const { currentUser, access } = useJlfRegulationAccess();
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const canVerify = can(access, JLF_PERMISSION.REGULATION_VERIFY);
  const canAi = can(access, JLF_PERMISSION.AI_LEGAL_ANALYSIS);
  const [item, setItem] = useState<Regulation | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [message, setMessage] = useState("");

  const loadDetail = useCallback(async () => {
    try {
      const [reg, sectionData, versionData] = await Promise.all([
        readApi<Regulation>(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}`), { cache: "no-store", credentials: "include" })),
        readApi<{ items: Section[] }>(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}/sections`), { cache: "no-store", credentials: "include" })),
        readApi<{ items: Version[] }>(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}/versions`), { cache: "no-store", credentials: "include" })),
      ]);
      setItem(reg);
      setSections(sectionData.items ?? []);
      setVersions(versionData.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat detail peraturan.");
    }
  }, [regulationId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void loadDetail(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadDetail]);

  async function action(endpoint: "verify" | "reject") {
    const reason = endpoint === "reject" ? window.prompt("Alasan penolakan peraturan") ?? "" : "";
    if (endpoint === "reject" && !reason.trim()) return;
    await readApi(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}/${endpoint}`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: endpoint === "reject" ? JSON.stringify({ reason }) : undefined,
    }));
    await loadDetail();
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Legal Knowledge Base"
        title={item?.title ?? "Detail Peraturan"}
        description="Detail sumber hukum, versi dokumen, pasal/bagian, dan relasi ke JLF."
        actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}><ArrowLeft className="h-4 w-4" />Peraturan</Link></Button>{canAi ? <Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/analysis?regulationId=${encodeURIComponent(regulationId)}`}><Scale className="h-4 w-4" />AI Ringkas</Link></Button> : null}</div>}
      />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      {!item ? <JlfLoadingState /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="border-border/80"><CardHeader><CardDescription>Jenis</CardDescription><CardTitle className="text-lg">{item.regulationTypeName}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Status</CardDescription><CardTitle><StatusBadge status={item.status} /></CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Verifikasi</CardDescription><CardTitle><VerificationBadge status={item.verificationStatus} /></CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Tahun</CardDescription><CardTitle className="text-lg">{item.regulationYear ?? "-"}</CardTitle></CardHeader></Card>
          </div>
          {canVerify ? (
            <Card className="border-border/80">
              <CardContent className="flex flex-wrap gap-2 p-4">
                <Button type="button" variant="outline" onClick={() => action("verify")}><CheckCircle2 className="h-4 w-4" />Verify</Button>
                <Button type="button" variant="outline" onClick={() => action("reject")}><XCircle className="h-4 w-4" />Reject</Button>
              </CardContent>
            </Card>
          ) : null}
          <Card className="border-border/80"><CardHeader><CardTitle>Ringkasan</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{item.summary || item.subject || "Belum ada ringkasan."}</CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80">
              <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Pasal/Bagian</CardTitle><CardDescription>{sections.length} section tersimpan</CardDescription></div><Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/${encodeURIComponent(regulationId)}/sections`}><FileText className="h-4 w-4" />Kelola</Link></Button></CardHeader>
              <CardContent>{sections.length === 0 ? <EmptyState title="Belum ada section" description="Tambahkan pasal/ayat/bagian untuk legal retrieval." /> : <div className="grid gap-2">{sections.slice(0, 5).map((section) => <div key={section.id} className="rounded-xl border border-border/80 p-3 text-sm"><p className="font-medium">{section.sectionType} {section.sectionNumber} {section.title}</p><p className="mt-1 line-clamp-2 text-muted-foreground">{section.content}</p></div>)}</div>}</CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader><CardTitle>Versi</CardTitle><CardDescription>Riwayat dokumen/perubahan peraturan</CardDescription></CardHeader>
              <CardContent>{versions.length === 0 ? <EmptyState title="Belum ada versi" description="Versi bisa ditambahkan dari API atau importer dokumen peraturan." /> : <div className="grid gap-2">{versions.slice(0, 5).map((version) => <div key={version.id} className="rounded-xl border border-border/80 p-3 text-sm"><p className="font-medium">Versi {version.versionNumber} {version.versionLabel}</p><p className="mt-1 break-all text-xs text-muted-foreground">{version.checksum}</p></div>)}</div>}</CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function JlfRegulationSectionsPage({ regulationId }: { regulationId: string }) {
  const { currentUser, access } = useJlfRegulationAccess();
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const canUpdate = can(access, JLF_PERMISSION.REGULATION_UPDATE);
  const [items, setItems] = useState<Section[]>([]);
  const [form, setForm] = useState({ sectionType: "pasal", sectionNumber: "", title: "", content: "", sortOrder: "0" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const data = await readApi<{ items: Section[] }>(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}/sections`), { cache: "no-store", credentials: "include" }));
    setItems(data.items ?? []);
  }, [regulationId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat section.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, load]);

  async function add() {
    await readApi(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(regulationId)}/sections`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) || 0 }),
    }));
    setForm({ sectionType: "pasal", sectionNumber: "", title: "", content: "", sortOrder: "0" });
    await load();
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro eyebrow="Legal Knowledge Base" title="Pasal/Ayat/Bagian" description="Kelola struktur section untuk citation dan retrieval AI legal analysis." actions={<Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/${encodeURIComponent(regulationId)}`}><ArrowLeft className="h-4 w-4" />Detail</Link></Button>} />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      {canUpdate ? (
        <Card className="border-border/80">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[160px_140px_1fr_120px_auto]">
            <NativeSelect value={form.sectionType} onChange={(event) => setForm((current) => ({ ...current, sectionType: event.target.value }))}>{["pembukaan", "konsiderans", "bab", "bagian", "paragraf", "pasal", "ayat", "huruf", "angka", "lampiran", "penjelasan", "lainnya"].map((item) => <option key={item} value={item}>{item}</option>)}</NativeSelect>
            <Input placeholder="Nomor" value={form.sectionNumber} onChange={(event) => setForm((current) => ({ ...current, sectionNumber: event.target.value }))} />
            <Input placeholder="Judul" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <Input placeholder="Urutan" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            <Button type="button" onClick={add} disabled={!form.content.trim()}><Plus className="h-4 w-4" />Tambah</Button>
            <Textarea className="md:col-span-5" placeholder="Isi section/pasal/ayat" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </CardContent>
        </Card>
      ) : null}
      <Card className="border-border/80">
        <CardContent className="p-4">
          {items.length === 0 ? <EmptyState title="Belum ada section" description="Tambahkan pasal/ayat/bagian yang akan dipakai sebagai sumber AI." /> : <div className="grid gap-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-border/80 p-4"><p className="font-semibold">{item.sectionType} {item.sectionNumber} {item.title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.content}</p></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfRegulationTypesPage() {
  const { currentUser, access } = useJlfRegulationAccess();
  const canManage = can(access, JLF_PERMISSION.REGULATION_TYPE_MANAGE);
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const [items, setItems] = useState<RegulationType[]>([]);
  const [form, setForm] = useState({ code: "", name: "", hierarchyLevel: "0", issuingScope: "", sortOrder: "0", isBinding: "true" });

  async function load() {
    const data = await readApi<{ items: RegulationType[] }>(await fetch(apiPath("/api/judicia/legal-form/regulations/types?includeInactive=true"), { cache: "no-store", credentials: "include" }));
    setItems(data.items ?? []);
  }
  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView]);

  async function add() {
    await readApi(await fetch(apiPath("/api/judicia/legal-form/regulations/types"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hierarchyLevel: Number(form.hierarchyLevel) || 0, sortOrder: Number(form.sortOrder) || 0, isBinding: form.isBinding === "true" }),
    }));
    setForm({ code: "", name: "", hierarchyLevel: "0", issuingScope: "", sortOrder: "0", isBinding: "true" });
    await load();
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return <MasterList title="Master Jenis Peraturan" description="Hierarchy, scope, dan status binding jenis peraturan." items={items.map((item) => ({ id: item.id, title: item.name, subtitle: `${item.code} - level ${item.hierarchyLevel} - ${item.issuingScope || "scope umum"}`, active: item.isActive }))} backHref={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`} form={canManage ? <div className="grid gap-3 md:grid-cols-[120px_1fr_120px_180px_120px_140px_auto]"><Input placeholder="Kode" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /><Input placeholder="Nama" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><Input placeholder="Level" value={form.hierarchyLevel} onChange={(event) => setForm((current) => ({ ...current, hierarchyLevel: event.target.value }))} /><Input placeholder="Scope" value={form.issuingScope} onChange={(event) => setForm((current) => ({ ...current, issuingScope: event.target.value }))} /><Input placeholder="Urutan" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /><NativeSelect value={form.isBinding} onChange={(event) => setForm((current) => ({ ...current, isBinding: event.target.value }))}><option value="true">Binding</option><option value="false">Non-binding</option></NativeSelect><Button type="button" onClick={add} disabled={!form.code || !form.name}><Plus className="h-4 w-4" />Tambah</Button></div> : null} />;
}

export function JlfRegulationTopicsPage() {
  const { currentUser, access } = useJlfRegulationAccess();
  const canManage = can(access, JLF_PERMISSION.REGULATION_TOPIC_MANAGE);
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const [items, setItems] = useState<Topic[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  async function load() {
    const data = await readApi<{ items: Topic[] }>(await fetch(apiPath("/api/judicia/legal-form/regulations/topics?includeInactive=true"), { cache: "no-store", credentials: "include" }));
    setItems(data.items ?? []);
  }
  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView]);

  async function add() {
    await readApi(await fetch(apiPath("/api/judicia/legal-form/regulations/topics"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }));
    setForm({ name: "", slug: "", description: "" });
    await load();
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return <MasterList title="Master Topik Hukum" description="Topik hukum untuk filter retrieval dan relasi peraturan." items={items.map((item) => ({ id: item.id, title: item.name, subtitle: item.slug, active: item.isActive }))} backHref={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`} form={canManage ? <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]"><Input placeholder="Nama topik" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><Input placeholder="Slug opsional" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /><Input placeholder="Deskripsi" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><Button type="button" onClick={add} disabled={!form.name.trim()}><Plus className="h-4 w-4" />Tambah</Button></div> : null} />;
}

function MasterList({ title, description, items, backHref, form }: { title: string; description: string; items: Array<{ id: string; title: string; subtitle: string; active: boolean }>; backHref: string; form: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <PageIntro eyebrow="Legal Knowledge Base" title={title} description={description} actions={<Button asChild variant="outline"><Link href={backHref}><ArrowLeft className="h-4 w-4" />Kembali</Link></Button>} />
      {form ? <Card className="border-border/80"><CardContent className="p-4">{form}</CardContent></Card> : null}
      <Card className="border-border/80"><CardContent className="p-4">{items.length === 0 ? <EmptyState title="Belum ada data" description="Data master belum tersedia." /> : <div className="grid gap-3">{items.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.subtitle}</p></div><Badge variant={item.active ? "success" : "muted"}>{item.active ? "Aktif" : "Nonaktif"}</Badge></div>)}</div>}</CardContent></Card>
    </div>
  );
}

export function JlfRegulationVerificationPage() {
  const { currentUser, access } = useJlfRegulationAccess();
  const canView = can(access, JLF_PERMISSION.REGULATION_VIEW);
  const canVerify = can(access, JLF_PERMISSION.REGULATION_VERIFY);
  const [items, setItems] = useState<Regulation[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await readApi<{ items: Regulation[] }>(await fetch(apiPath("/api/judicia/legal-form/regulations?verificationStatus=needs_review&limit=100"), { cache: "no-store", credentials: "include" }));
    setItems(data.items ?? []);
  }
  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView]);

  async function verify(id: string) {
    try {
      await readApi(await fetch(apiPath(`/api/judicia/legal-form/regulations/${encodeURIComponent(id)}/verify`), { method: "POST", credentials: "include" }));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal verifikasi.");
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro eyebrow="Legal Knowledge Base" title="Verifikasi Peraturan" description="Daftar peraturan needs_review. Hanya peraturan verified yang dipakai dalam verified-only AI mode." actions={<Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}><ArrowLeft className="h-4 w-4" />Peraturan</Link></Button>} />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <Card className="border-border/80"><CardContent className="p-4">{items.length === 0 ? <EmptyState title="Tidak ada antrean" description="Belum ada peraturan needs_review." /> : <div className="grid gap-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-border/80 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.regulationTypeName} {item.regulationYear ?? ""}</p></div>{canVerify ? <Button type="button" variant="outline" onClick={() => verify(item.id)}><CheckCircle2 className="h-4 w-4" />Verify</Button> : <VerificationBadge status={item.verificationStatus} />}</div></div>)}</div>}</CardContent></Card>
    </div>
  );
}
