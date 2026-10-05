"use client";

/**
 * ============================================================================
 * JADWAL SIDANG & HASIL SIDANG - PERBAIKAN 2 OKTOBER 2026 (butir 10)
 * ============================================================================
 *
 * Sidang yang SEDANG BERJALAN di ruang sidang disorot, dan "skors": lompat ke
 * perkara lain sambil menyatakan sidang yang ditinggalkan BELUM SELESAI -
 * dapat dilanjutkan nanti. Tanda Selesai yang sah tidak pernah dihapusnya.
 *
 * Aturannya di @/lib/jadwal-sidang-2okt (fungsi murni yang diuji). Berkas ini
 * hanya lencana, tombol, pelaksana langkah, dan papan untuk Hasil Sidang.
 *
 * Yang ditulis keluar ALETA hanya jalur yang SUDAH ada nilainya:
 *   - panggil  = jalur Papan panggil = MASUK RUANG (disidang = nomor ruang +
 *     jam_sidang, sama dengan PROSES aplikasi antrian; 10 = selesai - 5 Okt 2026);
 *   - skors    = antrian.status SIPP asli 0<->1 (tidak pernah menyentuh 2);
 *   - tandai sedang berjalan = tabel ALETA; ke mesin antrian ruang tunggu
 *     disidang = nomor ruang (bawaan sejak 5 Okt 2026; ALETA_ANTRIAN_DISIDANG_PROSES=mati mematikan).
 * Siapa, kapan, IP, "lewat ALETA" hanya di tabel ALETA (butir 14).
 *
 * 2 Okt 2026 malam: tombol Tandai sedang berjalan / Batalkan tanda, ringkasan
 * ruang memuat perkara yang diskors, dan PanelRuangPapanPanggil - skors dan
 * lanjutkan tersedia juga di halaman tempat nomor antrian dipanggil.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PauseCircle, PlayCircle, Radio, RefreshCw, SkipForward, Smartphone, Undo2 } from "lucide-react";

import { apiPath, withBasePath } from "@/lib/base-path";
import { keadaanSelesai, type PetaSelesai } from "@/lib/jadwal-sidang-1okt";
import {
  DATA_BERJALAN_KOSONG,
  aksiRuangSidang,
  daftarDiskors,
  jamSingkat,
  kalimatLangkah,
  kalimatSumberBerjalan,
  pesanTolakSkors,
  petaSidangBerjalan,
  rencanaLompat,
  selesaiPerKunciWaktu,
  skorsUntuk,
  type AksiRuangSidang,
  type CatatanSkors,
  type DataBerjalan,
  type DiskorsRingkas,
  type KeadaanRuangSidang,
  type LangkahRuangSidang,
  type PetaSkors,
  type SidangBerjalan,
} from "@/lib/jadwal-sidang-2okt";
import { bacaKontakPihak, kalimatKontak } from "@/lib/jadwal-sidang-kontak";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import type { KontakPihak } from "@/lib/bawaan-tunda";
import { kunciWaktu, WAKTU_ANTRIAN_KOSONG, type WaktuAntrian } from "@/lib/tiga-jarak-sidang";
import { type TandaAntrianOnline as TandaOnline } from "@/lib/tanda-antrian-online";
import { cn } from "@/lib/utils";

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

/** Keterangan perkara yang dibutuhkan pelaksana langkah. */
export type InfoPerkaraRuang = {
  nomorPerkara: string;
  nomorAntrian: number | null;
  noRuang: number | null;
};

/**
 * Menjalankan langkah lompat/skors/lanjut BERURUTAN dan berhenti pada yang
 * pertama gagal - pesannya menyebut langkah mana yang sudah terjadi.
 */
export async function jalankanLangkahRuangSidang(
  langkah: LangkahRuangSidang[],
  info: (perkaraId: string) => InfoPerkaraRuang
): Promise<{ ok: boolean; pesan: string }> {
  const sudah: string[] = [];
  const gagal = (pesan: string) => ({
    ok: false,
    pesan: sudah.length > 0 ? `${sudah.join(" ")} Lalu berhenti: ${pesan}` : pesan,
  });
  for (const l of langkah) {
    const i = info(l.perkaraId);
    const nomor = i.nomorPerkara || `perkara ${l.perkaraId}`;
    try {
      if (l.jenis === "panggil") {
        const data = await bacaJson(
          await fetch(apiPath("/api/aleta-ecourt/antrian/panggil"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              perkaraId: l.perkaraId,
              nomorPerkara: i.nomorPerkara,
              nomorAntrian: i.nomorAntrian,
              noRuang: i.noRuang,
            }),
          })
        );
        if (data.available === false) return gagal(String(data.message || "ALETA Bot belum dapat dihubungi."));
        if (data.ok === false) return gagal(`panggilan ${nomor} - ${String(data.alasan || "gagal")}`);
        sudah.push(`${nomor} dipanggil.`);
      } else {
        const data = await bacaJson(
          await fetch(apiPath("/api/aleta-ecourt/sidang/skors"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              perkaraId: l.perkaraId,
              tanggalSidang: l.tanggalSidang,
              nomorPerkara: i.nomorPerkara,
              skors: l.jenis === "skors",
              panggilSaatSkors: l.jenis === "skors" ? l.panggilSaatSkors : "",
              kering: false,
            }),
          })
        );
        if (data.available === false || data.ok === false) {
          return gagal(`${nomor} - ${pesanTolakSkors(String(data.alasan || ""), data.pesan ? String(data.pesan) : undefined)}`);
        }
        sudah.push(l.jenis === "skors" ? `${nomor} diskors (belum selesai).` : `Skors ${nomor} dilanjutkan.`);
      }
    } catch (galat) {
      return gagal(galat instanceof Error ? galat.message : "error");
    }
  }
  return { ok: true, pesan: sudah.join(" ") };
}

