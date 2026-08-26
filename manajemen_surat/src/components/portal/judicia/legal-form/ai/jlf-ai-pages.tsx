"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, RefreshCw, Scale, Send, ShieldAlert, Sparkles } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type AiStatus = {
  jlf: {
    enabled: boolean;
    redactionEnabled: boolean;
    logInputs: boolean;
    logOutputs: boolean;
    maxInputChars: number;
    legalAnalysisEnabled: boolean;
    requireVerifiedRegulations: boolean;
  };
  global: {
    status: {
      enabled: boolean;
      providerId: string;
      modelId: string;
      activeConnectionStatus: string;
      activeConnectionLabel: string | null;
    };
  };
  policy: {
    createsSeparateProvider: boolean;
    exposesApiKey: boolean;
    outputIsDraft: boolean;
    humanInTheLoop: boolean;
  };
};

type AiLog = {
  id: string;
  feature: string;
  status: string;
  provider: string;
  model: string;
  errorMessage?: string | null;
  createdAt: string;
};

type LegalAnalysisResult = {
  sessionId: string;
  status: string;
  output: string;
  aiUsed: boolean;
  model?: string;
  disclaimer?: string;
  sources: Array<{
    regulationId: string;
    regulationTitle: string;
    regulationSectionId: string | null;
    sectionLabel: string;
    quotedText: string;
    relevanceScore: number;
  }>;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan AI JLF belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfAiAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

function can(access: ReturnType<typeof resolveJudiciaLegalFormAccess>, permission: (typeof JLF_PERMISSION)[keyof typeof JLF_PERMISSION]) {
  return hasJudiciaLegalFormPermission(access, permission);
}

function ResultBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl border border-border/80 bg-muted/30 p-4 text-xs leading-6 text-foreground">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function JlfAiHomePage() {
  const { currentUser, access } = useJlfAiAccess();
  const canUse = can(access, JLF_PERMISSION.AI_USE) || can(access, JLF_PERMISSION.AI_ADMIN);
  const canAudit = can(access, JLF_PERMISSION.AI_AUDIT_VIEW);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [message, setMessage] = useState("");
  const [feature, setFeature] = useState("draft");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const statusData = await readApi<AiStatus>(await fetch(apiPath("/api/judicia/legal-form/ai/status"), { cache: "no-store", credentials: "include" }));
      setStatus(statusData);
      if (canAudit) {
        const logData = await readApi<{ items: AiLog[] }>(await fetch(apiPath("/api/judicia/legal-form/ai/logs?limit=10"), { cache: "no-store", credentials: "include" }));
        setLogs(logData.items ?? []);
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat status AI JLF.");
    } finally {
      setBusy(false);
    }
  }, [canAudit]);

  useEffect(() => {
    if (!canUse) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canUse, load]);

  async function runAssistant() {
    setBusy(true);
    setResult(null);
    try {
      const endpoint = {
        template: "template-assistant",
        mapping: "variable-mapping",
        draft: "draft",
        bas: "bas",
        consistency: "consistency",
        anonymization: "anonymization",
      }[feature] ?? "draft";
      const data = await readApi(await fetch(apiPath(`/api/judicia/legal-form/ai/${endpoint}`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText }),
      }));
      setResult(data);
      setMessage("");
      if (canAudit) await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI assistant gagal diproses.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canUse) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="AI JLF"
        title="AI Assistant"
        description="Asisten draft, BAS, konsistensi, anonimisasi, dan mapping. Semua memakai AI global ALETA dan output wajib direview manusia."
        actions={<Button asChild variant="outline"><Link href={JUDICIA_LEGAL_FORM_ROUTE}><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>}
      />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border-border/80"><CardHeader><CardDescription>AI Global</CardDescription><CardTitle><Badge variant={status?.global.status.enabled ? "success" : "warning"}>{status?.global.status.enabled ? "Aktif" : "Nonaktif"}</Badge></CardTitle></CardHeader></Card>
        <Card className="border-border/80"><CardHeader><CardDescription>Provider</CardDescription><CardTitle className="text-lg">{status?.global.status.providerId ?? "-"}</CardTitle></CardHeader></Card>
        <Card className="border-border/80"><CardHeader><CardDescription>Redaction</CardDescription><CardTitle><Badge variant={status?.jlf.redactionEnabled ? "success" : "warning"}>{status?.jlf.redactionEnabled ? "Aktif" : "Nonaktif"}</Badge></CardTitle></CardHeader></Card>
        <Card className="border-border/80"><CardHeader><CardDescription>Legal Analysis</CardDescription><CardTitle><Badge variant={status?.jlf.legalAnalysisEnabled ? "success" : "warning"}>{status?.jlf.legalAnalysisEnabled ? "Aktif" : "Nonaktif"}</Badge></CardTitle></CardHeader></Card>
      </div>
      <Card className="border-amber-300/70 bg-amber-100/50 dark:border-amber-700/50 dark:bg-amber-950/30">
        <CardContent className="flex gap-3 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
          <ShieldAlert className="mt-1 h-4 w-4 shrink-0" />
          <p>AI hanya asisten. Output bukan keputusan hukum, bukan produk final, dan tidak menggantikan hakim/panitera/pejabat berwenang.</p>
        </CardContent>
      </Card>
      <Card className="border-border/80">
        <CardHeader><CardTitle>Assistant Playground</CardTitle><CardDescription>Gunakan untuk draft administratif. Jangan masukkan data perkara sensitif berlebihan.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <NativeSelect value={feature} onChange={(event) => setFeature(event.target.value)}>
            <option value="template">AI Template Assistant</option>
            <option value="mapping">AI Variable Mapping</option>
            <option value="draft">AI Draft Assistant</option>
            <option value="bas">AI BAS Assistant</option>
            <option value="consistency">AI Consistency Checker</option>
            <option value="anonymization">AI Anonymization Assistant</option>
          </NativeSelect>
          <Textarea value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder="Masukkan teks/draft yang ingin dibantu AI..." className="min-h-40" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !inputText.trim()} onClick={runAssistant}><Sparkles className="h-4 w-4" />Jalankan AI</Button>
            <Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/analysis`}><Scale className="h-4 w-4" />Legal Analysis</Link></Button>
          </div>
          {result ? <ResultBlock value={result} /> : null}
        </CardContent>
      </Card>
      {canAudit ? (
        <Card className="border-border/80">
          <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Log AI Ringkas</CardTitle><CardDescription>Input disimpan sesuai kebijakan redaction/log JLF.</CardDescription></div><Button type="button" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />Refresh</Button></CardHeader>
          <CardContent>{logs.length === 0 ? <EmptyState title="Belum ada log" description="Aktivitas AI JLF akan tampil di sini sesuai permission." /> : <div className="grid gap-2">{logs.map((log) => <div key={log.id} className="flex flex-col gap-1 rounded-xl border border-border/80 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{log.feature}</p><p className="text-xs text-muted-foreground">{log.provider} {log.model} - {log.createdAt}</p></div><Badge variant={log.status === "success" ? "success" : log.status === "blocked" ? "warning" : "danger"}>{log.status}</Badge></div>)}</div>}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function JlfAnalysisPage() {
  const { currentUser, access } = useJlfAiAccess();
  const canAnalyze = can(access, JLF_PERMISSION.AI_LEGAL_ANALYSIS);
  const [analysisType, setAnalysisType] = useState("regulation_lookup");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LegalAnalysisResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const data = await readApi<LegalAnalysisResult>(await fetch(apiPath("/api/judicia/legal-form/ai/legal-analysis"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisType, query }),
      }));
      setResult(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analisa AI gagal diproses.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canAnalyze) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro eyebrow="AI Legal Analysis" title="Analisa Berbasis Peraturan" description="Retrieval mengambil peraturan JLF, lalu AI global ALETA menyusun draft analisa dengan sumber yang tercatat." actions={<Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/ai`}><ArrowLeft className="h-4 w-4" />AI</Link></Button>} />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <Card className="border-border/80">
        <CardContent className="grid gap-4 p-4">
          <NativeSelect value={analysisType} onChange={(event) => setAnalysisType(event.target.value)}>
            <option value="regulation_lookup">Regulation Lookup</option>
            <option value="legal_basis_suggestion">Legal Basis Suggestion</option>
            <option value="template_compliance">Template Compliance</option>
            <option value="document_consistency">Document Consistency</option>
            <option value="bas_review">BAS Regulation Checker</option>
            <option value="regulation_impact">Regulation Change Impact</option>
          </NativeSelect>
          <Textarea className="min-h-40" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tuliskan pertanyaan hukum atau konteks pemeriksaan. AI hanya boleh memakai sumber JLF Legal Knowledge Base." />
          <Button type="button" disabled={busy || !query.trim()} onClick={submit}><Send className="h-4 w-4" />Jalankan Analisa</Button>
        </CardContent>
      </Card>
      {result ? (
        <>
          <Card className="border-border/80"><CardHeader><div className="flex flex-wrap gap-2"><Badge variant={result.status === "completed" ? "success" : result.status === "no_source" ? "warning" : "danger"}>{result.status}</Badge><Badge variant="outline">{result.aiUsed ? `AI ${result.model ?? ""}` : "Tanpa AI"}</Badge></div><CardTitle>Hasil Analisa</CardTitle><CardDescription>{result.disclaimer ?? "Output adalah bahan bantu."}</CardDescription></CardHeader><CardContent className="whitespace-pre-wrap text-sm leading-6 text-foreground">{result.output}</CardContent></Card>
          <Card className="border-border/80"><CardHeader><CardTitle>Sumber Peraturan</CardTitle><CardDescription>Sumber dicatat di `jlf_legal_analysis_sources`.</CardDescription></CardHeader><CardContent>{result.sources.length === 0 ? <EmptyState title="Sumber tidak tersedia" description="Dasar hukum belum ditemukan di Legal Knowledge Base sesuai mode verifikasi." /> : <div className="grid gap-3">{result.sources.map((source) => <div key={`${source.regulationId}-${source.regulationSectionId ?? "reg"}`} className="rounded-xl border border-border/80 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{source.regulationTitle}</p><p className="text-xs text-muted-foreground">{source.sectionLabel || source.regulationId}</p></div><Badge variant="outline">score {source.relevanceScore}</Badge></div><p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{source.quotedText}</p></div>)}</div>}</CardContent></Card>
        </>
      ) : null}
    </div>
  );
}
