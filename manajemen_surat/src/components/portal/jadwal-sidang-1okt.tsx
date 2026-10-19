"use client";

/**
 * ============================================================================
 * JADWAL SIDANG - KOMPONEN PERBAIKAN 1 OKTOBER 2026 (J1, J2, J4, J7)
 * ============================================================================
 *
 * Berkas sendiri, bukan tambahan pada aleta-ecourt-sidang.tsx yang sudah
 * 9.000 baris: tombol Selesai, pemilih mediator, proses mediasi di rincian,
 * dan layar penuh berjendela. Dipakai Jadwal Sidang DAN Hasil Sidang - satu
 * komponen, supaya menu mediator di kedua layar tidak menyimpang.
 *
 * Aturannya (bawaan, pemeriksaan isian, keadaan selesai) di
 * @/lib/jadwal-sidang-1okt - fungsi murni yang diuji.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Maximize2, Minimize2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bagian } from "@/components/portal/bagian-ciut";
import { apiPath } from "@/lib/base-path";
import { ringkasTabel, sebutanTabel } from "@/lib/ringkasan-langkah-sipp";
import {
  bawaanPenetapanMediator,
  JENIS_PENETAPAN_MEDIATOR,
  periksaIsianMediator,
  ringkasMediasi,
  type KeadaanSelesai,
  type PetaSelesai,
  type ProsesMediasi,
} from "@/lib/jadwal-sidang-1okt";
import { DATA_BERJALAN_KOSONG, type DataBerjalan, type PetaSkors } from "@/lib/jadwal-sidang-2okt";
import type { PetaRiwayatSkors } from "@/lib/pernah-diskors"; // 12OKT-L
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { usePesanSementara } from "@/lib/pesan-sementara";
import { TombolTutupPesan } from "@/components/portal/tombol-tutup-pesan";
import { cn } from "@/lib/utils";

function hariIniLokal(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

// ============================================================================
// J2 - SELESAI
// ============================================================================

/**
 * Peta selesai untuk rentang yang tampil. Dibaca ulang setiap `pemicu`
 * berubah - layar Jadwal Sidang memuat ulang daftarnya tiap 45 detik, dan
 * pemicunya daftar itu sendiri. Itulah arah "antrian hijau -> ALETA hijau".
 */
export function useSelesaiSidang(dari: string, sampai: string, pemicu: unknown) {
  const [peta, setPeta] = useState<PetaSelesai>({});
  // Skors yang berlaku (perbaikan 2 Okt 2026, butir 10) - ikut di bacaan
  // yang sama; bot lama yang belum mengirimnya = tidak ada skors.
  const [skors, setSkors] = useState<PetaSkors>({});
  /* === 12OKT-L: riwayat skors (penanda "pernah diskors"); bot lama = kosong === */
  const [riwayatSkors, setRiwayatSkors] = useState<PetaRiwayatSkors>({});
  /* === AKHIR 12OKT-L === */
  // Tanda "sedang berjalan" manual + "proses sidang" mesin antrian (2 Okt 2026
  // malam, butir 3) - bacaan yang sama; bot lama = tidak ada.
  const [berjalan, setBerjalan] = useState<DataBerjalan>(DATA_BERJALAN_KOSONG);
  const [alasan, setAlasan] = useState("");
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    if (!dari) return;
    let batal = false;
    const params = new URLSearchParams({ dari, sampai: sampai || dari });
    fetch(apiPath(`/api/aleta-ecourt/sidang/selesai?${params.toString()}`), { cache: "no-store" })
      .then(bacaJson)
      .then((data) => {
        if (batal) return;
        if (data.available === false) {
          setAlasan(String(data.alasan || "Catatan selesai belum dapat dibaca."));
          return;
        }
        setPeta((data.peta as PetaSelesai) ?? {});
        setSkors((data.skors as PetaSkors) ?? {});
        setRiwayatSkors(data.riwayatSkors && typeof data.riwayatSkors === "object" ? (data.riwayatSkors as PetaRiwayatSkors) : {}); // 12OKT-L
        const mentah = (data.berjalan as Partial<DataBerjalan> | undefined) ?? {};
        setBerjalan({
          manual: mentah.manual && typeof mentah.manual === "object" ? mentah.manual : {},
          proses: Array.isArray(mentah.proses) ? mentah.proses : [],
        });
        setAlasan("");
      })
      .catch((galat) => {
        if (!batal) setAlasan(galat instanceof Error ? galat.message : "Catatan selesai belum dapat dibaca.");
      });
    return () => {
      batal = true;
    };
  }, [dari, sampai, pemicu, versi]);

  const muatUlang = useCallback(() => setVersi((n) => n + 1), []);
  return { peta, skors, riwayatSkors, berjalan, alasan, muatUlang };
}