// ============================================================================
// LENCANA
// ============================================================================

export function LencanaSedangBerjalan({ berjalan, className }: { berjalan: SidangBerjalan; className?: string }) {
  const jam = jamSingkat(berjalan.sejak);
  const sumber = berjalan.sumber ?? "panggilan";
  return (
    <div
      data-sedang-berjalan=""
      data-sumber-berjalan={sumber}
      className={cn("mt-1 flex flex-col gap-0.5", className)}
      title={`Sedang disidangkan di ${berjalan.ruang}. ${kalimatSumberBerjalan(berjalan)}`}
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-500 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-sky-800 dark:border-sky-400 dark:text-sky-200">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
        </span>
        sedang disidangkan
      </span>
      <span className="text-[10px] text-sky-800 dark:text-sky-300">
        {berjalan.ruang}
        {jam ? ` · sejak ${jam}` : ""}
        {sumber === "manual" ? " · ditandai manual" : sumber === "antrian-proses" ? " · proses (antrian)" : ""}
      </span>
    </div>
  );
}

export function LencanaDiskors({ catatan, className }: { catatan: CatatanSkors; className?: string }) {
  const jam = jamSingkat(catatan.diskorsPada);
  return (
    <span
      data-diskors=""
      className={cn(
        "mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-amber-500 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-amber-800 dark:border-amber-400 dark:text-amber-200",
        className
      )}
      title={`Diskors${jam ? ` pukul ${jam}` : ""}${catatan.oleh ? ` oleh ${catatan.oleh}` : ""}. Sidangnya BELUM SELESAI dan dapat dilanjutkan.`}
    >
      <PauseCircle className="h-3 w-3" aria-hidden />
      diskors · belum selesai
    </span>
  );
}

// ============================================================================
// TANDA ANTRIAN ONLINE (perbaikan 2 Okt sore, butir 4)
// ============================================================================
//
// Ikon ponsel bila nomor antriannya diambil lewat antrian online, bukan di
// loket/anjungan. Aturan dan sumbernya di @/lib/tanda-antrian-online - di sini
// hanya gambarnya. Mode Ringkas: ikon saja (kata "online" berkelas
// kolom-lengkap, yang disembunyikan tabel Ringkas); keterangannya tetap utuh
// di title dan aria-label pada kedua mode.

export function TandaAntrianOnline({
  tanda,
  className,
}: {
  tanda: TandaOnline | null;
  className?: string;
}) {
  if (!tanda) return null;
  return (
    <span
      data-tanda-antrian-online={tanda.sisi || "ya"}
      role="img"
      aria-label={tanda.keterangan}
      title={tanda.keterangan}
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full border border-sky-400 bg-sky-100 px-1 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        className
      )}
    >
      <Smartphone className="h-3 w-3 shrink-0" aria-hidden />
      <span className="kolom-lengkap" aria-hidden>
        online
      </span>
    </span>
  );
}

// ============================================================================
// EMAIL DAN PERSETUJUAN e-COURT DI RINCIAN (2 Okt 2026 malam, butir 1f)
// ============================================================================
//
// "Email tergugat: ada · persetujuan e-Court: setuju" - bahan aturan tunda
// karena ketidakhadiran (satu fungsi di @/lib/bawaan-tunda). Datanya dibaca
// SAAT Rincian dibuka (satu bacaan ke bot, yang hanya membaca tabelnya sendiri
// dan SIPP - tidak ke e-Court), bukan untuk tiap baris daftar. Alamat email
// tidak pernah sampai ke peramban: hanya ada/tidaknya.

export function KontakPihakRincian({ perkaraId, nomorPerkara }: { perkaraId: string | number; nomorPerkara: string }) {
  const [hasil, setHasil] = useState<{ id: string; kontak: KontakPihak | null } | null>(null);
  const id = String(perkaraId ?? "");

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    let batal = false;
    void bacaKontakPihak(id).then((kontak) => {
      if (!batal) setHasil({ id, kontak });
    });
    return () => {
      batal = true;
    };
  }, [id]);

  if (!/^\d+$/.test(id)) return null;
  const sebutan = sebutanPihakPerkara({ nomorPerkara });
  const siap = hasil !== null && hasil.id === id;
  return (
    <p
      data-kontak-pihak-rincian=""
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
    >
      <span className="font-medium text-foreground">Panggilan elektronik</span>
      <span>{siap ? kalimatKontak(hasil.kontak, sebutan.dua, sebutan.satu) : "Membaca email dan persetujuan e-Court…"}</span>
    </p>
  );
}

