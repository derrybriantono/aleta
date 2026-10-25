import { hurufAlasan } from "@/lib/set-pertanyaan-saksi";
import { jenisKunci, labelJenis } from "@/lib/ketepatan-isian";

/**
 * ============================================================================
 * HURUF ALASAN PERCERAIAN YANG BELAJAR DARI HAKIM - ATURAN MURNI
 * (25 Okt 2026, rantai D butir D4 = U14)
 * ============================================================================
 *
 * Berkas ini hanya aturan: tanpa basis data dan tanpa jaringan. Penyimpanan dan pembacaan di
 * src/server/modules/aleta-ecourt/huruf-alasan-belajar.ts.
 *
 * Huruf alasan perceraian (isian 8503, A-H) adalah KEPUTUSAN HAKIM. Mesin hanya menyarankan huruf dari posita
 * dan keterangan saksi (bot, usulan "ragu"), dan tidak pernah menulisnya sendiri. Berkas ini menambahkan
 * PERTIMBANGAN dari kebiasaan pemilihan yang sudah tercatat di jejak isian (C1):
 *
 *   pola     dari perkara sejenis yang mesinnya mengusulkan huruf yang sama, huruf apa yang akhirnya dipilih
 *            majelis (kecocokan usulan mesin dengan pilihan akhir);
 *   hakim    huruf yang paling sering DIPILIH hakim yang sedang membuka perkara, pada jenis perkara yang sama;
 *   majelis  idem, dari anggota majelis lain perkara ini.
 *
 * Hasilnya TETAP USULAN: kalimat pertimbangan + tombol "Pakai huruf ..." yang ditekan hakim sendiri. Tidak
 * ada yang diisi, diubah, atau disimpan ke ABT tanpa tindakan hakim. Pilihan hakim/majelis tidak pernah
 * diperingkat atau dibandingkan antar hakim: layar Admin hanya menampilkan kecocokan per pola, dan kebiasaan
 * seorang hakim hanya tampil kepada hakim itu sendiri (dan, tanpa nama, sebagai "anggota majelis lain").
 *
 * Dasar hukum per huruf disarankan dari pustaka pertimbangan (0026); yang belum disahkan, atau yang rujukan
 * pasalnya belum terbukti ada di pustaka hukum, ditandai [PERLU VERIFIKASI].
 */

export const KODE_FITUR_HURUF_BELAJAR = "huruf-alasan-belajar";
export const KODE_HURUF_ALASAN = "8503";

/** Perkara sejenis dengan pola yang sama sekurangnya sekian sebelum pola dipakai sebagai pertimbangan. */
export const MIN_POLA = 10;
export const RASIO_POLA = 0.6;
/** Pilihan hakim/majelis sendiri pada jenis perkara yang sama. */
export const MIN_HAKIM = 5;
export const RASIO_HAKIM = 0.6;
export const BATAS_BARIS = 20000;
export const MAKS_DASAR_HUKUM = 3;

export const TANDA_PERLU_VERIFIKASI = "[PERLU VERIFIKASI]";

const teks = (x: unknown): string => String(x ?? "").trim();

/** Himpunan huruf alasan dari teks isian (A-H, terurut, unik); "" bila tak terbaca. Sama dengan ekstensi. */
export const himpunanHuruf = (x: unknown): string => hurufAlasan(String(x ?? ""));

export type BarisHuruf = {
  /** Kunci jenis perkara (ketepatan-isian jenisKunci). */
  jenis: string;
  /** Huruf yang diusulkan/disarankan saat disimpan ("" bila tak ada). */
  usulan: string;
  /** Huruf yang akhirnya disimpan hakim. */
  akhir: string;
  oleh: string;
  olehNama: string;
  pada: string;
};