/**
 * Tombol Selesai satu baris. Menandai = catatan ALETA + antrian SIPP status 2
 * (+ mesin ruang tunggu bila disetel). Membatalkan hanya yang DITANDAI;
 * hijau dari hasil sidang tidak dibatalkan dari sini.
 */
export function TombolSelesaiSidang({
  baris,
  keadaan,
  onBerubah,
}: {
  baris: { perkaraId: string; nomorPerkara: string; tanggalSidang: string; ruangId?: number | string | null };
  keadaan: KeadaanSelesai;
  onBerubah: () => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  // Butir 3 (5 Okt 2026): pesan di sini selalu kegagalan - menetap, dapat ditutup.
  const [pesan, setPesan] = usePesanSementara();

  const setel = async (selesai: boolean) => {
    if (!selesai && !window.confirm(`Batalkan tanda selesai ${baris.nomorPerkara}? Antrian sidangnya kembali "menunggu".`)) {
      return;
    }
    setSibuk(true);
    setPesan(null);
    try {
      const data = await bacaJson(
        await fetch(apiPath("/api/aleta-ecourt/sidang/selesai"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId: baris.perkaraId,
            nomorPerkara: baris.nomorPerkara,
            tanggalSidang: baris.tanggalSidang,
            ruangId: baris.ruangId ?? null,
            selesai,
            kering: false,
          }),
        })
      );
      if (data.available === false || data.ok === false) {
        setPesan({ ok: false, teks: String(data.alasan || "Tanda selesai belum tersimpan.") });
        return;
      }
      const antrian = data.antrianSipp as { ok?: boolean; baris?: number; alasan?: string } | undefined;
      if (antrian && antrian.ok === false) {
        setPesan({ ok: false, teks: `Tersimpan di ALETA; antrian SIPP tidak tergerakkan: ${antrian.alasan || "error"}.` });
      }
      onBerubah();
    } catch (galat) {
      setPesan({ ok: false, teks: galat instanceof Error ? galat.message : "Tanda selesai belum tersimpan." });
    } finally {
      setSibuk(false);
    }
  };

  const hijau = keadaan.hijau;
  const hanyaHasil = keadaan.dariHasilSidang && !keadaan.ditandai;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        disabled={sibuk || hanyaHasil}
        aria-pressed={hijau}
        data-selesai={hijau ? "ya" : "tidak"}
        onClick={() => void setel(!keadaan.ditandai)}
        title={
          hanyaHasil
            ? `${keadaan.keterangan} Tanda ini mengikuti hasil sidang di SIPP.`
            : keadaan.ditandai
              ? `${keadaan.keterangan} Tekan untuk membatalkan.`
              : "Tandai sidang ini selesai - ikut menandai antrian sidang selesai."
        }
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:cursor-default",
          hijau
            ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-90"
            : "text-muted-foreground hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-300"
        )}
      >
        {hijau ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        {sibuk ? "…" : "Selesai"}
      </button>
      {pesan ? (
        <span
          className={cn(
            "inline-flex max-w-[12rem] items-start gap-1 text-[11px]",
            pesan.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"
          )}
        >
          <span className="min-w-0 flex-1">{pesan.teks}</span>
          {!pesan.ok ? <TombolTutupPesan onTutup={() => setPesan(null)} className="h-4 w-4" /> : null}
        </span>
      ) : null}
    </span>
  );
}

// ============================================================================
// J4 - LAYAR PENUH BERJENDELA
// ============================================================================

