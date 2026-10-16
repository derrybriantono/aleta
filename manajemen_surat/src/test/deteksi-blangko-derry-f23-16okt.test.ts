// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F2.3 (16 Okt 2026): variabel blangko Derry untuk jenis selain cerai - aleta_bot/services/deteksi/blangkoDerry.js.
 *
 * Posita DISALIN dari posita sungguhan SIPP server (138/Pdt.P/2022, 98/Pdt.P/2024, 30/Pdt.P/2025, 60/Pdt.P/2021,
 * 13/Pdt.P/2022, 514/Pdt.G/2021, 506/Pdt.G/2026, 602/Pdt.G/2026, 197/Pdt.P/2023) - susunan kalimat dan salah ketiknya
 * apa adanya; NAMA ORANG diganti. Ukuran per jenis: D:/aleta-dev/kerja/batch-14okt-sore/f23-deteksi/.
 */

type Fakta = Record<string, { nilai: string; yakin: string; kalimat?: string; catatan?: string; asal?: string }>;
type Usulan = { kode: string; nilai: string; keyakinan: string; nama?: string; catatan?: string; sumber?: unknown[] };
type Hasil = { ok: boolean; usulan: Usulan[]; belumSiap?: Array<{ kode: string }>; catatan?: string } | null;

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const dir = path.join(akar, "aleta_bot", "services", "deteksi");
const D = require_(path.join(dir, "blangkoDerry.js")) as {
  aktaCeraiItsbat: (p: string) => Array<{ pihak: number; nomor: string; tanggal: string; penerbit: string }>;
  deteksi: (p: string, o?: Record<string, unknown>) => Fakta;
  jenisSita: (t: string) => string[];
  alasanSita: (p: string) => { nilai: string } | null;
  bagianTertulis: (t: string) => { nilai: string } | null;
  lengkapiJenis: (h: Hasil, m: Record<string, unknown>) => Promise<Hasil>;
};
const waris = require_(path.join(dir, "waris.js")) as { deteksi: (p: string, o?: Record<string, unknown>) => Fakta };

const ITSBAT_DUDA = `<p>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda dalam usia 58 tahun (Akta Cerai Nomor : 00635/AC/2021/PA.Pal), dan Pemohon II berstatus Perawan dalam usia 19 tahun, Pernikahan dilangsungkan dengan wali nikah adalah Bapak Xxxa (Kakak Kandung Pemohon II);</p>`;
const ITSBAT_DUA_AKTA = `<p>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda (dibuktikan dengan akta cerai nomor :135/AC/2019/PA.Buol), dalam usia 55 tahun, dan Pemohon II berstatus Janda (dibuktikan dengan akta cerai nomor :23/AC/2022/PA.Tli tanggal 18 Juli 2022), dalam usia 37 tahun. Pernikahan dilangsungkan dengan wali nikah Ayah Kandung;</p>`;
const ITSBAT_KODE_ASING = `<p>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Duda di buktikan dengan nomor akta cerai : 0309/AC/2015/PA.Br dalam usia 27 tahun, dan Pemohon II berstatus Perawan dalam usia 20 tahun;</p>`;
const ITSBAT_NOMOR_KEMBAR = `<p>Bahwa pada saat pernikahan tersebut Xxxa bin Yyyb berstatus Duda dalam usia 38 tahun (Kutipan Akta Cerai Nomor : 222/AC/2015/PA.DGL), dan Pemohon berstatus Janda dalam usia 33 tahun (Kutipan Akta Cerai Nomor : 222/AC/2015/PA.DGL);</p>`;

