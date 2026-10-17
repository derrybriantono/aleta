/**
 * ============================================================================
 * PUTUSAN ADVANCE - TAHAP 2: DRAF PUTUSAN UTUH (17 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: "Putusan Advance: pemeriksa dulu, lalu DRAF UTUH."
 * Tahap pertama (putusan-advance.ts) hanya MEMERIKSA draf Blangko Derry.
 * Tahap ini, SESUDAH pemeriksa selesai, menyusun draf putusan utuh yang dapat
 * diunduh sebagai RTF dan dibuka di ABT/Word:
 *
 *   kepala dan identitas   dari naskah blangko Derry yang dipilih untuk
 *                          perkara itu (disusun ABT, bukan ditulis ulang di
 *                          sini); bila tidak terbaca, kepalaPutusan (Putusan
 *                          Mandiri) atau penanda "perlu dilengkapi";
 *   duduk perkara          uraian gugatan, jawaban, replik/duplik, dan BAS
 *                          yang SUDAH dirangkai blangko itu (pembangun naskah
 *                          Blangko Derry); isian yang masih kosong ditandai;
 *   pertimbangan hukum     naskah blangko + hasil pemeriksa: tiap unsur yang
 *                          belum dipertimbangkan diberi alinea contoh (pustaka
 *                          yang disahkan atau putusan BHT hakim sendiri, nama
 *                          sudah disamarkan) DAN penanda, dasar hukum yang
 *                          perlu diperiksa, dan rujukan putusan serupa;
 *   amar dan biaya         dari naskah blangko; ketidakcocokan dengan
 *                          pertimbangan hasil pemeriksa ditandai.
 *
 * ============================================================================
 * YANG BELUM PASTI DITANDAI, TIDAK DIKARANG
 * ============================================================================
 *
 * Satu bentuk penanda: "[perlu dilengkapi: ...]" (kurung siku, <= 190 huruf,
 * tanpa kurung di dalamnya) pada paragraf tersendiri BERWARNA MERAH. Bentuk itu
 * sengaja dipilih sama dengan yang dikenali deteksi sisa blangko
 * (deteksi-sisa-blangko.ts): kurung siku DAN tulisan merah - jadi peringatan
 * "masih ada sisa blangko" muncul sebelum draf ini diunggah ke ABT/SIPP.
 * Alinea contoh juga dibuat merah: ia milik perkara lain dan WAJIB disesuaikan.
 *
 * Tidak ada pasal atau yurisprudensi yang ditulis modul ini. Dasar hukum yang
 * tampil hanya yang sudah ada di katalog unsur (putusan-advance.ts), di naskah
 * blangko, atau di putusan serupa hakim sendiri; selebihnya penanda.
 *
 * ============================================================================
 * TIDAK ADA TANDA APLIKASI DI NASKAH
 * ============================================================================
 *
 * Keputusan 17 Okt butir 45: tidak satu kata nama aplikasi ini boleh sampai ke
 * SIPP/ABT, termasuk isi RTF, properti berkas, dan nama berkas unduhan. Semua
 * tulisan yang DISUSUN di sini (penanda, judul bagian, label sumber contoh,
 * nama berkas) diperiksa menyebutAleta; yang menyebutnya diganti kalimat
 * netral. Teks yang datang dari naskah blangko / data SIPP (mis. nama pihak
 * yang kebetulan memuat kata itu) dibiarkan: itu data perkara, bukan tanda.
 *
 * Murni: tanpa basis data dan tanpa jaringan. Rute memanggilnya dengan rapor
 * yang DIHITUNG ULANG di sisi peladen (rute /putusan/advance, tindakan "draf").
 */
import { rtfKeBita, lariRtf } from "@/lib/hasil-mediasi-rtf";
import { langkahUntukIsian, type KodeLangkah } from "@/lib/konseptor-langkah";
import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";
import { periksaRtf, ringkasJenis } from "@/lib/deteksi-sisa-blangko";
import { alineaDari, type RaporAdvance, type TemuanAdvance } from "@/lib/putusan-advance";
import { kepalaPutusan } from "@/lib/susunan-putusan";
import { menyebutAleta } from "@/lib/tanda-aleta";

// ----------------------------------------------------------------------------
// Jenis
// ----------------------------------------------------------------------------
export type KunciBagianDraf = "kepala" | "identitas" | "dudukPerkara" | "pertimbangan" | "amar" | "biaya" | "penutup";

