/**
 * ============================================================================
 * PEMERIKSA KUTIPAN DASAR HUKUM (P1 rak peraturan, keputusan pengguna 89-B5 & 90-P1, 1 Nov 2026)
 * ============================================================================
 *
 * Membaca naskah (teks polos hasil RTF), menemukan rujukan pasal (rujukan.ts), mencocokkannya dengan RAK PERATURAN
 * (rak.json - pasal yang dipakai blangko Derry, katalog saksi, kode deteksi; bunyi dari naskah resmi), lalu menandai:
 *   pasal-tidak-ada      peraturan dimuat UTUH di rak tetapi pasal itu tidak ada (nomor pasal salah)
 *   pasal-belum-di-rak   peraturan dimuat SEBAGIAN; pasal itu belum dimuat (tidak berarti salah)
 *   ayat-tak-ada         ayat yang disebut tidak ada pada pasal itu
 *   huruf-tak-ada        huruf yang disebut tidak ada pada pasal/ayat itu
 *   kutipan-beda         bunyi yang dikutip ("... berbunyi: "..."") tidak sesuai bunyi pasal/ayat/huruf yang dirujuk
 *   belum-terverifikasi  pasal ada di rak tetapi bunyinya belum dicocokkan dengan naskah resmi
 *   peraturan-belum-di-rak peraturan yang dirujuk belum ada di rak
 * TIDAK mengubah naskah. Dipakai sebagai butir info "Periksa sebelum cetak" (tidak menahan cetak) dan sebagai penyaring saran
 * pasal ALETA Ai (rujukanTerverifikasi / saringSaranPasal: hanya pasal terverifikasi yang boleh disarankan).
 *
 * KINERJA: indeks rak dibangun SEKALI (buatIndeks, disimpan di modul oleh indeks.ts); pemeriksaan satu naskah = satu sapuan
 * linear temukanRujukan + pencarian Map per butir + perbandingan kutipan berbasis himpunan pasangan kata (tanpa regex berat).
 * Dijalankan saat periksa/cetak saja, bukan tiap ketikan.
 */
import { temukanRujukan, type ButirPasal, type Rujukan } from "./rujukan";

export type StatusRak = "terverifikasi" | "belum";

export type SumberNaskah = { judul: string; url: string; diakses: string; resmi: boolean; catatan?: string };
export type PeraturanRak = {
  nama: string;
  /** utuh = semua pasal peraturan dimuat; sebagian = hanya pasal yang dipakai. */
  cakupan: "utuh" | "sebagian";
  /** Naskah berbahasa asal Belanda yang dipakai dalam terjemahan (KUHPerdata, HIR, RBg, Rv): bunyi kutipan boleh beda terjemahan. */
  terjemahan?: boolean;
  /** Nomor pasal terakhir peraturan (dari naskah) - pasal bernomor lebih besar pasti tidak ada walau cakupan sebagian. */
  pasalTerakhir?: number;
  sumber: string[];
  catatan?: string;
};
export type PasalRak = {
  peraturan: string;
  pasal: string;
  /** Bunyi batang tubuh; ayat diawali "(n)" dan huruf diawali "x." di awal baris. Kosong = belum ada naskah. */
  bunyi: string;
  status: StatusRak;
  sumber: string[];
  catatan?: string;
  /** false = teks rak mungkin terpotong (lebih pendek dari naskah): ayat/huruf yang tidak ditemukan tidak pasti. */
  lengkap?: boolean;
  /** Naskah tidak menomori ayat (paragraf saja): pemeriksaan ayat/huruf dilewati. */
  ayatTakBernomor?: boolean;
  /** Jumlah pemakaian di korpus (blangko/variabel/katalog/deteksi) saat rak disusun. */
  dipakai?: number;
};
export type DokumenRak = {
  kode: string;
  nama: string;
  /** Amar/isi pokok yang dikutip ALETA (putusan MK, SEMA). */
  bunyi: string;
  status: StatusRak;
  sumber: string[];
  catatan?: string;
};
export type Rak = {
  skema: string;
  dibuat: string;
  sumber: Record<string, SumberNaskah>;
  peraturan: Record<string, PeraturanRak>;
  pasal: PasalRak[];
  dokumen?: DokumenRak[];
};