const WALI_ADHAL_PAMAN = `<p>Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama : Xxxa bin Yyyb, umur 25 tahun, agama Islam, pekerjaan Petani, tempat tinggal di Desa Nupabomba, Kecamatan Tanantovea, Kabupaten Donggala.</p>
<p>Bahwa, antara Pemohon dengan calon suami sudah saling mencintai, sehingga Pemohon berniat untuk melangsungkan pernikahan</p>
<p>Bahwa Pemohon dan calon suami telah menyampaikan maksud tersebut kepada paman kandung Pemohon yang bernama Zzzc bin Wwwd.</p>
<p>Bahwa niat Pemohon tidak mendapatkan restu dari pihak wali Pemohon karena pihak wali Pemohon tidak menyukai calon suami Pemohon.</p>
<p>Bahwa sehubungan Pemohon dengan calon suami Pemohon akan segera melangsungkan pernikahan di Desa Nupabomba, Kecamatan Tanantovea, Kabupaten Donggala, dan atas penolakan wali Pemohon tidak didasarkan pada kepentingan Pemohon;</p>`;
const WALI_ADHAL_AYAH_DUDA = `<p>Bahwa Pemohon bermaksud akan melangsungkan pernikahan dengan seorang laki-laki pilihan yang bernama : Xxxa bin Yyyb, umur 30 tahun, agama Islam.</p>
<p>Bahwa Pemohon dan calon suami telah menyampaikan maksud tersebut kepada ayah kandung Pemohon yang bernama Zzzc bin Wwwd.</p>
<p>Bahwa niat Pemohon tidak mendapatkan restu dari pihak wali Pemohon karena calon suami Pemohon adalah seorang duda (Akta Cerai Nomor : 165/AC/2015/PA/Una) dan tidak memiliki pekerjaan yang tetap ;</p>
<p>Bahwa sehubungan Pemohon dengan calon suami Pemohon akan segera melangsungkan pernikahan di Desa Lolu, Kecamatan Sigi Biromaru, dan atas penolakan wali Pemohon tidak didasarkan pada kepentingan Pemohon;</p>`;

const WARIS_POSITA_SITA = `<p>Bahwa harta peninggalan Almarhum Xxxa berupa sebidang tanah pertanian seluas 4883 M2 yang terletak di Desa Tinggede Selatan, Kecamatan Marawola, Kabupaten Sigi;</p>
<p>Bahwa Karena Para Penggugat sangat Khawatir terhadap Para Tergugat dapat mengalihkan / memindah tangankan objek sengketa kepada Pihak lain, maka untuk menjamin Gugatan Para Penggugat, mohon kiranya Pengadilan Agama Donggala meletakkan Sita Jaminan ( CB ), terhadap objek sengketa milik Para Ahli Waris;</p>`;
const WARIS_PETITUM_SITA = `<p>Menetapkan bagian/kadar masing-masing ahli waris Almarhum Xxxa menurut Hukum Waris Islam;</p><p>Menyatakan sah dan berharga Sita Jaminan (CB) atas peninggalan Almarhum Xxxa;</p>`;
const WARIS_PETITUM_BAGIAN = `<p>3. TAHAP I Menetapkan ahli waris yang sah dari almarhumah Xxxa binti Yyyb adalah: Zzzc bin Wwwd (suami), Vvve (ibu kandung), serta Uuuf dan Tttg (anak-anak/Para Penggugat), dengan bagian: suami 1/4, ibu 1/6, dan sisanya 7/12 untuk kedua anak secara ashabah bil-ghairi;</p>`;

const PAW = `<p>Bahwa Xxxa binti Yyyb telah meninggal dunia pada tanggal 18 Mei 2023 di Palu karena sakit, sesuai Kutipan Akta Kematian Nomor 7271-KM-22052023-0001 tanggal 22 Mei 2023;</p>
<p>Bahwa semasa hidupnya almarhumah Xxxa binti Yyyb menikah dengan Zzzc bin Wwwd dan dikaruniai 2 (dua) orang anak;</p>`;

