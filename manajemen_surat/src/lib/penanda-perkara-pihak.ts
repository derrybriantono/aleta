/**
 * ============================================================================
 * PENANDA PERKARA DAN PIHAK DI JADWAL SIDANG (12 Okt 2026, butir 5)
 * ============================================================================
 *
 * Permintaan pengguna: "berikan penanda ghaib, prodeo dan PNS, PPPK, POLRI, TNI
 * dan BUMN BUMD di samping nama pihaknya (kalau ghaib, prodeo di samping nomor
 * perkara), beri tanda perkara non e-Court di samping nomor perkara (apabila
 * e-Court maka tidak perlu ada), tambah juga di rincian".
 *
 * Berkas ini hanya MEMILIH lencana dari bahan yang dikirim bot
 * (aleta_bot/services/penandaPerkaraPihakService.js) - tidak satu pun penciri
 * dihitung ulang di peramban:
 *
 *   ghaib / prodeo   dari `penandaPerkara` baris;
 *   non e-Court      dari `lewatEcourt` baris, TETAPI hanya bila bot menyatakan
 *                    peta e-Courtnya terbaca (`ecourtTerbaca === true`). Peta
 *                    yang gagal dibaca kosong, dan membaca "non e-Court" dari
 *                    peta kosong menuduh SELURUH daftar. Bot lama yang tidak
 *                    mengirim ruas itu membuat tanda diam (gagal-tertutup);
 *   pekerjaan        dari `penandaPihak` baris: PNS, PPPK, POLRI, TNI,
 *                    BUMN/BUMD menurut penggolongan ABT (keputusan 11 Okt).
 *
 * Perkara e-Court TIDAK diberi tanda apa pun - itu yang lazim.
 */

export type PenandaPerkaraBaris = {
  ghaib: boolean;
  /** Sumber penciri ghaib (mis. "penanda ghaib pada pihak tergugat/termohon"). */
  ghaibSumber?: string[];
  prodeo: boolean;
};

export type LencanaPekerjaanPihak = {
  /** Kedudukan pada SIPP: 1 penggugat/pemohon, 2 tergugat/termohon, 3 intervensi, 4 turut tergugat. */
  sisi: number;
  nama: string;
  /** PNS | PPPK | POLRI | TNI | BUMN | BUMD */
  kunci: string;
  /** Tulisan pada lencana (BUMN/BUMD bila teksnya menyebut keduanya). */
  label: string;
  /** Penggolongan dari teks bebas yang tidak baku - lencana diberi tanda tanya. */
  ragu?: boolean;
  /** Kalimat asal, mis. "PNS (dari teks 'ASN Dinas Pendidikan')". */
  kalimat?: string;
};

/** Ruas baris jadwal yang dibaca berkas ini - seluruhnya opsional (bot lama tidak mengirimnya). */
export type BahanPenandaBaris = {
  lewatEcourt?: boolean;
  ecourtTerbaca?: boolean;
  penandaPerkara?: PenandaPerkaraBaris | null;
  penandaPihak?: LencanaPekerjaanPihak[] | null;
};

export type KunciLencanaPerkara = "ghaib" | "prodeo" | "non-ecourt";

export type LencanaPerkara = {
  kunci: KunciLencanaPerkara;
  label: string;
  judul: string;
};

/**
 * Lencana di samping nomor perkara, dalam urutan tetap: ghaib, prodeo, non e-Court.
 * Daftar kosong bila tidak satu pun berlaku.
 */
export function lencanaPerkara(baris: BahanPenandaBaris): LencanaPerkara[] {
  const hasil: LencanaPerkara[] = [];
  const p = baris.penandaPerkara;
  if (p?.ghaib) {
    const sumber = (p.ghaibSumber ?? []).filter(Boolean);
    hasil.push({
      kunci: "ghaib",
      label: "Ghaib",
      judul: `Perkara ghaib: tergugat/termohon tidak diketahui tempat tinggalnya, dipanggil lewat pengumuman.${
        sumber.length > 0 ? ` Dikenali dari: ${sumber.join("; ")}.` : ""
      }`,
    });
  }
  if (p?.prodeo) {
    hasil.push({
      kunci: "prodeo",
      label: "Prodeo",
      judul: "Perkara prodeo: biaya perkara dibebaskan (ditanggung negara).",
    });
  }
  if (baris.ecourtTerbaca === true && baris.lewatEcourt !== true) {
    hasil.push({
      kunci: "non-ecourt",
      label: "Non e-Court",
      judul: "Perkara tidak terdaftar lewat e-Court (didaftarkan langsung). Perkara e-Court tidak diberi tanda.",
    });
  }
  return hasil;
}

/** Nama dibandingkan tanpa beda huruf besar dan spasi berlebih. */
export function kunciNamaPihak(nama: string | null | undefined): string {
  return String(nama ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Lencana pekerjaan milik nama-nama yang SEDANG ditampilkan (satu baris P, T,
 * Turut T, atau Int). Dicocokkan lewat nama, sebab daftar pihak di baris jadwal
 * berupa nama; tiap lencana hanya muncul sekali per nama.
 */
export function lencanaPekerjaanUntukNama(
  baris: BahanPenandaBaris,
  namaTampil: ReadonlyArray<string>
): LencanaPekerjaanPihak[] {
  const semua = baris.penandaPihak ?? [];
  if (semua.length === 0 || namaTampil.length === 0) return [];
  const dicari = new Set(namaTampil.map(kunciNamaPihak));
  const sudah = new Set<string>();
  const hasil: LencanaPekerjaanPihak[] = [];
  for (const l of semua) {
    const k = kunciNamaPihak(l.nama);
    const kunciUnik = `${k}|${l.label}`;
    if (!dicari.has(k) || sudah.has(kunciUnik)) continue;
    sudah.add(kunciUnik);
    hasil.push(l);
  }
  return hasil;
}

/**
 * Tulisan lencana pekerjaan. Bila yang ditampilkan lebih dari satu nama, nama
 * depan orangnya ikut disebut supaya jelas lencana itu milik siapa.
 */
export function tulisanLencanaPekerjaan(l: LencanaPekerjaanPihak, jumlahNamaTampil: number): string {
  const dasar = l.ragu ? `${l.label}?` : l.label;
  if (jumlahNamaTampil <= 1) return dasar;
  const depan = l.nama.split(/[\s,]+/).filter(Boolean)[0] ?? "";
  return depan ? `${dasar} (${depan})` : dasar;
}

/** Judul (tooltip) lencana pekerjaan - kalimat asalnya, bukan tebakan. */
export function judulLencanaPekerjaan(l: LencanaPekerjaanPihak): string {
  const asal = l.kalimat ? `${l.kalimat}.` : "";
  const ragu = l.ragu ? " Penggolongan dari teks bebas - periksa kolom pekerjaan di SIPP." : "";
  return `${l.nama}: ${asal}${ragu}`.trim();
}
