"use client";

import { useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";
import {
  ringkasKehadiran,
  sebutanOrang,
  statusOrang,
  susunKehadiran,
  usulanBas,
  usulanDihadiriOleh,
  type AntrianKehadiran,
  type BahanPerkaraHadir,
  type KehadiranOrang,
  type KehadiranTersusun,
  type NadaRingkas,
  type PotonganRingkas,
} from "@/lib/kehadiran-rinci";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * F3.2 - KEHADIRAN RINCI DI LAYAR (Jadwal Sidang, layar operator, blangko)
 * ============================================================================
 *
 * Aturannya di @/lib/kehadiran-rinci; di sini hanya gambarnya. Satu rupa di
 * semua layar supaya "Penggugat hadir 08.47" terbaca sama di jadwal, papan
 * panggil, dan blangko Tunda/Putus.
 */

const WARNA_NADA: Record<NadaRingkas, string> = {
  hijau: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  abu: "bg-muted text-muted-foreground",
  kuning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  biru: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  merah: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

/** Ringkasan satu baris: lencana kecil berwarna, dipisah titik tengah. */
export function RingkasKehadiran({
  potongan,
  ukuran = "kecil",
  className,
}: {
  potongan: PotonganRingkas[];
  ukuran?: "kecil" | "sedang";
  className?: string;
}) {
  if (!potongan.length) return null;
  return (
    <div
      data-kehadiran-rinci=""
      className={cn(
        "mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 leading-tight",
        ukuran === "kecil" ? "text-[10px]" : "text-xs",
        className
      )}
    >
      {potongan.map((p) => (
        <span key={p.kunci} title={p.judul} className={cn("rounded px-1 font-medium", WARNA_NADA[p.nada])}>
          {p.teks}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// PILIHAN "SIAPA YANG HADIR?" - dinamis menurut perkaranya
// ============================================================================

export type PilihanHadir = {
  kunci: string;
  label: string;
  peran: string;
  sebagaiKuasa: boolean;
  /** Kolom antrian: pihak_1 | pihak_2 | saksi. */
  sisi: string;
  saksiUntuk?: string;
  urutanPihak?: string;
  nama?: string;
};

/**
 * Daftar pilihan menurut perkaranya: sebutannya (Pemohon pada cerai talak),
 * sisi kedua hanya bila ada, turut tergugat/intervensi hanya bila terdaftar,
 * dan saksi satu per satu menurut yang DIAJUKAN di SIPP (namanya ikut).
 * Pilihan lama (P, T, kuasa P, kuasa T, saksi) tetap ada.
 */
export function daftarPilihanHadir(bahan: BahanPerkaraHadir): PilihanHadir[] {
  const satu = bahan.sebutanSatu || "Penggugat";
  const dua = bahan.sebutanDua || "Tergugat";
  const peranSatu = satu.toLowerCase() === "pemohon" ? "pemohon" : "penggugat";
  const peranDua = dua.toLowerCase() === "termohon" ? "termohon" : "tergugat";
  const daftar: PilihanHadir[] = [
    { kunci: "p1", label: satu, peran: peranSatu, sebagaiKuasa: false, sisi: "pihak_1" },
    { kunci: "kuasa-p1", label: `Kuasa ${satu}`, peran: peranSatu, sebagaiKuasa: true, sisi: "pihak_1" },
  ];
  if (!bahan.tanpaPihakKedua) {
    daftar.push(
      { kunci: "p2", label: dua, peran: peranDua, sebagaiKuasa: false, sisi: "pihak_2" },
      { kunci: "kuasa-p2", label: `Kuasa ${dua}`, peran: peranDua, sebagaiKuasa: true, sisi: "pihak_2" }
    );
  }
  if (bahan.adaTurut) {
    daftar.push({ kunci: "turut", label: "Turut Tergugat", peran: "turut-tergugat", sebagaiKuasa: false, sisi: "pihak_2" });
  }
  if (bahan.adaIntervensi) {
    daftar.push({ kunci: "intervensi", label: "Intervensi", peran: "intervenien", sebagaiKuasa: false, sisi: "pihak_1" });
  }

  const saksi = (huruf: string, sebutan: string, untuk: string, diajukan: number, nama: string[]) => {
    const n = Math.max(diajukan, nama.length);
    for (let i = 0; i < n; i += 1) {
      daftar.push({
        kunci: `saksi-${huruf}-${i + 1}`,
        label: `Saksi ${sebutan} ${i + 1}${nama[i] ? `: ${nama[i]}` : ""}`,
        peran: "saksi",
        sebagaiKuasa: false,
        sisi: "saksi",
        saksiUntuk: untuk,
        urutanPihak: String(i + 1),
        nama: nama[i] ?? "",
      });
    }
    daftar.push({
      kunci: `saksi-${huruf}-lain`,
      label: n ? `Saksi ${sebutan} lainnya` : `Saksi ${sebutan}`,
      peran: "saksi",
      sebagaiKuasa: false,
      sisi: "saksi",
      saksiUntuk: untuk,
    });
  };
  saksi("p", satu, "pihak_1", Number(bahan.saksiDiajukanP) || 0, bahan.namaSaksiP ?? []);
  if (!bahan.tanpaPihakKedua) saksi("t", dua, "pihak_2", Number(bahan.saksiDiajukanT) || 0, bahan.namaSaksiT ?? []);
  return daftar;
}

// ============================================================================
// DAFTAR YANG HADIR - status per orang + Pulang / Diperiksa
// ============================================================================

type Aksi = "pulang" | "kembali" | "diperiksa" | "belum-diperiksa";

/**
 * Orang yang sudah tercatat hadir, dengan statusnya (datang 08.47, di ruang
 * sidang, pulang 10.12, sudah diperiksa). Pulang dan Diperiksa BUKAN reset:
 * nomor antrian tidak bergeser dan orangnya tetap tercatat pernah hadir.
 */
export function DaftarHadirRinci({
  perkaraId,
  hadir,
  susun,
  bahan,
  bolehUbah = true,
  onSelesai,
}: {
  perkaraId: string;
  hadir: KehadiranOrang[];
  susun: Pick<KehadiranTersusun, "ruang" | "noRuang">;
  bahan: BahanPerkaraHadir;
  bolehUbah?: boolean;
  onSelesai?: () => void;
}) {
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const orang = hadir.filter((o) => o.id);
  if (!orang.length) return null;

  const ubah = async (o: KehadiranOrang, keadaan: Aksi) => {
    setSibuk(`${o.id}|${keadaan}`);
    setPesan(null);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/antrian/kehadiran"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkaraId, id: o.id, keadaan }),
      });
      const isi = (await jawaban.json()) as { ok?: boolean; alasan?: string; data?: { ok?: boolean; alasan?: string } };
      const hasil = isi.data ?? isi;
      if (!hasil.ok) {
        setPesan({ ok: false, teks: hasil.alasan || "Keadaan belum dapat disimpan." });
        return;
      }
      onSelesai?.();
    } catch {
      setPesan({ ok: false, teks: "Keadaan belum dapat disimpan." });
    } finally {
      setSibuk("");
    }
  };

  return (
    <div data-daftar-hadir="" className="mt-1 border-t pt-1.5">
      <p className="px-2 pb-0.5 text-[11px] text-muted-foreground">Yang sudah hadir</p>
      <ul className="space-y-0.5">
        {orang.map((o) => {
          const status = statusOrang(o, susun);
          const saksi = o.peran === "saksi";
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-1 px-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{sebutanOrang(o, bahan)}</span>
                {o.nama ? <span className="text-muted-foreground"> · {o.nama}</span> : null}
                <span
                  className={cn(
                    "ml-1 rounded px-1 text-[10px]",
                    status.kunci === "pulang" ? WARNA_NADA.abu : status.kunci === "disidang" ? WARNA_NADA.biru : WARNA_NADA.hijau
                  )}
                >
                  {status.label}
                </span>
              </span>
              {bolehUbah ? (
                <span className="flex gap-1">
                  {saksi ? (
                    <button
                      type="button"
                      disabled={Boolean(sibuk)}
                      onClick={() => void ubah(o, o.diperiksaJam ? "belum-diperiksa" : "diperiksa")}
                      className="rounded border px-1.5 py-0.5 text-[10px] transition hover:bg-muted disabled:opacity-50"
                      title={o.diperiksaJam ? "Batalkan tanda sudah diperiksa" : "Tandai saksi ini sudah diperiksa di persidangan (bahan BAS)"}
                    >
                      {o.diperiksaJam ? "Batal diperiksa" : "Diperiksa"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean(sibuk)}
                    onClick={() => void ubah(o, o.pulangJam ? "kembali" : "pulang")}
                    className="rounded border px-1.5 py-0.5 text-[10px] transition hover:bg-muted disabled:opacity-50"
                    title={o.pulangJam ? "Orangnya kembali / salah centang" : "Tandai sudah pulang. Nomor antrian tidak berubah dan ia tetap tercatat pernah hadir."}
                  >
                    {o.pulangJam ? "Kembali" : "Pulang"}
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pesan ? <p className={cn("px-2 pt-1 text-[11px]", pesan.ok ? "text-muted-foreground" : "text-rose-600")}>{pesan.teks}</p> : null}
    </div>
  );
}

// ============================================================================
// USULAN "DIHADIRI OLEH" DI BLANGKO TUNDA / PUTUS
// ============================================================================

/**
 * Siapa yang tercatat hadir + usulan isian "Dihadiri oleh" SIPP. Tidak
 * mengganti pilihan sendiri: tombol "Pakai usulan" hanya muncul bila
 * pilihannya berbeda dan usulannya ada di daftar pilihan blangko.
 */
export function UsulanKehadiranBlangko({
  kehadiran,
  antrian,
  bahan,
  dihadiri,
  pilihanSah,
  onPakai,
}: {
  kehadiran: KehadiranOrang[] | null | undefined;
  antrian: AntrianKehadiran;
  bahan: BahanPerkaraHadir;
  dihadiri: number;
  pilihanSah: number[];
  onPakai: (sandi: number) => void;
}) {
  const susun = susunKehadiran(kehadiran ?? [], antrian);
  if (!susun.adaCatatan) return null;
  const usul = usulanDihadiriOleh(susun, bahan);
  const bisaDipakai = usul.sandi !== null && usul.sandi !== dihadiri && pilihanSah.includes(usul.sandi);
  return (
    <div data-usulan-kehadiran="" className="space-y-1 rounded-md border border-emerald-300/60 bg-emerald-50/50 px-3 py-2 text-xs dark:border-emerald-500/30 dark:bg-emerald-500/5">
      <p className="font-medium text-foreground">Kehadiran hari ini</p>
      <RingkasKehadiran potongan={ringkasKehadiran(susun, bahan)} ukuran="sedang" />
      <p className="text-muted-foreground">
        {usul.alasan}
        {usul.sandi !== null ? (
          <>
            {" "}Usulan <strong>Dihadiri oleh</strong>: {usul.label}.
          </>
        ) : null}
        {usul.sandiRinci !== null ? ` SIPP juga punya pilihan lebih rinci: "${usul.labelRinci}".` : ""}
      </p>
      {bisaDipakai ? (
        <button
          type="button"
          onClick={() => onPakai(usul.sandi as number)}
          className="rounded border border-emerald-600/40 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
        >
          Pakai usulan: {usul.label}
        </button>
      ) : null}
    </div>
  );
}

// ============================================================================
// USULAN BAS - hadir/tidak per pihak dan saksi yang diperiksa
// ============================================================================

function hariIniLokal(): string {
  // Tanggal WITA, bukan zona perangkat (audit 17 Okt).
  return waktuPengadilan().tanggal;
}

/**
 * Usulan kotak kehadiran BAS dari kehadiran tercatat di antrian ALETA pada
 * tanggal sidang itu. Hanya mengisi bila petugas menekan "Isi" - BAS adalah
 * pernyataan resmi, dan kotaknya tetap bebas diketik.
 *
 * "Tidak hadir" hanya diusulkan untuk sidang yang SUDAH lewat dan sisi lainnya
 * tercatat hadir; sebelum itu kosongnya catatan bukan bukti tidak hadir.
 */
export function UsulanBasKehadiran({
  perkaraId,
  tanggal,
  sebutanSatu = "Penggugat",
  sebutanDua = "Tergugat",
  tanpaPihakKedua = false,
  isiPenggugat,
  isiTergugat,
  onIsi,
}: {
  perkaraId: string;
  tanggal: string | null | undefined;
  sebutanSatu?: string;
  sebutanDua?: string;
  /** Permohonan (Pdt.P) tanpa pihak kedua - tidak ada usulan "tidak hadir" untuk pihak yang tidak ada. */
  tanpaPihakKedua?: boolean;
  isiPenggugat: string;
  isiTergugat: string;
  onIsi: (medan: "kehadiranPenggugat" | "kehadiranTergugat", bunyi: string) => void;
}) {
  const hari = String(tanggal ?? "").slice(0, 10);
  const [hadir, setHadir] = useState<{ kunci: string; daftar: KehadiranOrang[] } | null>(null);

  useEffect(() => {
    if (!/^\d+$/.test(perkaraId) || !/^\d{4}-\d{2}-\d{2}$/.test(hari)) return;
    const kendali = new AbortController();
    fetch(apiPath(`/api/aleta-ecourt/antrian/kehadiran?perkaraId=${encodeURIComponent(perkaraId)}&tanggal=${hari}`), {
      cache: "no-store",
      signal: kendali.signal,
    })
      .then((jawaban) => jawaban.json())
      .then((isi) => {
        const data = isi?.data ?? isi;
        const daftar = data?.kehadiran?.[perkaraId]?.hadir;
        setHadir({ kunci: `${perkaraId}|${hari}`, daftar: Array.isArray(daftar) ? daftar : [] });
      })
      .catch(() => undefined);
    return () => kendali.abort();
  }, [perkaraId, hari]);

  if (!hadir || hadir.kunci !== `${perkaraId}|${hari}` || hadir.daftar.length === 0) return null;
  const bahan: BahanPerkaraHadir = { sebutanSatu, sebutanDua, tanpaPihakKedua };
  const susun = susunKehadiran(hadir.daftar, hari < hariIniLokal() ? { selesaiDisidang: true } : null);
  const usul = usulanBas(susun, bahan);
  const baris: Array<{ medan: "kehadiranPenggugat" | "kehadiranTergugat"; label: string; bunyi: string; sekarang: string }> = [
    { medan: "kehadiranPenggugat", label: sebutanSatu, bunyi: usul.penggugat.bunyi, sekarang: isiPenggugat },
    { medan: "kehadiranTergugat", label: sebutanDua, bunyi: usul.tergugat.bunyi, sekarang: isiTergugat },
  ];
  const saksi = (daftar: Array<{ sisi: string; nama: string; jam: string }>) =>
    daftar.map((x) => `${x.nama || "saksi"}${x.sisi ? ` (${x.sisi === "P" ? sebutanSatu : sebutanDua})` : ""}`).join(", ");

  return (
    <div data-usulan-bas-kehadiran="" className="space-y-1.5 rounded-md border border-emerald-300/60 bg-emerald-50/50 p-3 text-xs dark:border-emerald-500/30 dark:bg-emerald-500/5">
      <p className="font-medium text-foreground">Dari kehadiran yang dicatat di antrian</p>
      <RingkasKehadiran potongan={ringkasKehadiran(susun, bahan)} ukuran="sedang" />
      {baris
        .filter((b) => b.bunyi)
        .map((b) => (
          <p key={b.medan} className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>
              {b.label}: <strong className="text-foreground">{b.bunyi}</strong>
            </span>
            {b.sekarang.trim() !== b.bunyi ? (
              <button
                type="button"
                onClick={() => onIsi(b.medan, b.bunyi)}
                className="rounded border border-emerald-600/40 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                Isi
              </button>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-300">sudah sama</span>
            )}
          </p>
        ))}
      {usul.saksiDiperiksa.length ? (
        <p className="text-muted-foreground">Saksi diperiksa: {saksi(usul.saksiDiperiksa)}.</p>
      ) : null}
      {usul.saksiHadirBelumDiperiksa.length ? (
        <p className="text-muted-foreground">Saksi hadir, belum ditandai diperiksa: {saksi(usul.saksiHadirBelumDiperiksa)}.</p>
      ) : null}
    </div>
  );
}