describe("itsbat: akta cerai pasangan sebelumnya (1321-1331)", () => {
  it("Duda -> Pemohon I; penerbit dari kode PA", () => {
    expect(D.aktaCeraiItsbat(ITSBAT_DUDA)).toEqual([expect.objectContaining({ pihak: 1, nomor: "00635/AC/2021/PA.Pal", tanggal: "", penerbit: "Pengadilan Agama Palu" })]);
    const f = D.deteksi(ITSBAT_DUDA, { jenisPerkara: 360 });
    expect(Object.keys(f).sort()).toEqual(["1321", "1324"]);
    expect(f["1321"]).toMatchObject({ nilai: "00635/AC/2021/PA.Pal", yakin: "ragu" });
  });

  it("dua akta: Duda -> P I, Janda -> P II, tanggal sesudah nomor", () => {
    const f = D.deteksi(ITSBAT_DUA_AKTA, { jenisPerkara: 360 });
    expect(f["1321"].nilai).toBe("135/AC/2019/PA.Buol");
    expect(f["1324"].nilai).toBe("Pengadilan Agama Buol");
    expect(f["1325"].nilai).toBe("23/AC/2022/PA.Tli");
    expect(f["1329"].nilai).toBe("18 Juli 2022");
    expect(f["1331"].nilai).toBe("Pengadilan Agama Tolitoli");
    expect(f["1322"]).toBeUndefined();
  });

  it("kode PA yang tidak dikenal tidak ditebak; nomor yang sama untuk keduanya tidak dipakai", () => {
    const f = D.deteksi(ITSBAT_KODE_ASING, { jenisPerkara: 360 });
    expect(f["1321"].nilai).toBe("0309/AC/2015/PA.Br");
    expect(f["1324"]).toBeUndefined();
    expect(D.deteksi(ITSBAT_NOMOR_KEMBAR, { jenisPerkara: 360 })).toEqual({});
  });

  it("jenis lain tidak membaca akta cerai itsbat", () => {
    expect(D.deteksi(ITSBAT_DUDA, { jenisPerkara: 371 })).toEqual({});
  });
});

describe("wali adhal: 9201/9203/9204/9206 dari bacaan waliAdhol.js", () => {
  it("wali paman: nama wali nasab diisi, hubungan, wilayah KUA ber-Kecamatan/Kabupaten", () => {
    const f = D.deteksi(WALI_ADHAL_PAMAN, { jenisPerkara: 363 });
    expect(f["9203"]).toMatchObject({ nilai: "paman kandung", yakin: "ragu" });
    expect(f["9201"].nilai).toBe("Zzzc bin Wwwd");
    expect(f["9206"].nilai).toBe("Kecamatan Tanantovea, Kabupaten Donggala");
    expect(f["9204"]).toBeUndefined();
  });

  it("wali ayah kandung: 9201 DIKOSONGKAN (petunjuk variabel); calon duda berakta cerai -> Duda Cerai Hidup", () => {
    const f = D.deteksi(WALI_ADHAL_AYAH_DUDA, { jenisPerkara: 363 });
    expect(f["9203"].nilai).toBe("ayah kandung");
    expect(f["9201"]).toBeUndefined();
    expect(f["9204"].nilai).toBe("Duda Cerai Hidup");
    expect(f["9206"].nilai).toBe("Kecamatan Sigi Biromaru");
  });
});

