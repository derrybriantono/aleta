/**
 * NOMOR HALAMAN BAS RUNUT (keputusan pengguna 71, 1 Nov 2026) - aturan MURNI.
 *
 *   BAS sidang pertama mulai halaman 1; tiap BAS berikutnya (sidang lanjutan sampai BAS putus) mulai dari halaman TERAKHIR BAS sebelumnya
 *   + 1, termasuk lompatan halaman bukti sesudah Z cross (keputusan 59: halaman Z + jumlah halaman bukti + 1).
 *
 * Urutan BAS = urutan SIDANG (perkara_jadwal_sidang: tanggal_sidang, lalu id - sama dengan berkas perkara), BUKAN urutan cetak. Sidang ikrar
 * talak tidak ikut (BAS ikrar berkas tersendiri). Halaman terakhir tiap BAS dicatat portal tiap BAS dicetak / diunduh / diunggah
 * (tabel aleta_bas_halaman); BAS sebelumnya yang belum tercatat dihitung dari PDF e-Doc-nya di SIPP bila terbaca, selainnya dilewati -
 * keduanya diberi PERINGATAN (tidak menahan cetak).
 */

export type SidangBas = {
  id: string;
  tanggal: string; // YYYY-MM-DD
  urutan?: number;
  ikrar?: boolean;
  /** Jumlah halaman PDF e-Doc BAS di SIPP (null = belum diunggah / tidak terbaca). */
  halamanEdoc?: number | null;
};

export type CatatanHalaman = {
  sidangId: string;
  tanggal: string;
  awal: number;
  akhir: number;
};

export type HasilAwal = {
  awal: number;
  /** Urutan BAS di perkara (1 = sidang pertama); 0 = sidang tidak ditemukan di jadwal. */
  ke: number;
  dasar: "pertama" | "catatan" | "edoc" | "sebagian" | "tanpa-jadwal";
  peringatan: string[];
  /** Sidang sebelumnya yang BAS-nya belum tercatat (tanggal). */
  hilang: string[];
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function tanggalIndo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : String(iso || "");
}

/** Sidang ber-BAS (tanpa ikrar talak) urut tanggal, urutan, id. */
export function urutkanSidangBas(sidang: ReadonlyArray<SidangBas>): SidangBas[] {
  return sidang
    .filter((s) => s && !s.ikrar && /^\d{4}-\d{2}-\d{2}/.test(String(s.tanggal || "")))
    .map((s) => ({ ...s, tanggal: String(s.tanggal).slice(0, 10) }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0));
}

const cocokSidang = (s: { id?: string; tanggal?: string }, t: { sidangId?: string; tanggal?: string }): boolean =>
  t.sidangId ? String(s.id || "") === String(t.sidangId) : Boolean(t.tanggal) && String(s.tanggal || "").slice(0, 10) === String(t.tanggal).slice(0, 10);

function catatanUntuk(catatan: ReadonlyArray<CatatanHalaman>, s: SidangBas): CatatanHalaman | null {
  return catatan.find((c) => c.sidangId && c.sidangId === s.id) ?? catatan.find((c) => !c.sidangId && c.tanggal === s.tanggal) ?? null;
}

/**
 * Halaman awal BAS sidang `sasaran`. `catatan` = halaman BAS yang sudah dicetak/diunggah (per sidang).
 *   - sidang pertama -> 1;
 *   - BAS sebelumnya tercatat -> halaman terakhirnya + 1;
 *   - BAS sebelumnya belum tercatat -> mundur ke BAS tercatat terdekat; tiap BAS di antaranya dihitung dari halaman PDF e-Doc-nya (bila
 *     ada) atau dilewati (0 halaman) - peringatan menyebut sidangnya.
 */
