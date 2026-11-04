"use client";

import { useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";
import { modePersidangan } from "@/lib/mode-persidangan";
import {
  bolehLihatRekeningLayar,
  keteranganRekeningBelumAda,
  pemilikPembayaran,
  rupiahTitik,
  tanggalIndonesia,
  type PembayaranTampil,
} from "@/lib/pembayaran-ecourt";
import {
  tentukanBeracaraElektronik,
  type HasilBeracara,
  type MasukanBeracara,
} from "@/lib/beracara-elektronik";
import type { KontakParaPihak, KontakParaPihakBaris } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/* === STATUS-ZIP 12 Okt === */

/**
 * ============================================================================
 * EMAIL, NOMOR WHATSAPP, DAN KESEDIAAN SIDANG ELEKTRONIK PADA "PARA PIHAK"
 * (butir 12, 12 Oktober 2026)
 * ============================================================================
 *
 * Di bawah nama tiap pihak dan kuasa: email, nomor WhatsApp/HP, dan "Bersedia
 * sidang elektronik (e-Litigasi)" - ya / tidak / belum menjawab / tidak
 * diketahui. Email dan nomor datang dari SIPP dulu, lalu e-Court, SELALU dengan
 * tanda sumber; bila SIPP dan e-Court berbeda, nilai e-Court ikut disebut.
 * Kesediaan sidang elektronik dari persetujuan saluran elektronik e-Court -
 * yang tidak terbaca disebut "tidak diketahui" beserta sebabnya, tidak ditebak.
 *
 * Dibaca SEKALI per perkara dan disimpan - sepuluh nama tidak berarti sepuluh
 * pembacaan. Hak lihatnya dijaga rute (403 = bagian ini tidak digambar, bukan
 * pesan galat: yang tidak berhak tidak perlu tahu ada yang disembunyikan).
 */

type Keadaan =
  | { tahap: "memuat" }
  | { tahap: "ditolak" }
  | { tahap: "galat"; pesan: string }
  | { tahap: "siap"; data: KontakParaPihak };

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
      const balasan = await fetch(
        apiPath(`/api/aleta-ecourt/kontak-para-pihak?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );
      if (balasan.status === 403) {
        simpanan.set(nomorPerkara, { tahap: "ditolak" });
        return;
      }
      const isi = ((await balasan.json()) as { data?: KontakParaPihak & { alasan?: string; available?: boolean } })?.data;
      if (!balasan.ok || !isi) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: "Kontak para pihak tidak dapat dibaca." });
      } else if (isi.ok === false) {
        simpanan.set(nomorPerkara, { tahap: "galat", pesan: isi.alasan || "Kontak para pihak tidak dapat dibaca." });
      } else {
        simpanan.set(nomorPerkara, { tahap: "siap", data: isi });
      }
    } catch (e) {
      simpanan.set(nomorPerkara, {
        tahap: "galat",
        pesan: e instanceof Error ? e.message : "Kontak para pihak tidak dapat dibaca.",
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

/** Kosongkan simpanan - dipakai uji, dan bila petugas meminta baca ulang. */
export function bersihkanKontakParaPihak(nomorPerkara?: string) {
  if (nomorPerkara) simpanan.delete(nomorPerkara);
  else simpanan.clear();
  beritahu();
}

/**
 * `bacaOtomatis=false`: hanya memakai yang SUDAH tersimpan (mis. baris Jadwal Sidang
 * yang tidak boleh memicu satu pembacaan bot per baris); lencananya baru muncul
 * sesudah perkaranya dibuka di tempat lain.
 */
export function useKontakParaPihak(nomorPerkara: string, bacaOtomatis = true): Keadaan {
  const [, paksa] = useState(0);
  // HAK-PERAN 12 Okt: kontak pribadi pihak = status.data-pihak; rute juga 403.
  const boleh = bolehAksiLayar(usePenggunaAktifOpsional(), "status.data-pihak");
  useEffect(() => {
    const dengar = () => paksa((x) => x + 1);
    pendengar.add(dengar);
    if (nomorPerkara && boleh && bacaOtomatis) void muat(nomorPerkara);
    return () => {
      pendengar.delete(dengar);
    };
  }, [nomorPerkara, boleh, bacaOtomatis]);
  if (!boleh) return { tahap: "ditolak" };
  return simpanan.get(nomorPerkara) ?? { tahap: "memuat" };
}

/* === KASIR REKENING-SKUM 3 Nov === */
/**
 * Pembayar e-Court (e-Payment) satu perkara: nama pembayar, bank, nomor rekening pengguna. Dibaca SEKALI
 * per perkara (sama dengan kontak). Hanya pimpinan, hakim, panitera, kasir, PTSP, admin (penuh); 403 =
 * tidak digambar. Perkara yang tidak lewat e-Court = tidak ada baris.
 */
type KeadaanBayar = { tahap: "memuat" } | { tahap: "ditolak" } | { tahap: "kosong" } | { tahap: "siap"; data: PembayaranTampil };
const simpananBayar = new Map<string, KeadaanBayar>();
const jalanBayar = new Set<string>();

async function muatBayar(nomorPerkara: string) {
  if (simpananBayar.has(nomorPerkara) || jalanBayar.has(nomorPerkara)) return;
  jalanBayar.add(nomorPerkara);
  simpananBayar.set(nomorPerkara, { tahap: "memuat" });
  try {
    const balasan = await fetch(
      apiPath(`/api/aleta-ecourt/pembayaran-ecourt?nomor=${encodeURIComponent(nomorPerkara)}`),
      { cache: "no-store" }
    );
    if (balasan.status === 403) {
      simpananBayar.set(nomorPerkara, { tahap: "ditolak" });
      return;
    }
    const isi = ((await balasan.json()) as { data?: { perkara?: Record<string, PembayaranTampil> } })?.data;
    const p = isi?.perkara?.[nomorPerkara] ?? Object.values(isi?.perkara ?? {})[0];
    simpananBayar.set(nomorPerkara, p ? { tahap: "siap", data: p } : { tahap: "kosong" });
  } catch {
    simpananBayar.set(nomorPerkara, { tahap: "kosong" });
  } finally {
    jalanBayar.delete(nomorPerkara);
    beritahu();
  }
}

export function bersihkanPembayaranEcourt() {
  simpananBayar.clear();
  beritahu();
}

export function usePembayaranEcourt(nomorPerkara: string): KeadaanBayar {
  const [, paksa] = useState(0);
  // Keputusan 3 Nov 17.55: pimpinan, hakim, panitera, kasir, PTSP, admin (rute juga 403 bagi lainnya).
  const boleh = bolehLihatRekeningLayar(usePenggunaAktifOpsional());
  useEffect(() => {
    const dengar = () => paksa((x) => x + 1);
    pendengar.add(dengar);
    if (nomorPerkara && boleh) void muatBayar(nomorPerkara);
    return () => {
      pendengar.delete(dengar);
    };
  }, [nomorPerkara, boleh]);
  if (!boleh) return { tahap: "ditolak" };
  return simpananBayar.get(nomorPerkara) ?? { tahap: "memuat" };
}

/** Baris "Rekening pembayar" di bawah pihak/kuasa yang membayar panjar lewat e-Court. */
export function RuasPembayarEcourt({
  data,
  kuasa,
  cocok,
}: {
  data: PembayaranTampil;
  kuasa: boolean;
  cocok: boolean;
}) {
  const rincian = [
    data.panjar !== null ? `panjar ${rupiahTitik(data.panjar)}` : "",
    data.tanggal ? `dibayar ${tanggalIndonesia(data.tanggal)}${data.jam ? ` ${data.jam.slice(0, 5)}` : ""}` : "",
  ].filter(Boolean);
  // 4 Nov 2026 (rancangan Pihak): tiga baris berlabel - Pembayar panjar, Rekening, Untuk. Hak lihat tetap di rute/hook.
  const label = "w-[8.5rem] shrink-0 text-muted-foreground";
  return (
    <div className="mt-1 space-y-0.5 border-t border-dashed border-border/70 pt-1" data-ruas-kontak="rekening-pembayar">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={label}>Pembayar panjar</span>
        <b>{data.diterimaDari || "-"}</b>
        {kuasa ? <span className="text-muted-foreground">(kuasa)</span> : null}
        <span className="text-muted-foreground">· dari e-Court</span>
        {rincian.length ? <span className="text-muted-foreground">· {rincian.join(" · ")}</span> : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={label}>Rekening</span>
        {data.nomorRekening ? (
          <span className="font-semibold tabular-nums" data-rekening>
            {[data.bank, data.nomorRekening].filter(Boolean).join(" ")}
          </span>
        ) : (
          <span className="text-muted-foreground">{keteranganRekeningBelumAda(data.cek)}</span>
        )}
        {data.atasNama ? <span className="break-all text-muted-foreground">a.n. {data.atasNama}</span> : null}
        {!cocok && data.diterimaDari ? <span className="text-muted-foreground">(nama pembayar tidak sama dengan para pihak)</span> : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={label}>Untuk</span>
        <span>Pengembalian sisa panjar ke rekening pembayar</span>
      </div>
    </div>
  );
}

function PembayarEcourtPihak({
  nomorPerkara,
  orang,
  semua,
}: {
  nomorPerkara: string;
  orang: { nama: string; jenis: string; pihakKe: number | null };
  semua: { nama: string; jenis: string; pihakKe: number | null }[];
}) {
  const keadaan = usePembayaranEcourt(nomorPerkara);
  if (keadaan.tahap !== "siap") return null;
  const pemilik = pemilikPembayaran(keadaan.data.diterimaDari, semua);
  if (!pemilik.orang) return null;
  const sama =
    pemilik.orang.nama.trim().toLowerCase() === orang.nama.trim().toLowerCase() &&
    (pemilik.orang.jenis === "kuasa") === (orang.jenis === "kuasa");
  if (!sama) return null;
  return <RuasPembayarEcourt data={keadaan.data} kuasa={pemilik.kuasa} cocok={pemilik.cocok} />;
}
/* === AKHIR KASIR REKENING-SKUM === */

/** Mencari baris kontak untuk satu orang pada daftar pihak Status Perkara. */
export function cariKontakPihak(
  data: KontakParaPihak,
  orang: { nama: string; jenis: string; pihakKe: number | null }
): KontakParaPihakBaris | null {
  const baku = orang.nama.trim().toLowerCase().replace(/\s+/g, " ");
  const jenis = orang.jenis === "kuasa" ? "kuasa" : "pihak";
  const semua = data.orang.filter(
    (x) => x.nama.trim().toLowerCase().replace(/\s+/g, " ") === baku && x.jenis === jenis
  );
  return semua.find((x) => x.pihakKe === orang.pihakKe) ?? semua[0] ?? null;
}

const LABEL_ELITIGASI: Record<KontakParaPihakBaris["elitigasi"]["status"], { teks: string; kelas: string }> = {
  ya: { teks: "Ya", kelas: "text-emerald-700 dark:text-emerald-300" },
  tidak: { teks: "Tidak", kelas: "text-rose-700 dark:text-rose-300" },
  belum: { teks: "Belum menjawab", kelas: "text-amber-700 dark:text-amber-300" },
  "tidak-diketahui": { teks: "Tidak diketahui", kelas: "text-muted-foreground" },
  "tidak-berlaku": { teks: "-", kelas: "text-muted-foreground" },
};

function TandaSumber({ sumber }: { sumber: string }) {
  if (!sumber) return null;
  return (
    <span className="ml-1 rounded border border-border px-1 text-[0.65rem] uppercase text-muted-foreground">
      {sumber === "sipp" ? "SIPP" : "e-Court"}
    </span>
  );
}

function RuasKontak({
  label,
  nilai,
  tambahan,
  kosong,
}: {
  label: string;
  nilai: KontakParaPihakBaris["email"];
  tambahan?: string;
  kosong: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5" data-ruas-kontak={label}>
      <span className="w-[8.5rem] shrink-0 text-muted-foreground">{label}</span>
      {nilai.nilai ? (
        <>
          <span className="break-all font-medium">{nilai.nilai}</span>
          <TandaSumber sumber={nilai.sumber} />
          {nilai.lazim === false ? <span className="text-amber-700 dark:text-amber-300">(bentuknya tidak lazim)</span> : null}
          {tambahan ? <span className="text-muted-foreground">{tambahan}</span> : null}
          {nilai.lain.map((l) => (
            <span key={`${l.sumber}-${l.nilai}`} className="text-muted-foreground">
              · {l.sumber === "ecourt" ? "e-Court" : "SIPP"}: <span className="break-all">{l.nilai}</span>
            </span>
          ))}
        </>
      ) : (
        <span className="text-muted-foreground">{kosong}</span>
      )}
    </div>
  );
}

/** 28 Okt 2026: lencana "persidangan elektronik" / "persidangan hybrid" (aturan di @/lib/mode-persidangan). */
export function LencanaModePersidangan({ baris }: { baris: KontakParaPihakBaris | null }) {
  const m = baris ? modePersidangan(baris) : null;
  if (!m) return null;
  return (
    <span
      className={`ml-1.5 inline-block rounded-full border px-1.5 py-px text-[0.65rem] font-semibold ${
        m.mode === "elektronik"
          ? "border-emerald-600/50 text-emerald-700 dark:text-emerald-300"
          : "border-amber-600/50 text-amber-700 dark:text-amber-300"
      }`}
      title={m.sebab}
      data-mode-persidangan={m.mode}
    >
      {m.teks}
    </span>
  );
}

/** Lencana mode persidangan untuk satu nama (Jadwal Sidang): kontak dibaca sekali per perkara, tidak ada = tidak digambar. */
export function LencanaModePersidanganPihak({
  nomorPerkara,
  orang,
}: {
  nomorPerkara: string;
  orang: { nama: string; jenis: string; pihakKe: number | null };
}) {
  const keadaan = useKontakParaPihak(nomorPerkara);
  if (keadaan.tahap !== "siap") return null;
  return <LencanaModePersidangan baris={cariKontakPihak(keadaan.data, orang)} />;
}

/**
 * Baris kontak di bawah satu nama pada "Para pihak".
 *
 * `orang` dari daftar pihak Status Perkara. Pihak yang tidak terdaftar pada
 * jawaban bot (turut tergugat, saksi) tidak digambari apa-apa - bagian ini
 * hanya berbicara tentang pihak dan kuasa yang kontaknya memang dibaca.
 */
export function KontakPihak({
  nomorPerkara,
  orang,
  pernahHadirTergugat = null,
}: {
  nomorPerkara: string;
  orang: { nama: string; jenis: string; pihakKe: number | null };
  /** Tergugat pernah hadir? null = belum ada sidang yang tercatat (lihat beracara-elektronik.ts). */
  pernahHadirTergugat?: boolean | null;
}) {
  const keadaan = useKontakParaPihak(nomorPerkara);
  if (keadaan.tahap === "ditolak") return null;
  if (keadaan.tahap === "memuat") {
    return <p className="pl-0.5 text-xs text-muted-foreground">Membaca kontak…</p>;
  }
  if (keadaan.tahap === "galat") {
    return <p className="pl-0.5 text-xs text-muted-foreground">{keadaan.pesan}</p>;
  }
  const baris = cariKontakPihak(keadaan.data, orang);
  if (!baris) return null;
  const kuasa = baris.jenis === "kuasa";
  const e = LABEL_ELITIGASI[baris.elitigasi.status];
  const beracara =
    !kuasa && orang.pihakKe === 2
      ? tentukanBeracaraElektronik(masukanBeracaraDariKontak(keadaan.data, pernahHadirTergugat))
      : null;

  return (
    <div
      className="mt-0.5 space-y-0.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs"
      data-bagian="kontak-pihak"
    >
      <RuasKontak label="Email" nilai={baris.email} kosong="email belum ada" />
      <RuasKontak
        label={baris.hp.bisaWhatsApp || !baris.hp.nilai ? "WhatsApp / HP" : "Telepon (bukan HP)"}
        nilai={baris.hp}
        kosong="WA belum ada"
      />
      {/* KASIR REKENING-SKUM 3 Nov: rekening pengguna e-Court pada pihak/kuasa pembayar. */}
      <PembayarEcourtPihak nomorPerkara={nomorPerkara} orang={orang} semua={keadaan.data.orang} />
      {beracara ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5" data-ruas-kontak="beracara">
          <span className="w-[8.5rem] shrink-0 text-muted-foreground">Beracara</span>
          <span className="font-medium" data-beracara={beracara.jenis}>
            {beracara.label}
          </span>
          <span className="text-muted-foreground">
            {beracara.jenis === "tergugat-tidak-hadir" ? "" : `- ${beracara.alasan}`}
          </span>
        </div>
      ) : null}
      {kuasa ? null : (
        <div className="flex flex-wrap items-baseline gap-x-1.5" data-ruas-kontak="elitigasi">
          <span className="w-[8.5rem] shrink-0 text-muted-foreground">Sidang elektronik</span>
          <span className={`font-medium ${e.kelas}`} data-elitigasi={baris.elitigasi.status}>
            {e.teks}
          </span>
          <span className="text-muted-foreground">
            {baris.elitigasi.status === "ya" || baris.elitigasi.status === "tidak" || baris.elitigasi.status === "belum"
              ? "(bersedia bersidang secara e-Litigasi - dari e-Court)"
              : `(${baris.elitigasi.label})`}
          </span>
          <LencanaModePersidangan baris={baris} />
        </div>
      )}
    </div>
  );
}
/* === AKHIR STATUS-ZIP === */

/* === BERACARA ELEKTRONIK 3 Nov 2026 (keputusan 144) === */

/** Masukan fungsi tunggal dari kontak para pihak yang SUDAH dibaca (Tergugat = pihak kedua). */
export function masukanBeracaraDariKontak(data: KontakParaPihak, pernahHadir: boolean | null): MasukanBeracara {
  const tergugat = data.orang
    .filter((x) => x.jenis === "pihak" && x.pihakKe === 2)
    .map((x) => ({
      nama: x.nama,
      email: x.email.nilai || null,
      wa: x.hp.bisaWhatsApp ? x.hp.nilai || null : null,
      setujuElektronik:
        x.elitigasi.status === "ya" ? true : x.elitigasi.status === "tidak" ? false : null,
    }));
  return { eCourt: data.lewatEcourt === true, tergugat, tergugatPernahHadir: pernahHadir };
}

const KELAS_BERACARA: Record<HasilBeracara["jenis"], string> = {
  "e-litigasi": "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  hybrid: "border-amber-600/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "tergugat-tidak-hadir": "border-border bg-muted/40 text-muted-foreground",
};

/** Lencana beracara: hijau E-Litigasi, kuning Hybrid, abu "Tergugat tidak pernah hadir". */
export function LencanaBeracara({ hasil, className = "" }: { hasil: HasilBeracara | null; className?: string }) {
  if (!hasil) return null;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-px text-xs font-semibold ${KELAS_BERACARA[hasil.jenis]} ${className}`}
      title={hasil.alasan}
      data-beracara-lencana={hasil.jenis}
    >
      {hasil.label}
    </span>
  );
}

/**
 * Lencana beracara untuk satu perkara. `bacaOtomatis=false` (baris Jadwal Sidang):
 * hanya dari kontak yang SUDAH terbaca - tidak memicu pembacaan per baris.
 */
export function LencanaBeracaraPerkara({
  nomorPerkara,
  pernahHadirTergugat,
  bacaOtomatis = true,
  className,
}: {
  nomorPerkara: string;
  pernahHadirTergugat: boolean | null;
  bacaOtomatis?: boolean;
  className?: string;
}) {
  const keadaan = useKontakParaPihak(nomorPerkara, bacaOtomatis);
  if (keadaan.tahap !== "siap") return null;
  return (
    <LencanaBeracara
      hasil={tentukanBeracaraElektronik(masukanBeracaraDariKontak(keadaan.data, pernahHadirTergugat))}
      className={className}
    />
  );
}
