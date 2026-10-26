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

/**
 * Izin cerai PNS/ASN (PPPK)/TNI/POLRI (14 Okt 2026) - dihitung bot
 * (aleta_bot/services/izinCeraiService.js): perkara_izin_cerai SIPP, posita,
 * judul dokumen e-Court. "ada" tidak diberi lencana.
 */
export type KeadaanIzinCerai = "ada" | "belum-dicatat" | "belum-ada" | "belum-terbaca";

export type IzinCeraiBaris = {
  keadaan: KeadaanIzinCerai;
  label?: string;
  judul?: string;
  sumber?: string;
};

/** Ruas baris jadwal yang dibaca berkas ini - seluruhnya opsional (bot lama tidak mengirimnya). */
export type BahanPenandaBaris = {
  lewatEcourt?: boolean;
  ecourtTerbaca?: boolean;
  penandaPerkara?: PenandaPerkaraBaris | null;
  /** 26 Okt 2026: dari mana prodeo dikenali ("flag-sipp" | "ecourt"); hanya untuk keterangan lencana. */
  penandaProdeoSumber?: string[] | null;
  penandaPihak?: LencanaPekerjaanPihak[] | null;
  izinCerai?: IzinCeraiBaris | null;
};

export type KunciLencanaPerkara =
  | "ghaib"
  | "prodeo"
  | "non-ecourt"
  | "izin-cerai-belum-ada"
  | "izin-cerai-belum-dicatat"
  | "izin-cerai-belum-terbaca";

/** Tulisan bawaan bila bot tidak mengirim label (tetap satu sumber kata dengan bot). */
const LABEL_IZIN_CERAI: Record<Exclude<KeadaanIzinCerai, "ada">, string> = {
  "belum-ada": "Izin cerai belum ada",
  "belum-dicatat": "Izin cerai belum dicatat SIPP",
  "belum-terbaca": "Izin cerai belum terbaca",
};

export type LencanaPerkara = {
  kunci: KunciLencanaPerkara;
  label: string;
  judul: string;
};

const SEBUTAN_SUMBER_PRODEO: Record<string, string> = {
  "flag-sipp": "ditandai prodeo di SIPP",
  ecourt: "persetujuan prodeo dari e-Court",
};

/** Lencana Prodeo - satu rumusan untuk Jadwal Sidang dan Status Perkara. */
export function lencanaProdeo(sumber?: ReadonlyArray<string> | null): LencanaPerkara {
  const dikenali = (sumber ?? []).map((x) => SEBUTAN_SUMBER_PRODEO[x]).filter(Boolean);
  return {
    kunci: "prodeo",
    label: "Prodeo",
    judul: `Perkara prodeo: biaya perkara dibebaskan (ditanggung negara).${
      dikenali.length > 0 ? ` Dikenali dari: ${dikenali.join("; ")}.` : ""
    }`,
  };
}

/**
 * Lencana di samping nomor perkara, dalam urutan tetap: ghaib, prodeo, non e-Court,
 * izin cerai (14 Okt 2026). Daftar kosong bila tidak satu pun berlaku.
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
  if (p?.prodeo) hasil.push(lencanaProdeo(baris.penandaProdeoSumber));
  if (baris.ecourtTerbaca === true && baris.lewatEcourt !== true) {
    hasil.push({
      kunci: "non-ecourt",
      label: "Non e-Court",
      judul: "Perkara tidak terdaftar lewat e-Court (didaftarkan langsung). Perkara e-Court tidak diberi tanda.",
    });
  }
  const izin = baris.izinCerai;
  if (izin && izin.keadaan !== "ada" && izin.keadaan in LABEL_IZIN_CERAI) {
    hasil.push({
      kunci: `izin-cerai-${izin.keadaan}` as KunciLencanaPerkara,
      label: izin.label || LABEL_IZIN_CERAI[izin.keadaan],
      judul: izin.judul || LABEL_IZIN_CERAI[izin.keadaan],
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