/**
 * Layar penuh DI DALAM jendela peramban (bukan Fullscreen API): kartunya
 * menutupi seluruh jendela, tab dan bilah peramban tetap ada. Esc keluar.
 * Gulir halaman di belakangnya dikunci selama terbuka.
 */
export function useLayarPenuh() {
  const [penuh, setPenuh] = useState(false);
  useEffect(() => {
    if (!penuh) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPenuh(false);
    };
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tekan);
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = lama;
    };
  }, [penuh]);
  return [penuh, setPenuh] as const;
}

export function TombolLayarPenuh({ penuh, onUbah }: { penuh: boolean; onUbah: (penuh: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onUbah(!penuh)}
      aria-pressed={penuh}
      title={penuh ? "Keluar dari layar penuh (Esc)" : "Layar penuh di dalam jendela ini - Esc untuk keluar"}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition",
        penuh ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {penuh ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      {penuh ? "Keluar layar penuh" : "Layar penuh"}
    </button>
  );
}

// ============================================================================
// J1 / J7 - MEDIASI
// ============================================================================

type MediatorPilihan = {
  id: number;
  status: string;
  nama: string;
  namaGelar: string;
  noSertifikasi: string;
  anggotaMajelis: boolean;
};

type DataMediasi = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  mediasi?: ProsesMediasi[];
  daftarMediator?: MediatorPilihan[];
  akun?: {
    hakim: { username: string; namaLengkap: string } | null;
    panitera: { username: string; namaLengkap: string } | null;
  };
};

function useDataMediasi(perkaraId: string, aktif: boolean) {
  const [versi, setVersi] = useState(0);
  const sah = aktif && /^\d+$/.test(String(perkaraId || ""));
  const kunci = `${perkaraId}|${versi}`;
  // Hasil disimpan BESERTA kuncinya: "sedang memuat" dibaca dari selisih
  // kunci, bukan dari setState di dalam efek.
  const [hasil, setHasil] = useState<{ kunci: string; data: DataMediasi } | null>(null);
  useEffect(() => {
    if (!sah) return;
    let batal = false;
    fetch(apiPath(`/api/aleta-ecourt/sidang/mediator?perkaraId=${encodeURIComponent(perkaraId)}`), {
      cache: "no-store",
    })
      .then(bacaJson)
      .then((isi) => {
        if (!batal) setHasil({ kunci, data: isi as DataMediasi });
      })
      .catch((galat) => {
        if (!batal) {
          setHasil({ kunci, data: { available: false, alasan: galat instanceof Error ? galat.message : "error" } });
        }
      });
    return () => {
      batal = true;
    };
  }, [perkaraId, sah, kunci]);
  return {
    data: hasil?.data ?? null,
    memuat: sah && hasil?.kunci !== kunci,
    muatUlang: () => setVersi((n) => n + 1),
  };
}

const SEBUTAN_STATUS_MEDIATOR: Record<string, string> = { H: "Hakim", N: "Non-Hakim", P: "Pegawai" };

/**
 * Isian penetapan mediator - meniru blangko "Penetapan Mediasi" SIPP:
 * Tgl Penetapan Mediator, No. Penetapan Mediator, Mediator (dari daftar
 * mediator aktif, beserta nomor sertifikat dan profesinya), Jenis Penetapan
 * Mediator, dan Tgl Mulai Mediasi yang mengikuti tanggal penetapan.
 *
 * DUA LANGKAH: "Periksa" mengirim kering - bot menjalankan seluruh
 * pemeriksaan SIPP dan memulangkan rencananya; "Tulis ke SIPP" baru
 * dikerjakan sesudah rencana itu terlihat dan dikonfirmasi.
 */