/** Satu baris keterangan di panel Rincian - kalimat utuh, bukan sekadar ikon. */
export function TandaAntrianOnlineRincian({ tanda }: { tanda: TandaOnline | null }) {
  if (!tanda) return null;
  return (
    <p
      data-tanda-antrian-online-rincian={tanda.sisi || "ya"}
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
    >
      <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{tanda.keterangan}</span>
    </p>
  );
}

// ============================================================================
// TOMBOL SATU BARIS
// ============================================================================

/**
 * Menandai / membatalkan tanda "sedang berjalan" manual - POST sidang/berjalan.
 * Satu tempat untuk tombol di baris Jadwal Sidang dan di Hasil Sidang.
 */
export async function setelTandaBerjalan(opsi: {
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  ruang?: string;
  berjalan: boolean;
}): Promise<{ ok: boolean; pesan: string }> {
  try {
    const data = await bacaJson(
      await fetch(apiPath("/api/aleta-ecourt/sidang/berjalan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perkaraId: opsi.perkaraId,
          nomorPerkara: opsi.nomorPerkara,
          tanggalSidang: opsi.tanggalSidang,
          ruang: opsi.ruang ?? "",
          berjalan: opsi.berjalan,
          kering: false,
        }),
      })
    );
    if (data.available === false || data.ok === false) {
      return { ok: false, pesan: pesanTolakSkors(String(data.alasan || ""), data.pesan ? String(data.pesan) : undefined) };
    }
    const mesin = data.antrianRuangTunggu as { ok?: boolean; alasan?: string; baris?: number } | undefined;
    const tambahan =
      mesin && mesin.ok === false
        ? ` Tersimpan di ALETA; aplikasi antrian tidak tergerakkan: ${mesin.alasan || "error"}.`
        : mesin && mesin.alasan === "ruang_masih_ada_sidang_berproses"
          ? " Tersimpan di ALETA; di aplikasi antrian ruang itu masih ada sidang berproses - skors dulu."
          : "";
    return { ok: true, pesan: `${opsi.berjalan ? "Ditandai sedang berjalan." : "Tanda dibatalkan."}${tambahan}` };
  } catch (galat) {
    return { ok: false, pesan: galat instanceof Error ? galat.message : "Tanda belum tersimpan." };
  }
}