/** Baris jejak mentah -> BarisHuruf; null bila huruf akhir tak terbaca. */
export function bentukBarisHuruf(m: { jenis_perkara?: unknown; nilai_usulan?: unknown; nilai_final?: unknown; pengguna_id?: unknown; pengguna_nama?: unknown; pada?: unknown }): BarisHuruf | null {
  const akhir = himpunanHuruf(m.nilai_final);
  if (!akhir) return null;
  return { jenis: jenisKunci(m.jenis_perkara), usulan: himpunanHuruf(m.nilai_usulan), akhir, oleh: teks(m.pengguna_id), olehNama: teks(m.pengguna_nama), pada: teks(m.pada) };
}

export type SebaranHuruf = { huruf: string; n: number; persen: number };

function sebaran(baris: BarisHuruf[]): SebaranHuruf[] {
  const hitung = new Map<string, number>();
  for (const b of baris) hitung.set(b.akhir, (hitung.get(b.akhir) ?? 0) + 1);
  const total = baris.length;
  return Array.from(hitung, ([huruf, n]) => ({ huruf, n, persen: total ? Math.round((n / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.n - a.n || a.huruf.localeCompare(b.huruf));
}

export type StatistikPola = {
  jenis: string;
  usulan: string;
  /** Perkara sejenis yang mesinnya mengusulkan huruf ini. */
  n: number;
  /** Pilihan akhir sama dengan usulan mesin. */
  cocok: number;
  /** cocok / n, 0..100 (1 desimal); null bila n = 0. */
  persenCocok: number | null;
  sebaran: SebaranHuruf[];
};

/** Kecocokan usulan mesin dengan pilihan akhir untuk SATU pola (jenis perkara + huruf usulan). */
export function statistikPola(baris: BarisHuruf[], jenis: string, usulan: string): StatistikPola {
  const sama = baris.filter((b) => b.jenis === jenis && b.usulan === usulan && usulan !== "");
  const cocok = sama.filter((b) => b.akhir === b.usulan).length;
  return { jenis, usulan, n: sama.length, cocok, persenCocok: sama.length ? Math.round((cocok / sama.length) * 1000) / 10 : null, sebaran: sebaran(sama) };
}

/** Semua pola yang pernah tercatat (untuk layar Admin): per jenis perkara + huruf usulan, terbanyak dahulu. Tanpa nama hakim. */
export function ringkasPerPola(baris: BarisHuruf[]): StatistikPola[] {
  const kunci = new Set<string>();
  for (const b of baris) if (b.usulan) kunci.add(`${b.jenis}|${b.usulan}`);
  return Array.from(kunci, (k) => {
    const [jenis, usulan] = k.split("|");
    return statistikPola(baris, jenis, usulan);
  }).sort((a, b) => b.n - a.n || a.jenis.localeCompare(b.jenis) || a.usulan.localeCompare(b.usulan));
}

export type Pertimbangan = {
  sumber: "hakim" | "majelis" | "pola";
  huruf: string;
  n: number;
  dari: number;
  persen: number;
  /** Huruf ini sama dengan usulan mesin. */
  sejalan: boolean;
  kalimat: string;
};

function puncak(baris: BarisHuruf[], min: number, rasio: number): { huruf: string; n: number; dari: number; persen: number } | null {
  if (baris.length < min) return null;
  const teratas = sebaran(baris)[0];
  if (!teratas || teratas.n / baris.length < rasio) return null;
  return { huruf: teratas.huruf, n: teratas.n, dari: baris.length, persen: teratas.persen };
}

export type MasukanBelajar = {
  baris: BarisHuruf[];
  /** Kunci jenis perkara (jenisKunci) perkara yang dibuka. */
  jenis: string;
  /** Huruf yang disarankan mesin untuk perkara ini ("" bila tak ada). */
  hurufMesin: string;
  /** Hakim yang membuka perkara. */
  hakimId: string;
  /**
   * Teks susunan majelis perkara ini (mis. "Hakim Satu, S.H., Hakim Dua, M.H."); sebuah pilihan lama dihitung "anggota
   * majelis lain" bila nama pemilihnya termuat di teks ini. Hakim sendiri dikeluarkan lewat hakimId.
   */
  majelis: string[];
};

export type HasilBelajar = {
  jenis: string;
  jenisLabel: string;
  hurufMesin: string;
  pola: StatistikPola;
  pertimbangan: Pertimbangan[];
  /** Usulan huruf yang BERBEDA dari mesin (pertimbangan terkuat: hakim, lalu majelis, lalu pola); null bila tak ada. */
  usulanBeda: { huruf: string; sumber: Pertimbangan["sumber"]; kalimat: string } | null;
};

const bakuNama = (x: unknown) => teks(x).toLowerCase().replace(/\s+/g, " ");

/** Menyusun pertimbangan dari jejak. Murni; tetap usulan. */
export function susunBelajar(m: MasukanBelajar): HasilBelajar {
  const jenisLabel = labelJenis(m.jenis);
  const pola = statistikPola(m.baris, m.jenis, m.hurufMesin);
  const hasil: Pertimbangan[] = [];
  const sejalan = (h: string) => Boolean(m.hurufMesin) && h === m.hurufMesin;

  // 1. hakim sendiri, jenis perkara yang sama: pilih yang sejalan dengan usulan mesin bila cukup data, selain itu semua usulan.
  const hakimJenis = m.baris.filter((b) => b.jenis === m.jenis && b.oleh === m.hakimId && m.hakimId);
  const hakimPola = m.hurufMesin ? hakimJenis.filter((b) => b.usulan === m.hurufMesin) : [];
  const pH = puncak(hakimPola, MIN_HAKIM, RASIO_HAKIM);
  const pH2 = pH ?? puncak(hakimJenis, MIN_HAKIM, RASIO_HAKIM);
  if (pH2) {
    const dari = pH ? `dari ${pH2.dari} perkara ${jenisLabel} yang diusulkan huruf ${m.hurufMesin}` : `dari ${pH2.dari} perkara ${jenisLabel} sebelumnya`;
    hasil.push({ ...pH2, sumber: "hakim", sejalan: sejalan(pH2.huruf), kalimat: `Anda memilih huruf ${pH2.huruf} pada ${pH2.n} ${dari} (${pH2.persen}%).` });
  }

  // 2. anggota majelis lain.
  const teksMajelis = m.majelis.map(bakuNama).filter(Boolean);
  const anggota = (nama: string) => {
    const n = bakuNama(nama);
    return n.length >= 4 && teksMajelis.some((t) => t.includes(n));
  };
  const lain = m.baris.filter((b) => b.jenis === m.jenis && b.oleh !== m.hakimId && anggota(b.olehNama));
  const lainPola = m.hurufMesin ? lain.filter((b) => b.usulan === m.hurufMesin) : [];
  const pM = puncak(lainPola, MIN_HAKIM, RASIO_HAKIM);
  const pM2 = pM ?? puncak(lain, MIN_HAKIM, RASIO_HAKIM);
  if (pM2) {
    const dari = pM ? `dari ${pM2.dari} perkara ${jenisLabel} yang diusulkan huruf ${m.hurufMesin}` : `dari ${pM2.dari} perkara ${jenisLabel} sebelumnya`;
    hasil.push({ ...pM2, sumber: "majelis", sejalan: sejalan(pM2.huruf), kalimat: `Anggota majelis lain memilih huruf ${pM2.huruf} pada ${pM2.n} ${dari} (${pM2.persen}%).` });
  }

  // 3. pola: kecocokan usulan mesin dengan pilihan akhir di semua hakim.
  const pP = m.hurufMesin ? puncak(m.baris.filter((b) => b.jenis === m.jenis && b.usulan === m.hurufMesin), MIN_POLA, RASIO_POLA) : null;
  if (pP) {
    const kalimat =
      pP.huruf === m.hurufMesin
        ? `Dari ${pP.dari} perkara ${jenisLabel} yang diusulkan huruf ${m.hurufMesin}, majelis memilih huruf yang sama pada ${pP.n} perkara (${pP.persen}%).`
        : `Dari ${pP.dari} perkara ${jenisLabel} yang diusulkan huruf ${m.hurufMesin}, majelis akhirnya memilih huruf ${pP.huruf} pada ${pP.n} perkara (${pP.persen}%).`;
    hasil.push({ ...pP, sumber: "pola", sejalan: sejalan(pP.huruf), kalimat });
  }

  const beda = hasil.find((p) => !p.sejalan) ?? null;
  return { jenis: m.jenis, jenisLabel, hurufMesin: m.hurufMesin, pola, pertimbangan: hasil, usulanBeda: beda ? { huruf: beda.huruf, sumber: beda.sumber, kalimat: beda.kalimat } : null };
}

// ─── Dasar hukum per huruf ──────────────────────────────────────────────────

export type RujukanPustaka = { tertulis: string; pasal: string; ayat: string; huruf: string; peraturan: string; terbukti: boolean };
export type ButirPustaka = { id: string; keadaan: string; jumlahPemakaian: number; rujukan: RujukanPustaka[] };

export type DasarHukum = {
  teks: string;
  perluVerifikasi: boolean;
  /** Berapa butir pustaka merujuknya. */
  butir: number;
  pemakaian: number;
};

function rumusRujukan(r: RujukanPustaka): string {
  const t = teks(r.tertulis);
  if (t) return t.replace(/\s+/g, " ");
  const bagian = [r.pasal ? `Pasal ${r.pasal}` : "", r.ayat ? `ayat (${r.ayat})` : "", r.huruf ? `huruf ${r.huruf}` : "", r.peraturan].filter(Boolean);
  return bagian.join(" ");
}

/**
 * Saran dasar hukum untuk SATU huruf dari butir pustaka berlabel huruf itu. Hanya yang butirnya DISAHKAN dan rujukannya
 * TERBUKTI ada di pustaka hukum yang lolos tanpa tanda; yang lain tetap disebut tetapi ditandai [PERLU VERIFIKASI].
 * Rujukan yang menunjuk huruf yang sama (mis. "huruf f") didahulukan. Murni.
 */
export function susunDasarHukum(huruf: string, butir: ButirPustaka[], maks = MAKS_DASAR_HUKUM): DasarHukum[] {
  const kecil = huruf.toLowerCase();
  const peta = new Map<string, DasarHukum & { cocokHuruf: boolean }>();
  for (const b of butir) {
    for (const r of b.rujukan) {
      const rumus = rumusRujukan(r);
      if (!rumus) continue;
      const kunci = rumus.toLowerCase();
      const aman = b.keadaan === "disahkan" && r.terbukti;
      const w = peta.get(kunci) ?? { teks: rumus, perluVerifikasi: true, butir: 0, pemakaian: 0, cocokHuruf: teks(r.huruf).toLowerCase() === kecil };
      w.butir += 1;
      w.pemakaian += Math.max(0, b.jumlahPemakaian);
      // Tanda hilang hanya bila SEMUA butir yang merujuknya aman.
      w.perluVerifikasi = w.butir === 1 ? !aman : w.perluVerifikasi || !aman;
      peta.set(kunci, w);
    }
  }
  return Array.from(peta.values())
    .sort((a, b) => Number(b.cocokHuruf) - Number(a.cocokHuruf) || b.butir - a.butir || b.pemakaian - a.pemakaian || a.teks.localeCompare(b.teks))
    .slice(0, maks)
    .map((d) => ({ teks: d.perluVerifikasi ? `${d.teks} ${TANDA_PERLU_VERIFIKASI}` : d.teks, perluVerifikasi: d.perluVerifikasi, butir: d.butir, pemakaian: d.pemakaian }));
}