export function hitungHalamanAwal(p: {
  sidang: ReadonlyArray<SidangBas>;
  sasaran: { sidangId?: string; tanggal?: string };
  catatan: ReadonlyArray<CatatanHalaman>;
}): HasilAwal {
  const daftar = urutkanSidangBas(p.sidang);
  let idx = daftar.findIndex((s) => cocokSidang(s, p.sasaran));
  if (idx < 0 && p.sasaran.sidangId && p.sasaran.tanggal) idx = daftar.findIndex((s) => cocokSidang(s, { tanggal: p.sasaran.tanggal }));
  if (idx < 0) {
    return {
      awal: 1,
      ke: 0,
      dasar: "tanpa-jadwal",
      peringatan: [
        `Sidang BAS ini${p.sasaran.tanggal ? ` (${tanggalIndo(p.sasaran.tanggal)})` : ""} tidak ditemukan di jadwal sidang SIPP: nomor halaman dimulai dari 1. Periksa nomor halaman sebelum dicetak.`,
      ],
      hilang: [],
    };
  }
  if (idx === 0) return { awal: 1, ke: 1, dasar: "pertama", peringatan: [], hilang: [] };

  let awal = 1;
  let dasar: HasilAwal["dasar"] = "catatan";
  const hilang: string[] = [];
  const dariEdoc: string[] = [];
  let tambahan = 0;
  let j = idx - 1;
  for (; j >= 0; j -= 1) {
    const c = catatanUntuk(p.catatan, daftar[j]);
    if (c) {
      awal = c.akhir + 1;
      break;
    }
    const e = Number(daftar[j].halamanEdoc) || 0;
    if (e > 0) {
      tambahan += e;
      dariEdoc.push(`${tanggalIndo(daftar[j].tanggal)} (${e} halaman)`);
    } else hilang.push(daftar[j].tanggal);
  }
  awal += tambahan;
  const peringatan: string[] = [];
  if (dariEdoc.length) {
    dasar = "edoc";
    peringatan.push(
      `Nomor halaman BAS sidang ${dariEdoc.reverse().join(", ")} belum tercatat dari cetakan: dihitung dari PDF e-Doc di SIPP (lompatan halaman bukti di BAS itu tidak terhitung). Halaman awal BAS ini: ${awal}.`
    );
  }
  if (hilang.length) {
    dasar = "sebagian";
    peringatan.push(
      `BAS sidang ${hilang.reverse().map(tanggalIndo).join(", ")} belum pernah dicetak, diunduh, atau diunggah: halamannya belum dapat dihitung, jadi nomor halaman BAS ini (mulai ${awal}) dihitung dari BAS yang ada. Cetak BAS sidang itu lebih dulu agar nomornya runut.`
    );
  }
  return { awal, ke: idx + 1, dasar, peringatan, hilang: hilang.slice() };
}

export type RingkasZ = {
  diubah: boolean;
  seksi?: string;
  halamanFisikZ?: number;
  nomorBagianBerikut?: number | null;
  halamanBuktiSampai?: number;
};

/**
 * Halaman TERAKHIR (nomor tampil) yang ditempati BAS ini: awal + halaman fisik - 1; bila ada Z dengan bagian sesudahnya, bagian itu bernomor
 * `nomorBagianBerikut` mulai halaman fisik Z + 1; bila Z menutup naskah, bukti sesudah halaman Z ikut ditempati (sampai halamanBuktiSampai).
 */
export type TitikNomor = { fisik: number; nomor: number };

/**
 * `peta` (keputusan 87) = bagian sesudah lampiran jawaban/replik/duplik/kesimpulan: mulai halaman fisik `fisik` dengan nomor `nomor`.
 * Nomor halaman fisik terakhir = titik nomor terakhir yang dimulai sebelum/di halaman itu + selisih halamannya.
 */