export type JenisTemuan =
  | "pasal-tidak-ada"
  | "pasal-belum-di-rak"
  | "ayat-tak-ada"
  | "huruf-tak-ada"
  | "kutipan-beda"
  | "belum-terverifikasi"
  | "peraturan-belum-di-rak";

export type TemuanKutipan = {
  jenis: JenisTemuan;
  /** Rujukan sebagaimana tertulis (dipendekkan). */
  rujukan: string;
  /** Kunci rak "KODE|pasal". */
  kunci: string;
  letak: number;
  pesan: string;
  /** true = dasar pembanding terverifikasi (temuan dapat dipegang); false = pembandingnya sendiri belum terverifikasi. */
  pasti: boolean;
  /** kutipan-beda: bagian pasangan kata kutipan yang ditemukan di bunyi (0..1). */
  skor?: number;
  /** Banyak kemunculan temuan yang sama di naskah. */
  jumlah: number;
};

type Bagian = {
  ayat: Set<string>;
  huruf: Map<string, Set<string>>;
  /** Butir bernomor "1." per ayat ("" = tanpa ayat) - beberapa naskah memakai angka, bukan huruf. */
  angka: Map<string, Set<string>>;
  teksAyat: Map<string, string>;
  teksHuruf: Map<string, string>;
  /** Kalimat pembuka sebelum butir huruf, per ayat ("" = pasal tanpa ayat): "Bilamana perkawinan putus karena talak, maka bekas suami wajib :". */
  pembuka: Map<string, string>;
  utuh: string;
};
export type IndeksRak = {
  rak: Rak;
  pasal: Map<string, PasalRak & { bagian: Bagian }>;
  peraturan: Map<string, PeraturanRak>;
  dokumen: Map<string, DokumenRak>;
};

const kunciPasal = (kode: string, pasal: string) => `${kode}|${String(pasal).toLowerCase()}`;

/** Memecah bunyi pasal menjadi ayat & huruf. Huruf tanpa ayat disimpan di ayat "". */
export function pecahBunyi(bunyi: string): Bagian {
  const ayat = new Set<string>();
  const huruf = new Map<string, Set<string>>();
  const teksAyat = new Map<string, string>();
  const teksHuruf = new Map<string, string>();
  const angka = new Map<string, Set<string>>();
  const pembuka = new Map<string, string>();
  let ayatKini = "";
  let hurufKini = "";
  for (const barisMentah of String(bunyi || "").split("\n")) {
    const baris = barisMentah.trim();
    if (!baris) continue;
    const ma = /^\((\d{1,3}[a-z]?)\)\s*/.exec(baris);
    if (ma) {
      ayatKini = ma[1];
      hurufKini = "";
      ayat.add(ayatKini);
      teksAyat.set(ayatKini, baris.slice(ma[0].length));
      pembuka.set(ayatKini, baris.slice(ma[0].length));
      continue;
    }
    if (!pembuka.has(ayatKini) && !hurufKini) pembuka.set(ayatKini, baris);
    const mn = /^(\d{1,2})\.\s+/.exec(baris);
    if (mn) {
      if (!angka.has(ayatKini)) angka.set(ayatKini, new Set());
      angka.get(ayatKini)!.add(mn[1]);
    }
    const mh = /^([a-z])[.)]\s+/.exec(baris);
    if (mh) {
      hurufKini = mh[1];
      if (!huruf.has(ayatKini)) huruf.set(ayatKini, new Set());
      huruf.get(ayatKini)!.add(hurufKini);
      const k = `${ayatKini}|${hurufKini}`;
      teksHuruf.set(k, baris.slice(mh[0].length));
      if (ayatKini) teksAyat.set(ayatKini, `${teksAyat.get(ayatKini) || ""} ${baris}`);
      continue;
    }
    if (hurufKini) {
      const k = `${ayatKini}|${hurufKini}`;
      teksHuruf.set(k, `${teksHuruf.get(k) || ""} ${baris}`);
    }
    if (ayatKini) teksAyat.set(ayatKini, `${teksAyat.get(ayatKini) || ""} ${baris}`);
  }
  return { ayat, huruf, angka, teksAyat, teksHuruf, pembuka, utuh: String(bunyi || "") };
}