export function TombolRuangSidang({
  baris,
  aksi,
  berjalan,
  skors,
  bisaDipanggil,
  info,
  onBerubah,
  ruang,
}: {
  baris: { perkaraId: string; nomorPerkara: string; tanggalSidang: string };
  aksi: AksiRuangSidang;
  berjalan: SidangBerjalan | null | undefined;
  skors: CatatanSkors | null | undefined;
  bisaDipanggil: boolean;
  info: (perkaraId: string) => InfoPerkaraRuang;
  onBerubah: (hasil: { ok: boolean; tujuan: string }) => void;
  /** Sebutan ruang baris ini - dicatat bersama tanda manual. */
  ruang?: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  if (!aksi.skors && !aksi.lompat && !aksi.lanjut && !aksi.tandai && !aksi.batalTanda) {
    return pesan ? <span className={cn("max-w-[12rem] text-[11px]", pesan.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600")}>{pesan.teks}</span> : null;
  }

  const tandai = async (nyala: boolean) => {
    setSibuk(true);
    setPesan(null);
    const hasil = await setelTandaBerjalan({
      perkaraId: baris.perkaraId,
      nomorPerkara: baris.nomorPerkara,
      tanggalSidang: baris.tanggalSidang,
      ruang,
      berjalan: nyala,
    });
    setSibuk(false);
    setPesan({ ok: hasil.ok, teks: hasil.pesan });
    onBerubah({ ok: hasil.ok, tujuan: baris.perkaraId });
  };

  const jalankan = async (langkah: LangkahRuangSidang[]) => {
    if (langkah.length === 0) return;
    const kalimat = kalimatLangkah(langkah, (id) => info(id).nomorPerkara);
    if (!window.confirm(`${kalimat.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nLanjutkan?`)) return;
    setSibuk(true);
    setPesan(null);
    const hasil = await jalankanLangkahRuangSidang(langkah, info);
    setSibuk(false);
    setPesan({ ok: hasil.ok, teks: hasil.pesan });
    onBerubah({ ok: hasil.ok, tujuan: baris.perkaraId });
  };

  const tombol =
    "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:cursor-default disabled:opacity-60";

  return (
    <span className="inline-flex flex-col gap-0.5" data-ruang-sidang="">
      {aksi.skors && berjalan ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={() =>
            void jalankan([
              {
                jenis: "skors",
                perkaraId: baris.perkaraId,
                tanggalSidang: baris.tanggalSidang,
                panggilSaatSkors: berjalan.sejak,
              },
            ])
          }
          title="Skors: sidang ini BELUM SELESAI dan dapat dilanjutkan nanti. Tanda Selesai yang sah tidak tersentuh."
          className={cn(tombol, "border-amber-500/60 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200")}
        >
          <PauseCircle className="h-3.5 w-3.5" />
          {sibuk ? "…" : "Skors"}
        </button>
      ) : null}
      {aksi.lompat && aksi.asal ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={() =>
            void jalankan(rencanaLompat({ asal: aksi.asal, tujuan: baris, tujuanDiskors: false, bisaDipanggil }))
          }
          title={`Lompat ke perkara ini: ${info(aksi.asal.perkaraId).nomorPerkara || "sidang yang berjalan"} di ${aksi.asal.ruang} diskors (belum selesai), lalu perkara ini dipanggil.`}
          className={cn(tombol, "border-sky-500/60 text-sky-800 hover:bg-sky-500/10 dark:text-sky-200")}
        >
          <SkipForward className="h-3.5 w-3.5" />
          {sibuk ? "…" : "Lompat ke sini"}
        </button>
      ) : null}
      {aksi.lanjut && skors ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={() =>
            void jalankan(rencanaLompat({ asal: aksi.asal, tujuan: baris, tujuanDiskors: true, bisaDipanggil }))
          }
          title={
            bisaDipanggil
              ? "Lanjutkan sidang yang diskors: perkara ini dipanggil lagi" +
                (aksi.asal ? ` dan ${info(aksi.asal.perkaraId).nomorPerkara || "sidang yang berjalan"} diskors.` : ".")
              : "Catat skors ini dilanjutkan (perkara ini tidak punya antrian hari ini, jadi tidak dipanggil)."
          }
          className={cn(tombol, "border-emerald-600/60 text-emerald-800 hover:bg-emerald-600/10 dark:text-emerald-200")}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          {sibuk ? "…" : "Lanjutkan"}
        </button>
      ) : null}
      {aksi.tandai ? (
        <button
          type="button"
          disabled={sibuk}
          data-tandai-berjalan=""
          onClick={() => void tandai(true)}
          title="Perkara ini sedang disidangkan tetapi tidak terdeteksi dari antrian: tandai manual. Bila aplikasi antrian ruang tunggu sudah dipasangkan, statusnya ikut ke sana; bila belum, hanya tersimpan di ALETA."
          className={cn(tombol, "border-sky-500/40 text-sky-800/90 hover:bg-sky-500/10 dark:text-sky-200")}
        >
          <Radio className="h-3.5 w-3.5" />
          {sibuk ? "…" : "Tandai berjalan"}
        </button>
      ) : null}
      {aksi.batalTanda ? (
        <button
          type="button"
          disabled={sibuk}
          data-batal-tanda-berjalan=""
          onClick={() => void tandai(false)}
          title="Batalkan tanda sedang berjalan yang dipasang manual. Riwayatnya tetap tercatat di ALETA."
          className={cn(tombol, "text-muted-foreground hover:bg-muted")}
        >
          <Undo2 className="h-3.5 w-3.5" />
          {sibuk ? "…" : "Batalkan tanda"}
        </button>
      ) : null}
      {pesan ? (
        <span className={cn("max-w-[12rem] text-[11px]", pesan.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600")}>
          {pesan.teks}
        </span>
      ) : null}
    </span>
  );
}

// ============================================================================
// RINGKASAN DI ATAS TABEL - SIAPA YANG SEDANG DISIDANGKAN DI TIAP RUANG
// ============================================================================

export function RingkasRuangSidang({
  perRuang,
  nomorPerkara,
  jumlahDiskors,
  diskors,
  onLihat,
}: {
  perRuang: Record<string, SidangBerjalan>;
  nomorPerkara: (kunci: string) => string;
  /** Dipakai bila `diskors` (daftar rinci) tidak diberikan. */
  jumlahDiskors?: number;
  /** Perkara yang sedang diskors - disebut satu per satu, dapat ditekan. */
  diskors?: DiskorsRingkas[];
  onLihat?: (kunci: string) => void;
}) {
  const ruang = Object.entries(perRuang).sort(([a], [b]) => a.localeCompare(b, "id", { numeric: true }));
  const banyakDiskors = diskors ? diskors.length : (jumlahDiskors ?? 0);
  if (ruang.length === 0 && banyakDiskors === 0) return null;
  return (
    <div
      data-ringkas-ruang-sidang=""
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-sky-500/40 bg-sky-500/[0.06] px-3 py-1.5 text-xs"
    >
      <span className="font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-200">Ruang sidang</span>
      {ruang.length === 0 ? <span className="text-muted-foreground">tidak ada sidang yang sedang berjalan</span> : null}
      {ruang.map(([nama, b]) => (
        <button
          key={nama}
          type="button"
          onClick={() => onLihat?.(b.kunci)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition hover:bg-sky-500/15"
          title="Tunjukkan barisnya"
        >
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
          <span className="font-medium">{nama}:</span>
          <span className="tabular-nums">{nomorPerkara(b.kunci) || `perkara ${b.perkaraId}`}</span>
          {b.nomorAntrian !== null ? <span className="text-muted-foreground">antrian {b.nomorAntrian}</span> : null}
          {jamSingkat(b.sejak) ? <span className="text-muted-foreground">sejak {jamSingkat(b.sejak)}</span> : null}
          {b.sumber === "manual" ? <span className="text-muted-foreground">(ditandai manual)</span> : null}
        </button>
      ))}
      {diskors && diskors.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-1.5" data-ringkas-diskors="">
          <span className="font-medium text-amber-800 dark:text-amber-200">{diskors.length} diskors · belum selesai:</span>
          {diskors.map((d) => (
            <button
              key={d.kunci}
              type="button"
              onClick={() => onLihat?.(d.kunci)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-left text-amber-900 transition hover:bg-amber-500/20 dark:text-amber-100"
              title={`Tunjukkan barisnya${d.oleh ? ` - diskors oleh ${d.oleh}` : ""}. Sidangnya belum selesai dan dapat dilanjutkan.`}
            >
              <PauseCircle className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">{nomorPerkara(d.kunci) || `perkara ${d.perkaraId}`}</span>
              {d.ruang ? <span className="text-amber-800/80 dark:text-amber-200/80">{d.ruang}</span> : null}
              {d.jam ? <span className="text-amber-800/80 dark:text-amber-200/80">{d.jam}</span> : null}
            </button>
          ))}
        </span>
      ) : banyakDiskors > 0 ? (
        <span className="text-amber-800 dark:text-amber-200">{banyakDiskors} diskors · belum selesai</span>
      ) : null}
    </div>
  );
}

// ============================================================================
// DATA RUANG SIDANG SATU HARI - dipakai Hasil Sidang dan Papan panggil
// ============================================================================

type BarisJadwalRingkas = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  jamSidang?: string;
  ruangan?: string;
  agenda?: string;
  ditunda?: boolean;
  alasanDitunda?: string;
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  sidangIkrarTalak?: boolean;
  ikrarTercatat?: boolean;
};

type AntrianRingkas = { nomor: number | null; tanggalSidang: string; noRuang: number | null };

type DataPapan = {
  sidang: BarisJadwalRingkas[];
  antrian: Record<string, AntrianRingkas>;
  waktu: WaktuAntrian;
  selesai: PetaSelesai;
  skors: PetaSkors;
  /** Tanda "sedang berjalan" manual + proses sidang mesin antrian (bot lama = kosong). */
  berjalan: DataBerjalan;
};

function hariIniLokal(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/**
 * Keadaan ruang sidang untuk SATU tanggal - bacaan yang SAMA dengan Jadwal
 * Sidang (rute jadwal + peta selesai/skors/berjalan). Dipakai PapanRuangSidang
 * (Hasil Sidang) dan PanelRuangPapanPanggil (halaman tempat nomor dipanggil).
 */
function useDataRuangSidang(tanggal: string) {
  const [data, setData] = useState<DataPapan | null>(null);
  const [galat, setGalat] = useState("");
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return;
    let batal = false;
    const params = new URLSearchParams({ dari: tanggal, sampai: tanggal });
    Promise.all([
      fetch(apiPath(`/api/aleta-ecourt/sidang?${params.toString()}`), { cache: "no-store" }).then(bacaJson),
      fetch(apiPath(`/api/aleta-ecourt/sidang/selesai?${params.toString()}`), { cache: "no-store" })
        .then(bacaJson)
        .catch(() => ({}) as Record<string, unknown>),
    ])
      .then(([jadwal, selesai]) => {
        if (batal) return;
        if (jadwal.available === false) {
          setGalat(String(jadwal.message || "Jadwal sidang belum dapat dibaca."));
          return;
        }
        const antrian = (jadwal.antrian as { peta?: Record<string, AntrianRingkas> } | undefined)?.peta ?? {};
        const mentah = (selesai.berjalan as Partial<DataBerjalan> | undefined) ?? {};
        setData({
          sidang: Array.isArray(jadwal.sidang) ? (jadwal.sidang as BarisJadwalRingkas[]) : [],
          antrian,
          waktu: (jadwal.waktuAntrian as WaktuAntrian) ?? WAKTU_ANTRIAN_KOSONG,
          selesai: (selesai.peta as PetaSelesai) ?? {},
          skors: (selesai.skors as PetaSkors) ?? {},
          berjalan: {
            manual: mentah.manual && typeof mentah.manual === "object" ? mentah.manual : DATA_BERJALAN_KOSONG.manual,
            proses: Array.isArray(mentah.proses) ? mentah.proses : DATA_BERJALAN_KOSONG.proses,
          },
        });
        setGalat("");
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof Error ? e.message : "Jadwal sidang belum dapat dibaca.");
      });
    return () => {
      batal = true;
    };
  }, [tanggal, versi]);

  const muatUlang = useCallback(() => setVersi((n) => n + 1), []);

  const susun = useMemo(() => {
    if (!data) return null;
    const hariIni = data.waktu.hariIni;
    const ruangSipp: Record<string, string> = {};
    for (const b of data.sidang) ruangSipp[kunciWaktu(b.tanggalSidang, b.perkaraId)] = String(b.ruangan || "");
    const selesai = selesaiPerKunciWaktu(data.sidang, data.selesai);
    const ruang = petaSidangBerjalan(data.waktu.baris, { hariIni, selesai, skors: data.skors, ruangSipp, berjalan: data.berjalan });
    const bisaDipanggil = (b: { perkaraId: string; tanggalSidang: string }) =>
      Boolean(hariIni) && b.tanggalSidang === hariIni && data.antrian[String(b.perkaraId)]?.tanggalSidang === b.tanggalSidang;
    return { hariIni, selesai, ruang, bisaDipanggil };
  }, [data]);

  return { data, galat, muatUlang, susun };
}

