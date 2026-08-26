"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FileSearch, ShieldCheck, Sparkles } from "lucide-react";

import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type AnonymizerSuggestion = {
  id: string;
  type: string;
  label: string;
  value: string;
  replacement: string;
  confidence: number;
  reason: string;
  source: string;
  acceptedByDefault: boolean;
};

type ScanResult = {
  originalFileName: string;
  fileType: string;
  checksum: string;
  text: string;
  suggestions: AnonymizerSuggestion[];
  warnings: string[];
  limits: {
    allowedExtensions: string[];
    supportedExtractionTypes: string[];
    maxUploadSizeMb: number;
  };
};

type GenerateResult = {
  id: string;
  fileName: string;
  fileType: string;
  checksum: string;
  entityCount: number;
  downloadUrl: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan anonimisasi JLF belum berhasil.");
  }
  return payload?.data as T;
}

function suggestionVariant(type: string) {
  if (type === "nik" || type === "child_data") return "danger";
  if (type === "party_name" || type === "address") return "warning";
  return "outline";
}

export function JlfAnonymizerPage() {
  const { currentUser, positions } = usePortal();
  const [file, setFile] = useState<File | null>(null);
  const [nomorPerkara, setNomorPerkara] = useState("");
  const [partyNames, setPartyNames] = useState("");
  const [customTerms, setCustomTerms] = useState("");
  const [includeAiSuggestions, setIncludeAiSuggestions] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentPositionLabel = getUserPositionLabel(currentUser, positions);
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId,
    positionLabel: currentPositionLabel,
  });
  const canUseAnonymizer = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.AI_USE);

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, AnonymizerSuggestion[]>();
    for (const suggestion of scanResult?.suggestions ?? []) {
      groups.set(suggestion.type, [...(groups.get(suggestion.type) ?? []), suggestion]);
    }
    return Array.from(groups.entries());
  }, [scanResult]);

  if (!currentUser) {
    return (
      <Card className="border-border/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Memuat sesi portal...</CardContent>
      </Card>
    );
  }

  if (!canUseAnonymizer) {
    return <AccessDeniedCard />;
  }

  async function scanDocument() {
    if (!file) {
      setMessage("Pilih file TXT/RTF terlebih dahulu.");
      return;
    }

    setBusy(true);
    setMessage("");
    setGenerated(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("nomorPerkara", nomorPerkara);
      formData.set("partyNames", JSON.stringify(partyNames.split(",").map((item) => item.trim()).filter(Boolean)));
      formData.set("customTerms", JSON.stringify(customTerms.split(",").map((item) => item.trim()).filter(Boolean)));
      formData.set("includeAiSuggestions", String(includeAiSuggestions));

      const result = await readApi<ScanResult>(
        await fetch(apiPath("/api/judicia/legal-form/anonymizer/scan"), {
          method: "POST",
          credentials: "include",
          body: formData,
        })
      );
      setScanResult(result);
      setAcceptedIds(result.suggestions.filter((item) => item.acceptedByDefault).map((item) => item.id));
      setMessage(result.suggestions.length ? "Scan selesai. Pilih saran yang akan diterapkan." : "Scan selesai, belum ada entitas sensitif terdeteksi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan anonimisasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDocument() {
    if (!scanResult) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await readApi<GenerateResult>(
        await fetch(apiPath("/api/judicia/legal-form/anonymizer/generate"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalFileName: scanResult.originalFileName,
            fileType: scanResult.fileType,
            text: scanResult.text,
            suggestions: scanResult.suggestions,
            acceptedSuggestionIds: acceptedIds,
            nomorPerkara,
          }),
        })
      );
      setGenerated(result);
      setMessage("Dokumen anonim dibuat di storage private JLF.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generate dokumen anonim gagal.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSuggestion(id: string, checked: boolean) {
    setAcceptedIds((current) => {
      if (checked) return Array.from(new Set([...current, id]));
      return current.filter((item) => item !== id);
    });
  }

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Judicia Legal Form"
        title="Anonimisasi Dokumen"
        description="Scan dokumen secara rule-based, tambah saran AI global ALETA bila diizinkan, lalu pilih manual data yang benar-benar akan dianonimkan."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>Dashboard JLF</Link>
          </Button>
        }
      />

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Upload & Scan</CardTitle>
              <CardDescription>
                Tahap ini mendukung ekstraksi aman untuk TXT/RTF. DOCX/PDF menunggu worker/sandbox, bukan eksekusi LibreOffice langsung.
              </CardDescription>
            </div>
            <Badge variant="outline">Human approval required</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input type="file" accept=".txt,.rtf,.docx,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <Input value={nomorPerkara} onChange={(event) => setNomorPerkara(event.target.value)} placeholder="Nomor perkara opsional" />
            <Input value={partyNames} onChange={(event) => setPartyNames(event.target.value)} placeholder="Nama pihak, pisahkan koma" />
            <Input value={customTerms} onChange={(event) => setCustomTerms(event.target.value)} placeholder="Istilah sensitif tambahan, pisahkan koma" />
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={includeAiSuggestions}
              onChange={(event) => setIncludeAiSuggestions(event.target.checked)}
            />
            <span>
              Gunakan saran AI anonimisasi sebagai bahan bantu. AI tetap memakai pengaturan global ALETA dan user wajib approve manual.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={scanDocument} disabled={busy || !file}>
              <FileSearch className="h-4 w-4" />
              Scan Dokumen
            </Button>
            <Button type="button" variant="outline" onClick={generateDocument} disabled={busy || !scanResult}>
              <ShieldCheck className="h-4 w-4" />
              Generate Anonim
            </Button>
            {generated ? (
              <Button asChild variant="outline">
                <a href={apiPath(generated.downloadUrl)}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {!scanResult ? (
        <EmptyState
          title="Belum ada dokumen yang discan"
          description="Upload dokumen TXT/RTF untuk melihat kandidat NIK, telepon, email, alamat, nama pihak, dan data sensitif lain."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Preview Dokumen</CardTitle>
              <CardDescription>
                {scanResult.originalFileName} - {scanResult.fileType.toUpperCase()} - checksum {scanResult.checksum.slice(0, 12)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={scanResult.text.slice(0, 20000)} readOnly className="min-h-[520px] font-mono text-xs leading-5" />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Saran Entitas</CardTitle>
                <CardDescription>{acceptedIds.length} dari {scanResult.suggestions.length} saran dipilih.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {scanResult.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada saran terdeteksi.</p>
                ) : groupedSuggestions.map(([group, items]) => (
                  <div key={group} className="rounded-xl border border-border/80 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{group}</p>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map((suggestion) => (
                        <label key={suggestion.id} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={acceptedIds.includes(suggestion.id)}
                            onChange={(event) => toggleSuggestion(suggestion.id, event.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge variant={suggestionVariant(suggestion.type)}>{suggestion.label}</Badge>
                              <span className="text-xs text-muted-foreground">{Math.round(suggestion.confidence * 100)}%</span>
                            </span>
                            <span className="mt-1 block break-words font-medium text-foreground">{suggestion.value}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{suggestion.reason}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Guardrail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p>AI hanya memberi saran dan tidak menerapkan perubahan otomatis.</p>
                <p>File anonim disimpan privat dan download tetap melalui route authorized.</p>
                <p>LibreOffice/PDF worker belum diaktifkan pada tahap ini.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
