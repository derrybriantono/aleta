// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA USULAN PERKARA LAIN (DK, PERWALIAN, ASAL USUL, HARTA BERSAMA)
 * ============================================================================
 *
 * Menjalankan abtUsulanLainService.dariPositaLain (kontrak K6) atas posita
 * contoh berbentuk templat PA Donggala. Nama diganti pengganti ('Xxxa'),
 * KUA dan kecamatan diganti ('Aaaa'), tanpa NIK dan alamat.
 *
 * Pagar yang dijaga: TIDAK SATU variabel pun diusulkan sebelum lulus gerbang
 * ukur (presisi >= 0,9 DAN n >= 10 atas pembanding yang sah) DAN terbukti
 * tidak lebih buruk dari bawaan ABT pada perkara yang sama. Yang tidak lulus
 * ada di belumSiap (beserta presisi dan n-nya) atau bawaanAbt (beserta kueri
 * ABT-nya) - tidak diusulkan, dan tidak hilang diam-diam.
 */

type UsulanLain = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: string;
  sumber: { saksi: number; asal: string; kalimat: string }[];
  siap: boolean;
};
type HasilLain = {
  ok: boolean;
  jenis: string;
  usulan: UsulanLain[];
  belumSiap: { kode: string; alasan: string; presisi: number | null; n: number }[];
  bawaanAbt: { kode: string; acuan: string; alasan: string }[];
  alasan?: string;
  catatan?: string;
};
type BarisUkur = {
  aleta: { n: number; benar: number; ketat?: number };
  abt?: { acuan: string; n: number; benar: number; kosong: number; nMentah: number; benarMentah: number; dipangkas: number };
  pasang?: { n: number; aleta: number; abt: number };
  sampah?: string;
  gabung?: { n: number; benar: number; dasar: string };
};
type Keputusan = {
  sumber: "aleta" | "abt" | "belum-terukur";
  jalur: string;
  jenis: string | null;
  kode: string;
  presisiAleta: number | null;
  n: number;
  ketepatanAbt: number | null;
  nAbt: number;
  acuan: string | null;
  jenisUkur: string | null;
  gerbang: { siap: boolean; alasan: string; presisi: number | null; n: number };
  alasan: string;
};
type HasilItsbat = {
  ok?: boolean;
  ditemukan: number;
  usulan: { kode: string; nama: string; nilai: string }[];
  bawaanAbt: { kode: string; nama: string; acuan: string; alasan: string }[];
  belumSiap: { kode: string; alasan: string }[];
  catatan: string;
};
type LayananLain = {
  JENIS_LAIN: { kunci: string; jenisPerkaraId: number }[];
  ATURAN_LAIN: Record<string, { kode: string; ambil: (teks: string, konteks: unknown) => { nilai: string; kalimat: string } }[]>;
  GERBANG: { presisiMinimal: number; nMinimal: number };
  GERBANG_ITSBAT: { presisiMinimal: number; nMinimal: number; selisihAbtMaks: number; jenisWakil: string };
  saringUsulanItsbat: (hasil: unknown, jenisPerkara?: unknown) => HasilItsbat;
  UKUR_SUMBER: Record<string, Record<string, Record<string, BarisUkur>>>;
  VARIABEL_SIAP: Record<string, string[]>;
  konteksAturan: (posita: string) => unknown;
  keadaanGerbang: (jenis: string, kode: string, jalur?: string) => { siap: boolean; alasan: string; presisi: number | null; n: number };
  sumberUsulanTerukur: (jenisPerkara: unknown, kode: unknown, opsi?: { jalur?: string }) => Keputusan;
  susunVariabelSiap: () => Record<string, string[]>;
  kenaliJenis: (jenis: unknown) => { kunci: string } | null;
  kenaliJenisTerukur: (jenis: unknown) => { kunci: string } | null;
  dariPositaLain: (posita: string, opsi: { jenisPerkara?: unknown; alur?: unknown }) => HasilLain;
};

const require_ = createRequire(import.meta.url);
const lain = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanLainService.js")) as LayananLain;
const usulanService = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as {
  dariPositaItsbat: (posita: string, pihak: Record<string, string>) => { usulan: { kode: string; nama: string; nilai: string }[] };
};