export function halamanAkhirBas(p: { awal: number; fisik: number; z?: RingkasZ | null; peta?: ReadonlyArray<TitikNomor> }): number {
  const fisik = Math.max(1, Math.floor(p.fisik) || 1);
  const titik: TitikNomor[] = [{ fisik: 1, nomor: p.awal }, ...(p.peta ?? [])];
  const z = p.z && p.z.diubah ? p.z : null;
  if (z && z.seksi && z.seksi !== "tanpa-bagian-berikut" && z.nomorBagianBerikut != null && z.halamanFisikZ) titik.push({ fisik: z.halamanFisikZ + 1, nomor: z.nomorBagianBerikut });
  titik.sort((a, b) => a.fisik - b.fisik);
  const berlaku = titik.filter((t) => t.fisik <= fisik).pop() ?? titik[0];
  let akhir = berlaku.nomor + (fisik - berlaku.fisik);
  // bagian bernomor yang dimulai sesudah halaman terakhir (lampiran/bukti di ujung naskah): halaman lampirannya tetap ditempati
  for (const t of titik) if (t.fisik > fisik) akhir = Math.max(akhir, t.nomor - 1);
  if (z && (!z.seksi || z.seksi === "tanpa-bagian-berikut" || z.nomorBagianBerikut == null)) akhir = Math.max(akhir, z.halamanBuktiSampai ?? akhir);
  return akhir;
}

/** Peringatan bila BAS sidang SESUDAHNYA sudah dicetak dengan halaman awal yang kini tidak sambung lagi. */
export function periksaSesudah(p: { sidang: ReadonlyArray<SidangBas>; sasaran: { sidangId?: string; tanggal?: string }; akhir: number; catatan: ReadonlyArray<CatatanHalaman> }): string[] {
  const daftar = urutkanSidangBas(p.sidang);
  const idx = daftar.findIndex((s) => cocokSidang(s, p.sasaran));
  if (idx < 0 || idx + 1 >= daftar.length) return [];
  const c = catatanUntuk(p.catatan, daftar[idx + 1]);
  if (!c || c.awal === p.akhir + 1) return [];
  return [
    `BAS sidang ${tanggalIndo(daftar[idx + 1].tanggal)} sudah dicetak mulai halaman ${c.awal}, padahal BAS ini kini berakhir di halaman ${p.akhir}: cetak ulang BAS sidang itu agar mulai halaman ${p.akhir + 1}.`,
  ];
}

// ----------------------------------------------------------------------------
// Mengenali perkara & sidang dari naskah (unggah BAS Word yang disunting di luar panel)
// ----------------------------------------------------------------------------
const RE_NOMOR = /\b(\d{1,5}\s*\/\s*Pdt\s*\.\s*[A-Z]{1,3}\s*\/\s*\d{4}\s*\/\s*PA\s*\.?\s*[A-Za-z]{2,6})\b/;
const RE_TANGGAL = new RegExp(`\\b(\\d{1,2})\\s+(${BULAN.join("|")})\\s+(\\d{4})\\b`, "gi");

/** Nomor perkara (dirapatkan) dan tanggal-tanggal di awal naskah (ISO, urut kemunculan). */
export function konteksDariNaskah(paragraf: ReadonlyArray<string>, batasParagraf = 40): { nomorPerkara: string; tanggal: string[] } {
  const awal = paragraf.slice(0, batasParagraf).join("\n");
  const m = RE_NOMOR.exec(awal);
  const nomorPerkara = m ? m[1].replace(/\s+/g, "").replace(/PA\.?([A-Za-z])/, "PA.$1") : "";
  const tanggal: string[] = [];
  for (const t of awal.matchAll(RE_TANGGAL)) {
    const b = BULAN.findIndex((x) => x.toLowerCase() === t[2].toLowerCase());
    const iso = `${t[3]}-${String(b + 1).padStart(2, "0")}-${String(Number(t[1])).padStart(2, "0")}`;
    if (!tanggal.includes(iso)) tanggal.push(iso);
  }
  return { nomorPerkara, tanggal };
}

/** Sidang yang dimaksud naskah: tanggal PERTAMA di naskah yang merupakan tanggal sidang perkara itu. */
export function pilihSidangDariTanggal(sidang: ReadonlyArray<SidangBas>, tanggal: ReadonlyArray<string>): SidangBas | null {
  const daftar = urutkanSidangBas(sidang);
  for (const t of tanggal) {
    const s = daftar.find((x) => x.tanggal === t);
    if (s) return s;
  }
  return null;
}