export function IsianMediator({
  perkaraId,
  nomorPerkara,
  tanggalSidang,
  onTertulis,
}: {
  perkaraId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  onTertulis?: () => void;
}) {
  const { data, memuat, muatUlang } = useDataMediasi(perkaraId, true);
  const bawaan = bawaanPenetapanMediator({ tanggalSidang, nomorPerkara });
  const [mediatorId, setMediatorId] = useState<number | null>(null);
  const [tanggal, setTanggal] = useState(bawaan.tanggalPenetapan);
  const [nomorSk, setNomorSk] = useState(bawaan.nomorSk);
  const [jenis, setJenis] = useState<string>(bawaan.jenisPenetapan);
  const [atasNama, setAtasNama] = useState<"hakim" | "panitera">(bawaan.atasNama);
  const [cari, setCari] = useState("");
  // Rencana yang sudah diperiksa disimpan BESERTA isian yang memeriksanya:
  // isian yang berubah membatalkannya dengan sendirinya - konfirmasi tidak
  // boleh berlaku untuk isian yang lain dari yang diperlihatkan.
  const kunciIsian = JSON.stringify([mediatorId, tanggal, nomorSk, jenis, atasNama]);
  const [rencanaTersimpan, setRencanaTersimpan] = useState<{ kunci: string; isi: Record<string, unknown> } | null>(null);
  const rencana = rencanaTersimpan && rencanaTersimpan.kunci === kunciIsian ? rencanaTersimpan.isi : null;
  const setRencana = (isi: Record<string, unknown> | null) =>
    setRencanaTersimpan(isi ? { kunci: kunciIsian, isi } : null);
  // Butir 3 (5 Okt 2026): "tertulis di SIPP" hilang sendiri; penolakan menetap.
  const [pesan, setPesan] = usePesanSementara();
  const [sibuk, setSibuk] = useState(false);
  const [tertulis, setTertulis] = useState(false);

  const mediasiPertama = (data?.mediasi ?? []).find((m) => m.tahapanId === 10 && m.jenisMediasi === 1);
  const salah = periksaIsianMediator({ mediatorId, tanggalPenetapan: tanggal, jenisPenetapan: jenis, nomorSk }, hariIniLokal());

  const kirim = async (kering: boolean) => {
    setSibuk(true);
    setPesan(null);
    try {
      const isi = await bacaJson(
        await fetch(apiPath("/api/aleta-ecourt/sidang/mediator"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId,
            mediatorId,
            tanggalPenetapan: tanggal,
            nomorSk,
            jenisPenetapan: jenis,
            atasNama,
            kering,
          }),
        })
      );
      if (isi.available === false || isi.ok === false) {
        // gagal_menulis = SIPP menolak satu langkah; sejak uji rilis 9 Okt 2026
        // seluruh langkahnya satu transaksi, jadi sebutkan nasibnya.
        const gagalTulis = isi.alasan === "gagal_menulis";
        const pada = (isi.pada as { tabel?: string } | undefined)?.tabel;
        setPesan({
          ok: false,
          teks: gagalTulis
            ? `SIPP menolak salah satu langkah penulisan (${pada ? sebutanTabel(pada).toLowerCase() : "penulisan"}) - ${
                isi.dipulihkan === true
                  ? "seluruh penetapan mediator dibatalkan, tidak ada yang tertinggal di SIPP. Dapat dicoba lagi."
                  : "periksa tab Mediasi di SIPP sebelum mencoba lagi."
              }`
            : String(isi.alasan || isi.pesan || "Penetapan mediator ditolak."),
        });
        setRencana(null);
        return;
      }
      if (kering) {
        setRencana(isi);
        return;
      }
      setTertulis(true);
      setRencana(null);
      setPesan({ ok: true, teks: `Penetapan mediator tertulis di SIPP (${Number(isi.jumlahLangkah) || 0} langkah).` });
      muatUlang();
      onTertulis?.();
    } catch (galat) {
      setPesan({ ok: false, teks: galat instanceof Error ? galat.message : "Penetapan mediator gagal." });
    } finally {
      setSibuk(false);
    }
  };

  // Tanpa tulisan memuat (JADWAL-3 butir 5): ruangnya dipesan supaya panel tidak melompat.
  if (memuat && !data) return <div className="min-h-[4rem]" aria-busy="true" />;
  if (data?.available === false) {
    return <p className="text-xs text-amber-700 dark:text-amber-300">{data.alasan || "Data mediasi belum dapat dibaca."}</p>;
  }
  if (mediasiPertama) {
    return (
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Mediator: </span>
          <span className="font-semibold">{mediasiPertama.mediator || "—"}</span>
        </p>
        <p className="text-muted-foreground">
          Ditetapkan {mediasiPertama.penetapan || "—"}
          {mediasiPertama.nomorSk ? ` · No. ${mediasiPertama.nomorSk}` : ""}
          {" · "}
          {ringkasMediasi(mediasiPertama, hariIniLokal())}
        </p>
        {pesan ? <p className={pesan.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}>{pesan.teks}</p> : null}
        {!tertulis ? (
          <p className="text-[11px] text-muted-foreground">
            Mengganti mediator yang sudah ditetapkan dikerjakan lewat Edit Penetapan Mediasi di SIPP.
          </p>
        ) : null}
      </div>
    );
  }

  const daftar = (data?.daftarMediator ?? []).filter((m) =>
    `${m.namaGelar} ${m.noSertifikasi}`.toLowerCase().includes(cari.trim().toLowerCase())
  );
  const akun = data?.akun;
  const langkah = Array.isArray(rencana?.rencana) ? (rencana?.rencana as Array<{ tabel: string; aksi: string }>) : [];

  return (
    <div className="space-y-2 text-xs" data-isian-mediator="">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-0.5">
          <span className="text-muted-foreground">Tgl Penetapan Mediator *</span>
          <input
            type="date"
            value={tanggal}
            max={hariIniLokal()}
            onChange={(e) => setTanggal(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-muted-foreground">No. Penetapan Mediator</span>
          <input
            type="text"
            value={nomorSk}
            maxLength={50}
            onChange={(e) => setNomorSk(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2"
          />
        </label>
        <label className="space-y-0.5 sm:col-span-2">
          <span className="text-muted-foreground">Jenis Penetapan Mediator *</span>
          <select
            value={jenis}
            onChange={(e) => setJenis(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2"
          >
            {JENIS_PENETAPAN_MEDIATOR.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Mediator *</span>
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama / sertifikat"
            className="h-7 w-40 rounded-md border bg-background px-2"
          />
        </div>
        <ul className="max-h-44 overflow-y-auto rounded-md border" role="listbox" aria-label="Daftar mediator">
          {daftar.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Data tidak ditemukan.</li>
          ) : (
            daftar.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={mediatorId === m.id}
                  onClick={() => setMediatorId(m.id)}
                  className={cn(
                    "flex w-full flex-wrap items-baseline gap-x-2 px-2 py-1 text-left hover:bg-muted",
                    mediatorId === m.id && "bg-teal-600/15 font-semibold"
                  )}
                >
                  <span>{m.namaGelar}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {SEBUTAN_STATUS_MEDIATOR[m.status] || "-"}
                    {m.noSertifikasi ? ` · ${m.noSertifikasi}` : ""}
                  </span>
                  {m.anggotaMajelis ? (
                    <Badge variant="muted" title="Hakim ini anggota majelis perkara ini - boleh, sekadar keterangan.">
                      majelis perkara ini
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <label className="block space-y-0.5">
        <span className="text-muted-foreground">Ditulis atas nama (akun SIPP)</span>
        <select
          value={atasNama}
          onChange={(e) => setAtasNama(e.target.value === "panitera" ? "panitera" : "hakim")}
          className="h-8 w-full rounded-md border bg-background px-2"
        >
          <option value="hakim">Ketua majelis{akun?.hakim ? ` - ${akun.hakim.namaLengkap || akun.hakim.username}` : " (tidak ada akun aktif)"}</option>
          <option value="panitera">
            Panitera pengganti{akun?.panitera ? ` - ${akun.panitera.namaLengkap || akun.panitera.username}` : " (tidak ada akun aktif)"}
          </option>
        </select>
      </label>

      <p className="text-muted-foreground">Tgl Mulai Mediasi: {tanggal || "—"}</p>

      {salah.length > 0 ? (
        <ul className="list-disc pl-4 text-amber-700 dark:text-amber-300">
          {salah.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}

      {rencana ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2">
          <p className="font-semibold">Periksa sebelum ditulis ke SIPP</p>
          <p>
            {String((rencana.mediator as { nama?: string })?.nama || "")} · {String((rencana.penetapan as { tanggal?: string })?.tanggal || "")} ·
            atas nama {String((rencana.atasNama as { namaLengkap?: string; username?: string })?.namaLengkap || (rencana.atasNama as { username?: string })?.username || "")}
          </p>
          <p className="text-muted-foreground">Akan ditulis ke SIPP: {ringkasTabel(langkah).toLowerCase()}.</p>
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" disabled={sibuk} onClick={() => void kirim(false)}>
              {sibuk ? "Menulis…" : "Ya, tulis ke SIPP"}
            </Button>
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setRencana(null)}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled={sibuk || salah.length > 0} onClick={() => void kirim(true)}>
          {sibuk ? "Memeriksa…" : "Periksa penetapan mediator"}
        </Button>
      )}

      {pesan ? (
        <p className={cn("flex items-start gap-1", pesan.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600")}>
          <span className="min-w-0 flex-1">{pesan.teks}</span>
          {!pesan.ok ? <TombolTutupPesan onTutup={() => setPesan(null)} className="h-4 w-4" /> : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tombol "mediator" pada baris jadwal - kini MEMILIH mediator (J1). Jalan
 * lama ke Status Perkara bagian Mediasi TETAP ada di dalam menunya.
 */
export function TombolPilihMediator({
  baris,
  onBukaStatus,
  kelasPanel = "bg-card",
  catatan,
}: {
  baris: { perkaraId: string; nomorPerkara: string; tanggalSidang: string };
  sebab: string;
  onBukaStatus?: (nomorPerkara: string) => void;
  /** Latar panel - bg-card; token popover tidak ada pada tema ini. */
  kelasPanel?: string;
  /** Batas yang disebut terus terang di kaki panel. */
  catatan?: string;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const wadah = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!terbuka) return;
    const diLuar = (peristiwa: MouseEvent) => {
      if (wadah.current && !wadah.current.contains(peristiwa.target as Node)) setTerbuka(false);
    };
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerbuka(false);
    };
    document.addEventListener("mousedown", diLuar);
    document.addEventListener("keydown", tekan);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      document.removeEventListener("keydown", tekan);
    };
  }, [terbuka]);

  return (
    <span ref={wadah} className="relative ml-1 inline-flex align-middle">
      <button
        type="button"
        onClick={() => setTerbuka((buka) => !buka)}
        aria-expanded={terbuka}
        // 19 Okt 2026 (JADWAL-3 butir 6): sebab munculnya tombol (jam antrian,
        // catatan SIPP) TIDAK lagi ditampilkan - keterangan teknis, bukan kalimat
        // yang dibutuhkan petugas. Prop `sebab` tetap diterima pemanggil lama.
        title="Pilih mediator untuk perkara ini"
        className={cn(
          "rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition",
          terbuka
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-teal-600/50 text-teal-700 hover:bg-teal-600/10 dark:text-teal-300"
        )}
      >
        mediator
      </button>

      {terbuka ? (
        <div
          className={cn(
            "absolute left-0 top-full z-30 mt-1 w-[22rem] max-w-[90vw] rounded-md border p-2 text-left shadow-lg",
            kelasPanel
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Penetapan mediator · {baris.nomorPerkara}
          </p>
          <p className="mb-1 mt-0.5 text-xs text-muted-foreground">Pilih mediator yang ditunjuk untuk perkara ini.</p>
          <IsianMediator perkaraId={baris.perkaraId} nomorPerkara={baris.nomorPerkara} tanggalSidang={baris.tanggalSidang} />
          {onBukaStatus ? (
            <button
              type="button"
              onClick={() => {
                setTerbuka(false);
                onBukaStatus(baris.nomorPerkara);
              }}
              className="mt-2 w-full rounded-md border px-2 py-1 text-left text-xs font-medium transition hover:bg-muted"
            >
              Buka Status Perkara → bagian Mediasi
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                Mediator, nomor SK, tanggal penetapan, tenggat 30 hari, laporan, hasil, dan jadwal pertemuannya.
              </span>
            </button>
          ) : null}
          <p className="mt-2 border-t pt-2 text-[11px] leading-snug text-muted-foreground">
            {catatan ||
              "Jadwal pertemuan, laporan, dan hasil mediasi masih ditulis di SIPP."}
          </p>
        </div>
      ) : null}
    </span>
  );
}

/**
 * Proses mediasi di rincian sidang (J7) - HANYA bila perkaranya punya
 * mediasi. Tidak ada mediasi = tidak ada bagian sama sekali.
 *
 * Sumbernya bot (perkara_mediasi + perkara_jadwal_mediasi). Bila bot belum
 * punya rutenya, jatuh ke ringkasan mediasi yang sudah ikut di baris jadwal
 * (durasi.mediasi) - tidak ada yang hilang dari yang dulu sudah tampil.
 */
export function ProsesMediasiRincian({
  perkaraId,
  cadangan,
}: {
  perkaraId: string;
  cadangan?: Array<{ mulai: string; selesai: string; hasil: string; mediator: string }>;
}) {
  const { data } = useDataMediasi(perkaraId, true);
  const daftar = data?.mediasi ?? [];
  const hariIni = hariIniLokal();

  if (daftar.length === 0) {
    const sisa = cadangan ?? [];
    if (sisa.length === 0) return null;
    return (
      <Bagian judul="Proses mediasi" kunci="sidang-mediasi-1okt" keterangan={String(sisa.length)}>
        <ul className="space-y-1 text-sm">
          {sisa.map((m, i) => (
            <li key={`${m.mulai}-${i}`} className="flex flex-wrap items-center gap-2">
              <span>
                {m.mulai || "—"} → {m.selesai || "belum berujung"}
              </span>
              {m.hasil ? <Badge variant="outline">{m.hasil}</Badge> : null}
              {m.mediator ? <span className="text-xs text-muted-foreground">mediator: {m.mediator}</span> : null}
            </li>
          ))}
        </ul>
      </Bagian>
    );
  }

  return (
    <Bagian
      judul="Proses mediasi"
      kunci="sidang-mediasi-1okt"
      keterangan={ringkasMediasi(daftar[daftar.length - 1], hariIni)}
    >
      <div className="space-y-3 text-sm">
        {daftar.map((m) => (
          <div key={m.mediasiId} className="space-y-1">
            <p>
              <span className="font-semibold">{m.mediator || "Mediator belum tercatat"}</span>
              <span className="text-xs text-muted-foreground">
                {" "}
                · ditetapkan {m.penetapan || "—"}
                {m.nomorSk ? ` · No. ${m.nomorSk}` : ""}
                {m.jenisMediasi === 2 ? " · perdamaian pada tahap pemeriksaan" : ""}
              </span>
            </p>
            <p className="text-xs">
              <Badge variant={m.hasil ? (/^Y|^S/.test(m.hasil) ? "success" : "warning") : "muted"}>
                {ringkasMediasi(m, hariIni)}
              </Badge>
              {m.laporan ? <span className="ml-2 text-muted-foreground">laporan mediator {m.laporan}</span> : null}
            </p>
            {m.jadwal.length > 0 ? (
              <ol className="space-y-0.5 text-xs">
                {m.jadwal.map((j) => (
                  <li key={`${m.mediasiId}-${j.urutan}`} className="flex flex-wrap gap-x-2">
                    <span className="w-6 text-right tabular-nums text-muted-foreground">{j.urutan}</span>
                    <span className="tabular-nums">{j.tanggal || "—"}</span>
                    {j.jam ? (
                      <span className="tabular-nums text-muted-foreground">
                        {j.jam}
                        {j.sampaiJam ? `-${j.sampaiJam}` : ""}
                      </span>
                    ) : null}
                    {j.tempat ? <span className="text-muted-foreground">{j.tempat}</span> : null}
                    {j.kehadiran ? <span>· {j.kehadiran}</span> : null}
                    {j.ditunda ? <Badge variant="muted">ditunda</Badge> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {m.catatan ? <p className="text-xs text-muted-foreground">{m.catatan}</p> : null}
          </div>
        ))}
      </div>
    </Bagian>
  );
}
