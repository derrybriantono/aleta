/**
 * ============================================================================
 * SATU ATURAN "SIAPA PIHAK YANG DIPANGGIL" UNTUK RELAAS (20 OKT 2026)
 * ============================================================================
 *
 * Masalah (pengguna, 19 Okt): Cetak relaas di Jadwal Sidang menampilkan
 * "Dipanggil: Pihak Kedua (T)" dengan blangko "[JS] 5.2 ... T (e-Court)" untuk
 * 247/Pdt.P/2026/PA.Dgl - permohonan itsbat dengan dua Pemohon dan TANPA
 * Termohon. Bot melaporkan sidang pertama sebagai satu dokumen "keduanya"
 * (sidang pertama selalu dua pihak), lalu dialog memecahnya ke blangko P dan
 * blangko T seolah perkaranya gugatan.
 *
 * Padahal jawabannya sudah dikenal di tempat lain: panel juru sita ekstensi
 * (jurusita.js: jurusitaSebutanItsbat) dan pengumuman itsbat (14 Okt) tahu
 * bahwa permohonan voluntair (alur 16) yang tidak punya baris pihak kedua
 * hanya punya Pemohon I (+ Pemohon II bila ada dua Pemohon). Berkas ini
 * memindahkan aturan itu ke SATU fungsi yang dipakai rute dan dialog Cetak
 * relaas portal, pemilihan kunci blangko (pemetaan-cetak.ts), dan cetak massal
 * Blangko Derry - bukan dua rumus.
 *
 * ============================================================================
 * ATURANNYA
 * ============================================================================
 *
 *   bentuk "gugatan"        alur bukan 16 (Pdt.G, termasuk cerai talak dan
 *                           izin poligami yang bersebutan Pemohon/Termohon).
 *                           Pihak kedua SELALU ada; perilaku lama tidak berubah.
 *   bentuk "voluntair"      alur 16 (Pdt.P). Pihak kedua ada bila SIPP punya
 *                           baris perkara_pihak2 (Termohon: wali adhol, dst.).
 *                           Bila tidak, sisi kedua = Pemohon II hanya jika
 *                           perkara_pihak1 berisi dua orang atau lebih
 *                           (blangko T memuat #7109# = Pemohon II pada alur
 *                           16); jika hanya satu Pemohon, TIDAK ADA sisi kedua.
 *
 * Jumlah baris pihak ("jumlahPihak") datang dari bot; bot lama tanpa ruas itu
 * dinilai seperti dulu (kedua sisi ada) - tidak ditebak.
 */

import { sebutanPihakPerkara, ALUR_PERMOHONAN } from "@/lib/sebutan-pihak";

/** Ruas dokumen yang dibaca; sisanya tidak disentuh. */
export type DokumenPihakRelaas = {
  golongan?: unknown;
  pihakDipanggil?: unknown;
  alurPerkaraId?: unknown;
  jenisPerkaraId?: unknown;
  jenisPerkara?: unknown;
  nomorPerkara?: unknown;
  jumlahPihak?: { pertama?: unknown; kedua?: unknown; lain?: unknown } | null;
  sebutanPihak?: { pertama?: unknown; kedua?: unknown } | null;
  keterangan?: string[];
};

export type KedudukanSisiKedua =
  /** Gugatan / permohonan kontensius: Tergugat atau Termohon. */
  | "lawan"
  /** Permohonan voluntair beberapa Pemohon: sisi kedua = Pemohon II. */
  | "pemohon-ii"
  /** Permohonan tanpa Termohon dan hanya satu Pemohon: tidak ada pihak kedua. */
  | "tidak-ada";