export type ParagrafDraf = {
  teks: string;
  /** naskah = datang dari blangko Derry; susun = ditulis modul ini (judul, penanda, alinea contoh). */
  asal: "naskah" | "susun";
  /** true = penanda "[perlu dilengkapi: ...]". */
  tanda?: boolean;
  /** Berwarna merah di RTF (penanda dan alinea contoh). */
  merah?: boolean;
  /** Alinea contoh dari pustaka / putusan serupa (bukan naskah perkara ini). */
  contoh?: boolean;
  gaya?: "judul" | "tengah" | "isi" | "amar";
};

export type BagianDraf = { kunci: KunciBagianDraf; judul: string; paragraf: ParagrafDraf[]; jumlahTanda: number };

export type TandaDraf = { bagian: KunciBagianDraf; judul: string; teks: string };

export type IsianKosong = { kode?: string; nama?: string; jenis?: string; khusus?: string };
export type BahanIsian = { kode?: string; nama?: string; teks?: string; jenis?: string; khusus?: string };

export type MasukanDrafUtuh = {
  nomorPerkara: string;
  /** Teks naskah draf Blangko Derry (hasil membaca RTF-nya). */
  naskah: string;
  /** Rapor pemeriksa (dihitung peladen atas naskah yang sama). */
  rapor: RaporAdvance;
  /** Nama pengadilan, bila kepala naskah tidak terbaca. */
  pengadilan?: string;
  /** Isian blangko yang masih kosong (menurut Blangko Derry). */
  isianKosong?: IsianKosong[];
  /** Isian blangko teks yang terisi - dipakai hanya bila duduk perkara naskah tidak terbaca. */
  bahan?: BahanIsian[];
};

export type RujukanSerupa = { nomor: string; tanggalBht: string; sama: string[]; beda: string[] };

export type DrafUtuh = {
  nomorPerkara: string;
  namaBerkas: string;
  bagian: BagianDraf[];
  tanda: TandaDraf[];
  jumlahTanda: number;
  /** Putusan serupa (BHT, hakim yang sama) yang menjadi pembanding pemeriksa. */
  serupa: RujukanSerupa[];
  /** Hasil deteksi sisa blangko atas RTF yang dihasilkan - peringatan yang akan muncul saat unggah. */
  sisa: { jumlah: number; rincian: Array<{ jenis: string; label: string; jumlah: number }> };
  /** Kalimat ringkas untuk layar. */
  ringkas: string;
  /** Penjelasan bagian yang tidak bisa disusun (naskah bagian hilang, dst.). */
  catatan: string[];
  rtf: string;
};

// ----------------------------------------------------------------------------
// Penanda
// ----------------------------------------------------------------------------
const AWAL_TANDA = "[perlu dilengkapi: ";
/** Kurung siku yang dikenali deteksi sisa blangko panjang isinya paling banyak 200 huruf. */
const BATAS_TANDA = 190;
const NETRAL = "bagian ini belum lengkap, lengkapi dari berkas perkara";

const teks = (x: unknown) => String(x ?? "").trim();

