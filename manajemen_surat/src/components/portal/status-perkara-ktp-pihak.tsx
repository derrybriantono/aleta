"use client";

import { useEffect, useState } from "react";

import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  cariKtpUntukPihak,
  keteranganTanpaKtp,
  teksCocokKtp,
  teksSumberBacaKtp,
  teksYakinKtp,
  type KtpPihakStatusData,
  type PihakDaftarStatus,
} from "@/lib/ktp-pihak-tampil";
import { bolehAksiLayar } from "@/lib/matriks-peran";

/* === 12OKT-E: Tanggal KTP pihak di Status Perkara (butir 8) === */

/**
 * ============================================================================
 * TANGGAL KTP TIAP PIHAK PADA "PARA PIHAK" (butir 8, 12 Oktober 2026)
 * ============================================================================
 *
 * Di bawah nama tiap pihak: tanggal KTP dikeluarkan, tingkat yakin, dan sumbernya
 * ("dari berkas KTP e-Court"). Datanya dari rute ktp-pihak-status (tabel
 * aleta_bot_ktp_pihak, diisi penyapu latar). Yang belum dibaca atau tidak terbaca
 * disebut apa adanya beserta sebabnya - bukan dikosongkan seolah tidak ada KTP.
 *
 * NIK TIDAK ditampilkan di sini (rute tidak mengirimnya).
 * Dibaca SEKALI per perkara dan disimpan; bagian ini baru digambar saat "Para pihak"
 * dibuka. Hak lihat = aksi `status.data-pihak` (rute juga 403 -> tidak digambar).
 * Hanya membaca: tidak memicu pembacaan OCR.
 */

type Keadaan =
  | { tahap: "memuat" }
  | { tahap: "ditolak" }
  | { tahap: "galat"; pesan: string }
  | { tahap: "siap"; data: KtpPihakStatusData };

const simpanan = new Map<string, Keadaan>();
const sedangJalan = new Map<string, Promise<void>>();
const pendengar = new Set<() => void>();

function beritahu() {
  for (const p of pendengar) p();
}

async function muat(nomorPerkara: string) {
  if (simpanan.has(nomorPerkara) && simpanan.get(nomorPerkara)!.tahap !== "memuat") return;
  const lama = sedangJalan.get(nomorPerkara);
  if (lama) return lama;
  simpanan.set(nomorPerkara, { tahap: "memuat" });
  const kerja = (async () => {
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/ktp-pihak-status?nomor=${encodeURIComponent(nomorPerkara)}`), {
        cache: "no-store",
      });
      if (balasan.status === 403) {
        simpanan.set(nomorPerkara, { tahap: "ditolak" });
        return;
      }
      const isi = ((await balasan.json()) as { data?: KtpPihakStatusData })?.data;
      if (!balasan.ok || !isi) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: "Tanggal KTP pihak tidak dapat dibaca." });
      } else if (!isi.ada && isi.sebab) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: isi.sebab });
      } else {
        simpanan.set(nomorPerkara, { tahap: "siap", data: isi });
      }
    } catch (e) {
      simpanan.set(nomorPerkara, {
        tahap: "galat",
        pesan: e instanceof Error ? e.message : "Tanggal KTP pihak tidak dapat dibaca.",
      });
    } finally {
      sedangJalan.delete(nomorPerkara);
      beritahu();
    }
  })();
  sedangJalan.set(nomorPerkara, kerja);
  beritahu();
  return kerja;
}

/** Kosongkan simpanan - dipakai uji. */
export function bersihkanKtpPihakStatus(nomorPerkara?: string) {
  if (nomorPerkara) simpanan.delete(nomorPerkara);
  else simpanan.clear();
  beritahu();
}

export function useKtpPihakStatus(nomorPerkara: string): Keadaan {
  const [, paksa] = useState(0);
  const boleh = bolehAksiLayar(usePenggunaAktifOpsional(), "status.data-pihak");
  useEffect(() => {
    const dengar = () => paksa((x) => x + 1);
    pendengar.add(dengar);
    if (nomorPerkara && boleh) void muat(nomorPerkara);
    return () => {
      pendengar.delete(dengar);
    };
  }, [nomorPerkara, boleh]);
  if (!boleh) return { tahap: "ditolak" };
  return simpanan.get(nomorPerkara) ?? { tahap: "memuat" };
}

const KELAS_YAKIN: Record<string, string> = {
  pasti: "text-emerald-700 dark:text-emerald-300",
  cukup: "text-emerald-700 dark:text-emerald-300",
  ragu: "text-amber-700 dark:text-amber-300",
};

/** Tampilan murni (diuji tanpa jaringan): satu baris tanggal KTP untuk satu pihak. */
export function BarisTanggalKtp({
  data,
  orang,
  semuaPihak,
}: {
  data: KtpPihakStatusData;
  orang: PihakDaftarStatus;
  semuaPihak: PihakDaftarStatus[];
}) {
  const baris = cariKtpUntukPihak(orang, semuaPihak, data.pihak);
  return (
    <div
      className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs"
      data-bagian="ktp-pihak"
    >
      <span className="w-[8.5rem] shrink-0 text-muted-foreground" title="Tanggal KTP dikeluarkan (bukan tanggal lahir, bukan masa berlaku)">
        Tanggal KTP
      </span>
      {baris ? (
        <>
          <span className="font-medium tabular-nums" data-tanggal-ktp={baris.tanggalKtp}>
            {baris.tanggalKtp}
          </span>
          {baris.yakin ? (
            <span className={`font-medium ${KELAS_YAKIN[baris.yakin] ?? ""}`} data-yakin-ktp={baris.yakin}>
              ({teksYakinKtp(baris.yakin)})
            </span>
          ) : null}
          <span className="text-muted-foreground" title={[teksCocokKtp(baris.cocok), teksSumberBacaKtp(baris.sumberBaca)].filter(Boolean).join("; ")}>
            · dari berkas KTP e-Court{baris.kota ? ` (${baris.kota})` : ""}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground" data-ktp-belum="">
          belum ada - {keteranganTanpaKtp(data)}
        </span>
      )}
    </div>
  );
}

/**
 * Baris tanggal KTP di bawah satu nama pada "Para pihak".
 * Kuasa dan saksi tidak punya baris ini (KTP kuasa/saksi bukan bahan perkara ini).
 */
export function TanggalKtpPihak({
  nomorPerkara,
  orang,
  semuaPihak,
}: {
  nomorPerkara: string;
  orang: PihakDaftarStatus;
  semuaPihak: PihakDaftarStatus[];
}) {
  const keadaan = useKtpPihakStatus(nomorPerkara);
  if (orang.jenis === "kuasa" || orang.pihakKe == null || orang.pihakKe < 1 || orang.pihakKe > 4) return null;
  if (keadaan.tahap === "ditolak") return null;
  if (keadaan.tahap === "memuat") return <p className="pl-0.5 text-xs text-muted-foreground">Membaca tanggal KTP…</p>;
  if (keadaan.tahap === "galat") return <p className="pl-0.5 text-xs text-muted-foreground">{keadaan.pesan}</p>;
  return <BarisTanggalKtp data={keadaan.data} orang={orang} semuaPihak={semuaPihak} />;
}
/* === AKHIR 12OKT-E === */