const DK_ANAK_PEREMPUAN = [
  "Bahwa para Pemohon telah menikah pada tanggal 26 September 2004 di Kantor Urusan Agama Kecamatan Aaaa, Kabupaten Bbbb, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama :",
  "Xxxa Yyya binti Zzza, umur 16 tahun",
  "Xxxc binti Zzza, umur 14 tahun",
  "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxa Yyya binti Zzza (calon mempelai wanita) dengan seorang laki-laki yang bernama Muh. Xxxb bin Zzzb (calon mempelai laki-laki), umur 21 tahun;",
  "Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur;",
  "Bahwa anak para Pemohon tersebut telah saling mengenal selama 1 tahun, dan hubungan mereka telah sedemikian eratnya;",
].join("\n");

// Anak para Pemohon laki-laki: urutan nama di kalimat menikahkan terbalik, dan
// umurnya hanya ada di kalimat "masih berumur 15 dan 16 tahun".
const DK_ANAK_LAKI = [
  "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxb bin Zzzb dengan Xxxa Yyya binti Zzzc;",
  "Bahwa syarat perkawinan anak para Pemohon bernama Xxxb bin Zzzb dan Xxxa Yyya binti Zzzc belum terpenuhi persyaratan umurnya, sampai saat ini masih berumur 15 dan 16 tahun;",
  "Bahwa para Pemohon telah melapor ke Kantor Urusan Agama Kecamatan Eeee, Kabupaten Ffff, guna mencatatkan pernikahan tersebut, namun ditolak;",
].join("\n");

const PERWALIAN =
  "Bahwa Pemohon adalah istri dari Alm. Xxxa bin Yyya (Suami Pemohon) yang telah meninggal dunia pada tanggal 3 Maret 2020; " +
  "Bahwa Pemohon hendak menjadi wali atas anak yang bernama Xxxc binti Xxxa untuk mengurus balik nama sertifikat tanah;";

const nilai = (h: HasilLain) => Object.fromEntries(h.usulan.map((u) => [u.kode, u.nilai]));

describe("dariPositaLain - dispensasi kawin", () => {
  it("anak perempuan: nama, umur, dan KUA yang MENOLAK (bukan KUA tempat orang tua menikah)", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 362 });
    expect(h.ok).toBe(true);
    expect(h.jenis).toBe("dispensasi-kawin");
    expect(nilai(h)).toEqual({
      "0606": "Xxxa Yyya binti Zzza",
      "0600": "Muh. Xxxb bin Zzzb",
      "0607": "16 tahun",
      "0601": "21 tahun",
      // Aaaa (tempat para Pemohon menikah) disebut lebih dulu - bukan itu.
      "5178": "Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd",
    });
    expect(h.bawaanAbt).toEqual([]);
    for (const u of h.usulan) {
      expect(u.siap).toBe(true);
      expect(u.sumber[0]).toMatchObject({ saksi: 0, asal: "posita" });
      expect(u.sumber[0].kalimat).not.toBe("");
    }
  });

  it("anak laki-laki: jenis kelamin dari bin/binti, umur dibagi menurut urutan nama", () => {
    const h = lain.dariPositaLain(DK_ANAK_LAKI, { jenisPerkara: "Dispensasi Kawin" });
    expect(nilai(h)).toMatchObject({
      "0606": "Xxxa Yyya binti Zzzc",
      "0600": "Xxxb bin Zzzb",
      "0607": "16 tahun",
      "0601": "15 tahun",
      "5178": "Kantor Urusan Agama Kecamatan Eeee, Kabupaten Ffff",
    });
  });

  it("variabel yang gagal gerbang ada di belumSiap beserta angkanya, tidak diusulkan", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: "dispensasi-kawin" });
    expect(h.belumSiap).toEqual([
      { kode: "1666", alasan: "n<10", presisi: 0.5, n: 8 },
      { kode: "1551", alasan: "n<10", presisi: 0.286, n: 7 },
      { kode: "0999", alasan: "n<10", presisi: 0.333, n: 3 },
    ]);
    expect(h.usulan.map((u) => u.kode)).not.toContain("1666");
  });
});

