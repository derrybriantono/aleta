"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Database, FlaskConical, Loader2, Plus, RefreshCw, Send, Trash2, XCircle } from "lucide-react";

import type {
  AletaBotEmployeeRecipient,
  AletaBotManualRecipientPreview,
  AletaBotManualSendHistoryEntry,
  AletaBotManualSendMode,
  AletaBotManualSendPreviewResult,
  AletaBotManualSendResult,
  AletaBotNotification,
  AletaBotQuery,
  AletaBotTemplate,
} from "@/lib/aleta-bot-types";
import { apiPath } from "@/lib/base-path";
import { humanizeErrorMessage } from "@/lib/humanized-labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  message?: string;
  error?: { message?: string };
};

async function requestManualSendApi<T>(url: string, init?: RequestInit) {
  const response = await fetch(apiPath(url), {
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      // Matikan overlay "Sedang memproses..." global: panel ini sudah punya
      // indikator sendiri (tombol berputar + status), overlay hanya menutupi
      // tabel penerima yang justru sedang diperiksa operator.
      "x-aleta-silent-loading": "1",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(humanizeErrorMessage(payload?.message ?? payload?.error?.message, "Permintaan Kirim Manual belum berhasil diproses."));
  }
  return payload.data;
}

// Normalisasi nomor Indonesia untuk tampilan live di UI.
// Backend tetap melakukan validasi/normalisasi final sebelum kirim.
export function normalizeIndonesianWhatsappInput(raw: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return { normalized: "", valid: false, reason: "Nomor kosong." };
  let normalized = digits;
  if (normalized.startsWith("0")) normalized = `62${normalized.slice(1)}`;
  else if (normalized.startsWith("8")) normalized = `62${normalized}`;
  if (!/^628\d{7,13}$/.test(normalized)) {
    return {
      normalized: "",
      valid: false,
      reason: "Bukan nomor WhatsApp Indonesia yang valid. Contoh benar: 081234567890, 6281234567890, +6281234567890.",
    };
  }
  return { normalized, valid: true, reason: "" };
}

type ManualRecipient = {
  key: string;
  input: string;
  name: string;
  source: "manual" | "query";
  selected: boolean;
  // Path dokumen gugatan/permohonan (petitum_dok) dari baris sumber data.
  // Hanya terisi untuk penerima hasil query, dan hanya dipakai bila toggle aktif.
  documentPath?: string;
  // Pesan yang sudah dirender khusus untuk penerima ini dari baris datanya.
  message?: string;
  nomorPerkara?: string;
};

type SendState = {
  inFlight: false | "test" | "actual";
  result: AletaBotManualSendResult | null;
  error: string | null;
};

function makeClientRequestId() {
  try {
    return `ms-${crypto.randomUUID()}`;
  } catch {
    return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function statusBadgeVariant(status: string): "success" | "danger" | "warning" | "default" {
  if (["sent", "enqueued", "success", "delivered", "read"].includes(status)) return "success";
  if (["failed", "dead_letter"].includes(status)) return "danger";
  if (["simulated", "dry_run", "skipped", "duplicate"].includes(status)) return "warning";
  return "default";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    sent: "Terkirim",
    enqueued: "Masuk Antrean",
    simulated: "Simulasi",
    failed: "Gagal",
    skipped: "Dilewati",
    duplicate: "Duplikat (tidak dikirim ulang)",
    dry_run: "Simulasi",
    delivered: "Diterima",
    read: "Dibaca",
  };
  return labels[status] ?? status;
}

/**
 * Cari notifikasi yang memasangkan sebuah sumber data dengan isi pesannya, agar
 * Kirim Manual memakai isi pesan yang sama dengan pengiriman terjadwal.
 * Bila satu query dipakai beberapa notifikasi, yang AKTIF didahulukan karena
 * itulah pesan yang benar-benar dikirim ke penerima.
 */
export function findNotificationForQuery<T extends { queryId: string; isActive: boolean }>(
  notifications: T[],
  queryId: string
): T | null {
  if (!queryId) return null;
  const matches = notifications.filter((item) => item.queryId === queryId);
  if (matches.length === 0) return null;
  return matches.find((item) => item.isActive) ?? matches[0];
}

/**
 * Tentukan isi pesan untuk sebuah sumber data di Kirim Manual.
 * 1. Pasangan langsung dari tab Notifikasi (paling tepat).
 * 2. Bila query memang tidak dipakai notifikasi terjadwal — misalnya query
 *    berparameter tanggal yang hanya untuk kirim manual — pakai isi pesan yang
 *    lazim dipakai sumber data sekategori supaya operator tidak mulai dari kosong.
 */
export function suggestTemplateIdForQuery(
  notifications: Array<{ queryId: string; templateId: string; isActive: boolean }>,
  queries: Array<{ id: string; category: string }>,
  queryId: string
): { templateId: string; matchedNotification: boolean } {
  const direct = findNotificationForQuery(notifications, queryId);
  if (direct) return { templateId: direct.templateId, matchedNotification: true };

  const category = queries.find((query) => query.id === queryId)?.category;
  if (!category) return { templateId: "", matchedNotification: false };

  const sameCategoryQueryIds = new Set(queries.filter((query) => query.category === category).map((query) => query.id));
  const sibling =
    notifications.find((item) => sameCategoryQueryIds.has(item.queryId) && item.isActive) ??
    notifications.find((item) => sameCategoryQueryIds.has(item.queryId));

  return { templateId: sibling?.templateId ?? "", matchedNotification: false };
}

/**
 * Ambil nilai dari satu baris hasil query berdasarkan beberapa kemungkinan nama
 * kolom. Sumber data SIPP tidak konsisten (nama vs nama_pihak, jenis_perkara vs
 * jenis_perkara_nama), jadi daftar penerima tidak boleh bergantung pada satu nama.
 */
export function pickRowValue(row: Record<string, string> | undefined, candidates: string[]): string {
  if (!row) return "";
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const found = entries.find(([key]) => key.toLowerCase() === candidate.toLowerCase());
    const value = String(found?.[1] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * Baca parameter {{nama}} langsung dari SQL sumber data.
 * Sengaja dihitung di sisi portal: dulu daftar parameter hanya didapat dari
 * respons runtime aleta_bot, sehingga saat bot mati kolom parameter (mis.
 * tanggal sidang) tidak pernah muncul dan operator hanya melihat pesan error.
 */
export function extractSqlParameters(sqlText: string): string[] {
  const found = String(sqlText || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
  return [...new Set([...found].map((match) => match[1]))];
}

// Nama kolom path dokumen, disamakan dengan STANDARD_COLUMN_ALIASES.file_path
// pada aleta_bot/services/dynamicNotificationSchedulerService.js.
const DOCUMENT_PATH_COLUMNS = [
  "petitum_dok",
  "file_path",
  "attachment_path",
  "attachment_source",
  "document_path",
  "dokumen_path",
  "file_dokumen",
  "path_file",
];

// Harus sama dengan MANUAL_SEND_MAX_RECIPIENTS di server; dulu angkanya
// ditulis langsung di teks sehingga tetap "20" walau batas server sudah naik.
const MANUAL_SEND_MAX_RECIPIENTS = 1000;

/**
 * Tanggal hari ini (YYYY-MM-DD) menurut zona waktu pengadilan.
 * Harus sepadan dengan todayInCourtTimezone() di
 * aleta_bot/services/manualSendService.js, supaya keterangan di layar sama
 * dengan tanggal yang benar-benar dipakai query saat kolom dikosongkan.
 */
export function tanggalHariIniPengadilan(timeZone = "Asia/Makassar") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Geser tanggal YYYY-MM-DD sebanyak N hari, tetap dalam format YYYY-MM-DD. */
export function geserTanggal(tanggal: string, hari: number) {
  const dasar = /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? tanggal : tanggalHariIniPengadilan();
  const d = new Date(`${dasar}T00:00:00`);
  d.setDate(d.getDate() + hari);
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tgl = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${tgl}`;
}

/**
 * Apakah sumber data bisa memakai tanggal acuan pilihan operator?
 * Harus sepadan dengan supportsReferenceDate() di
 * aleta_bot/services/manualSendService.js.
 */
export function mendukungTanggalAcuan(sqlText: string) {
  const teks = String(sqlText || "").trim();
  if (!teks) return false;
  // Pseudo-query portal:/runtime: dieksekusi layanan khusus, bukan SQL.
  if (/^(portal|runtime):/i.test(teks)) return false;
  // Jalur lama IKUT didukung sejak CURDATE()-nya digantikan saat eksekusi.
  if (/^legacy:/i.test(teks)) return true;
  if (/\bCURDATE\s*\(\s*\)|\bCURRENT_DATE\b/i.test(teks)) return true;
  return extractSqlParameters(teks).some((key) => /tanggal|tgl|date/i.test(key));
}

// Pilihan cepat yang paling sering dipakai operator: hari ini untuk pengingat
// harian, besok untuk H-1, dan tiga hari lagi untuk H-3.
const PILIHAN_CEPAT_TANGGAL = [
  { label: "Hari ini", offset: 0 },
  { label: "Besok", offset: 1 },
  { label: "+3 hari", offset: 3 },
];

/** "2026-07-28" -> "Selasa, 28 Juli 2026". Input kosong/rusak dikembalikan apa adanya. */
export function formatTanggalIndonesia(nilai: string) {
  const teks = String(nilai || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return teks;
  const tanggal = new Date(`${teks}T00:00:00`);
  if (Number.isNaN(tanggal.getTime())) return teks;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(tanggal);
}

// Peran pihak (Penggugat/Tergugat/Turut Tergugat/Intervensi/Kuasa Hukum) agar
// operator bisa memastikan seluruh pihak ikut terkirim, bukan penggugat saja.
const RECIPIENT_ROLE_COLUMNS = ["peran_pihak", "peran", "recipient_role", "jenis_pihak", "kategori_pihak"];

const RECIPIENT_CASE_COLUMNS = ["nomor_perkara", "no_perkara", "nomorperkara"];
const RECIPIENT_NAME_COLUMNS = ["nama_pihak", "nama", "nama_penerima", "recipient_name"];
const RECIPIENT_CASE_TYPE_COLUMNS = ["jenis_perkara_nama", "jenis_perkara", "jenisperkara"];

export function AletaBotManualSendPanel({
  queries,
  templates,
  notifications,
  employeeRecipients = [],
  dryRunEnabled,
  testTargetNumber,
  onAfterSend,
}: {
  queries: AletaBotQuery[];
  templates: AletaBotTemplate[];
  notifications: AletaBotNotification[];
  employeeRecipients?: AletaBotEmployeeRecipient[];
  dryRunEnabled: boolean;
  testTargetNumber: string;
  onAfterSend?: () => void;
}) {
  const [mode, setMode] = useState<AletaBotManualSendMode>("manual");

  // Mode manual
  const [manualMessage, setManualMessage] = useState("");

  // Mode sumber data
  const [selectedNotificationId, setSelectedNotificationId] = useState("");
  const [selectedQueryId, setSelectedQueryId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [preview, setPreview] = useState<AletaBotManualSendPreviewResult | null>(null);
  const [neededParams, setNeededParams] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Penerima
  const [recipients, setRecipients] = useState<ManualRecipient[]>([]);
  // Toggle kirim dokumen gugatan/permohonan, sepadan dengan toggle di notifikasi
  // pihak baru. Default mati agar dokumen tidak ikut terkirim tanpa disengaja.
  const [attachDocument, setAttachDocument] = useState(false);
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("");
  // Dihitung sekali per render; dipakai untuk keterangan "Kosong = hari ini".
  const hariIniLokal = tanggalHariIniPengadilan();
  // Suntingan manual atas isi pesan pratinjau (null = ikut hasil sumber data).
  const [pesanSuntingan, setPesanSuntingan] = useState<string | null>(null);
  // Tanggal acuan: menggantikan "hari ini" pada SQL sumber data. Kosong = hari ini.
  const [tanggalAcuan, setTanggalAcuan] = useState("");
  const [newRecipientInput, setNewRecipientInput] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [confirmMultiple, setConfirmMultiple] = useState(false);

  // Kirim
  const [sendState, setSendState] = useState<SendState>({ inFlight: false, result: null, error: null });
  const clientRequestIdRef = useRef(makeClientRequestId());

  // Riwayat
  const [history, setHistory] = useState<AletaBotManualSendHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Pseudo-query portal:/runtime: dieksekusi layanan khusus dan tidak bisa dijalankan dari sini.
  // Query legacy: tetap ditampilkan karena bisa dijalankan read-only (hasilnya ringkasan teks).
  const activeQueries = useMemo(() => queries.filter((query) => !/^(portal|runtime):/i.test(query.sqlText)), [queries]);
  const selectedQuery = activeQueries.find((query) => query.id === selectedQueryId) ?? null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await requestManualSendApi<{ history: AletaBotManualSendHistoryEntry[] }>("/api/admin/aleta-bot/manual-send?limit=20");
      setHistory(data.history);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Riwayat belum bisa dimuat.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [loadHistory]);

  // Saat pilih sumber data langsung, ikut ambil isi pesan dari notifikasi yang
  // memakai query tersebut. Tanpa ini pratinjau tampil "Belum ada isi pesan"
  // karena template belum terpilih, padahal pasangannya sudah didefinisikan
  // di tab Notifikasi.
  function applyQuerySelection(queryId: string) {
    resetDataSourceState();
    setSelectedQueryId(queryId);

    if (!queryId) {
      setSelectedNotificationId("");
      return;
    }

    // Parameter dibaca dari SQL saat itu juga supaya kolom isian (mis. tanggal
    // sidang) langsung tampil, tanpa menunggu — atau bergantung pada — runtime bot.
    const query = activeQueries.find((item) => item.id === queryId);
    setNeededParams(extractSqlParameters(query?.sqlText ?? ""));

    const related = findNotificationForQuery(notifications, queryId);
    const suggestion = suggestTemplateIdForQuery(notifications, activeQueries, queryId);

    setSelectedNotificationId(related?.id ?? "");
    if (suggestion.templateId) {
      setSelectedTemplateId(suggestion.templateId);
    }
  }

  // Saat pilih relasi notifikasi, isi query + template otomatis.
  function applyNotificationRelation(notificationId: string) {
    setSelectedNotificationId(notificationId);
    const notification = notifications.find((item) => item.id === notificationId);
    if (notification) {
      resetDataSourceState();
      setSelectedQueryId(notification.queryId);
      setSelectedTemplateId(notification.templateId);
    }
  }

  function resetDataSourceState() {
    setNeededParams([]);
    setPreview(null);
    setParamValues({});
    setManualValues({});
    setSelectedRowIndex(0);
    setPreviewError(null);
    // Suntingan pesan dibuang saat sumber data berganti, supaya teks lama tidak
    // ikut terkirim untuk sumber data yang sama sekali berbeda.
    setPesanSuntingan(null);
    // Tanggal acuan juga dikembalikan ke hari ini agar tidak terbawa diam-diam
    // ke sumber data lain yang maknanya berbeda.
    setTanggalAcuan("");
  }

  // Ambil daftar parameter yang dibutuhkan query (tanpa menjalankan query).
  useEffect(() => {
    if (mode !== "data_source" || !selectedQueryId) return;
    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      void (async () => {
        try {
          const data = await requestManualSendApi<AletaBotManualSendPreviewResult>("/api/admin/aleta-bot/manual-send", {
            method: "POST",
            body: JSON.stringify({
              action: "preview",
              mode: "data_source",
              queryId: selectedQueryId,
              runQuery: false,
            }),
          });
          // Gabungkan dengan hasil bacaan lokal; runtime bisa mengenali parameter
          // tambahan, tapi jangan sampai menghapus yang sudah terbaca dari SQL.
          if (!cancelled) {
            const fromRuntime = data.query?.neededParams ?? [];
            setNeededParams((current) => [...new Set([...current, ...fromRuntime])]);
          }
        } catch {
          // Bot mati bukan alasan menyembunyikan kolom parameter: daftar dari SQL
          // sudah cukup untuk mengisi form. Error sebenarnya baru ditampilkan saat
          // operator menekan "Jalankan Sumber Data & Preview".
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [mode, selectedQueryId]);

  const runPreview = useCallback(
    async (rowIndex?: number) => {
      if (mode !== "data_source" || (!selectedQueryId && !selectedTemplateId)) return;
      setIsPreviewing(true);
      setPreviewError(null);
      try {
        const data = await requestManualSendApi<AletaBotManualSendPreviewResult>("/api/admin/aleta-bot/manual-send", {
          method: "POST",
          body: JSON.stringify({
            action: "preview",
            mode: "data_source",
            queryId: selectedQueryId || undefined,
            templateId: selectedTemplateId || undefined,
            params: paramValues,
            manualValues,
            selectedRowIndex: rowIndex ?? selectedRowIndex,
            // Untuk sumber data pegawai: menentukan pegawai mana yang difilter,
            // memakai pemetaan penerima milik notifikasi terkait.
            notificationId: selectedNotificationId || undefined,
            referenceDate: tanggalAcuan || undefined,
          }),
        });
        setPreview(data);
        if (data.query?.missingParams?.length) {
          setPreviewError(`Parameter wajib belum diisi: ${data.query.missingParams.join(", ")}.`);
        }
        // Tawarkan penerima hasil query yang valid (tanpa menimpa pilihan manual).
        setRecipients((current) => {
          const manualOnly = current.filter((item) => item.source === "manual");
          const fromQuery = (data.recipients ?? [])
            .filter((item) => item.source === "query" && item.valid)
            .map((item, index) => {
              const existing = current.find((entry) => entry.source === "query" && entry.input === item.normalized);
              const row = typeof item.rowIndex === "number" ? data.query?.rows[item.rowIndex] : undefined;
              const perRecipient = (data.recipientMessages ?? []).find(
                (entry) => entry.normalized === item.normalized
              );
              return {
                key: `query-${index}-${item.normalized}`,
                input: item.normalized,
                name: item.name,
                source: "query" as const,
                selected: existing ? existing.selected : false,
                documentPath: pickRowValue(row, DOCUMENT_PATH_COLUMNS),
                message: perRecipient?.complete ? perRecipient.message : "",
                nomorPerkara: pickRowValue(row, RECIPIENT_CASE_COLUMNS),
              };
            });
          return [...fromQuery, ...manualOnly];
        });
      } catch (error) {
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "Preview sumber data gagal.");
      } finally {
        setIsPreviewing(false);
      }
    },
    [
      mode,
      selectedQueryId,
      selectedTemplateId,
      paramValues,
      manualValues,
      selectedRowIndex,
      selectedNotificationId,
      // Wajib ikut: tanpa ini tanggal acuan yang baru dipilih tidak terbawa saat
      // preview dijalankan, sehingga hasilnya masih memakai tanggal sebelumnya.
      tanggalAcuan,
    ]
  );

  const addManualRecipient = useCallback(() => {
    const check = normalizeIndonesianWhatsappInput(newRecipientInput);
    if (!newRecipientInput.trim()) return;
    setRecipients((current) => {
      if (check.valid && current.some((item) => normalizeIndonesianWhatsappInput(item.input).normalized === check.normalized)) {
        return current;
      }
      return [
        ...current,
        {
          key: `manual-${Date.now()}-${current.length}`,
          input: newRecipientInput.trim(),
          name: newRecipientName.trim(),
          source: "manual",
          selected: true,
        },
      ];
    });
    setNewRecipientInput("");
    setNewRecipientName("");
  }, [newRecipientInput, newRecipientName]);

  const selectedRecipients = recipients.filter((item) => item.selected);
  const selectedRecipientChecks = selectedRecipients.map((item) => ({
    ...item,
    check: normalizeIndonesianWhatsappInput(item.input),
  }));
  const invalidSelectedCount = selectedRecipientChecks.filter((item) => !item.check.valid).length;

  // Dokumen hanya bisa dilampirkan di mode sumber data, dan hanya bila baris
  // penerima memang memuat kolom path dokumen.
  // Opsi role/jabatan diambil dari data pegawai, bukan daftar statis, supaya
  // ikut menyesuaikan penamaan role di Manajemen Akun tiap satker.
  const employeeRoleOptions = [
    ...new Set(
      employeeRecipients
        .flatMap((item) => [item.roleId, item.positionName])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ].sort();

  const filteredEmployees = employeeRecipients.filter((item) => {
    if (!employeeRoleFilter) return true;
    const haystack = `${item.roleId} ${item.positionId} ${item.positionName} ${item.unitKerja} ${(item.additionalRoleIds ?? []).join(" ")}`.toLowerCase();
    return haystack.includes(employeeRoleFilter.toLowerCase());
  });

  const addEmployeeRecipients = () => {
    setRecipients((current) => {
      const existingNumbers = new Set(current.map((item) => item.input));
      const additions = filteredEmployees
        .filter((employee) => employee.whatsappNumber && !existingNumbers.has(employee.whatsappNumber))
        .map((employee, index) => ({
          key: `employee-${employee.id}-${index}`,
          input: employee.whatsappNumber,
          name: employee.name || employee.username,
          source: "manual" as const,
          selected: true,
        }));
      return [...current, ...additions];
    });
  };

  // Sumber data SQL yang memuat CURDATE()/CURRENT_DATE atau punya parameter
  // tanggal bisa memakai tanggal acuan. Sumber data jalur lama tidak bisa
  // karena tanggalnya dipatok di dalam kode notifikasi.js.
  const dateSupported = mendukungTanggalAcuan(selectedQuery?.sqlText ?? "");
  // Parameter tanggal sudah ditangani kartu Tanggal acuan, jadi tidak
  // ditampilkan dua kali di daftar parameter.
  const parameterNonTanggal = neededParams.filter((param) => !/tanggal|tgl|date/i.test(param));

  const semuaTujuanTerpilih = recipients.length > 0 && recipients.every((item) => item.selected);
  const queryRecipients = recipients.filter((item) => item.source === "query");
  const queryRecipientsAllSelected = queryRecipients.length > 0 && queryRecipients.every((item) => item.selected);
  const recipientsWithDocument = recipients.filter((item) => Boolean(item.documentPath));
  const documentAvailable = mode === "data_source" && recipientsWithDocument.length > 0;
  const sendDocumentEnabled = attachDocument && documentAvailable;
  const selectedWithDocumentCount = selectedRecipients.filter((item) => Boolean(item.documentPath)).length;

  // Operator boleh menyunting isi pesan langsung di kotak pratinjau.
  // null = belum disunting (ikut hasil sumber data); string = versi suntingan.
  const pesanAsli = mode === "manual" ? manualMessage : preview?.message ?? "";
  const sedangDisunting = pesanSuntingan !== null;
  const finalMessage = sedangDisunting ? pesanSuntingan : pesanAsli;
  // Bila preview belum berhasil (mis. aleta_bot belum menyala), tampilkan isi
  // template mentah supaya operator tetap melihat bentuk pesannya. Ini hanya
  // untuk dilihat: finalMessage sengaja dibiarkan kosong agar tombol kirim tetap
  // terkunci sampai placeholder benar-benar terisi data.
  const isTemplateOnlyPreview = mode === "data_source" && !finalMessage.trim() && Boolean(selectedTemplate?.body?.trim());
  const previewDisplayMessage = finalMessage.trim() ? finalMessage : isTemplateOnlyPreview ? selectedTemplate!.body : "";
  // Di mode sumber data, yang menentukan siap-kirim adalah pesan MASING-MASING
  // penerima terpilih, bukan pratinjau satu baris. Sebelumnya satu baris yang
  // kebetulan tidak lengkap mengunci seluruh pengiriman.
  const perRecipientReady =
    selectedRecipients.length > 0 && selectedRecipients.every((item) => (item.message ?? "").trim().length >= 3);
  const punyaPesanPerPenerima = selectedRecipients.some((item) => (item.message ?? "").trim().length >= 3);
  const messageReady =
    mode === "manual" || sedangDisunting
      ? // Pesan suntingan dinilai apa adanya: itulah yang benar-benar dikirim.
        finalMessage.trim().length >= 3
      : perRecipientReady || (finalMessage.trim().length >= 3 && Boolean(preview?.template?.complete));
  const newRecipientCheck = normalizeIndonesianWhatsappInput(newRecipientInput);

  const canSend =
    !sendState.inFlight &&
    messageReady &&
    selectedRecipients.length > 0 &&
    invalidSelectedCount === 0 &&
    (selectedRecipients.length === 1 || confirmMultiple);

  // Fungsi biasa, bukan useCallback: daftar penerima kini bisa berubah dari
  // beberapa tempat (centang tabel, tambah pegawai), sehingga memoization manual
  // tidak lagi bisa dijaga React Compiler.
  const doSend =
    async (isTest: boolean) => {
      if (!canSend || sendState.inFlight) return;
      if (selectedRecipients.length > 1) {
        const confirmed = globalThis.confirm(
          `Kirim pesan ${isTest ? "PENGUJIAN (TEST) " : ""}ke ${selectedRecipients.length} penerima sekaligus?`
        );
        if (!confirmed) return;
      }
      setSendState({ inFlight: isTest ? "test" : "actual", result: null, error: null });
      try {
        const data = await requestManualSendApi<AletaBotManualSendResult>("/api/admin/aleta-bot/manual-send", {
          method: "POST",
          body: JSON.stringify({
            action: "send",
            mode,
            message: finalMessage,
            recipients: selectedRecipients.map((item) => ({
              input: item.input,
              name: item.name,
              documentPath: sendDocumentEnabled ? item.documentPath ?? "" : "",
              // Pesan hasil render per penerima. Dikosongkan bila operator
              // menyunting manual, supaya teks suntingan itulah yang dipakai
              // untuk semua penerima (server memakai pesan global sebagai dasar).
              message: sedangDisunting ? "" : item.message ?? "",
            })),
            isTest,
            clientRequestId: `${clientRequestIdRef.current}${isTest ? "-test" : ""}`,
            confirmMultiple: selectedRecipients.length > 1,
            queryId: mode === "data_source" ? selectedQueryId || undefined : undefined,
            templateId: mode === "data_source" ? selectedTemplateId || undefined : undefined,
            params: mode === "data_source" ? paramValues : undefined,
            attachDocument: sendDocumentEnabled,
          }),
        });
        setSendState({ inFlight: false, result: data, error: null });
        // Request ID baru agar pengiriman berikutnya tidak dianggap duplikat.
        clientRequestIdRef.current = makeClientRequestId();
        setConfirmMultiple(false);
        void loadHistory();
        onAfterSend?.();
      } catch (error) {
        setSendState({
          inFlight: false,
          result: null,
          error: error instanceof Error ? error.message : "Pengiriman gagal tanpa detail.",
        });
      }
    };

  return (
    <div className="space-y-4">
      {/* 1. Mode pengiriman */}
      <Card>
        <CardHeader>
          <CardTitle>Kirim Manual WhatsApp</CardTitle>
          <CardDescription>
            Kirim pesan langsung dari portal: ketik bebas, atau pakai Sumber Data + Isi Pesan yang sudah dikonfigurasi.
            {dryRunEnabled ? " Mode Simulasi sedang AKTIF: pesan tidak dikirim ke WhatsApp sungguhan." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => {
                setMode("manual");
                setSendState({ inFlight: false, result: null, error: null });
              }}
              disabled={Boolean(sendState.inFlight)}
              data-testid="manual-send-mode-manual"
            >
              Pesan Manual
            </Button>
            <Button
              variant={mode === "data_source" ? "default" : "outline"}
              onClick={() => {
                setMode("data_source");
                setSendState({ inFlight: false, result: null, error: null });
              }}
              disabled={Boolean(sendState.inFlight)}
              data-testid="manual-send-mode-data-source"
            >
              <Database className="h-4 w-4" />
              Pesan dari Sumber Data
            </Button>
          </div>

          {mode === "manual" ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Isi pesan</span>
              <Textarea
                value={manualMessage}
                onChange={(event) => setManualMessage(event.target.value)}
                rows={6}
                placeholder="Tulis isi pesan WhatsApp di sini..."
                data-testid="manual-send-message"
              />
              <span className="text-xs text-muted-foreground">{manualMessage.trim().length} karakter (minimal 3, maksimal 4000).</span>
            </label>
          ) : (
            <div className="space-y-4">
              {/* 2-3. Pilihan sumber data & template */}
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-foreground">Relasi notifikasi (opsional)</span>
                  <NativeSelect
                    value={selectedNotificationId}
                    onChange={(event) => applyNotificationRelation(event.target.value)}
                    data-testid="manual-send-notification"
                  >
                    <option value="">Pilih relasi query + isi pesan...</option>
                    {notifications.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-foreground">Sumber data (query)</span>
                  <NativeSelect
                    value={selectedQueryId}
                    onChange={(event) => applyQuerySelection(event.target.value)}
                    data-testid="manual-send-query"
                  >
                    <option value="">Tanpa sumber data</option>
                    {activeQueries.map((item) => {
                      // Tandai query yang minta parameter, supaya sumber data
                      // "pilih tanggal sidang" mudah ditemukan di daftar panjang.
                      const params = extractSqlParameters(item.sqlText);
                      const suffix = /^legacy:/i.test(item.sqlText)
                        ? " — jalur lama (hasil ringkasan)"
                        : params.length > 0
                          ? ` — isi ${params.join(", ").replace(/_/g, " ")}`
                          : "";
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name}{suffix}
                        </option>
                      );
                    })}
                  </NativeSelect>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-foreground">Isi pesan (template)</span>
                  <NativeSelect
                    value={selectedTemplateId}
                    onChange={(event) => {
                      setSelectedTemplateId(event.target.value);
                      setSelectedNotificationId("");
                      setPreview(null);
                    }}
                    data-testid="manual-send-template"
                  >
                    <option value="">Pilih template...</option>
                    {templates.map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </NativeSelect>
                </label>
              </div>

              {/* 4a. Tanggal acuan — satu kendali untuk semua sumber data SQL.
                     Menggantikan "hari ini" di dalam SQL, sehingga query yang
                     relatif (H-1, H-3, hari sidang) ikut bergeser mengikutinya. */}
              {selectedQuery ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Tanggal acuan</span>
                      <span className="text-xs text-muted-foreground">(opsional)</span>
                    </div>
                    {tanggalAcuan ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setTanggalAcuan("")}
                        data-testid="manual-send-reset-date"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Kembali ke hari ini
                      </Button>
                    ) : null}
                  </div>

                  {dateSupported ? (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          value={tanggalAcuan}
                          onChange={(event) => setTanggalAcuan(event.target.value)}
                          className="h-9 w-auto min-w-[10rem] bg-background"
                          data-testid="manual-send-reference-date"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {PILIHAN_CEPAT_TANGGAL.map((pilihan) => {
                            const nilai = geserTanggal(hariIniLokal, pilihan.offset);
                            const aktif = tanggalAcuan === nilai || (pilihan.offset === 0 && !tanggalAcuan);
                            return (
                              <button
                                key={pilihan.label}
                                type="button"
                                onClick={() => setTanggalAcuan(pilihan.offset === 0 ? "" : nilai)}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs transition-colors",
                                  aktif
                                    ? "border-primary bg-primary/10 font-medium text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                )}
                              >
                                {pilihan.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {tanggalAcuan
                          ? `Sumber data dijalankan seolah hari ini ${formatTanggalIndonesia(tanggalAcuan)}.`
                          : `Kosong = hari ini (${formatTanggalIndonesia(hariIniLokal)}).`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Sumber data ini dijalankan layanan khusus portal, bukan SQL, sehingga tanggalnya tidak dapat diubah.
                    </p>
                  )}
                </div>
              ) : null}

              {/* 4b. Parameter query non-tanggal (tanggal sudah ditangani di atas) */}
              {parameterNonTanggal.length > 0 ? (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">Parameter query</p>
                  <p className="text-xs text-muted-foreground">Isi parameter berikut sebelum menjalankan sumber data.</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {parameterNonTanggal.map((param) => (
                      <label key={param} className="block space-y-1">
                        <span className="text-xs font-medium text-foreground">{param.replace(/_/g, " ")}</span>
                        <Input
                          value={paramValues[param] ?? ""}
                          onChange={(event) => setParamValues((current) => ({ ...current, [param]: event.target.value }))}
                          placeholder={`Nilai ${param.replace(/_/g, " ")}`}
                          data-testid={`manual-send-param-${param}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void runPreview()}
                  disabled={isPreviewing || (!selectedQueryId && !selectedTemplateId) || Boolean(sendState.inFlight)}
                  data-testid="manual-send-run-preview"
                >
                  {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  Jalankan Sumber Data & Preview
                </Button>
                {preview?.query ? (
                  <span className="text-xs text-muted-foreground">
                    {preview.query.rowCount} baris ({preview.query.durationMs} ms{preview.query.truncated ? ", terpotong" : ""}).
                  </span>
                ) : null}
              </div>

              {previewError ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
              ) : null}

              {/* 5. Hasil query */}
              {preview?.query?.empty ? (
                <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {/* Sumber data pegawai memberi sebab spesifik (mis. tidak ada
                      jadwal hari ini) supaya tidak tertukar dengan salah konfigurasi. */}
                  {preview.query.error ||
                    "Query berhasil dijalankan tetapi tidak mengembalikan data. Periksa parameter atau isi datanya."}
                </div>
              ) : null}
              {preview?.query?.legacy && preview.query.legacyText ? (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">Ringkasan data jalur lama</p>
                  <p className="text-xs text-muted-foreground">
                    Hasil ini otomatis mengisi placeholder <code>{"{{ringkasan}}"}</code> pada template.
                  </p>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-2 text-xs leading-5">
                    {preview.query.legacyText}
                  </pre>
                </div>
              ) : null}
              {/* Tabel baris mentah (perkara_id, pihak_id, dst.) dihapus: kolomnya
                  tidak bermakna bagi operator dan pemilihan barisnya tumpang tindih
                  dengan Daftar Penerima di bawah, yang kini jadi satu-satunya tempat
                  memilih siapa yang dikirimi. */}

              {/* 5b. Daftar penerima: siapa yang benar-benar akan dikirimi pesan */}
              {preview && preview.recipients.length > 0 ? (
                <div className="rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">Daftar penerima</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {selectedRecipients.length} dipilih dari {preview.recipients.filter((item) => item.valid).length} nomor valid
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const allSelected = queryRecipientsAllSelected;
                          setRecipients((current) =>
                            current.map((item) =>
                              item.source === "query" ? { ...item, selected: !allSelected } : item
                            )
                          );
                        }}
                        data-testid="manual-send-toggle-all"
                      >
                        {queryRecipientsAllSelected ? "Hapus semua centang" : "Centang semua"}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="bg-muted/30 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2">Kirim</th>
                          <th className="px-2 py-2">Nomor perkara</th>
                          <th className="px-2 py-2">Nama pihak</th>
                          <th className="px-2 py-2">Peran</th>
                          <th className="px-2 py-2">Jenis perkara</th>
                          <th className="px-2 py-2">Nomor WhatsApp</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.recipients.map((recipient, index) => {
                          const row =
                            typeof recipient.rowIndex === "number" ? preview.query?.rows[recipient.rowIndex] : undefined;
                          const namaPihak = pickRowValue(row, RECIPIENT_NAME_COLUMNS) || recipient.name || "-";
                          const stateEntry = recipients.find(
                            (item) => item.source === "query" && item.input === recipient.normalized
                          );
                          return (
                            <tr key={`${recipient.normalized || recipient.raw}-${index}`} className="border-t border-border">
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={Boolean(stateEntry?.selected)}
                                  disabled={!recipient.valid}
                                  onChange={(event) =>
                                    setRecipients((current) =>
                                      current.map((item) =>
                                        item.source === "query" && item.input === recipient.normalized
                                          ? { ...item, selected: event.target.checked }
                                          : item
                                      )
                                    )
                                  }
                                  aria-label={`Kirim ke ${namaPihak}`}
                                />
                              </td>
                              <td className="px-2 py-2 font-medium text-foreground">
                                {pickRowValue(row, RECIPIENT_CASE_COLUMNS) || "-"}
                              </td>
                              <td className="max-w-[200px] truncate px-2 py-2" title={namaPihak}>{namaPihak}</td>
                              <td className="px-2 py-2">{pickRowValue(row, RECIPIENT_ROLE_COLUMNS) || "-"}</td>
                              <td className="max-w-[180px] truncate px-2 py-2">
                                {pickRowValue(row, RECIPIENT_CASE_TYPE_COLUMNS) || "-"}
                              </td>
                              <td className="px-2 py-2 font-mono">
                                {recipient.normalized || recipient.raw || "-"}
                                {recipient.raw && recipient.normalized && recipient.raw !== recipient.normalized ? (
                                  <span className="block text-[11px] font-sans text-muted-foreground">asal: {recipient.raw}</span>
                                ) : null}
                              </td>
                              <td className="px-2 py-2">
                                {recipient.valid ? (
                                  <Badge variant="success">Valid</Badge>
                                ) : (
                                  <span className="text-destructive" title={recipient.reason}>
                                    Tidak valid{recipient.reason ? ` — ${recipient.reason}` : ""}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Fallback placeholder kosong.
                  Disembunyikan saat sumber data tidak mengembalikan baris sama
                  sekali: placeholder kosong di situ akibat tidak ada data, bukan
                  salah konfigurasi. Mengisinya manual hanya akan menghasilkan
                  pesan tanpa data perkara yang sesungguhnya. */}
              {preview?.template && preview.template.missingPlaceholders.length > 0 && !preview.query?.empty ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-300/40 dark:bg-amber-500/10">
                  <p className="font-semibold text-amber-800 dark:text-amber-100">
                    Placeholder belum terisi: {preview.template.missingPlaceholders.join(", ")}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-200">Isi manual di bawah sebagai fallback, lalu jalankan preview lagi.</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {preview.template.missingPlaceholders.map((placeholder) => (
                      <label key={placeholder} className="block space-y-1">
                        <span className="text-xs font-medium text-foreground">{placeholder.replace(/_/g, " ")}</span>
                        <Input
                          value={manualValues[placeholder] ?? ""}
                          onChange={(event) => setManualValues((current) => ({ ...current, [placeholder]: event.target.value }))}
                          placeholder={`Isi ${placeholder.replace(/_/g, " ")}`}
                          data-testid={`manual-send-fallback-${placeholder}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 6. Nomor tujuan */}
        <Card>
          <CardHeader>
            <CardTitle>Nomor Tujuan</CardTitle>
            <CardDescription>
              Terima format 08xxx, 62xxx, atau +62xxx — otomatis dinormalisasi ke 62xxx. Nomor bisa dari hasil query atau diketik manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[180px] flex-1 space-y-1">
                <span className="text-xs font-medium text-foreground">Nomor WhatsApp</span>
                <Input
                  value={newRecipientInput}
                  onChange={(event) => setNewRecipientInput(event.target.value)}
                  placeholder="081234567890 / +6281234567890"
                  data-testid="manual-send-recipient-input"
                />
              </label>
              <label className="min-w-[140px] flex-1 space-y-1">
                <span className="text-xs font-medium text-foreground">Nama (opsional)</span>
                <Input value={newRecipientName} onChange={(event) => setNewRecipientName(event.target.value)} placeholder="Nama penerima" />
              </label>
              <Button variant="outline" onClick={addManualRecipient} disabled={!newRecipientInput.trim()} data-testid="manual-send-add-recipient">
                <Plus className="h-4 w-4" />
                Tambah
              </Button>
              {testTargetNumber ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewRecipientInput(testTargetNumber);
                    setNewRecipientName("Nomor internal pengujian");
                  }}
                >
                  Pakai nomor internal pengujian
                </Button>
              ) : null}
            </div>

            {/* Tambah penerima pegawai berdasarkan role/jabatan dari Manajemen Akun.
                Sebelumnya Kirim Manual hanya bisa memakai nomor hasil query atau
                ketikan tangan, sehingga hakim/panitera harus disalin manual. */}
            {employeeRecipients.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Tambah penerima pegawai</p>
                <p className="text-xs text-muted-foreground">
                  Diambil dari Manajemen Akun: user aktif yang punya nomor WhatsApp valid.
                </p>
                <div className="flex flex-wrap gap-2">
                  <NativeSelect
                    value={employeeRoleFilter}
                    onChange={(event) => setEmployeeRoleFilter(event.target.value)}
                    className="max-w-[220px]"
                    data-testid="manual-send-employee-role"
                  >
                    <option value="">Semua role/jabatan</option>
                    {employeeRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addEmployeeRecipients}
                    disabled={filteredEmployees.length === 0}
                    data-testid="manual-send-add-employees"
                  >
                    <Plus className="h-4 w-4" />
                    Tambahkan {filteredEmployees.length} pegawai
                  </Button>
                </div>
                {filteredEmployees.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {filteredEmployees
                      .slice(0, 4)
                      .map((item) => item.name || item.username)
                      .join(", ")}
                    {filteredEmployees.length > 4 ? `, dan ${filteredEmployees.length - 4} lainnya` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Tidak ada pegawai dengan role/jabatan itu yang punya nomor WhatsApp valid.
                  </p>
                )}
              </div>
            ) : null}
            {newRecipientInput.trim() ? (
              <p className={cn("text-xs", newRecipientCheck.valid ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")} data-testid="manual-send-normalization-hint">
                {newRecipientCheck.valid
                  ? `Hasil normalisasi: ${newRecipientCheck.normalized}`
                  : newRecipientCheck.reason}
              </p>
            ) : null}

            {recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada nomor tujuan. Tambah manual atau jalankan sumber data.</p>
            ) : (
              <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{recipients.length} nomor pada daftar</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRecipients((current) => current.map((item) => ({ ...item, selected: !semuaTujuanTerpilih })))
                    }
                    data-testid="manual-send-toggle-all-recipients"
                  >
                    {semuaTujuanTerpilih ? "Hapus semua centang" : "Centang semua"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      // Menghapus seluruh daftar tidak bisa dibatalkan, jadi minta
                      // konfirmasi lebih dulu agar tidak terhapus karena salah klik.
                      if (!globalThis.confirm(`Hapus semua ${recipients.length} nomor tujuan dari daftar?`)) return;
                      setRecipients([]);
                      setConfirmMultiple(false);
                    }}
                    data-testid="manual-send-clear-recipients"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus semua
                  </Button>
                </div>
              </div>
              <ul className="space-y-2" data-testid="manual-send-recipient-list">
                {recipients.map((recipient) => {
                  const check = normalizeIndonesianWhatsappInput(recipient.input);
                  return (
                    <li key={recipient.key} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={recipient.selected}
                        onChange={(event) =>
                          setRecipients((current) =>
                            current.map((item) => (item.key === recipient.key ? { ...item, selected: event.target.checked } : item))
                          )
                        }
                        aria-label={`Pilih ${recipient.input}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {recipient.input}
                          {check.valid && check.normalized !== recipient.input.replace(/\D/g, "") ? (
                            <span className="text-muted-foreground"> → {check.normalized}</span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {recipient.name || "Tanpa nama"} · {recipient.source === "query" ? "dari hasil query" : "manual"}
                          {!check.valid ? <span className="text-destructive"> · {check.reason}</span> : null}
                        </span>
                      </span>
                      {check.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <button
                        type="button"
                        className="text-muted-foreground transition hover:text-destructive"
                        onClick={() => setRecipients((current) => current.filter((item) => item.key !== recipient.key))}
                        aria-label={`Hapus ${recipient.input}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedRecipients.length} penerima dipilih{invalidSelectedCount > 0 ? `, ${invalidSelectedCount} tidak valid (perbaiki dulu)` : ""}. Maksimal {MANUAL_SEND_MAX_RECIPIENTS} per pengiriman.
            </p>
            {selectedRecipients.length > 1 ? (
              <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmMultiple}
                  onChange={(event) => setConfirmMultiple(event.target.checked)}
                  data-testid="manual-send-confirm-multiple"
                />
                <span>Saya paham pesan ini akan dikirim ke {selectedRecipients.length} penerima sekaligus.</span>
              </label>
            ) : null}
          </CardContent>
        </Card>

        {/* 7. Preview pesan + kirim */}
        <Card>
          <CardHeader>
            <CardTitle>Preview & Kirim</CardTitle>
            <CardDescription>Periksa isi akhir pesan sebelum mengirim. Tombol TEST menambah penanda *[TEST]* di awal pesan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "data_source" ? (
              <div className="grid gap-1 text-xs text-muted-foreground">
                <span>Sumber data: <strong className="text-foreground">{selectedQuery?.name ?? "—"}</strong></span>
                <span>Template: <strong className="text-foreground">{selectedTemplate?.title ?? "—"}</strong></span>
                {Object.keys(paramValues).length > 0 ? (
                  <span>
                    Parameter: {Object.entries(paramValues).map(([key, value]) => `${key}=${value || "(kosong)"}`).join(", ")}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {isTemplateOnlyPreview ? "Contoh isi pesan (placeholder belum terisi data)" : "Isi akhir pesan WhatsApp"}
                </p>
                {sedangDisunting ? (
                  <Button size="sm" variant="ghost" onClick={() => setPesanSuntingan(null)} data-testid="manual-send-reset-message">
                    <RefreshCw className="h-4 w-4" />
                    Kembalikan ke pesan asli
                  </Button>
                ) : null}
              </div>
              {isTemplateOnlyPreview ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Jalankan Sumber Data &amp; Preview untuk mengisi placeholder dengan data asli. Tombol kirim terkunci sampai itu berhasil.
                </p>
              ) : null}
              {/* Isi pesan bisa disunting langsung lalu dikirim. Saat disunting,
                  personalisasi per-penerima dilepas: teks yang sama dikirim ke
                  semua penerima terpilih, dan itu dinyatakan terang-terangan. */}
              <Textarea
                className="mt-2 max-h-64 min-h-[9rem] bg-background font-mono text-sm leading-6"
                value={sedangDisunting ? pesanSuntingan : previewDisplayMessage}
                onChange={(event) => setPesanSuntingan(event.target.value)}
                placeholder="Belum ada isi pesan. Jalankan sumber data atau ketik langsung di sini."
                data-testid="manual-send-final-preview"
              />
              {sedangDisunting ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Pesan sudah disunting manual.
                  {mode === "data_source" && punyaPesanPerPenerima
                    ? " Teks ini akan dikirim SAMA PERSIS ke semua penerima terpilih, tanpa penyesuaian nama/perkara per orang."
                    : ""}
                </p>
              ) : mode === "data_source" && punyaPesanPerPenerima ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Yang tampil adalah contoh untuk penerima pertama. Tiap penerima menerima pesan sesuai datanya sendiri.
                </p>
              ) : null}
            </div>
            {mode === "data_source" && preview?.template && !preview.template.complete ? (
              <p className="text-xs text-destructive">Pesan belum lengkap: masih ada placeholder kosong. Lengkapi fallback lalu jalankan preview lagi.</p>
            ) : null}

            {mode === "data_source" ? (
              <div className="rounded-xl border border-border p-3">
                <label className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      Kirim dokumen gugatan/permohonan (PDF/Word)
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {documentAvailable
                        ? `Lampirkan berkas dari SIPP seperti notifikasi pihak baru. ${selectedWithDocumentCount} dari ${selectedRecipients.length} penerima terpilih punya dokumen.`
                        : "Sumber data terpilih belum memuat kolom dokumen (petitum_dok), jadi tidak ada berkas untuk dilampirkan."}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={sendDocumentEnabled}
                    disabled={!documentAvailable}
                    onChange={(event) => setAttachDocument(event.target.checked)}
                    data-testid="manual-send-attach-document"
                  />
                </label>
                {sendDocumentEnabled && selectedWithDocumentCount < selectedRecipients.length ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Penerima tanpa dokumen tetap menerima pesan teks saja.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-300/50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                onClick={() => void doSend(true)}
                disabled={!canSend}
                data-testid="manual-send-test-button"
              >
                {sendState.inFlight === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                {sendState.inFlight === "test" ? "Mengirim TEST..." : "Kirim Pengujian (TEST)"}
              </Button>
              <Button onClick={() => void doSend(false)} disabled={!canSend} data-testid="manual-send-actual-button">
                {sendState.inFlight === "actual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendState.inFlight === "actual" ? "Mengirim..." : "Kirim Aktual"}
              </Button>
            </div>

            {sendState.error ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-100" data-testid="manual-send-error">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{sendState.error}</span>
              </div>
            ) : null}
            {sendState.result ? (
              <div className="space-y-2 rounded-xl border border-border p-3 text-sm" data-testid="manual-send-result">
                <p className={cn("font-semibold", sendState.result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
                  {sendState.result.message}
                </p>
                <ul className="space-y-1">
                  {sendState.result.recipients.map((item, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={statusBadgeVariant(item.status)}>{statusLabel(item.status)}</Badge>
                      <span className="font-medium text-foreground">{item.normalized || item.raw}</span>
                      {item.name ? <span className="text-muted-foreground">({item.name})</span> : null}
                      {item.queueId ? <span className="text-muted-foreground">Antrean #{item.queueId}</span> : null}
                      {item.errorMessage ? <span className="text-destructive">{item.errorMessage}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* 10. Riwayat */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Riwayat Kirim Manual Terbaru</CardTitle>
            <CardDescription>20 pengiriman manual terakhir, termasuk pengujian dan kegagalan.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadHistory()} disabled={isLoadingHistory}>
            {isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Muat ulang
          </Button>
        </CardHeader>
        <CardContent>
          {historyError ? <p className="text-sm text-destructive">{historyError}</p> : null}
          {!historyError && history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat pengiriman manual.</p>
          ) : null}
          {history.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-left text-xs" data-testid="manual-send-history">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Pengirim</th>
                    <th className="px-3 py-2">Tujuan</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Sumber/Template</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="cursor-pointer border-t border-border align-top transition hover:bg-muted/40"
                      onClick={() => setExpandedHistoryId((current) => (current === entry.id ? null : entry.id))}
                    >
                      <td className="whitespace-nowrap px-3 py-2">{new Date(entry.createdAt).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2">{entry.actorName || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-foreground">{entry.recipientNumber}</span>
                        {entry.recipientNumberRaw && entry.recipientNumberRaw !== entry.recipientNumber ? (
                          <span className="block text-muted-foreground">input: {entry.recipientNumberRaw}</span>
                        ) : null}
                        {entry.recipientName ? <span className="block text-muted-foreground">{entry.recipientName}</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        {entry.mode === "data_source" ? "Sumber data" : "Manual"}
                        {entry.isTest ? <Badge variant="warning" className="ml-1">TEST</Badge> : null}
                      </td>
                      <td className="px-3 py-2">
                        {entry.queryName || entry.templateTitle ? (
                          <>
                            {entry.queryName ? <span className="block">{entry.queryName}</span> : null}
                            {entry.templateTitle ? <span className="block text-muted-foreground">{entry.templateTitle}</span> : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusBadgeVariant(entry.status)}>{statusLabel(entry.status)}</Badge>
                      </td>
                      <td className="max-w-[260px] px-3 py-2">
                        {entry.errorMessage ? <span className="block text-destructive">{entry.errorMessage}</span> : null}
                        {expandedHistoryId === entry.id ? (
                          <>
                            {Object.keys(entry.queryParams).length > 0 ? (
                              <span className="block text-muted-foreground">
                                Parameter: {Object.entries(entry.queryParams).map(([key, value]) => `${key}=${value}`).join(", ")}
                              </span>
                            ) : null}
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-2 text-[11px] leading-5">
                              {entry.messagePreview}
                            </pre>
                          </>
                        ) : (
                          <span className="block truncate text-muted-foreground">{entry.messagePreview}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
