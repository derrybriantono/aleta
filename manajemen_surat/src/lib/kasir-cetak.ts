/**
 * ============================================================================
 * KASIR: DAFTAR PSP DAN INSTRUMEN JURUSITA (3 Nov 2026) - bagian murni
 * ============================================================================
 *
 * Data dari bot (aleta_bot/services/kasirCetakService.js, jurnal keuangan SIPP - baca saja). Di sini:
 * penyaringan rekening per peran (keputusan 171: hanya pimpinan, hakim, panitera, kasir, PTSP, admin) dan
 * pengelompokan instrumen per jurusita (satu PDF per jurusita, dicetak terpisah).
 */

export type RekeningPsp = { diterimaDari: string; bank: string; nomorRekening: string; atasNama: string };

export type BarisPsp = {
  jurnalId: number;
  perkaraId: number;
  nomorPerkara: string;
  tanggal: string;
  jumlah: number;
  penerima: string;
  kuasa: string;
  ecourt: boolean;
  rekening: RekeningPsp | null;
};

export type DaftarPsp = {
  ok: true;
  dari: string;
  sampai: string;
  jumlah: number;
  total: number;
  daftar: BarisPsp[];
  terpotong?: boolean;
  /** true = peran ini tidak boleh melihat rekening; kolom rekening dikosongkan peladen. */
  rekeningDisembunyikan?: boolean;
};

export type BarisInstrumen = {
  jurnalId: number;
  perkaraId: number;
  nomorPerkara: string;
  tanggal: string;
  jenisBiayaId: number;
  uraian: string;
  jenis: string;
  jumlah: number;
  pihak: string;
  /** "Tergugat", "Pemohon II"; kosong bila baris jurnal tidak menunjuk pihak. */
  statusPihak?: string;
  alamat: string;
  jurusitaId: number;
  jurusita: string;
  jurusitaDariPerkara: boolean;
};

export type KelompokInstrumen = {
  /** "js-<id>" atau "tanpa-jurusita". */
  kunci: string;
  jurusitaId: number;
  jurusita: string;
  baris: BarisInstrumen[];
  jumlahPanggilan: number;
  jumlahPbt: number;
  total: number;
};

/** Rekening dikosongkan untuk peran yang tidak berhak (tanpa tingkat tersamar). */
export function saringRekeningPsp(data: DaftarPsp, bolehRekening: boolean): DaftarPsp {
  if (bolehRekening) return { ...data, rekeningDisembunyikan: false };
  return { ...data, rekeningDisembunyikan: true, daftar: data.daftar.map((b) => ({ ...b, rekening: null })) };
}

/** Keterangan rekening untuk layar/PDF. */
export function teksRekeningPsp(b: BarisPsp, disembunyikan = false): string {
  if (disembunyikan) return "";
  if (b.rekening && b.rekening.nomorRekening) return [b.rekening.bank, b.rekening.nomorRekening].filter(Boolean).join(" ");
  return b.ecourt ? "rekening belum terbaca dari e-Court" : "rekening belum ada";
}

/** Penerima PSP: pembayar e-Court bila ada, selain itu pihak pada jurnal (+ kuasanya). */
export function penerimaPsp(b: BarisPsp): string {
  if (b.rekening && b.rekening.diterimaDari) return b.rekening.diterimaDari;
  return b.kuasa ? `${b.penerima} (kuasa: ${b.kuasa})` : b.penerima;
}

/** Instrumen dikelompokkan per jurusita (urut nama), baris diurut tanggal lalu nomor perkara. */
export function kelompokkanInstrumen(baris: BarisInstrumen[]): KelompokInstrumen[] {
  const peta = new Map<string, KelompokInstrumen>();
  for (const b of baris) {
    const kunci = b.jurusitaId > 0 ? `js-${b.jurusitaId}` : "tanpa-jurusita";
    let k = peta.get(kunci);
    if (!k) {
      k = { kunci, jurusitaId: b.jurusitaId > 0 ? b.jurusitaId : 0, jurusita: b.jurusitaId > 0 ? b.jurusita || `Jurusita ${b.jurusitaId}` : "Jurusita belum ditunjuk", baris: [], jumlahPanggilan: 0, jumlahPbt: 0, total: 0 };
      peta.set(kunci, k);
    }
    k.baris.push(b);
    if (/^PBT/.test(b.jenis)) k.jumlahPbt += 1;
    else k.jumlahPanggilan += 1;
    k.total += Number(b.jumlah) || 0;
  }
  const hasil = [...peta.values()];
  for (const k of hasil) k.baris.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nomorPerkara.localeCompare(b.nomorPerkara, "id", { numeric: true }) || a.jurnalId - b.jurnalId);
  return hasil.sort((a, b) => (a.jurusitaId === 0 ? 1 : 0) - (b.jurusitaId === 0 ? 1 : 0) || a.jurusita.localeCompare(b.jurusita, "id"));
}

/** Nama berkas aman, mis. "Instrumen jurusita Ahmad Rekaan 2026-11-03.pdf". */
export function namaBerkasAman(teks: string): string {
  return teks.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}