describe("gerbang ukur - berlaku untuk SEMUA jenis", () => {
  const CONTOH: Record<string, string> = {
    "dispensasi-kawin": DK_ANAK_PEREMPUAN,
    perwalian: PERWALIAN,
    "asal-usul": "Bahwa Pemohon telah menikah dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon) dan dihadiri saksi nikah bernama Xxxc dan Xxxd;",
    "harta-bersama": "Bahwa selama perkawinan Penggugat dan Tergugat memperoleh harta bersama berupa sebidang tanah;",
  };

  it.each(Object.keys(CONTOH))("%s: tiap aturan masuk TEPAT SATU daftar menurut keputusan sumbernya", (jenis) => {
    const h = lain.dariPositaLain(CONTOH[jenis], { jenisPerkara: jenis });
    expect(h.ok).toBe(true);
    const { presisiMinimal, nMinimal } = lain.GERBANG;
    for (const u of h.usulan) {
      const k = lain.sumberUsulanTerukur(jenis, u.kode);
      expect(k.sumber, `${jenis}:${u.kode}`).toBe("aleta");
      expect(k.n).toBeGreaterThanOrEqual(nMinimal);
      expect(k.presisiAleta).toBeGreaterThanOrEqual(presisiMinimal);
    }
    for (const b of h.belumSiap) {
      const lulus = b.n >= nMinimal && b.presisi !== null && b.presisi >= presisiMinimal;
      expect(lulus, `${jenis}:${b.kode}`).toBe(false);
      expect(b.alasan).not.toBe("");
      expect(lain.sumberUsulanTerukur(jenis, b.kode).sumber).toBe("belum-terukur");
    }
    for (const b of h.bawaanAbt) {
      expect(lain.sumberUsulanTerukur(jenis, b.kode).sumber).toBe("abt");
      expect(b.acuan).toMatch(/^\d{4,5}$/);
      expect(b.alasan).not.toBe("");
    }
    const semua = [...h.usulan.map((u) => u.kode), ...h.belumSiap.map((b) => b.kode), ...h.bawaanAbt.map((o) => o.kode)];
    expect([...semua].sort()).toEqual(lain.ATURAN_LAIN[jenis].map((a) => a.kode).sort());
    expect(new Set(semua).size).toBe(semua.length);
  });

  it("daftar siap = hasil ukur 26 September 2026 (DK lima, jenis lain kosong); 3333 tidak lagi di sana", () => {
    expect(lain.VARIABEL_SIAP).toEqual({
      "dispensasi-kawin": ["0606", "0600", "0607", "0601", "5178"],
      perwalian: [],
      "asal-usul": [],
      "harta-bersama": [],
    });
    expect(lain.susunVariabelSiap()).toEqual(JSON.parse(JSON.stringify(lain.VARIABEL_SIAP)));
    // 3333 tidak ada di satu pun dari 908 RTF blangko - tidak diusulkan.
    expect(lain.ATURAN_LAIN["dispensasi-kawin"].map((a) => a.kode)).not.toContain("3333");
  });

  it("perwalian: n < 10 tetap belum siap walau presisinya 1", () => {
    const h = lain.dariPositaLain(PERWALIAN, { jenisPerkara: 354 });
    expect(h.usulan).toEqual([]);
    expect(h.belumSiap).toContainEqual({ kode: "0712", alasan: "n<10", presisi: 1, n: 5 });
  });

  it("harta bersama tanpa aturan terukur - disebut di catatan, bukan jawaban kosong diam-diam", () => {
    const h = lain.dariPositaLain(CONTOH["harta-bersama"], { jenisPerkara: 348 });
    expect(h.usulan).toEqual([]);
    expect(h.catatan).toMatch(/Harta Bersama/);
  });
});