export type StrukturPihakRelaas = {
  bentuk: "gugatan" | "voluntair";
  /** Dua sebutan yang dipakai layar; kedua = "" bila tidak ada sisi kedua. */
  sebutan: { pertama: string; kedua: string };
  kedua: KedudukanSisiKedua;
  /** false: sisi kedua TIDAK boleh muncul sebagai baris/pilihan. */
  adaPihakKedua: boolean;
  /** true bila jumlahPihak terbaca (bot baru); false = aturan lama dipakai apa adanya. */
  jumlahTerbaca: boolean;
};

function bilangan(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || String(nilai).trim() === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Perkara permohonan voluntair (Pdt.P): alur_perkara_id 16 - angka SIPP, bukan kata. */
export function relaasVoluntair(dok: Pick<DokumenPihakRelaas, "alurPerkaraId">): boolean {
  return Number(dok.alurPerkaraId) === ALUR_PERMOHONAN;
}

/** Sebutan dasar pasangan pihak - sumber yang sama dengan sebutan-pihak.ts; bot lama tanpa bahan memakai sebutan kirimannya. */
function sebutanDasar(dok: DokumenPihakRelaas): { pertama: string; kedua: string } {
  const bahan = {
    alurPerkaraId: dok.alurPerkaraId as number | string | null | undefined,
    jenisPerkaraId: dok.jenisPerkaraId as number | string | null | undefined,
    jenisPerkaraNama: dok.jenisPerkara as string | null | undefined,
    nomorPerkara: dok.nomorPerkara as string | null | undefined,
  };
  const hasil = sebutanPihakPerkara(bahan);
  const kiriman = {
    pertama: String(dok.sebutanPihak?.pertama ?? "").trim(),
    kedua: String(dok.sebutanPihak?.kedua ?? "").trim(),
  };
  if (hasil.sumber === "bawaan" && kiriman.pertama && kiriman.kedua) return kiriman;
  return { pertama: hasil.satu, kedua: hasil.dua };
}

/** Struktur pihak satu dokumen relaas. */
export function strukturPihakRelaas(dok: DokumenPihakRelaas): StrukturPihakRelaas {
  const dasar = sebutanDasar(dok);
  const n1 = bilangan(dok.jumlahPihak?.pertama);
  const voluntairAlur = relaasVoluntair(dok);
  // Ruas "kedua" yang tak dikirim pada permohonan voluntair dibaca 0 (aturan itsbat satu Pemohon 14 Okt memang begitu).
  const n2 = bilangan(dok.jumlahPihak?.kedua) ?? (voluntairAlur ? 0 : null);
  const jumlahTerbaca = n1 !== null && n2 !== null;

  if (!relaasVoluntair(dok) || !jumlahTerbaca) {
    return {
      bentuk: relaasVoluntair(dok) ? "voluntair" : "gugatan",
      sebutan: dasar,
      kedua: "lawan",
      adaPihakKedua: true,
      jumlahTerbaca,
    };
  }
  if ((n2 as number) > 0) {
    return { bentuk: "voluntair", sebutan: dasar, kedua: "lawan", adaPihakKedua: true, jumlahTerbaca };
  }
  if ((n1 as number) >= 2) {
    return {
      bentuk: "voluntair",
      sebutan: { pertama: `${dasar.pertama} I`, kedua: `${dasar.pertama} II` },
      kedua: "pemohon-ii",
      adaPihakKedua: true,
      jumlahTerbaca,
    };
  }
  return {
    bentuk: "voluntair",
    sebutan: { pertama: dasar.pertama, kedua: "" },
    kedua: "tidak-ada",
    adaPihakKedua: false,
    jumlahTerbaca,
  };
}

/** Sebutan satu sisi ("" bila sisi itu tidak ada). */
export function sebutanSisiRelaas(dok: DokumenPihakRelaas, sisi: "pertama" | "kedua"): string {
  return strukturPihakRelaas(dok).sebutan[sisi];
}

/**
 * Sisi kedua dibaca kunci blangko sebagai "termohon"/"tergugat" (blangko T) -
 * juga ketika sebutannya "Pemohon II". Tanpa ini sebutan "Pemohon II"
 * dianggap Pemohon dan memilih blangko P untuk kedua sisi.
 */
export function kunciKhususSisiRelaas(
  dok: DokumenPihakRelaas,
  sisi: "pertama" | "kedua"
): "pemohon" | "termohon" | "penggugat" | "tergugat" {
  const s = strukturPihakRelaas(dok);
  const permohonan = s.bentuk === "voluntair" || /pemohon|termohon/i.test(s.sebutan.pertama);
  if (sisi === "pertama") return permohonan ? "pemohon" : "penggugat";
  return permohonan ? "termohon" : "tergugat";
}

const GOLONGAN_PENGUMUMAN = "pengumuman-itsbat";

/** Keterangan baku untuk itsbat dengan satu Pemohon - teks lama dipertahankan. */
const KETERANGAN_ITSBAT_SATU = "Itsbat nikah dengan satu Pemohon - hanya Pemohon yang dipanggil.";
const KETERANGAN_TANPA_TERMOHON = "Permohonan tanpa Termohon - hanya Pemohon yang dipanggil.";
const KETERANGAN_KEDUA_TAK_ADA =
  "Permohonan tanpa Termohon dan hanya satu Pemohon: SIPP menyebut pihak kedua, tetapi tidak ada pihak kedua - pilih pihaknya dulu.";

/**
 * Menyelaraskan satu dokumen dengan struktur pihak perkaranya. Murni dan
 * idempoten (dipanggil rute DAN dialog tanpa menggandakan keterangan):
 *
 *   - sebutanPihak diisi sebutan struktur (Pemohon I / Pemohon II, dst.);
 *   - "keduanya" pada perkara tanpa sisi kedua menjadi "pertama";
 *   - "kedua" pada perkara tanpa sisi kedua menjadi "tidak-diketahui"
 *     (tidak ditebak - juru sita memilih).
 *
 * Dokumen pengumuman itsbat dan bot lama tanpa jumlahPihak tidak diubah.
 */
export function selaraskanPihakRelaas<T extends DokumenPihakRelaas>(dok: T): T {
  if (String(dok.golongan ?? "") === GOLONGAN_PENGUMUMAN) return dok;
  const s = strukturPihakRelaas(dok);
  if (!s.jumlahTerbaca) return dok;
  const sebutanPihak = { pertama: s.sebutan.pertama, kedua: s.sebutan.kedua };
  const pihak = String(dok.pihakDipanggil ?? "");
  if (s.adaPihakKedua || (pihak !== "keduanya" && pihak !== "kedua")) return { ...dok, sebutanPihak };
  const itsbat = Number(dok.jenisPerkaraId) === 360;
  const catatan =
    pihak === "keduanya" ? (itsbat ? KETERANGAN_ITSBAT_SATU : KETERANGAN_TANPA_TERMOHON) : KETERANGAN_KEDUA_TAK_ADA;
  return {
    ...dok,
    sebutanPihak,
    pihakDipanggil: pihak === "keduanya" ? "pertama" : "tidak-diketahui",
    keterangan: [...(dok.keterangan ?? []), catatan],
  };
}

/** Daftar dokumen sekaligus. */
export function selaraskanDaftarRelaas<T extends DokumenPihakRelaas>(daftar: T[]): T[] {
  return daftar.map(selaraskanPihakRelaas);
}

/**
 * Kalimat "Dipanggil: ..." / "Diberi tahu: ...". Perkara gugatan dan bot lama
 * tetap berkalimat lama; perkara permohonan memakai sebutan sebenarnya.
 */
export function labelPihakRelaas(pihak: string, dok: DokumenPihakRelaas | null | undefined, pemberitahuan: boolean): string {
  const s = dok ? strukturPihakRelaas(dok) : null;
  const voluntair = Boolean(s && s.bentuk === "voluntair" && s.jumlahTerbaca);
  if (pihak === "keduanya") {
    if (voluntair && s!.kedua === "pemohon-ii") return `${s!.sebutan.pertama} dan ${s!.sebutan.kedua}`;
    if (voluntair && s!.kedua === "lawan") return `${s!.sebutan.pertama} dan ${s!.sebutan.kedua}`;
    return "Kedua pihak";
  }
  if (pihak === "pertama") return voluntair ? s!.sebutan.pertama : "Pihak Pertama (P)";
  if (pihak === "kedua") return voluntair && s!.sebutan.kedua ? s!.sebutan.kedua : "Pihak Kedua (T)";
  if (pihak === "tidak-perlu") return "Tidak ada - semua pihak hadir";
  return pemberitahuan ? "Belum diketahui siapa yang diberi tahu" : "Belum diketahui siapa yang dipanggil";
}

/** Pilihan pihak yang boleh ditawarkan juru sita - sisi yang tidak ada tidak ditawarkan. */
export function pilihanPihakRelaas(dok: DokumenPihakRelaas): Array<"pertama" | "kedua" | "keduanya"> {
  return strukturPihakRelaas(dok).adaPihakKedua ? ["pertama", "kedua", "keduanya"] : ["pertama"];
}

/** Label pilihan pihak ("Pemohon I saja", "Kedua pihak" -> "Pemohon I dan Pemohon II"). */
export function labelPilihanPihakRelaas(pilihan: "pertama" | "kedua" | "keduanya", dok: DokumenPihakRelaas): string {
  const s = strukturPihakRelaas(dok);
  const voluntair = s.bentuk === "voluntair" && s.jumlahTerbaca;
  if (pilihan === "pertama") return voluntair ? `${s.sebutan.pertama} saja` : "Pihak Pertama (P) saja";
  if (pilihan === "kedua") return voluntair && s.sebutan.kedua ? `${s.sebutan.kedua} saja` : "Pihak Kedua (T) saja";
  return voluntair && s.sebutan.kedua ? `${s.sebutan.pertama} dan ${s.sebutan.kedua}` : "Kedua pihak";
}

/**
 * Catatan daftar relaas yang disesuaikan: catatan bot tentang dokumen
 * "keduanya" tanpa pihak kedua dibuang (ia menyebut semuanya "hanya pihak
 * pertama", padahal dua Pemohon tetap dipanggil keduanya), diganti hitungan
 * dari aturan pihak yang sama dengan baris di layar.
 */
export function catatanPihakRelaas(dokumenMentah: DokumenPihakRelaas[], catatanBot: unknown): string[] {
  const lama = (Array.isArray(catatanBot) ? catatanBot : []).map(String).filter((x) => !/tidak punya pihak kedua/.test(x));
  let hanyaPemohon = 0;
  let duaPemohon = 0;
  for (const d of dokumenMentah) {
    if (String(d.golongan ?? "") === GOLONGAN_PENGUMUMAN) continue;
    const s = strukturPihakRelaas(d);
    if (!s.jumlahTerbaca || s.bentuk !== "voluntair" || String(d.pihakDipanggil ?? "") !== "keduanya") continue;
    if (s.kedua === "tidak-ada") hanyaPemohon += 1;
    else if (s.kedua === "pemohon-ii") duaPemohon += 1;
  }
  if (hanyaPemohon > 0) {
    lama.push(
      `${hanyaPemohon} dokumen "keduanya" perkaranya permohonan tanpa Termohon dan hanya satu Pemohon - ` +
        `dipanggil Pemohon saja, tanpa blangko pihak kedua.`
    );
  }
  if (duaPemohon > 0) {
    lama.push(
      `${duaPemohon} dokumen permohonan tanpa Termohon dengan dua Pemohon - dipanggil Pemohon I dan Pemohon II ` +
        `(bukan Termohon); Pemohon II memakai blangko pihak kedua.`
    );
  }
  return lama;
}