describe("sita (9161-9163) dan bagian waris (8719)", () => {
  it("jenis sita: jaminan, marital (termasuk 'Sita Jaminan Marital'), revindikasi", () => {
    expect(D.jenisSita("meletakkan Sita Jaminan ( CB ) terhadap objek")).toEqual(["sita jaminan (conservatoir beslag)"]);
    expect(D.jenisSita("meletakan Sita Jaminan Marital (Maritale Beslag) atas kendaraan")).toEqual(["sita marital (maritaal beslag)"]);
    expect(D.jenisSita("sah dan berharga Sita Jaminan (CB) dan Sita Rivindikatoir Berslaag (RB)")).toEqual([
      "sita jaminan (conservatoir beslag)",
      "sita revindikasi (revindicatoir beslag)",
    ]);
    expect(D.jenisSita("Menetapkan harta bersama dibagi dua")).toEqual([]);
  });

  it("alasan sita = kalimat yang memohon sita, bukan kalimat daftar harta", () => {
    const a = D.alasanSita(WARIS_POSITA_SITA);
    expect(a && a.nilai).toMatch(/^Karena Para Penggugat sangat Khawatir/);
    expect(D.alasanSita("<p>Bahwa harta waris berupa sebidang tanah dengan sertifikat yang dijual sebagian;</p>")).toBeNull();
  });

  it("kewarisan: 9161 dari petitum, 9163 dari posita, 9162 = objek sengketa modul waris; semua ragu + dasar hukum", () => {
    const f = D.deteksi(WARIS_POSITA_SITA, { jenisPerkara: 364, petitum: WARIS_PETITUM_SITA });
    expect(f["9161"]).toMatchObject({ nilai: "sita jaminan (conservatoir beslag)", yakin: "ragu" });
    expect(f["9161"].catatan).toBe("dasar: sita jaminan: Pasal 261 RBg");
    expect(f["9163"].nilai).toMatch(/memindah tangankan objek sengketa/);
    for (const k of Object.keys(f)) expect(f[k].yakin).toBe("ragu");
    expect(f["8719"]).toBeUndefined(); // "bagian/kadar ... menurut Hukum Waris Islam" bukan pecahan tertulis
  });

  it("8719 hanya bila pecahannya TERTULIS; tidak pernah dihitung ALETA", () => {
    expect(D.bagianTertulis(WARIS_PETITUM_SITA)).toBeNull();
    const f = D.deteksi("<p>Bahwa pewaris meninggal dunia.</p>", { jenisPerkara: 364, petitum: WARIS_PETITUM_BAGIAN });
    expect(f["8719"].nilai).toMatch(/suami 1\/4, ibu 1\/6/);
    expect(f["8719"]).toMatchObject({ yakin: "ragu", asal: "petitum" });
    expect(f["8719"].catatan).toMatch(/bukan hitungan ALETA.*perlu dicek pengguna/);
    // Penetapan ahli waris (371) tidak memakai 8719.
    expect(D.deteksi("<p>x</p>", { jenisPerkara: 371, petitum: WARIS_PETITUM_BAGIAN })["8719"]).toBeUndefined();
  });

  it("harta bersama tanpa permohonan sita: tidak ada 9161-9163", () => {
    expect(D.deteksi("<p>Bahwa selama perkawinan Penggugat dan Tergugat memperoleh harta bersama berupa: sebuah rumah;</p>", { jenisPerkara: 348, petitum: "<p>Menetapkan harta bersama dibagi dua</p>" })).toEqual({});
  });
});

