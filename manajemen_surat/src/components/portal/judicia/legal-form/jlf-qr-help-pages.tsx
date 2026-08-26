"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BookOpenText, QrCode, ShieldCheck } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type QrCaseResponse = {
  dataUrl: string;
  maskedNomorPerkara: string;
  payload: {
    url: string;
    requires_login: boolean;
  };
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan QR belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

export function JlfCaseQrPage() {
  const { currentUser, access } = useJlfAccess();
  const canViewCase = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.CASE_VIEW);
  const [nomorPerkara, setNomorPerkara] = useState("");
  const [result, setResult] = useState<QrCaseResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generateQr() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const params = new URLSearchParams({ nomorPerkara });
      const data = await readApi<QrCaseResponse>(
        await fetch(apiPath(`/api/judicia/legal-form/qr/case?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR perkara belum dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canViewCase) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="QR Perkara"
        title="QR Perkara"
        description="Buat QR link perkara yang tetap menuju ALETA dan memerlukan login/otorisasi."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Generate QR Aman
          </CardTitle>
          <CardDescription>Payload QR hanya memuat nomor perkara masked dan URL ALETA. Dokumen tidak dikirim di QR.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">{message}</div> : null}
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input value={nomorPerkara} onChange={(event) => setNomorPerkara(event.target.value)} placeholder="Contoh: 317/Pdt.G/2026/PA.Dgl" />
            <Button type="button" disabled={busy || nomorPerkara.trim().length < 3} onClick={generateQr}>
              <QrCode className="h-4 w-4" />
              Buat QR
            </Button>
          </div>
          {result ? (
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="rounded-xl border border-border/80 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.dataUrl} alt="QR Perkara JLF" className="h-auto w-full" />
              </div>
              <div className="space-y-3 rounded-xl border border-border/80 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{result.maskedNomorPerkara}</Badge>
                  <Badge variant={result.payload.requires_login ? "success" : "danger"}>Login required</Badge>
                  <Badge variant="outline">public minimal</Badge>
                </div>
                <p className="break-all text-sm text-muted-foreground">{result.payload.url}</p>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
                  Untuk template, gunakan variabel QR dengan key <span className="font-mono text-foreground">qr_perkara</span> atau mapping legacy{" "}
                  <span className="font-mono text-foreground">#0002#</span>. Resolver JLF mengisi payload/link aman yang tetap butuh login.
                </div>
                <Button asChild variant="outline">
                  <a href={result.payload.url}>Buka Perkara</a>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

const helpSections = [
  {
    title: "Mode Cepat Blangko",
    items: [
      "Mulai dari dashboard JLF: pilih kategori/template, isi nomor/kode/tahun perkara, pilih hasil perkara, lalu preview variabel.",
      "Jika jadwal sidang tersedia, pilih sidang sebelum preview agar variabel tanggal sidang dan agenda memakai konteks yang benar.",
      "Setelah draft dibuat, gunakan Download untuk file authorized atau Submit Validasi bila dokumen perlu diperiksa.",
    ],
  },
  {
    title: "Template dan Placeholder",
    items: [
      "DOCX adalah target modern, RTF tetap didukung untuk kompatibilitas legacy.",
      "Placeholder legacy: #0001#, #0048#, dan pola angka lainnya.",
      "Placeholder modern: {{nomor_perkara}}, {{tanggal_sidang}}, {{majelis_hakim}}.",
      "QR perkara dapat memakai {{qr_perkara}} atau mapping legacy #0002# untuk payload/link aman.",
    ],
  },
  {
    title: "Generate Dokumen",
    items: [
      "Cari perkara dari SIPP read-only, pilih template, pilih sidang bila diperlukan, lalu preview variabel.",
      "Variabel wajib kosong harus dilengkapi dengan data manual sebelum generate.",
      "Nilai manual dapat diedit dari tabel review variabel dan akan dicatat di audit.",
      "Download dokumen selalu lewat route authorized, bukan public folder.",
    ],
  },
  {
    title: "Tanya Jawab/BAS",
    items: [
      "Template Tanya Jawab/BAS memakai kode, jenis perkara, dan urutan pertanyaan/jawaban seperti pola ABT.",
      "Gunakan source_type jlf_bas_qa pada variabel untuk memasukkan section tanya jawab ke template BAS.",
      "Item dapat ditambah, diedit, dihapus, dan digeser oleh user dengan permission template update.",
    ],
  },
  {
    title: "Import Legacy ABT",
    items: [
      "ABT hanya sumber legacy/importer, tidak menjadi route baru /abt.",
      "Dry-run wajib dipakai untuk membaca variabel dan template sebelum import aktif.",
      "Raw SQL legacy ditandai needs_review dan tidak diaktifkan otomatis.",
    ],
  },
  {
    title: "Anonimisasi",
    items: [
      "Upload file dibatasi tipe dan ukuran dari pengaturan JLF.",
      "Saran AI/rule-based harus disetujui user sebelum dokumen anonim dibuat.",
      "Data sensitif tidak dikirim via WhatsApp dan tidak tampil di public verification.",
    ],
  },
];

export function JlfHelpPage() {
  const { currentUser, access } = useJlfAccess();
  const canView = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.VIEW);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Bantuan"
        title="Bantuan ALETA Judicia (Legal Form)"
        description="Panduan singkat untuk template, variabel, generate dokumen, import legacy, dan anonimisasi."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {helpSections.map((section) => (
          <Card key={section.title} className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-border/80 p-3 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
