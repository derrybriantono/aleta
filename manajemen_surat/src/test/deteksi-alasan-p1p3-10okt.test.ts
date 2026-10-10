// @vitest-environment node
/**
 * ============================================================================
 * 10 OKT 2026 - DETEKSI LENGKAP AGEN 1: P1 ALASAN, P2 WAKTU, P3 PELAKU, S6 SAKSI
 * ============================================================================
 *
 * Kalimat di bawah adalah bentuk NYATA keterangan saksi/posita PA Donggala
 * (salinan 9 Okt) yang disamarkan. Yang dijaga:
 *   1. benih kamus alasan/waktu/pelaku sah, dan CIRI_ALASAN SUNGGUH dibaca dari
 *      kamus (mematikan/menambah baris lewat lapis database mengubah perilaku)
 *   2. P1 sebab & huruf: bunyi baru (kembali ke agama semula, Rutan/Lapas,
 *      tidak pernah kembali, dijodohkan) terbaca; penyangkalan tidak
 *   3. S6: kedua saksi sama / hanya satu saksi / pelaku berbeda / lama pisah
 *      berbeda - per huruf dan per fakta; kartu huruf membawa h.kesesuaian
 *   4. P3: subjek perbuatan per kalimat, dua arah (cerai gugat & cerai talak),
 *      pelaku = 0047 = Tergugat/Termohon
 *   5. P2: "sejak bulan Januari ... sudah 1 tahun 2 bulan" -> tahun perkiraan,
 *      hanya petunjuk di catatan kartu kosong
 *   6. pola waktu & pelaku yang dipindah ke kamus dibaca lewat kamus
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Pihak = { pelaku?: string; lawan?: string };
type Kesesuaian = { status: string; label: string; saksi1: string[]; saksi2: string[] };
type Usulan = { kode: string; nilai: string; catatan: string; petunjukWaktu?: { saksi: number; teks: string; perkiraan?: string }[] };
type HurufKartu = { huruf: string; kesesuaian?: Kesesuaian };
type Hasil = {
  ciri: string[];
  usulan: Usulan[];
  huruf: HurufKartu[];
  deteksiAlasan?: {
    sebab: { sebab: string; huruf: string; status: string; label: string; saksi1: { pelaku: string; sebutan: string } | null }[];
    huruf: { huruf: string; usul: boolean; kesesuaian: Kesesuaian }[];
    pelaku: { saksi1: { perbuatan: string; sisi: string; sebutan: string }[]; saksi2: { perbuatan: string; sisi: string; sebutan: string }[] };
    pelakuBerbeda: { perbuatan: string; saksi1: string; saksi2: string }[];
  };
  kesesuaian?: { huruf: (Kesesuaian & { huruf: string })[]; fakta: { kode: string; status: string; label: string }[] };
  deteksiAlasanGalat?: string;
};
type Pola = { kode: string; kunci: string; sebab?: string; jenis?: string; kata?: string[]; regex: string; flags?: string; yakin: string; status: string; contohBenar: string[]; contohSalah: string[]; ukur?: { n: number; tepat: number } };

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as {
  polaKelompok: (k: string) => (Pola & { re: RegExp })[];
  aturLapisDatabase: (x: { pola?: unknown[]; templat?: unknown[] }) => void;
  lupakan: () => void;
};
const layanan = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: Pihak, posita?: string) => Hasil;
  CIRI_ALASAN: { kunci: string; kata: string[]; hanyaDeteksi?: boolean }[];
  segarkanCiriAlasan: () => boolean;
};
const deteksi = require_(path.join(AKAR, "services/deteksiAlasanService.js")) as {
  sebabDariTeks: (t: string) => { sebab: string; huruf: string; pelaku: string; pola: string[] }[];
  pelakuPerKalimat: (b: string[]) => { perbuatan: string; sisi: string }[];
};
const benih = (k: string) => require_(path.join(AKAR, `kamus-deteksi/awal/${k}.json`)) as { kelompok: string; pola: Pola[] };

const GUGAT: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const TALAK: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b};`).join("\n");
const sebab = (teks: string) => deteksi.sebabDariTeks(teks).map((s) => s.sebab);
const usul = (h: Hasil, kode: string) => {
  const u = h.usulan.find((x) => x.kode === kode);
  if (!u) throw new Error(`usulan ${kode} tidak ada`);
  return u;
};
const hurufDet = (h: Hasil, huruf: string) => {
  const x = h.deteksiAlasan?.huruf.find((y) => y.huruf === huruf);
  if (!x) throw new Error(`huruf ${huruf} tidak ada (${h.deteksiAlasanGalat || ""})`);
  return x;
};

afterEach(() => {
  // Lapis database uji tidak boleh bocor ke uji lain.
  kamus.lupakan();
  layanan.segarkanCiriAlasan();
});

describe("1. benih kamus & CIRI_ALASAN dari kamus", () => {
  it.each(["alasan", "waktu", "pelaku"])("benih %s: regex sah, contoh benar cocok, contoh salah tidak, 'pasti' hanya dengan ukur >= 95%", (k) => {
    const isi = benih(k);
    expect(isi.kelompok).toBe(k);
    expect(isi.pola.length).toBeGreaterThan(10);
    const kode = new Set<string>();
    for (const p of isi.pola) {
      expect(kode.has(p.kode), p.kode).toBe(false);
      kode.add(p.kode);
      expect((p.flags || "").includes("g"), `${p.kode}: bendera g dilarang (RegExp dibagi bersama)`).toBe(false);
      const re = new RegExp(p.regex, p.flags || "");
      for (const c of p.contohBenar) expect(re.test(c), `${p.kode} harus cocok: ${c}`).toBe(true);
      for (const c of p.contohSalah) expect(re.test(c), `${p.kode} tidak boleh cocok: ${c}`).toBe(false);
      if (p.yakin === "pasti") expect(p.ukur && p.ukur.n >= 20 && p.ukur.tepat / p.ukur.n >= 0.95, p.kode).toBe(true);
    }
  });

  it("alasan: kunci = huruf A-H; baris 'ciri' setara dengan kata lamanya (semua kata dalam satu kalimat)", () => {
    for (const p of benih("alasan").pola) {
      expect("ABCDEFGH").toContain(p.kunci);
      if (p.jenis !== "ciri") continue;
      const re = new RegExp(p.regex, p.flags);
      const kata = p.kata as string[];
      expect(re.test(`awal ${kata.join(" tengah ")} akhir`), p.kode).toBe(true);
      if (kata.length > 1) expect(re.test(`awal ${kata.slice(1).join(" ")} akhir`), `${p.kode} tanpa kata pertama`).toBe(false);
    }
  });

  it("CIRI_ALASAN = baris 'ciri' kamus, urutan & hanyaDeteksi sama (144 baris, 15 hanyaDeteksi)", () => {
    const ciri = benih("alasan").pola.filter((p) => p.jenis === "ciri");
    expect(layanan.CIRI_ALASAN.map((b) => `${b.kunci}|${b.kata.join("+")}`)).toEqual(ciri.map((p) => `${p.sebab}|${(p.kata as string[]).join("+")}`));
    expect(layanan.CIRI_ALASAN).toHaveLength(144);
    expect(layanan.CIRI_ALASAN.filter((b) => b.hanyaDeteksi)).toHaveLength(15);
  });

  it("lapis database MEMATIKAN baris ciri -> 5227 berubah; dipulihkan sesudah lupakan()", () => {
    const teks = bas("penyebabnya karena Tergugat sering bermain togel");
    expect(layanan.dariKeteranganSaksi(teks, teks, "", GUGAT).ciri).toContain("judi");
    kamus.aturLapisDatabase({ pola: [{ kelompok: "alasan", kode: "ciri-judi-togel", status: "nonaktif", regex: "x" }] });
    expect(layanan.dariKeteranganSaksi(teks, teks, "", GUGAT).ciri).not.toContain("judi");
    kamus.lupakan();
    expect(layanan.dariKeteranganSaksi(teks, teks, "", GUGAT).ciri).toContain("judi");
  });

  it("lapis database MENAMBAH baris ciri baru -> ikut 5227 tanpa rilis", () => {
    const teks = bas("penyebabnya karena Tergugat sering main koprok di kampung");
    expect(layanan.dariKeteranganSaksi(teks, teks, "", GUGAT).ciri).not.toContain("judi");
    kamus.aturLapisDatabase({
      pola: [{ kelompok: "alasan", kode: "db-judi-koprok", kunci: "A", sebab: "judi", jenis: "ciri", kata: ["koprok"], regex: "koprok", flags: "i", status: "aktif", yakin: "ragu" }],
    });
    expect(layanan.dariKeteranganSaksi(teks, teks, "", GUGAT).ciri).toContain("judi");
  });
});

describe("2. P1 sebab & huruf dari pola kamus", () => {
  it.each([
    ["Termohon telah kembali ke agama semula yaitu agama Kristen", "murtad/pindah agama"],
    ["Tergugat kembali keagamanya Katolik", "murtad/pindah agama"],
    ["saat ini Tergugat ditahan di Rutan Kelas IIB Donggala", "salah satu pihak menjalani pidana penjara"],
    ["Tergugat telah dijatuhi hukuman penjara selama 6 tahun 2 bulan", "salah satu pihak menjalani pidana penjara"],
    ["sejak saat itu Tergugat tidak pernah kembali lagi ke rumah kediaman bersama", "meninggalkan"],
    ["Tergugat tidak diketahui lagi keberadaannya sampai sekarang", "meninggalkan"],
    ["pernikahan Penggugat dan Tergugat karena dijodohkan oleh orang tua", "kawin paksa"],
    ["Tergugat menderita lemah syahwat sehingga tidak mampu melaksanakan kewajibannya", "cacat badan atau penyakit"],
    ["Tergugat telah mempunyai wanita idaman lain (WIL)", "pihak lain (wanita/pria idaman lain)"],
    ["Antara Pemohon dan Termohon sering memiliki perbedaan pendapat", "beda prinsip"],
  ])("terbaca: %s", (kalimat, harapan) => {
    expect(sebab(kalimat)).toContain(harapan);
  });

  it("pola berstatus 'draf' (merantau/LDR, terukur 6/10) TIDAK dipakai; diaktifkan lewat lapis database -> dipakai", () => {
    const kalimat = "Tergugat meminta izin kepada Penggugat untuk pergi merantau ke Kalimantan";
    expect(benih("alasan").pola.find((p) => p.kode === "tambah-f-merantau")?.status).toBe("draf");
    expect(sebab(kalimat)).not.toContain("merantau/LDR");
    const dasar = benih("alasan").pola.find((p) => p.kode === "tambah-f-merantau");
    kamus.aturLapisDatabase({ pola: [{ ...dasar, kelompok: "alasan", status: "aktif" }] });
    expect(sebab(kalimat)).toContain("merantau/LDR");
  });

  it.each([
    ["almarhumah beragama Islam dan tidak pernah keluar dari agama Islam", "murtad/pindah agama"],
    ["sebenarnya tidak dijodohkan karena sebelum ada pelamaran keduanya sudah saling kenal", "kawin paksa"],
    ["Tergugat bekerja di wilayah Palu", "pihak lain (wanita/pria idaman lain)"],
    ["Penggugat sempat ditahan di rumah Termohon satu malam", "salah satu pihak menjalani pidana penjara"],
    ["Termohon sudah tidak mau berhubungan badan dengan Pemohon", "zina"],
  ])("TIDAK terbaca (penyangkalan/salah tangkap terukur): %s", (kalimat, bukan) => {
    expect(sebab(kalimat)).not.toContain(bukan);
  });

  it("huruf yang ditunjuk sebab: murtad -> H, Rutan -> C, togel -> A, KDRT -> D, nafkah -> F (penyebab perselisihan)", () => {
    const peta = Object.fromEntries(
      deteksi.sebabDariTeks(bas("Termohon kembali ke agama semula", "Tergugat ditahan di Lapas Palu", "Tergugat bermain togel", "Tergugat memukul Penggugat", "Tergugat tidak memberi nafkah")).map((s) => [s.sebab, s.huruf])
    );
    expect(peta["murtad/pindah agama"]).toBe("H");
    expect(peta["salah satu pihak menjalani pidana penjara"]).toBe("C");
    expect(peta.judi).toBe("A");
    expect(peta["kekerasan dalam rumah tangga"]).toBe("D");
    expect(peta["tidak memberi nafkah"]).toBe("F");
  });

  it("H diusulkan mesin P1 hanya bila KEDUA saksi menerangkan murtad dan posita mendalilkannya", () => {
    const s = bas("rumah tangga tidak harmonis karena Termohon telah kembali ke agama semula yaitu Kristen");
    const posita = "Bahwa Termohon telah kembali ke agama semula yaitu agama Kristen sehingga terjadi perselisihan";
    expect(hurufDet(layanan.dariKeteranganSaksi(s, s, "", TALAK, posita), "H").usul).toBe(true);
    expect(hurufDet(layanan.dariKeteranganSaksi(s, bas("sering bertengkar"), "", TALAK, posita), "H").usul).toBe(false);
  });
});

describe("3. S6 kesesuaian saksi per huruf & per fakta", () => {
  it("kedua saksi menerangkan judi oleh Tergugat -> huruf A 'kedua saksi sama', dan kartu huruf membawa kesesuaiannya", () => {
    const s = bas("sering terjadi perselisihan dan pertengkaran karena Tergugat sering bermain judi");
    const h = layanan.dariKeteranganSaksi(s, s, "", GUGAT, "Bahwa Tergugat sering bermain judi sehingga sering bertengkar");
    expect(hurufDet(h, "A").kesesuaian.status).toBe("sama");
    expect(hurufDet(h, "A").kesesuaian.label).toBe("kedua saksi sama");
    const kartuA = h.huruf.find((x) => x.huruf === "A");
    expect(kartuA?.kesesuaian?.label).toBe("kedua saksi sama");
    expect(h.huruf.find((x) => x.huruf === "F")?.kesesuaian?.status).toBe("sama");
  });

  it("hanya saksi 1 yang menerangkan judi -> 'hanya saksi 1', A tidak diusulkan", () => {
    const h = layanan.dariKeteranganSaksi(bas("sering bertengkar karena Tergugat bermain judi"), bas("sering bertengkar karena masalah rumah tangga"), "", GUGAT);
    expect(hurufDet(h, "A").kesesuaian.label).toBe("hanya saksi 1");
    expect(hurufDet(h, "A").usul).toBe(false);
  });

  it("saksi 1 'Tergugat berjudi', saksi 2 'Penggugat berjudi' -> pelaku berbeda (merah), bukan sama", () => {
    const h = layanan.dariKeteranganSaksi(bas("karena Tergugat sering berjudi"), bas("karena Penggugat sering berjudi"), "", GUGAT);
    expect(hurufDet(h, "A").kesesuaian.status).toBe("berbeda");
    expect(hurufDet(h, "A").kesesuaian.label).toBe("pelaku berbeda antar saksi");
    expect(h.deteksiAlasan?.sebab.find((x) => x.sebab === "judi")?.label).toBe("pelaku berbeda antar saksi");
  });

  it("huruf B: saksi 1 pisah 3 tahun, saksi 2 pisah 1 tahun -> lama pisah berbeda", () => {
    const h = layanan.dariKeteranganSaksi(bas("Penggugat dan Tergugat sudah berpisah selama 3 tahun"), bas("Penggugat dan Tergugat sudah berpisah selama 1 tahun"), "", GUGAT);
    expect(hurufDet(h, "B").kesesuaian.label).toBe("lama pisah berbeda antar saksi");
  });

  it("fakta 0246: saksi menyebut bulan berbeda -> berbeda; 7035 sama -> kedua saksi sama", () => {
    const h = layanan.dariKeteranganSaksi(
      bas("pisah rumah sejak bulan Mei 2023", "yang meninggalkan tempat tinggal bersama adalah Tergugat"),
      bas("pisah rumah sejak bulan Juni 2023", "yang meninggalkan tempat tinggal bersama adalah Tergugat"),
      "",
      GUGAT
    );
    const f = Object.fromEntries((h.kesesuaian?.fakta || []).map((x) => [x.kode, x]));
    expect(f["0246"].status).toBe("berbeda");
    expect(f["7035"].label).toBe("kedua saksi sama");
  });
});

describe("4. P3 subjek perbuatan per kalimat - dua arah, pelaku = 0047", () => {
  it("cerai gugat: 'Tergugat pergi meninggalkan Penggugat' -> pergi oleh Tergugat; 'Penggugat pergi ...' -> Penggugat", () => {
    expect(deteksi.pelakuPerKalimat(["Tergugat pergi meninggalkan Penggugat ke rumah orang tuanya"])).toContainEqual(expect.objectContaining({ perbuatan: "pergi", sisi: "pelaku" }));
    expect(deteksi.pelakuPerKalimat(["Penggugat pergi meninggalkan Tergugat karena sering dipukul"])).toContainEqual(expect.objectContaining({ perbuatan: "pergi", sisi: "lawan" }));
  });

  it("cerai talak: sebutan dari 0046/0047 perkara - Termohon pergi = pelaku 'Termohon'", () => {
    const h = layanan.dariKeteranganSaksi(bas("Termohon pergi meninggalkan Pemohon tanpa pamit"), bas("Termohon pergi meninggalkan Pemohon tanpa pamit"), "", TALAK);
    expect(h.deteksiAlasan?.pelaku.saksi1).toContainEqual(expect.objectContaining({ perbuatan: "pergi", sisi: "pelaku", sebutan: "Termohon" }));
    const tinggal = h.deteksiAlasan?.sebab.find((x) => x.sebab === "meninggalkan");
    expect(tinggal?.saksi1?.sebutan).toBe("Termohon");
  });

  it("tuduhan 'Tergugat menuduh Penggugat berselingkuh' bukan perselingkuhan Penggugat", () => {
    const x = deteksi.pelakuPerKalimat(["Tergugat menuduh Penggugat berselingkuh dengan laki-laki lain"]).find((y) => y.perbuatan === "selingkuh");
    expect(x?.sisi).toBe("tuduhan");
  });

  it("saksi 1: Tergugat yang pergi; saksi 2: Penggugat yang pergi -> pelakuBerbeda", () => {
    const h = layanan.dariKeteranganSaksi(bas("Tergugat pergi meninggalkan Penggugat"), bas("Penggugat pergi meninggalkan Tergugat"), "", GUGAT);
    expect(h.deteksiAlasan?.pelakuBerbeda).toContainEqual(expect.objectContaining({ perbuatan: "pergi", saksi1: "Tergugat", saksi2: "Penggugat" }));
  });
});

describe("5. P2 petunjuk waktu tanpa tahun", () => {
  it("'sejak bulan Januari ... sudah sekitar 1 tahun 2 bulan' + sidang 10 Maret 2026 -> perkiraan bulan Januari 2025; kartu 0246 kosong, catatan menyebutnya", () => {
    const s = bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari kira-kira sampai sekarang sudah sekitar 1 tahun 2 bulan");
    const u = usul(layanan.dariKeteranganSaksi(s, s, "10 Maret 2026", GUGAT), "0246");
    expect(u.nilai).toBe("");
    expect(u.petunjukWaktu?.[0]).toMatchObject({ saksi: 1, teks: "sejak bulan Januari", perkiraan: "bulan Januari 2025" });
    expect(u.catatan).toContain("Petunjuk saksi");
    expect(u.catatan).toContain("perkiraan bulan Januari 2025");
  });

  it("bulan bertahun ('sejak bulan Mei 2023') bukan petunjuk - kartu terisi seperti biasa", () => {
    const s = bas("Penggugat dan Tergugat sudah pisah rumah sejak bulan Mei 2023");
    const u = usul(layanan.dariKeteranganSaksi(s, s, "10 Maret 2026", GUGAT), "0246");
    expect(u.nilai).toBe("bulan Mei 2023");
    expect(u.petunjukWaktu).toBeUndefined();
  });
});

describe("6. pola waktu & pelaku yang dipindah dibaca LEWAT kamus", () => {
  it("menambah kata konflik 'ribut besar' lewat lapis database -> 0222 terisi dari kalimat yang dahulu tidak terbaca", () => {
    const s = bas("sejak tahun 2020 Penggugat dan Tergugat sering ribut besar");
    expect(usul(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "0222").nilai).toBe("");
    kamus.aturLapisDatabase({ pola: [{ kelompok: "waktu", kode: "db-konflik-ribut", kunci: "konflik", regex: "ribut\\s+besar", flags: "i", status: "aktif", yakin: "ragu" }] });
    expect(usul(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "0222").nilai).toBe("tahun 2020");
  });

  it("mematikan pola pemicu 'pergi-pemicu' -> 7035 tidak lagi terbaca (siapaPergiDari membaca kamus pelaku)", () => {
    const s = bas("yang meninggalkan tempat tinggal bersama adalah Tergugat");
    expect(usul(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "7035").nilai).toBe("Tergugat");
    kamus.aturLapisDatabase({ pola: [{ kelompok: "pelaku", kode: "pelaku-pergi-pemicu", status: "nonaktif", regex: "x" }] });
    expect(usul(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "7035").nilai).toBe("");
  });

  it("u.kodePola: tiap usulan dari kalimat saksi membawa kode pola kamus pemicunya; usulan dari posita tidak", () => {
    const s = bas(
      "sejak bulan Mei 2020 sering terjadi perselisihan dan pertengkaran karena Tergugat sering bermain togel",
      "Penggugat dan Tergugat sudah pisah rumah sejak bulan Juni 2023, sudah 2 tahun lamanya",
      "yang meninggalkan tempat tinggal bersama adalah Tergugat"
    );
    const h = layanan.dariKeteranganSaksi(s, s, "", GUGAT, "Bahwa Tergugat sering bermain togel");
    const kode = (k: string) => (h.usulan.find((x) => x.kode === k) as Usulan & { kodePola?: string }).kodePola;
    expect(kode("0222")).toBe("waktu-konflik");
    expect(kode("0246")).toBe("waktu-kata-pisah");
    expect(kode("7035")).toBe("pelaku-pergi-adalah");
    expect(kode("5227")).toBe("ciri-judi-togel");
    const kodeAlasan = new Set(benih("alasan").pola.map((p) => p.kode));
    for (const x of h.huruf as (HurufKartu & { kodePola?: string })[]) if (x.kodePola) expect(kodeAlasan.has(x.kodePola) || x.kodePola.startsWith("waktu-")).toBe(true);
    expect((h.huruf.find((x) => x.huruf === "A") as HurufKartu & { kodePola?: string }).kodePola).toBe("ciri-judi-togel");
    // Kedua saksi diam -> 0246 dari posita: bukan pola kamus, tanpa kodePola.
    const dariPosita = layanan.dariKeteranganSaksi(bas("saya tidak tahu"), bas("saya tidak tahu"), "", GUGAT, "Bahwa sejak bulan Juni 2023 Penggugat dan Tergugat telah pisah rumah");
    const u = dariPosita.usulan.find((x) => x.kode === "0246") as Usulan & { kodePola?: string };
    expect(u.nilai).not.toBe("");
    expect(u.kodePola).toBeUndefined();
  });

  it("lama pisah 'sudah 8 bulan pisah rumah' tetap terbaca lewat pola kamus lama-sebelum-pisah", () => {
    const s = bas("Penggugat dan Tergugat sudah 8 bulan pisah rumah");
    expect(usul(layanan.dariKeteranganSaksi(s, s, "", GUGAT), "9944").nilai).toBe("8 bulan");
  });
});