/** Keterangan perkara untuk tombol - dari data satu hari, dengan cadangan untuk perkara yang sedang dibuka. */
function infoDari(data: DataPapan | null, cadangan?: { perkaraId: string; nomorPerkara: string }) {
  return (id: string): InfoPerkaraRuang => {
    const b = data?.sidang.find((x) => String(x.perkaraId) === String(id));
    const a = data?.antrian[String(id)];
    return {
      nomorPerkara: b?.nomorPerkara || (cadangan && String(id) === String(cadangan.perkaraId) ? cadangan.nomorPerkara : ""),
      nomorAntrian: a?.nomor ?? null,
      noRuang: a?.noRuang ?? null,
    };
  };
}

// ============================================================================
// PAPAN RUANG SIDANG DI HALAMAN HASIL SIDANG
// ============================================================================

/**
 * Hasil Sidang (/sidang-tunda/<id>) - satu perkara, tetapi petugasnya duduk di
 * ruang sidang: ia perlu tahu apakah perkara ini yang sedang disidangkan,
 * menskorsnya, menandainya berjalan, dan melompat ke perkara berikutnya di
 * ruang yang sama tanpa kembali ke Jadwal Sidang.
 *
 * Datanya bacaan yang SAMA dengan Jadwal Sidang (rute jadwal + peta selesai),
 * untuk tanggal sidang perkara ini saja. Hari lampau / akan datang: tidak
 * ditampilkan - tidak ada sidang yang sedang berjalan pada hari itu.
 */