describe("dasar hukum sita menurut keadaan (keputusan pengguna 16 Okt)", () => {
  const HB_POSITA = `<p>Bahwa selama perkawinan Penggugat dan Tergugat memperoleh harta bersama berupa: sebidang tanah di Desa Kalukubula;</p>
<p>Bahwa untuk menjamin agar harta bersama tidak dialihkan selama proses pemeriksaan perkara, Penggugat memohon agar Majelis Hakim menjatuhkan sita marital terhadap Harta bersama antara Penggugat dan Tergugat;</p>`;
  const HB_PETITUM = "<p>Menyatakan sah dan berharga sita marital atas harta bersama;</p>";
  const CG_PETITUM = "<p>Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;</p><p>Menetapkan harta bersama Penggugat dan Tergugat berupa sebidang tanah;</p><p>Menyatakan sah dan berharga sita marital atas harta bersama;</p>";

  it("harta bersama TANPA perceraian -> Pasal 95 KHI", () => {
    expect(D.deteksi(HB_POSITA, { jenisPerkara: 348, petitum: HB_PETITUM })["9161"]).toMatchObject({
      nilai: "sita marital (maritaal beslag)",
      catatan: "dasar: sita marital tanpa gugatan perceraian: Pasal 95 KHI",
    });
  });

  it("cerai berkumulasi harta bersama (dari petitum) -> Pasal 78 huruf c UU 7/1989; objek dari modul harta bersama", () => {
    const f = D.deteksi(HB_POSITA, { jenisPerkara: 347, petitum: CG_PETITUM });
    expect(f["9161"].catatan).toBe("dasar: sita marital bersamaan dengan gugatan perceraian: Pasal 78 huruf c UU 7/1989");
    expect(f["9162"].nilai).toMatch(/^1\. sebidang tanah di Desa Kalukubula/);
  });

  it("cerai TANPA kumulasi harta bersama: sita tidak dibaca; kumulasi dari SIPP ikut menentukan", async () => {
    const talak = "<p>Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;</p>";
    expect(D.deteksi(HB_POSITA, { jenisPerkara: 347, petitum: talak })).toEqual({});
    expect(D.deteksi(HB_POSITA, { jenisPerkara: 347, petitum: talak, kumulasi: [{ jenisPerkaraId: 348 }] })["9161"].catatan).toMatch(/Pasal 78 huruf c/);
    const h = (await D.lengkapiJenis(null, {
      jalur: "posita-lain", posita: HB_POSITA, jenisPerkara: "347", petitum: talak, nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      bacaKumulasi: async () => ({ daftar: [{ kode: "harta-bersama", nama: "Harta Bersama", sumber: "sipp" }] }),
    }))!;
    expect(h.usulan.find((u) => u.kode === "9161")!.catatan).toMatch(/Pasal 78 huruf c UU 7\/1989/);
  });

  it("sita revindikasi: Pasal 260 RBg", () => {
    expect(D.deteksi("<p>x</p>", { jenisPerkara: 348, petitum: "<p>Menyatakan sah sita revindicatoir beslag</p>" })["9161"].catatan).toBe("dasar: sita revindikasi: Pasal 260 RBg");
  });

  it("sita marital atas harta WARISAN tidak pernah diusulkan; panel diberi catatan (398/Pdt.G/2021)", async () => {
    const marital = "<p>Menyatakan sah dan berharga sita marital yang di letakkan atas harta warisan;</p>";
    expect(D.deteksi(HB_POSITA, { jenisPerkara: 364, petitum: marital })).toEqual({});
    const h = (await D.lengkapiJenis(null, { jalur: "posita-lain", posita: HB_POSITA, jenisPerkara: "364", petitum: marital }))!;
    expect(h.usulan.some((u) => /^916[123]$/.test(u.kode))).toBe(false);
    expect(h.catatan).toMatch(/sita marital hanya untuk harta bersama dan TIDAK berlaku untuk harta warisan/);
    // Sita jaminan + marital: hanya sita jaminan yang diusulkan.
    const f = D.deteksi(WARIS_POSITA_SITA, { jenisPerkara: 364, petitum: "<p>Menyatakan sah sita jaminan (CB) dan sita marital atas harta warisan;</p>" });
    expect(f["9161"]).toMatchObject({ nilai: "sita jaminan (conservatoir beslag)", catatan: "dasar: sita jaminan: Pasal 261 RBg" });
  });
});