/** "[perlu dilengkapi: isi]" - tanpa kurung di dalamnya, pas di bawah batas deteksi, tanpa tanda aplikasi. */
export function tandaPerlu(isi: string): string {
  let badan = teks(isi).replace(/[[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!badan || menyebutAleta(badan)) badan = NETRAL;
  const maks = BATAS_TANDA - AWAL_TANDA.length - 1;
  if (badan.length > maks) badan = `${badan.slice(0, maks - 1).trimEnd()}…`;
  return `${AWAL_TANDA}${badan}]`;
}

const penanda = (isi: string): ParagrafDraf => ({ teks: tandaPerlu(isi), asal: "susun", tanda: true, merah: true, gaya: "isi" });
const dariNaskah = (t: string, gaya: ParagrafDraf["gaya"] = "isi"): ParagrafDraf => ({ teks: t, asal: "naskah", gaya });

function barisNaskah(isi: string | undefined): string[] {
  return String(isi ?? "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const JUDUL: Record<KunciBagianDraf, string> = {
  kepala: "Kepala putusan",
  identitas: "Identitas para pihak",
  dudukPerkara: "Duduk perkara",
  pertimbangan: "Pertimbangan hukum",
  amar: "Amar putusan",
  biaya: "Biaya perkara",
  penutup: "Penutup",
};

/** Kalimat penutup pertimbangan: contoh unsur disisipkan SEBELUM deretan ini, bukan sesudahnya. */
const POLA_KESIMPULAN =
  /(?:patut|layak|beralasan|harus|dapat)\b.{0,80}\b(?:dikabulkan|ditolak|diterima)|biaya\s+perkara|membebankan|^mengingat\b|^memperhatikan\b|oleh\s+karena\s+itu|\bmaka\s+(?:gugatan|permohonan)/i;

/** Indeks tempat blok unsur disisipkan: sebelum deretan kalimat kesimpulan di ujung pertimbangan. */
export function titikSisipPertimbangan(paragraf: string[]): number {
  let i = paragraf.length;
  while (i > 0 && POLA_KESIMPULAN.test(paragraf[i - 1])) i -= 1;
  // Pertimbangan yang seluruhnya kesimpulan: sisipkan di awal tidak masuk akal, taruh di akhir.
  return i === 0 ? paragraf.length : i;
}

const BAGIAN_LANGKAH: Record<KodeLangkah, KunciBagianDraf> = {
  duduk: "dudukPerkara",
  bukti: "dudukPerkara",
  saksi: "dudukPerkara",
  kesimpulan: "dudukPerkara",
  sela: "dudukPerkara",
  eksepsi: "dudukPerkara",
  rekonvensi: "dudukPerkara",
  koreksi: "pertimbangan",
  pertimbangan: "pertimbangan",
  amar: "amar",
  biaya: "biaya",
};

const POLA_BIAYA_AMAR = /biaya\s+perkara|membebankan[^.\n]{0,60}biaya|biaya[^.\n]{0,40}sejumlah|rp\.?\s*\d/i;

function singkat(t: string, maks: number): string {
  const s = teks(t).replace(/\s+/g, " ");
  return s.length > maks ? `${s.slice(0, maks - 1).trimEnd()}…` : s;
}

function labelSumber(c: { sumber: "pustaka" | "putusan"; label: string }): string {
  if (c.sumber === "pustaka") return "pustaka yang disahkan";
  const l = singkat(c.label, 70);
  return menyebutAleta(l) ? "putusan serupa hakim ini" : l;
}

// ----------------------------------------------------------------------------
// Penyusunan
// ----------------------------------------------------------------------------
type Papan = Record<KunciBagianDraf, ParagrafDraf[]>;

export function susunDrafUtuh(m: MasukanDrafUtuh): DrafUtuh {
  const pecah = pecahNaskahResmi(m.naskah);
  const b = pecah.bagian;
  const rapor = m.rapor;
  const catatan: string[] = [];
  const papan: Papan = { kepala: [], identitas: [], dudukPerkara: [], pertimbangan: [], amar: [], biaya: [], penutup: [] };

  // ── kepala ────────────────────────────────────────────────────────────────
  if (b.kepala) {
    barisNaskah(b.kepala).forEach((t, i) => papan.kepala.push(dariNaskah(t, i === 0 ? "judul" : "tengah")));
  } else {
    const k = kepalaPutusan({ nomorPerkara: m.nomorPerkara, pengadilan: teks(m.pengadilan) });
    if (k.isi) {
      const baris = barisNaskah(k.isi);
      baris.forEach((t, i) => papan.kepala.push({ teks: t, asal: "susun", gaya: i === 0 ? "judul" : "tengah" }));
    } else {
      papan.kepala.push(penanda(`kepala putusan (judul, nomor perkara, irah-irah, nama pengadilan): ${k.halangan ?? "belum terbaca"}`));
      catatan.push("Kepala putusan tidak terbaca dari naskah blangko.");
    }
  }

  // ── identitas ─────────────────────────────────────────────────────────────
  if (b.identitas) barisNaskah(b.identitas).forEach((t) => papan.identitas.push(dariNaskah(t)));
  else {
    papan.identitas.push(penanda("identitas para pihak (nama, umur, agama, pekerjaan, alamat) belum terbaca dari blangko"));
    catatan.push("Identitas para pihak tidak terbaca dari naskah blangko.");
  }

  // ── duduk perkara ─────────────────────────────────────────────────────────
  const duduk = barisNaskah(b.dudukPerkara);
  if (duduk.length) duduk.forEach((t) => papan.dudukPerkara.push(dariNaskah(t)));
  else {
    papan.dudukPerkara.push(penanda("duduk perkara belum tersusun di blangko; rangkai uraian gugatan, jawaban, replik, duplik, dan BAS"));
    catatan.push("Duduk perkara tidak terbaca dari naskah blangko; bahan isian ditampilkan apa adanya.");
    // Bahan: isian teks yang terisi, dikutip tanpa diubah (bukan dikarang).
    const urutan: KodeLangkah[] = ["duduk", "sela", "eksepsi", "rekonvensi", "bukti", "saksi", "kesimpulan"];
    const bahan = (m.bahan ?? [])
      .map((x) => ({ x, langkah: langkahUntukIsian({ kode: x.kode, nama: x.nama, jenis: x.jenis, khusus: x.khusus }) }))
      .filter((y) => teks(y.x.teks) && BAGIAN_LANGKAH[y.langkah] === "dudukPerkara")
      .sort((p, q) => urutan.indexOf(p.langkah) - urutan.indexOf(q.langkah))
      .slice(0, 40);
    for (const { x } of bahan) {
      const nama = teks(x.nama);
      for (const t of barisNaskah(teks(x.teks).slice(0, 4000))) papan.dudukPerkara.push(dariNaskah(nama ? `${nama}: ${t}` : t));
    }
  }

  // ── pertimbangan ──────────────────────────────────────────────────────────
  const pert = barisNaskah(b.pertimbangan);
  const blokUnsur: ParagrafDraf[] = [];
  const sudah = new Set<string>();
  let contohDipakai = 0;
  for (const a of rapor.alasan) {
    for (const u of a.unsur) {
      if (u.dipertimbangkan || sudah.has(u.kode)) continue;
      sudah.add(u.kode);
      const dasar = teks(u.dasar) || a.dasar.join("; ");
      // Label pustaka bawaan rapor memuat nama aplikasi; yang dipakai di naskah adalah labelSumber().
      const contoh = u.contoh.find((c) => c.teks.trim() && !menyebutAleta(c.teks) && (c.sumber === "pustaka" || !menyebutAleta(c.label)));
      if (contoh) {
        contohDipakai += 1;
        // Dasar hukum di ujung: bila penanda terpotong, yang hilang dasarnya, bukan perintahnya.
        blokUnsur.push(penanda(`unsur "${u.nama}": alinea berikut contoh dari ${labelSumber(contoh)}, sesuaikan dengan fakta perkara${dasar ? ` (dasar: ${singkat(dasar, 60)})` : ""}`));
        for (const alinea of alineaDari(contoh.teks)) blokUnsur.push({ teks: alinea, asal: "susun", merah: true, contoh: true, gaya: "isi" });
      } else {
        blokUnsur.push(penanda(`unsur "${u.nama}": belum ada alinea contoh, tulis dari fakta perkara ini${dasar ? ` (dasar: ${singkat(dasar, 60)})` : ""}`));
      }
    }
  }
  // Alasan yang didalilkan tetapi tidak dikutip, dasar hukum yang janggal, dan dasar yang lazim pada putusan serupa.
  const dasarHukum: ParagrafDraf[] = [];
  for (const t of rapor.temuan) {
    if (t.kode.startsWith("unsur-") || t.kode.startsWith("saksi-")) continue;
    if (t.kode === "alasan-tidak-dipertimbangkan") dasarHukum.push(penanda(`pertimbangan alasan perceraian yang didalilkan: ${t.judul}`));
    else if (["huruf-19-116", "tahun-peraturan", "uu7-tanpa-perubahan"].includes(t.kode)) dasarHukum.push(penanda(`periksa dasar hukum: ${t.judul}`));
    else if (t.kode === "kutipan-lazim") dasarHukum.push(penanda(`${t.judul.replace(/^Belum mengutip\s*/i, "dasar hukum yang lazim dikutip putusan serupa hakim ini: ")}; kutip bila relevan`));
    else if (t.kode === "verstek-tanpa-dasar") dasarHukum.push(penanda(`pertimbangan ketidakhadiran: ${t.judul}`));
  }
  const sisip = titikSisipPertimbangan(pert);
  pert.slice(0, sisip).forEach((t) => papan.pertimbangan.push(dariNaskah(t)));
  papan.pertimbangan.push(...blokUnsur, ...dasarHukum.slice(0, 8));
  pert.slice(sisip).forEach((t) => papan.pertimbangan.push(dariNaskah(t)));
  if (!pert.length) {
    papan.pertimbangan.unshift(penanda("pertimbangan hukum belum tersusun di blangko; tulis dari unsur, dasar hukum, dan fakta perkara ini"));
    catatan.push("Pertimbangan hukum tidak terbaca dari naskah blangko.");
  }

  // ── keterangan saksi yang belum memuat unsur: letaknya di duduk perkara ────
  const unsurTanpaSaksi = rapor.alasan.flatMap((a) => a.unsur).filter((u) => u.saksi === false);
  const lihat = new Set<string>();
  for (const u of unsurTanpaSaksi) {
    if (lihat.has(u.kode) || lihat.size >= 6) continue;
    lihat.add(u.kode);
    papan.dudukPerkara.push(penanda(`keterangan saksi yang menerangkan unsur "${u.nama}" belum ada di BAS`));
  }
  if (rapor.tidakDiperiksa.some((x) => /^Keterangan saksi tidak terkirim/.test(x))) {
    papan.dudukPerkara.push(penanda("keterangan saksi belum terbaca dari blangko; lengkapi tanya jawab saksi lalu periksa ulang"));
  }

  // ── amar ──────────────────────────────────────────────────────────────────
  const amar = barisNaskah(b.amar);
  if (amar.length) amar.forEach((t) => papan.amar.push(dariNaskah(t, "amar")));
  else {
    papan.amar.push(penanda("amar putusan (MENGADILI) belum tersusun di blangko; tulis sesuai pertimbangan"));
    catatan.push("Amar tidak terbaca dari naskah blangko.");
  }
  for (const t of rapor.temuan as TemuanAdvance[]) {
    if (t.tingkat !== "perhatian" || (t.langkah !== "amar" && t.langkah !== "biaya")) continue;
    if (papan.amar.filter((p) => p.tanda).length >= 6) break;
    papan.amar.push(penanda(`amar belum cocok dengan pertimbangan: ${t.judul}`));
  }

  // ── biaya: ada di amar, atau ditandai ──────────────────────────────────────
  const biayaDiAmar = amar.some((t) => POLA_BIAYA_AMAR.test(t));
  if (!biayaDiAmar) papan.biaya.push(penanda("biaya perkara: pihak yang dibebani dan jumlahnya belum tercantum di amar"));

  // ── penutup ───────────────────────────────────────────────────────────────
  const penutup = barisNaskah(b.penutup);
  if (penutup.length) penutup.forEach((t) => papan.penutup.push(dariNaskah(t)));
  else papan.penutup.push(penanda("penutup (hari dan tanggal musyawarah, nama majelis hakim, panitera sidang) belum terbaca dari blangko"));

  // ── isian blangko yang masih kosong, ke bagian menurut langkahnya ──────────
  const kosong = (m.isianKosong ?? []).slice(0, 60);
  const sudahNama = new Set<string>();
  for (const k of kosong) {
    const nama = singkat(teks(k.nama) || teks(k.kode) || "isian", 90);
    const kunci = `${langkahUntukIsian({ kode: k.kode, nama: k.nama, jenis: k.jenis, khusus: k.khusus })}|${nama.toLowerCase()}`;
    if (sudahNama.has(kunci)) continue;
    sudahNama.add(kunci);
    const langkah = langkahUntukIsian({ kode: k.kode, nama: k.nama, jenis: k.jenis, khusus: k.khusus });
    const tujuan = BAGIAN_LANGKAH[langkah];
    const sasaran = tujuan === "biaya" && biayaDiAmar ? "amar" : tujuan;
    papan[sasaran].push(penanda(`${nama} (isian blangko belum diisi)`));
  }

  // ── rangkai ───────────────────────────────────────────────────────────────
  const urutan: KunciBagianDraf[] = ["kepala", "identitas", "dudukPerkara", "pertimbangan", "amar", "biaya", "penutup"];
  const bagian: BagianDraf[] = urutan
    .filter((k) => papan[k].length)
    .map((k) => ({ kunci: k, judul: JUDUL[k], paragraf: papan[k], jumlahTanda: papan[k].filter((p) => p.tanda).length }));
  const tanda: TandaDraf[] = bagian.flatMap((bg) => bg.paragraf.filter((p) => p.tanda).map((p) => ({ bagian: bg.kunci, judul: bg.judul, teks: p.teks })));

  const draf: DrafUtuh = {
    nomorPerkara: m.nomorPerkara,
    namaBerkas: namaBerkasDraf(m.nomorPerkara),
    bagian,
    tanda,
    jumlahTanda: tanda.length,
    serupa: rapor.serupa.map((s) => ({ nomor: s.nomor, tanggalBht: s.tanggalBht, sama: s.sama, beda: s.beda })),
    sisa: { jumlah: 0, rincian: [] },
    ringkas: "",
    catatan,
    rtf: "",
  };
  draf.rtf = drafKeRtf(draf);
  const hasil = periksaRtf(draf.rtf);
  draf.sisa = { jumlah: hasil.temuan.length + hasil.terpotong, rincian: ringkasJenis(hasil.temuan) };
  draf.ringkas = ringkasDraf(draf, contohDipakai);
  return draf;
}

function ringkasDraf(d: DrafUtuh, contoh: number): string {
  const nBagian = d.bagian.length;
  const tanda = d.jumlahTanda
    ? `${d.jumlahTanda} bagian bertanda "perlu dilengkapi" (merah) harus dilengkapi atau dihapus sebelum diunggah`
    : "tidak ada bagian yang bertanda; tetap baca ulang seluruh naskah";
  return `Draf utuh disusun dari ${nBagian} bagian; ${tanda}${contoh ? `; ${contoh} alinea contoh disisipkan (merah)` : ""}.`;
}

/** Nama berkas unduhan: nomor perkara, tanpa karakter terlarang dan tanpa tanda aplikasi. */
export function namaBerkasDraf(nomorPerkara: string): string {
  const nomor = teks(nomorPerkara).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
  const nama = nomor && !menyebutAleta(nomor) ? `Draf putusan ${nomor}.rtf` : "Draf putusan.rtf";
  return nama;
}

// ----------------------------------------------------------------------------
// RTF
// ----------------------------------------------------------------------------
const TATA_HALAMAN = "\\paperw11906\\paperh16838\\margl1701\\margr1134\\margt1134\\margb1134\\widowctrl\\ftnbj\\viewkind1";
const SEKSI = "\\sectd\\pgwsxn11906\\pghsxn16838\\marglsxn1701\\margrsxn1134\\margtsxn1134\\margbsxn1134";
const HURUF = "\\f0\\fs24";
const SPASI = "\\sl360\\slmult1\\sa120";

function barisRtf(p: ParagrafDraf): string {
  const isi = lariRtf(p.teks);
  const badan = p.merah ? `{\\cf2 ${isi}}` : p.gaya === "judul" ? `{\\b ${isi}}` : isi;
  let rata = "\\qj";
  let jorok = "";
  if (p.gaya === "tengah" || p.gaya === "judul") rata = "\\qc";
  else if (p.gaya === "amar") rata = "\\qj\\li567\\fi-567";
  else if (!p.tanda) jorok = "\\fi720";
  return `\\pard\\plain${rata}${jorok}${SPASI}${HURUF} ${badan}\\par`;
}

function judulRtf(judul: string): string {
  return `\\pard\\plain\\qc\\keepn\\sb240${SPASI}${HURUF} {\\b ${lariRtf(judul)}}\\par`;
}

/** Draf -> RTF ASCII murni (A4, Arial 12, spasi 1,5). Tanpa pembuat/penulis di properti berkas. */
export function drafKeRtf(d: Pick<DrafUtuh, "bagian">): string {
  const keluar: string[] = [
    "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\\deflang1057",
    "{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}",
    "{\\colortbl;\\red0\\green0\\blue0;\\red192\\green0\\blue0;}",
    "{\\info{\\title Draf putusan}}",
    TATA_HALAMAN,
    SEKSI,
  ];
  for (const bg of d.bagian) {
    if (bg.kunci === "dudukPerkara") keluar.push(judulRtf("DUDUK PERKARA"));
    if (bg.kunci === "pertimbangan") keluar.push(judulRtf("PERTIMBANGAN HUKUM"));
    if (bg.kunci === "amar") keluar.push(judulRtf("MENGADILI"));
    for (const p of bg.paragraf) keluar.push(barisRtf(p));
  }
  keluar.push("}");
  return keluar.join("\n");
}

/** RTF -> bita untuk diunduh / dikirim base64. */
export function drafKeBita(rtf: string): Uint8Array {
  return rtfKeBita(rtf);
}