export function PapanRuangSidang({
  perkaraId,
  nomorPerkara,
  tanggalSidang,
  hasilSidangSelesai,
}: {
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  hasilSidangSelesai: boolean;
}) {
  const tanggal = String(tanggalSidang || "").slice(0, 10);
  const { data, galat, muatUlang, susun } = useDataRuangSidang(tanggal);
  const info = useMemo(() => infoDari(data, { perkaraId, nomorPerkara }), [data, perkaraId, nomorPerkara]);
  const [pesanLompat, setPesanLompat] = useState("");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return null;
  if (galat) {
    return (
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground" data-papan-ruang-sidang="">
        Ruang sidang: {galat}
      </p>
    );
  }
  if (!data || !susun) {
    return (
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground" data-papan-ruang-sidang="">
        Membaca keadaan ruang sidang…
      </p>
    );
  }
  // Hanya hari sidang yang sedang berjalan - hari lain tidak punya "sedang disidangkan".
  if (!susun.hariIni || susun.hariIni !== tanggal) return null;

  const kunci = kunciWaktu(tanggal, perkaraId);
  const baris = { perkaraId: String(perkaraId), nomorPerkara, tanggalSidang: tanggal };
  const berjalanIni = susun.ruang.berjalan[kunci] ?? null;
  const skorsIni = skorsUntuk(data.skors, baris, susun.ruang.penandaPerKunci[kunci]);
  const ruangIni = susun.ruang.ruangPerKunci[kunci] ?? "";
  const berjalanDiRuang = ruangIni ? (susun.ruang.perRuang[ruangIni] ?? null) : null;
  const hijau =
    hasilSidangSelesai || keadaanSelesai(baris, false, data.selesai).hijau || Boolean(susun.selesai[kunci]);
  const dapatDipanggil = susun.bisaDipanggil(baris);
  const aksi = aksiRuangSidang({
    hijau,
    berjalan: berjalanIni,
    skors: skorsIni,
    berjalanDiRuang,
    bisaDipanggil: dapatDipanggil,
    bisaTandai: true,
  });

  // Perkara lain di ruang yang sama, hari ini, belum selesai, dapat dipanggil.
  const calon = ruangIni
    ? data.sidang
        .filter((b) => String(b.perkaraId) !== String(perkaraId))
        .filter((b) => b.tanggalSidang === tanggal)
        .filter((b) => susun.ruang.ruangPerKunci[kunciWaktu(b.tanggalSidang, b.perkaraId)] === ruangIni)
        .filter((b) => !susun.selesai[kunciWaktu(b.tanggalSidang, b.perkaraId)])
        .filter((b) => !susun.ruang.berjalan[kunciWaktu(b.tanggalSidang, b.perkaraId)])
        .filter((b) => susun.bisaDipanggil(b))
        .sort(
          (a, b) =>
            (data.antrian[a.perkaraId]?.nomor ?? Number.POSITIVE_INFINITY) -
            (data.antrian[b.perkaraId]?.nomor ?? Number.POSITIVE_INFINITY)
        )
    : [];

  const lompatKe = async (tujuan: BarisJadwalRingkas) => {
    const diskors = Boolean(
      skorsUntuk(data.skors, tujuan, susun.ruang.penandaPerKunci[kunciWaktu(tujuan.tanggalSidang, tujuan.perkaraId)])
    );
    const langkah = rencanaLompat({ asal: berjalanDiRuang, tujuan, tujuanDiskors: diskors, bisaDipanggil: true });
    const kalimat = kalimatLangkah(langkah, (id) => info(id).nomorPerkara);
    if (!window.confirm(`${kalimat.map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nSesudahnya halaman Hasil Sidang ${tujuan.nomorPerkara} dibuka. Lanjutkan?`)) {
      return;
    }
    setPesanLompat("");
    const hasil = await jalankanLangkahRuangSidang(langkah, info);
    if (!hasil.ok) {
      setPesanLompat(hasil.pesan);
      muatUlang();
      return;
    }
    window.location.assign(withBasePath(`/sidang-tunda/${encodeURIComponent(tujuan.sidangId)}`));
  };

  return (
    <div
      data-papan-ruang-sidang=""
      className={cn(
        "space-y-2 rounded-lg border px-3 py-2 text-sm",
        berjalanIni ? "border-sky-500/60 bg-sky-500/[0.07]" : skorsIni ? "border-amber-500/60 bg-amber-500/[0.07]" : ""
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ruang sidang{ruangIni ? ` · ${ruangIni}` : ""}
          </span>
          {berjalanIni ? <LencanaSedangBerjalan berjalan={berjalanIni} className="mt-0" /> : null}
          {skorsIni ? <LencanaDiskors catatan={skorsIni} className="mt-0" /> : null}
        </div>
        <button
          type="button"
          onClick={muatUlang}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
          title="Baca ulang keadaan ruang sidang"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {hijau
          ? "Sidang perkara ini sudah selesai - tidak dapat diskors."
          : berjalanIni
            ? `Perkara ini yang sedang disidangkan (${kalimatSumberBerjalan(berjalanIni)}) Skors bila sidangnya belum selesai dan akan dilanjutkan nanti.`
            : skorsIni
              ? "Sidang perkara ini diskors dan belum selesai."
              : berjalanDiRuang
                ? `Yang sedang disidangkan di ${ruangIni}: ${info(berjalanDiRuang.perkaraId).nomorPerkara || `perkara ${berjalanDiRuang.perkaraId}`}${
                    jamSingkat(berjalanDiRuang.sejak) ? ` sejak ${jamSingkat(berjalanDiRuang.sejak)}` : ""
                  }.`
                : ruangIni
                  ? `Tidak ada sidang yang sedang berjalan di ${ruangIni}.`
                  : "Perkara ini belum tercatat di antrian sidang hari ini - ruangnya belum diketahui."}
      </p>

      <TombolRuangSidang
        baris={baris}
        aksi={aksi}
        berjalan={berjalanIni}
        skors={skorsIni}
        bisaDipanggil={dapatDipanggil}
        info={info}
        ruang={ruangIni}
        onBerubah={() => muatUlang()}
      />

      {calon.length > 0 ? (
        <details className="text-xs" data-lompat-perkara-lain="">
          <summary className="cursor-pointer select-none font-medium">
            Lompat ke perkara lain di {ruangIni} ({calon.length})
          </summary>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {berjalanDiRuang
              ? `${info(berjalanDiRuang.perkaraId).nomorPerkara || "Sidang yang berjalan"} diskors (belum selesai, dapat dilanjutkan), lalu perkara pilihan dipanggil dan halaman hasil sidangnya dibuka.`
              : "Perkara pilihan dipanggil dan halaman hasil sidangnya dibuka."}
          </p>
          <ul className="mt-1 space-y-1">
            {calon.map((b) => {
              const k = kunciWaktu(b.tanggalSidang, b.perkaraId);
              const skorsB = skorsUntuk(data.skors, b, susun.ruang.penandaPerKunci[k]);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => void lompatKe(b)}
                    className="flex w-full flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-left transition hover:bg-muted"
                  >
                    <SkipForward className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
                    {data.antrian[b.perkaraId]?.nomor ? (
                      <span className="font-bold tabular-nums">{data.antrian[b.perkaraId]?.nomor}</span>
                    ) : null}
                    <span className="font-medium">{b.nomorPerkara}</span>
                    {b.agenda ? <span className="text-muted-foreground">{b.agenda}</span> : null}
                    {skorsB ? <LencanaDiskors catatan={skorsB} className="mt-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {pesanLompat ? <p className="text-xs text-rose-600">{pesanLompat}</p> : null}
    </div>
  );
}

// ============================================================================
// PANEL RUANG SIDANG DI HALAMAN TEMPAT NOMOR ANTRIAN DIPANGGIL (Papan panggil)
// ============================================================================

/**
 * Skors, Lanjutkan, dan Batalkan tanda - di halaman yang dibuka petugas ruang
 * sidang untuk MEMANGGIL nomor, bukan hanya di baris Jadwal Sidang. Sidang yang
 * sedang berjalan di tiap ruang disebut, dapat diskors; yang diskors disebut
 * dan dapat dilanjutkan. Perkara yang diskors TIDAK selesai (tidak hijau):
 * tombol tunda|putus di Jadwal Sidang tetap ada, dan tanda Selesai yang sah
 * tidak pernah tersentuh.
 *
 * Mandiri: membaca datanya sendiri (bacaan yang sama dengan Jadwal Sidang),
 * sehingga halaman pemanggil cukup memasangnya tanpa membawa data lain.
 * Hanya HARI INI - sidang hari lain tidak punya "sedang berjalan".
 */
export function PanelRuangPapanPanggil({ tanggal, className }: { tanggal?: string; className?: string }) {
  const hari = tanggal || hariIniLokal();
  const { data, galat, muatUlang, susun } = useDataRuangSidang(hari);
  const info = useMemo(() => infoDari(data), [data]);

  if (galat) {
    return (
      <p className={cn("rounded-md border px-3 py-2 text-xs text-muted-foreground", className)} data-panel-ruang-papan="">
        Ruang sidang: {galat}
      </p>
    );
  }
  if (!data || !susun) {
    return (
      <p className={cn("rounded-md border px-3 py-2 text-xs text-muted-foreground", className)} data-panel-ruang-papan="">
        Membaca keadaan ruang sidang…
      </p>
    );
  }
  if (!susun.hariIni || susun.hariIni !== hari) return null;

  const berjalan = Object.values(susun.ruang.berjalan).sort((a, b) =>
    a.ruang.localeCompare(b.ruang, "id", { numeric: true })
  );
  const diskors = daftarDiskors(data.sidang, data.skors, susun.ruang, susun.selesai);
  const barisDari = (b: { perkaraId: string; tanggalSidang: string }) => ({
    perkaraId: String(b.perkaraId),
    tanggalSidang: b.tanggalSidang,
    nomorPerkara: info(String(b.perkaraId)).nomorPerkara,
  });

  return (
    <div
      data-panel-ruang-papan=""
      className={cn("space-y-2 rounded-2xl border bg-muted/10 p-4 text-sm", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Sidang berjalan dan skors · tidak menyelesaikan perkara
        </p>
        <button
          type="button"
          onClick={muatUlang}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
          title="Baca ulang keadaan ruang sidang"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>

      {berjalan.length === 0 && diskors.length === 0 ? (
        <p className="text-xs text-muted-foreground">Tidak ada sidang yang sedang berjalan atau diskors hari ini.</p>
      ) : null}

      {berjalan.length > 0 ? (
        <ul className="space-y-1.5" data-panel-berjalan="">
          {berjalan.map((b) => {
            const baris = barisDari(b);
            const aksi = aksiRuangSidang({
              hijau: false,
              berjalan: b,
              skors: null,
              berjalanDiRuang: b,
              bisaDipanggil: susun.bisaDipanggil(baris),
            });
            return (
              <li key={b.kunci} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-sky-500/40 bg-sky-500/[0.06] px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{baris.nomorPerkara || `perkara ${b.perkaraId}`}</p>
                  <LencanaSedangBerjalan berjalan={b} className="mt-0.5" />
                </div>
                <TombolRuangSidang
                  baris={baris}
                  aksi={aksi}
                  berjalan={b}
                  skors={null}
                  bisaDipanggil={susun.bisaDipanggil(baris)}
                  info={info}
                  ruang={b.ruang}
                  onBerubah={() => muatUlang()}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {diskors.length > 0 ? (
        <ul className="space-y-1.5" data-panel-diskors="">
          {diskors.map((d) => {
            const baris = barisDari(d);
            const catatan = data.skors[`${d.perkaraId}|${d.tanggalSidang}`];
            const aksi = aksiRuangSidang({
              hijau: false,
              berjalan: null,
              skors: catatan ?? null,
              berjalanDiRuang: d.ruang ? (susun.ruang.perRuang[d.ruang] ?? null) : null,
              bisaDipanggil: susun.bisaDipanggil(baris),
            });
            return (
              <li key={d.kunci} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{baris.nomorPerkara || `perkara ${d.perkaraId}`}</p>
                  {catatan ? <LencanaDiskors catatan={catatan} className="mt-0.5" /> : null}
                </div>
                <TombolRuangSidang
                  baris={baris}
                  aksi={aksi}
                  berjalan={null}
                  skors={catatan ?? null}
                  bisaDipanggil={susun.bisaDipanggil(baris)}
                  info={info}
                  ruang={d.ruang}
                  onBerubah={() => muatUlang()}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