describe("dariPositaLain - masukan yang tidak dilayani", () => {
  // Bentuk ok:false memuat ketiga daftar yang dijanjikan JSDoc - pembacanya
  // tidak perlu menebak ruas mana yang ada.
  it("jenis perkara lain ditolak dengan alasan, berbentuk lengkap", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 346 });
    expect(h).toEqual({ ok: false, jenis: "", usulan: [], belumSiap: [], bawaanAbt: [], alasan: "jenis_perkara_tidak_dilayani" });
  });

  it("posita kosong ditolak dengan alasan, berbentuk lengkap", () => {
    expect(lain.dariPositaLain("  ", { jenisPerkara: 362 })).toEqual({
      ok: false,
      jenis: "dispensasi-kawin",
      usulan: [],
      belumSiap: [],
      bawaanAbt: [],
      alasan: "posita_kosong",
    });
  });

  it("itsbat nikah TIDAK dilayani dariPositaLain (hanya dikenal keputusan sumber)", () => {
    expect(lain.kenaliJenis(360)).toBeNull();
    expect(lain.kenaliJenisTerukur(360)?.kunci).toBe("itsbat-nikah");
    expect(lain.kenaliJenisTerukur("Pengesahan Perkawinan/Istbat Nikah")?.kunci).toBe("itsbat-nikah");
    expect(lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 360 })).toMatchObject({ ok: false, alasan: "jenis_perkara_tidak_dilayani" });
  });

  it("jenis dikenali dari id SIPP, nama, atau kunci", () => {
    expect(lain.kenaliJenis(362)?.kunci).toBe("dispensasi-kawin");
    expect(lain.kenaliJenis("Perwalian")?.kunci).toBe("perwalian");
    expect(lain.kenaliJenis("asal-usul")?.kunci).toBe("asal-usul");
    expect(lain.kenaliJenis("Harta Bersama")?.kunci).toBe("harta-bersama");
    expect(lain.kenaliJenis("Cerai Gugat")).toBeNull();
  });
});

/* ============================================================================
 * KEPUTUSAN SUMBER TERUKUR - ALETA ATAU BAWAAN ABT, DIUKUR, BUKAN DIANDAIKAN
 * ============================================================================
 *
 * Bawaan ABT (default_data -> kueri data_sql buatan pengguna) hanyalah isian
 * BAWAAN di kotak popup ABT, yang tersimpan bila petugas membuka dan
 * menyimpannya. ALETA mengusulkan hanya bila aturannya lulus gerbang DAN
 * tidak lebih buruk dari bawaan itu pada perkara yang sama; selainnya ALETA
 * diam dan menyebut kueri ABT-nya. Uji di bawah MENJALANKAN
 * sumberUsulanTerukur; yang bertanda GIGITAN terbukti merah bila syaratnya
 * dibuang (D:/aleta-dev/kerja/pembetul-perkara-lain/mutasi.js).
 */