export function buatIndeks(rak: Rak): IndeksRak {
  const pasal = new Map<string, PasalRak & { bagian: Bagian }>();
  for (const p of rak.pasal || []) pasal.set(kunciPasal(p.peraturan, p.pasal), { ...p, bagian: pecahBunyi(p.bunyi) });
  return {
    rak,
    pasal,
    peraturan: new Map(Object.entries(rak.peraturan || {})),
    dokumen: new Map((rak.dokumen || []).map((d) => [d.kode, d])),
  };
}

// ── Perbandingan kutipan ──────────────────────────────────────────────────────────────────────────────────────────────
const EJAAN: Array<[RegExp, string]> = [
  [/\bisteri\b/g, "istri"],
  [/\bisterinya\b/g, "istrinya"],
  [/\bpemabok\b/g, "pemabuk"],
  [/\btatacara\b/g, "tata cara"],
  [/\bdidepan\b/g, "di depan"],
  [/\bdimuka\b/g, "di muka"],
  [/\bsesudah\b/g, "setelah"],
];
/** Kata ternormal: huruf kecil, tanpa tanda baca, ejaan lama/baru disamakan. */
export function kataNormal(t: string): string[] {
  let s = String(t || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
  for (const [re, ganti] of EJAAN) s = s.replace(re, ganti);
  // "di bawah"/"dibawah", "di peroleh"/"diperoleh": kata depan dan awalan di- disamakan (ditulis menyambung).
  s = s.replace(/\bdi ([a-z])/g, "di$1");
  return s.split(" ").filter(Boolean);
}
const pasangan = (k: string[]) => {
  const h = new Set<string>();
  for (let i = 0; i + 1 < k.length; i++) h.add(`${k[i]} ${k[i + 1]}`);
  return h;
};
/**
 * Kecocokan kutipan dengan pembanding (0..1) = rata-rata bagian KATA kutipan yang ada di pembanding dan bagian PASANGAN kata
 * berurutan yang ada. Kata saja tahan sisipan/hilangnya satu kata ("suami isteri" vs "suami dan isteri"); pasangan menjaga
 * urutan. Kutipan boleh sebagian (dipotong "...").
 */
export function skorKutipan(kutipan: string, pembanding: string): number {
  const bagian = String(kutipan || "").split(/\.{3}|…/);
  const kataTarget = kataNormal(pembanding);
  const target = pasangan(kataTarget);
  const himpunanKata = new Set(kataTarget);
  let ada = 0;
  let semua = 0;
  let adaKata = 0;
  let semuaKata = 0;
  for (const b of bagian) {
    const k = kataNormal(b);
    for (let i = 0; i < k.length; i++) {
      semuaKata++;
      if (himpunanKata.has(k[i])) adaKata++;
      if (i + 1 < k.length) {
        semua++;
        if (target.has(`${k[i]} ${k[i + 1]}`)) ada++;
      }
    }
  }
  if (!semuaKata) return 1;
  return ((semua ? ada / semua : 1) + adaKata / semuaKata) / 2;
}
export const AMBANG_KUTIPAN = 0.85;
const MIN_KATA_KUTIPAN = 6;

const pendek = (t: string, n = 90) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const sebutButir = (b: ButirPasal) =>
  `Pasal ${b.pasal}${b.ayat.length ? ` ayat ${b.ayat.map((a) => `(${a})`).join(", ")}` : ""}${b.huruf.length ? ` huruf ${b.huruf.join(", ")}` : ""}`;

/** Teks pembanding paling khusus untuk satu butir. */
function pembandingButir(e: { bagian: Bagian }, b: ButirPasal): string {
  const g = e.bagian;
  const potong: string[] = [];
  if (b.huruf.length) {
    const ayatDicari = b.ayat.length ? b.ayat : [...g.huruf.keys()];
    for (const a of ayatDicari) {
      let adaDiAyat = false;
      for (const h of b.huruf) {
        const t = g.teksHuruf.get(`${a}|${h}`);
        if (t) {
          if (!adaDiAyat && g.pembuka.get(a)) potong.push(g.pembuka.get(a)!);
          adaDiAyat = true;
          potong.push(t);
        }
      }
    }
  } else if (b.ayat.length) {
    for (const a of b.ayat) {
      const t = g.teksAyat.get(a);
      if (t) potong.push(t);
    }
  }
  return potong.length ? potong.join(" ") : g.utuh;
}

export type OpsiPeriksa = {
  /** Sertakan temuan info (belum-terverifikasi, pasal-belum-di-rak, peraturan-belum-di-rak). Bawaan true. */
  info?: boolean;
};

/** Memeriksa satu rujukan; temuan dikembalikan tanpa penggabungan. */
export function periksaRujukan(idx: IndeksRak, r: Rujukan, s?: string): Omit<TemuanKutipan, "jumlah">[] {
  const hasil: Omit<TemuanKutipan, "jumlah">[] = [];
  if (!r.peraturan || r.penjelasan) return hasil;
  const kode = r.peraturan;
  const rujukanTeks = pendek(r.teks, 120);
  const per = idx.peraturan.get(kode);
  if (!per) {
    hasil.push({ jenis: "peraturan-belum-di-rak", rujukan: rujukanTeks, kunci: `${kode}|`, letak: r.mulai, pesan: `${r.namaTertulis || kode} belum ada di rak peraturan.`, pasti: false });
    return hasil;
  }
  const kutipanSah = r.kutipan && kataNormal(r.kutipan).length >= MIN_KATA_KUTIPAN ? r.kutipan : null;
  const pembanding: string[] = [];
  let semuaAda = true;
  let semuaPasti = true;
  for (const b of r.butir) {
    const daftarPasal = [b.pasal, ...(b.rentangKe ? [b.rentangKe] : [])];
    for (const nomor of daftarPasal) {
      const kunci = kunciPasal(kode, nomor);
      const e = idx.pasal.get(kunci);
      if (!e) {
        semuaAda = false;
        const angkaPasal = parseInt(nomor, 10);
        hasil.push(
          per.cakupan === "utuh" || (per.pasalTerakhir && angkaPasal > per.pasalTerakhir)
            ? { jenis: "pasal-tidak-ada", rujukan: rujukanTeks, kunci, letak: r.mulai, pesan: `Pasal ${nomor} tidak ada dalam ${per.nama}.`, pasti: true }
            : { jenis: "pasal-belum-di-rak", rujukan: rujukanTeks, kunci, letak: r.mulai, pesan: `Pasal ${nomor} ${per.nama} belum dimuat di rak peraturan.`, pasti: false }
        );
        continue;
      }
      const pasti = e.status === "terverifikasi";
      if (!pasti) {
        semuaPasti = false;
        hasil.push({ jenis: "belum-terverifikasi", rujukan: rujukanTeks, kunci, letak: r.mulai, pesan: `Bunyi Pasal ${nomor} ${per.nama} di rak belum dicocokkan dengan naskah resmi.`, pasti: false });
      }
      if (!e.bunyi.trim() || nomor !== b.pasal) continue;
      if (e.ayatTakBernomor) {
        pembanding.push(e.bunyi);
        continue;
      }
      const g = e.bagian;
      // Teks rak belum tentu lengkap (digitalisasi terpotong): ayat/huruf yang tidak ditemukan tidak dapat dipegang.
      const pastiBagian = pasti && e.lengkap !== false;
      const ayatSah: string[] = [];
      for (const a of b.ayat) {
        if (g.ayat.has(a)) ayatSah.push(a);
        else if (e.lengkap === false) continue;
        else
          hasil.push({
            jenis: "ayat-tak-ada",
            rujukan: rujukanTeks,
            kunci,
            letak: r.mulai,
            pesan: g.ayat.size
              ? `Pasal ${nomor} ${per.nama} tidak memiliki ayat (${a}) - ayatnya (${[...g.ayat].join("), (")}).`
              : g.angka.get("")?.has(a)
                ? `Pasal ${nomor} ${per.nama} tidak berayat; butirnya bernomor angka - yang dimaksud mungkin "angka ${a}", bukan "ayat ${a}".`
                : `Pasal ${nomor} ${per.nama} tidak berayat, tetapi dirujuk ayat (${a}).`,
            pasti: pastiBagian,
          });
      }
      for (const h of b.huruf) {
        const tempat = (b.ayat.length ? ayatSah : [...g.huruf.keys()]).filter((a) => g.huruf.get(a)?.has(h));
        if (!tempat.length && e.lengkap !== false) {
          const tempatAyat = b.ayat.length ? ayatSah : [...new Set([...g.huruf.keys(), ...g.angka.keys(), ""])];
          const ada = tempatAyat.flatMap((a) => [...(g.huruf.get(a) || [])]);
          const angka = tempatAyat.flatMap((a) => [...(g.angka.get(a) || [])]);
          hasil.push({
            jenis: "huruf-tak-ada",
            rujukan: rujukanTeks,
            kunci,
            letak: r.mulai,
            pesan: ada.length
              ? `${sebutButir({ ...b, huruf: [] })} ${per.nama} tidak memiliki huruf ${h} - hurufnya ${ada.join(", ")}.`
              : angka.length
                ? `${sebutButir({ ...b, huruf: [] })} ${per.nama} memakai butir angka ${angka.join(", ")} (bukan huruf) menurut naskah rak, tetapi dirujuk huruf ${h}.`
                : `${sebutButir({ ...b, huruf: [] })} ${per.nama} tidak memuat huruf, tetapi dirujuk huruf ${h}.`,
            // Naskah berbutir angka: penomoran naskah lain (huruf) mungkin berbeda - tidak pasti.
            pasti: pastiBagian && !angka.length,
          });
        }
      }
      pembanding.push(pembandingButir(e, { ...b, ayat: ayatSah }));
    }
  }
  if (kutipanSah && semuaAda && pembanding.length) {
    const skor = skorKutipan(kutipanSah, pembanding.join(" "));
    if (skor < AMBANG_KUTIPAN) {
      // Bunyi kutipan ada di pasal yang sama tetapi di ayat/huruf lain = rujukan ayat/huruf yang meleset.
      const seluruh = r.butir
        .map((b) => idx.pasal.get(kunciPasal(kode, b.pasal)))
        .filter(Boolean)
        .map((e) => e!.bunyi)
        .join(" ");
      const skorSeluruh = skorKutipan(kutipanSah, seluruh);
      hasil.push({
        jenis: "kutipan-beda",
        rujukan: rujukanTeks,
        kunci: kunciPasal(kode, r.butir[0].pasal),
        letak: r.mulai,
        pesan:
          skorSeluruh >= AMBANG_KUTIPAN
            ? `Bunyi yang dikutip ("${pendek(kutipanSah, 70)}") ada di ${r.butir.length > 1 ? "pasal-pasal" : "pasal"} itu tetapi bukan di ayat/huruf yang dirujuk.`
            : `Bunyi yang dikutip ("${pendek(kutipanSah, 70)}") tidak sesuai bunyi ${r.butir.map(sebutButir).join(", ")} ${per.nama} (kecocokan ${Math.round(skor * 100)}%).`,
        // Terjemahan (KUHPerdata, HIR, RBg) boleh berbeda kata dengan terjemahan lain - tidak pasti.
        pasti: semuaPasti && !per.terjemahan,
        skor: Math.round(skor * 100) / 100,
      });
    }
  }
  void s;
  // Peraturan ditafsir dari rujukan sesudah "jo." - temuan tidak dapat dipegang penuh.
  if (r.ikutBerikut) for (const t of hasil) t.pasti = false;
  return hasil;
}

const INFO: ReadonlySet<JenisTemuan> = new Set(["belum-terverifikasi", "pasal-belum-di-rak", "peraturan-belum-di-rak"]);
export const jenisInfo = (j: JenisTemuan) => INFO.has(j);

/** Semua temuan di naskah, digabung per (jenis, kunci, pesan) dengan jumlah kemunculan; urut menurut letak pertama. */
export function periksaKutipan(idx: IndeksRak, teks: string, opsi: OpsiPeriksa = {}): TemuanKutipan[] {
  const info = opsi.info !== false;
  const gabung = new Map<string, TemuanKutipan>();
  for (const r of temukanRujukan(teks)) {
    for (const t of periksaRujukan(idx, r)) {
      if (!info && INFO.has(t.jenis)) continue;
      const k = `${t.jenis}|${t.kunci}|${t.pesan}`;
      const ada = gabung.get(k);
      if (ada) ada.jumlah++;
      else gabung.set(k, { ...t, jumlah: 1 });
    }
  }
  return [...gabung.values()].sort((a, b) => a.letak - b.letak);
}

/**
 * Untuk ALETA Ai (C5 dan draf putusan): rujukan BOLEH disarankan hanya bila setiap pasalnya ada di rak, TERVERIFIKASI,
 * dan ayat/hurufnya ada. Teks yang tidak memuat rujukan pasal dengan peraturan yang dikenali = tidak boleh.
 */
export function rujukanTerverifikasi(idx: IndeksRak, teksRujukan: string): { boleh: boolean; sebab: string } {
  const daftar = temukanRujukan(teksRujukan).filter((r) => r.peraturan && !r.penjelasan);
  if (!daftar.length) return { boleh: false, sebab: "rujukan pasal tidak dikenali" };
  for (const r of daftar) {
    const t = periksaRujukan(idx, r);
    if (t.length) return { boleh: false, sebab: t[0].pesan };
  }
  return { boleh: true, sebab: "" };
}

/** Saringan saran pasal ALETA Ai: yang terverifikasi lolos, sisanya ditolak beserta sebabnya. */
export function saringSaranPasal(idx: IndeksRak, saran: readonly string[]): { boleh: string[]; ditolak: Array<{ teks: string; sebab: string }> } {
  const boleh: string[] = [];
  const ditolak: Array<{ teks: string; sebab: string }> = [];
  for (const s of saran) {
    const v = rujukanTerverifikasi(idx, s);
    if (v.boleh) boleh.push(s);
    else ditolak.push({ teks: s, sebab: v.sebab });
  }
  return { boleh, ditolak };
}

/** Bunyi pasal terverifikasi dari rak (untuk dikutip ALETA Ai); null bila tidak ada/ belum terverifikasi. */
export function bunyiTerverifikasi(idx: IndeksRak, kode: string, pasal: string): string | null {
  const e = idx.pasal.get(kunciPasal(kode, pasal));
  return e && e.status === "terverifikasi" && e.bunyi.trim() ? e.bunyi : null;
}