describe("waris.js: gerbang 90% untuk Penetapan Ahli Waris (keputusan pengguna 16 Okt)", () => {
  it("371 -> 1025/1246/1247 cukup; 364 -> ragu (belum terukur)", () => {
    const paw = waris.deteksi(PAW, { jenisPerkara: 371 });
    expect(paw["1247"]).toMatchObject({ nilai: "sakit", yakin: "cukup" });
    expect(paw["1246"]).toMatchObject({ nilai: "18 Mei 2023", yakin: "cukup" });
    expect(paw["1025"]).toMatchObject({ nilai: "Xxxa binti Yyyb", yakin: "cukup" });
    const kw = waris.deteksi(PAW, { jenisPerkara: 364 });
    for (const k of ["1025", "1246", "1247"]) expect(kw[k].yakin).toBe("ragu");
  });

  it("posita & petitum menyebut tanggal wafat BERBEDA -> tanggal petitum, ragu, keduanya disebut (153/Pdt.P/2025)", () => {
    const posita = "<p>Bahwa Xxxa bin Yyyb telah meninggal dunia pada tanggal 27 Juni 2025 dikarenakan sakit;</p>";
    const petitum = "<p>Menyatakan bahwa Xxxa bin Yyyb telah meninggal dunia pada tanggal 27 Juni 2005 dikarenakan sakit;</p>";
    const h = waris.deteksi(posita, { jenisPerkara: 371, petitum });
    expect(h["1246"]).toMatchObject({ nilai: "27 Juni 2005", yakin: "ragu", asal: "petitum" });
    expect(h["1246"].catatan).toMatch(/Posita menyebut 27 Juni 2025, petitum 27 Juni 2005/);
  });

  it("nama pewaris bergelar berkoma (42/Pdt.P/2025) dan berawalan 'Alm . Bpk.' (203/Pdt.P/2023) terbaca", () => {
    const a = waris.deteksi("<p>Bahwa pewaris telah meninggal dunia.</p>", {
      jenisPerkara: 371,
      petitum: "<p>Menyatakan bahwa Xxxa Yyyb, S.E.MM binti Zzzc Wwwd (ALM) telah meninggal dunia pada tanggal 29 April 2025 dikarenakan sakit;</p>",
    });
    expect(a["1025"].nilai).toBe("Xxxa Yyyb, S.E.MM binti Zzzc Wwwd");
    expect(a["1246"].nilai).toBe("29 April 2025");
    const b = waris.deteksi("<p>Bahwa pewaris telah meninggal dunia.</p>", {
      jenisPerkara: 371,
      petitum: "<p>Menyatakan Alm . Bpk. Xxxa Yyyb Bin Zzzc Wwwd telah meninggal dunia karena sakit;</p>",
    });
    expect(b["1025"].nilai).toBe("Xxxa Yyyb Bin Zzzc Wwwd");
    // "Menetapkan X sebagai ahli waris" tetap bukan pewaris
    expect(waris.deteksi("<p>x</p>", { jenisPerkara: 371, petitum: "<p>Menetapkan Xxxa bin Yyyb sebagai ahli waris;</p>" })["1025"]).toBeUndefined();
  });
});