describe("keputusan sumber terukur (ALETA vs bawaan ABT)", () => {
  const aturan = (jenis: string, kode: string) => lain.ATURAN_LAIN[jenis].find((a) => a.kode === kode)!;
  const DK = lain.UKUR_SUMBER["posita-lain"]["dispensasi-kawin"];

  /** Pinjam satu baris UKUR_SUMBER selama `f` berjalan, lalu kembalikan persis. */
  function denganBaris<T>(jalur: string, jenis: string, kode: string, baris: BarisUkur, f: () => T): T {
    const peta = lain.UKUR_SUMBER[jalur][jenis];
    const ada = Object.prototype.hasOwnProperty.call(peta, kode);
    const asli = peta[kode];
    peta[kode] = baris;
    try {
      return f();
    } finally {
      if (ada) peta[kode] = asli;
      else delete peta[kode];
    }
  }

  it("DK 5178: ALETA lulus atas pembanding sah (5178 7 + 3333 11) dan jauh lebih tepat dari bawaan #10103#", () => {
    const k = lain.sumberUsulanTerukur(362, "5178");
    expect(k).toMatchObject({
      sumber: "aleta",
      jenis: "dispensasi-kawin",
      kode: "5178",
      acuan: "10103",
      presisiAleta: 0.944,
      n: 18,
      ketepatanAbt: 0,
      nAbt: 7,
    });
    expect(k.alasan).toMatch(/tidak lebih buruk dari bawaan ABT #10103#/);
    // Dasar pengecualian dan penggabungan tertulis, bukan diandaikan.
    expect(DK["5178"].sampah).toMatch(/ditolak oleh #5178#/);
    expect(DK["5178"].gabung).toMatchObject({ n: 11, benar: 11 });
    expect(DK["5178"].gabung?.dasar).toMatch(/3333/);
    // Tanpa bukti 3333 yang maknanya sama, n 7 < 10: ALETA diam dan ABT
    // menawarkan bawaannya.
    const tanpaGabung: BarisUkur = { ...DK["5178"], gabung: undefined };
    denganBaris("posita-lain", "dispensasi-kawin", "5178", tanpaGabung, () => {
      expect(lain.sumberUsulanTerukur(362, "5178")).toMatchObject({ sumber: "abt", n: 7 });
      expect(lain.susunVariabelSiap()["dispensasi-kawin"]).not.toContain("5178");
    });
  });

  it("asal usul: ketujuh aturannya belum lulus (n=2) dan punya bawaan ABT - disebut di bawaanAbt beserta kuerinya", () => {
    const h = lain.dariPositaLain("Bahwa Pemohon menikah pada tanggal 1 Mei 2010 dengan saksi nikah bernama Xxxc dan Xxxd;", {
      jenisPerkara: 358,
    });
    expect(h.usulan).toEqual([]);
    expect(h.belumSiap).toEqual([]);
    expect(h.bawaanAbt.map((o) => o.kode).sort()).toEqual(lain.ATURAN_LAIN["asal-usul"].map((a) => a.kode).sort());
    expect(h.bawaanAbt.find((b) => b.kode === "5197")).toMatchObject({ acuan: "10101" });
    for (const b of h.bawaanAbt) expect(b.alasan).toMatch(/ABT menawarkan isian bawaan dari kueri #\d+#/);
  });

  /**
   * Jalur itsbat memakai GERBANG_ITSBAT (26 September 2026): memilih SUMBER
   * yang lebih tepat pada perkara yang sama, bukan membuka usulan baru.
   * Gerbang 0,9 jalur posita-lain akan menghentikan ke-14 variabel, padahal
   * ALETA jauh lebih tepat untuk 5197, 0650, 0651, dan 1217.
   */
  it("jalur itsbat: sembilan variabel tetap ALETA, lima diserahkan ke bawaan ABT", () => {
    const itsbat = { jalur: "itsbat" };
    expect(lain.GERBANG_ITSBAT).toMatchObject({ presisiMinimal: 0.5, nMinimal: 10, selisihAbtMaks: 0.02 });
    const keputusan = Object.fromEntries(
      Object.keys(lain.UKUR_SUMBER.itsbat["itsbat-nikah"]).map((k) => [k, lain.sumberUsulanTerukur(360, k, itsbat).sumber])
    );
    expect(keputusan).toEqual({
      "1001": "aleta",
      "1002": "abt",
      "1003": "aleta",
      "1046": "abt",
      "1217": "aleta",
      "5105": "abt",
      "5178": "abt",
      "5197": "aleta",
      "7211": "aleta",
      "7212": "aleta",
      "8087": "aleta",
      "0007": "abt",
      "0650": "aleta",
      "0651": "aleta",
    });
    // 1003 dan 7211 kalah tipis (0,973 lawan 0,983; 0,794 lawan 0,803):
    // setara, dan alasannya berkata begitu.
    const k1003 = lain.sumberUsulanTerukur(360, "1003", itsbat);
    expect(k1003).toMatchObject({ sumber: "aleta", acuan: "10107", presisiAleta: 0.973, ketepatanAbt: 0.983, n: 301 });
    expect(k1003.alasan).toMatch(/setara dengan bawaan ABT #10107#/);
    // 0007: ABT hanya 0,141 tetapi ALETA 0,119 - di bawah ketepatan minimal.
    expect(lain.sumberUsulanTerukur(360, "0007", itsbat).alasan).toMatch(/presisi<0\.5.*kueri #8492#/);
    // 1217: 578/637 = 0,907 sepanjang masa, tetapi 244/280 = 0,871 di masa
    // bawaan ABT - dihitung di masa bawaan, pada perkara yang sama.
    expect(lain.UKUR_SUMBER.itsbat["itsbat-nikah"]["1217"].aleta).toEqual({ n: 637, benar: 578 });
    expect(lain.sumberUsulanTerukur("Pengesahan Perkawinan/Istbat Nikah", 1217, itsbat)).toMatchObject({
      sumber: "aleta",
      presisiAleta: 0.871,
      n: 280,
      ketepatanAbt: 0.689,
      jenisUkur: "itsbat-nikah",
    });
    expect(lain.sumberUsulanTerukur(360, "#5197#", itsbat)).toMatchObject({ sumber: "aleta", presisiAleta: 0.785, ketepatanAbt: 0.158, acuan: "10101" });
    // Asal usul lewat jalur itsbat (tombol itsbat tampil karena #5197#): n-nya
    // 2, jadi keputusan dipinjam dari itsbat nikah - pengurai yang sama.
    const asalUsul = lain.sumberUsulanTerukur(358, "8087", itsbat);
    expect(asalUsul).toMatchObject({ sumber: "aleta", acuan: "10109", n: 298, jenis: "asal-usul", jenisUkur: "itsbat-nikah" });
    expect(asalUsul.alasan).toMatch(/^diukur pada itsbat-nikah - pengurai yang sama, asal-usul baru n 2; /);
    expect(lain.sumberUsulanTerukur(358, "5178", itsbat)).toMatchObject({ sumber: "abt", jenisUkur: "itsbat-nikah" });
    // Jalur bawaan (posita-lain) tidak mengukur itsbat nikah, dan gerbangnya
    // tetap 0,9 - VARIABEL_SIAP tidak berubah oleh gerbang itsbat.
    expect(lain.sumberUsulanTerukur(360, "1003")).toMatchObject({ sumber: "belum-terukur", alasan: "belum diukur" });
    expect(lain.VARIABEL_SIAP["dispensasi-kawin"]).toEqual(["0606", "0600", "0607", "0601", "5178"]);
  });

  it("saringUsulanItsbat: pengurai tetap 14 variabel, yang dikirim ke panel disaring", () => {
    const POSITA =
      "Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan antara Pemohon I dengan Pemohon II di Desa Aaaa Kecamatan Bbbb Kabupaten Donggala, dengan wali nikah ayah kandung bernama Xxxa dan disaksikan oleh Yyya dan Zzza dengan mahar seperangkat alat sholat;";
    const urai = usulanService.dariPositaItsbat(POSITA, { pemohon: "Pemohon I", pemohon2: "Pemohon II" });
    expect(urai.usulan).toHaveLength(14);
    const h = lain.saringUsulanItsbat(urai);
    expect(h.usulan.map((u: { kode: string }) => u.kode).sort()).toEqual(["0650", "0651", "1001", "1003", "1217", "5197", "7211", "7212", "8087"]);
    expect(h.bawaanAbt.map((b: { kode: string }) => b.kode).sort()).toEqual(["0007", "1002", "1046", "5105", "5178"]);
    expect(h.bawaanAbt.find((b: { kode: string }) => b.kode === "5178")).toMatchObject({ acuan: "10103", nama: "KUA kecamatan" });
    expect(h.belumSiap).toEqual([]);
    expect(h.ditemukan).toBe(h.usulan.filter((u: { nilai: string }) => u.nilai).length);
    expect(h.catatan).toMatch(/dari 9 variabel usulan ALETA terbaca dari posita.*5 variabel diserahkan ke isian bawaan ABT/);
    // Posita yang bukan itsbat: kabar pengurai dipertahankan.
    const bukan = lain.saringUsulanItsbat(usulanService.dariPositaItsbat("Bahwa Penggugat dan Tergugat sering bertengkar;", {}));
    expect(bukan.catatan).toMatch(/^Tidak satu pun fakta pernikahan terbaca/);
    // ok:false dan masukan rusak diteruskan apa adanya.
    expect(lain.saringUsulanItsbat({ ok: false, alasan: "x" })).toEqual({ ok: false, alasan: "x" });
    expect(lain.saringUsulanItsbat(null)).toBeNull();
  });

  it("yang tidak dikenal: belum-terukur, dengan alasan", () => {
    expect(lain.sumberUsulanTerukur("Cerai Gugat", "0606")).toMatchObject({ sumber: "belum-terukur", jenis: null, alasan: "jenis perkara tidak dikenal" });
    expect(lain.sumberUsulanTerukur(362, "9999")).toMatchObject({ sumber: "belum-terukur", jenis: "dispensasi-kawin", alasan: "belum diukur" });
    expect(lain.sumberUsulanTerukur(362, "1666")).toMatchObject({ sumber: "belum-terukur", presisiAleta: 0.5, n: 8, acuan: null });
  });

  it("GIGITAN (M1): lulus gerbang tetapi bawaan ABT lebih tepat -> tidak siap, tidak diusulkan, disebut bawaanAbt", () => {
    const baris: BarisUkur = {
      ...DK["0606"],
      abt: { acuan: "10999", n: 12, benar: 12, kosong: 0, nMentah: 12, benarMentah: 12, dipangkas: 0 },
      pasang: { n: 12, aleta: 11, abt: 12 },
    };
    denganBaris("posita-lain", "dispensasi-kawin", "0606", baris, () => {
      expect(lain.keadaanGerbang("dispensasi-kawin", "0606").siap).toBe(true);
      expect(lain.sumberUsulanTerukur(362, "0606")).toMatchObject({ sumber: "abt", acuan: "10999" });
      expect(lain.susunVariabelSiap()["dispensasi-kawin"]).not.toContain("0606");
      const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 362 });
      expect(h.usulan.map((u) => u.kode)).not.toContain("0606");
      expect(h.bawaanAbt).toContainEqual(expect.objectContaining({ kode: "0606", acuan: "10999" }));
    });
  });

  it("GIGITAN (M2): SAMA tepat dengan bawaan ABT = tidak lebih buruk -> ALETA mengusulkan", () => {
    const baris: BarisUkur = {
      aleta: { n: 12, benar: 11 },
      abt: { acuan: "10999", n: 12, benar: 11, kosong: 0, nMentah: 12, benarMentah: 11, dipangkas: 0 },
      pasang: { n: 12, aleta: 11, abt: 11 },
    };
    denganBaris("posita-lain", "dispensasi-kawin", "0606", baris, () => {
      expect(lain.sumberUsulanTerukur(362, "0606")).toMatchObject({ sumber: "aleta", presisiAleta: 0.917, ketepatanAbt: 0.917 });
      expect(lain.susunVariabelSiap()["dispensasi-kawin"]).toContain("0606");
    });
  });

  it("GIGITAN: tepi gerbang - n 10 dengan presisi tepat 0,9 lulus; n 9 atau presisi di bawah 0,9 tidak", () => {
    const coba = (n: number, benar: number) =>
      denganBaris("posita-lain", "dispensasi-kawin", "0606", { aleta: { n, benar } }, () => lain.keadaanGerbang("dispensasi-kawin", "0606"));
    expect(coba(10, 9)).toEqual({ siap: true, alasan: "", presisi: 0.9, n: 10 });
    expect(coba(9, 9)).toMatchObject({ siap: false, alasan: "n<10" });
    expect(coba(20, 17)).toMatchObject({ siap: false, alasan: "presisi<0.9", presisi: 0.85 });
  });

  it("GIGITAN: gerbang lulus lewat gabung, tetapi bawaan ABT belum dibandingkan pada perkara yang sama -> abt", () => {
    const baris: BarisUkur = {
      aleta: { n: 0, benar: 0 },
      abt: { acuan: "10999", n: 3, benar: 0, kosong: 0, nMentah: 3, benarMentah: 0, dipangkas: 0 },
      pasang: { n: 0, aleta: 0, abt: 0 },
      gabung: { n: 12, benar: 12, dasar: "uji" },
    };
    denganBaris("posita-lain", "dispensasi-kawin", "0606", baris, () => {
      const k = lain.sumberUsulanTerukur(362, "0606");
      expect(k).toMatchObject({ sumber: "abt", n: 12, nAbt: 0, ketepatanAbt: null });
      expect(k.alasan).toMatch(/belum dapat dibandingkan/);
    });
  });

  it("angka UKUR_SUMBER masuk akal (tiap jalur, jenis, variabel)", () => {
    for (const [jalur, perJenis] of Object.entries(lain.UKUR_SUMBER)) {
      for (const [jenis, baris] of Object.entries(perJenis)) {
        for (const [k, u] of Object.entries(baris)) {
          const t = `${jalur}/${jenis}/${k}`;
          expect(k, t).toMatch(/^\d{4}$/);
          expect(u.aleta.benar, t).toBeLessThanOrEqual(u.aleta.n);
          if (u.aleta.ketat !== undefined) expect(u.aleta.ketat, t).toBeLessThanOrEqual(u.aleta.benar);
          if (u.gabung) expect(u.gabung.benar, t).toBeLessThanOrEqual(u.gabung.n);
          if (!u.abt || !u.pasang) {
            expect(u.abt, t).toBeUndefined();
            expect(u.pasang, t).toBeUndefined();
            continue;
          }
          expect(u.abt.acuan, t).toMatch(/^\d{4,5}$/);
          expect(u.abt.benar, t).toBeLessThanOrEqual(u.abt.n);
          expect(u.abt.kosong, t).toBeLessThanOrEqual(u.abt.n);
          expect(u.abt.n, t).toBeLessThanOrEqual(u.abt.nMentah);
          expect(u.abt.benarMentah, t).toBeLessThanOrEqual(u.abt.nMentah);
          expect(u.abt.dipangkas, t).toBeLessThanOrEqual(u.abt.nMentah);
          expect(u.pasang.n, t).toBeLessThanOrEqual(Math.min(u.abt.n, u.aleta.n));
          expect(u.pasang.aleta, t).toBeLessThanOrEqual(Math.min(u.pasang.n, u.aleta.benar));
          expect(u.pasang.abt, t).toBeLessThanOrEqual(Math.min(u.pasang.n, u.abt.benar));
          // Isian yang dikeluarkan sebagai sampah harus berdasar tertulis.
          if (u.abt.n < u.abt.nMentah) expect(u.sampah, t).toMatch(/\S/);
        }
      }
    }
  });

  describe("aturan baru DK (belum siap, tetapi diukur) - fixture teranonimkan", () => {
    const KANDUNGAN: [string, string][] = [
      ["anak para Pemohon sekarang sedang hamil 20 Minggu (Sertifikat Siap Nikah dan Hamil Nomor Kuesioner Elsimil : K00XXX) ;", "20 minggu"],
      ["sekarang sedang hamil 24 Minggu 3 hari (Surat Keterangan Kehamilan Nomor : 445/S.Ket/XI-PKM/2022);", "24 minggu"],
      ["calon mempelai wanita sekarang sedang hamil 25/26 Minggu (Surat Keterangan Hamil Nomor : 445/000/SKH/2023) ;", "25/26 minggu"],
      ["anak para Pemohon sekarang sedang hamil 18-19 Minggu sesuai dengan surat keterangan Puskesmas Aaaa;", "18-19 minggu"],
      ["anak Pemohon telah hamil kurang lebih 3 bulan;", "3 bulan"],
      ["anak para Pemohon sedang hamil 5 (lima) bulan;", "5 bulan"],
      ["anak para Pemohon belum hamil;", ""],
      ["hubungan mereka sangat erat dan dikhawatirkan hamil di luar nikah;", ""],
    ];
    it.each(KANDUNGAN)("0999 umur kandungan: %s", (posita, harap) => {
      expect(aturan("dispensasi-kawin", "0999").ambil(posita, lain.konteksAturan(posita)).nilai).toBe(harap);
    });

    it("1551 ayah calon PASANGAN: patronim calon yang bukan anak para Pemohon", () => {
      const a = aturan("dispensasi-kawin", "1551");
      expect(a.ambil(DK_ANAK_PEREMPUAN, lain.konteksAturan(DK_ANAK_PEREMPUAN)).nilai).toBe("Zzzb");
      expect(a.ambil(DK_ANAK_LAKI, lain.konteksAturan(DK_ANAK_LAKI)).nilai).toBe("Zzzc");
      expect(a.ambil(PERWALIAN, lain.konteksAturan(PERWALIAN)).nilai).toBe("");
    });
  });
});