describe("lengkapiJenis: gabung ke jawaban rute", () => {
  const usul = (kode: string, nilai: string, keyakinan = "ragu"): Usulan => ({ kode, nilai, keyakinan, nama: kode });

  it("jalur itsbat pada PAW: kode pewaris jalur itsbat DIGANTI bacaan waris.js, kode lain tetap", async () => {
    const lama: Hasil = { ok: true, usulan: [usul("1025", "Ibunya"), usul("1509", "Bahwa"), usul("5197", "06 Juli 1995", "cukup")] };
    const baru = (await D.lengkapiJenis(lama, { jalur: "itsbat", posita: PAW, nomorPerkara: "197/Pdt.P/2023/PA.Dgl", bacaSipp: async () => ({ jenisPerkara: "371", petitum: "", posita: "" }) }))!;
    const nilai = Object.fromEntries(baru.usulan.map((u) => [u.kode, u.nilai]));
    expect(nilai["1025"]).toBe("Xxxa binti Yyyb");
    expect(nilai["1509"]).toBe("Palu");
    expect(nilai["5197"]).toBe("06 Juli 1995");
    expect(baru.catatan).toMatch(/aturan penetapan ahli waris/);
    // masukan tidak diubah
    expect(lama!.usulan[0].nilai).toBe("Ibunya");
  });

  it("jalur itsbat pada perwalian: 8171 (kamus tujuan itsbat) dibuang, diserahkan ke jalur posita-lain", async () => {
    const lama: Hasil = { ok: true, usulan: [usul("8171", "pengurusan kelengkapan administrasi kependudukan"), usul("5197", "06 Juli 1995", "cukup")] };
    const baru = (await D.lengkapiJenis(lama, { jalur: "itsbat", posita: PAW, jenisPerkara: "354" }))!;
    expect(baru.usulan.map((u) => u.kode)).toEqual(["5197"]);
    // jalur posita-lain tidak menyentuh 8171
    const lain = await D.lengkapiJenis(lama, { jalur: "posita-lain", posita: PAW, jenisPerkara: "354", petitum: "" });
    expect(lain).toBe(lama);
  });

  it("jalur itsbat pada itsbat nikah: kode pewaris dan 8171 TIDAK disentuh, akta cerai ditambah", async () => {
    const lama: Hasil = { ok: true, usulan: [usul("1025", "Fulan"), usul("8171", "kepastian hukum"), usul("5197", "06 Juli 1995", "cukup")] };
    const baru = (await D.lengkapiJenis(lama, { jalur: "itsbat", posita: ITSBAT_DUDA, jenisPerkara: "360" }))!;
    expect(baru.usulan.find((u) => u.kode === "1025")!.nilai).toBe("Fulan");
    expect(baru.usulan.find((u) => u.kode === "8171")!.nilai).toBe("kepastian hukum");
    expect(baru.usulan.find((u) => u.kode === "1321")).toMatchObject({ nilai: "00635/AC/2021/PA.Pal", keyakinan: "ragu" });
  });

  it("usulan lama berkode sama tidak ditimpa; kode baru keluar dari belumSiap; jawaban kosong dibangun", async () => {
    const lama: Hasil = { ok: true, usulan: [usul("9203", "kakek kandung", "cukup")], belumSiap: [{ kode: "9206" }, { kode: "1014" }] };
    const baru = (await D.lengkapiJenis(lama, { jalur: "posita-lain", posita: WALI_ADHAL_PAMAN, jenisPerkara: "363", petitum: "" }))!;
    expect(baru.usulan.find((u) => u.kode === "9203")!.nilai).toBe("kakek kandung");
    expect(baru.usulan.find((u) => u.kode === "9206")!.nilai).toBe("Kecamatan Tanantovea, Kabupaten Donggala");
    expect(baru.belumSiap).toEqual([{ kode: "1014" }]);
    const dariKosong = (await D.lengkapiJenis(null, { jalur: "posita-lain", posita: WALI_ADHAL_PAMAN, jenisPerkara: "363", petitum: "" }))!;
    expect(dariKosong.ok).toBe(true);
    expect(dariKosong.usulan.map((u) => u.kode).sort()).toEqual(["9201", "9203", "9206"]);
  });

  it("jenis tidak diketahui dan SIPP tidak terbaca: jawaban apa adanya", async () => {
    const lama: Hasil = { ok: true, usulan: [usul("1025", "Ibunya")] };
    expect(await D.lengkapiJenis(lama, { jalur: "itsbat", posita: PAW, nomorPerkara: "1/Pdt.P/2026/PA.Dgl", bacaSipp: async () => null })).toBe(lama);
    expect(await D.lengkapiJenis(lama, { jalur: "itsbat", posita: PAW })).toBe(lama);
  });
});

describe("rute /abt/usulan memanggil pelengkap blangko Derry", () => {
  type Jawab = Record<string, unknown> & { positaLain?: { ok: boolean; usulan: Usulan[] } };
  async function panggil(body: Record<string, unknown>): Promise<Jawab> {
    const router = require_(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"));
    const lapis = router.stack.find((l: any) => l.route && l.route.path === "/abt/usulan" && l.route.methods.post);
    const penangan = lapis.route.stack[lapis.route.stack.length - 1].handle;
    let keluar: Jawab = {};
    await penangan({ body, headers: {}, query: {} }, { json: (x: Jawab) => (keluar = x), status() { return this; } });
    return keluar;
  }

  it("posita-lain wali adhal: 9201/9203/9206 ikut sebagai usulan ragu", async () => {
    const j = await panggil({ sumber: "posita-lain", posita: WALI_ADHAL_PAMAN, jenisPerkara: "363", alur: "16" });
    const kode = new Map(j.positaLain!.usulan.map((u) => [u.kode, u]));
    expect(kode.get("9203")).toMatchObject({ nilai: "paman kandung", keyakinan: "ragu" });
    expect(kode.get("9201")!.nilai).toBe("Zzzc bin Wwwd");
    expect(kode.get("9206")!.nilai).toBe("Kecamatan Tanantovea, Kabupaten Donggala");
    // bacaan lama waliAdhol.js tetap ada
    expect(kode.get("1029")!.nilai).toBe("Xxxa bin Yyyb");
  });
});
