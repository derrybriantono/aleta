// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Butir 16 (13 Okt 2026): deteksi variabel blangko Derry izin poligami (341), harta bersama (348),
 * kewarisan (364) dan penetapan ahli waris (371) dari posita/petitum/SIPP.
 *
 * Posita di bawah DISALIN dari posita sungguhan sipp_donggala (156/Pdt.G/2019, 369/Pdt.G/2020,
 * 197/Pdt.P/2023, 22/Pdt.P/2024, 31/Pdt.P/2025, 286/Pdt.G/2023, 637/Pdt.G/2025, 175/Pdt.G/2026) -
 * susunan kalimat, tanda baca, dan salah ketiknya apa adanya; NAMA ORANG diganti (Xxxa, Yyyb, ...).
 */

type Fakta = Record<string, { nilai: string; yakin: string; asal?: string; kalimat?: string }>;
type Modul = {
  kunci: string;
  jenisPerkaraId: number[];
  variabel: Array<{ kode: string; jenis?: number[] }>;
  deteksi: (posita: string, opsi?: Record<string, unknown>) => Fakta;
};
type Usulan = { kode: string; nilai: string; keyakinan: string; jagaIsianLama?: boolean };

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const dir = path.join(akar, "aleta_bot", "services", "deteksi");
const poligami = require_(path.join(dir, "poligami.js")) as Modul;
const waris = require_(path.join(dir, "waris.js")) as Modul & {
  kalimatWafat: (satu: string, nama: string) => string[];
};
const hb = require_(path.join(dir, "hartaBersama.js")) as Modul;
const pemuat = require_(path.join(dir, "index.js")) as { DAFTAR: readonly string[]; modulUntuk: (j: unknown) => { kunci: string } | null };
const sambungan = require_(path.join(dir, "sambunganPwh.js")) as {
  idJenis: (j: unknown) => number;
  tambahUsulanPwh: (h: unknown, posita: string, opsi: Record<string, unknown>) => { ok: boolean; usulan: Usulan[]; catatan: string };
  bacaSipp: (n: string, kueri: (sql: string, p: unknown[]) => Promise<unknown[]>) => Promise<Record<string, unknown> | null>;
};

/* ------------------------------------------------------------------ POLIGAMI */

const POSITA_POLIGAMI_A = `<p>Bermaksud mengajukan permohonan izin untuk poligami terhadap isteri saya :</p>
<p>Xxxa binti Yyyb, umur 50 tahun, agama Islam, pendidikan terakhir S!, pekerjaan : Pegawai Negeri Sipil, tempat tinggal di RT.003 RW.001, Jalan Lasoso, Desa Bora, Kecamatan Sigi Biromaru, Kabupaten Sigi.</p>
<p>Adapun alasan/dalil - dalil permohonan Pemohon sebagai berikut :</p>
<ol>
<li>Bahwa pada tanggal 31 Desember 1993, Pemohon dengan Termohon melangsungkan pernikahan, sebagaimana tercatat pada Duplikat Kutipan Akta Nikah Nomor : 44/02/XII/1993tanggal 02 Agustus 2007;</li>
<li>Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama : Nama : Zzzc binti Wwwd</li>
</ol>
<p>Umur : 40 tahun</p><p>Agama : Islam</p><p>Pendidikan Terakhir : SD</p><p>Pekerjaan : Urusan Rumah Tangga</p>
<p>Alamat : RT.001 RW.001, Jalan Tanggul Mas Palu, Desa Petobo, Kecamatan Palu Selatan, Kota Palu</p>
<p>Selanjutnya disebut sebagai Calon isteri kedua Pemohon.</p>
<ol>
<li>Bahwa alasan Pemohon untuk menikah lagi adalah karena Termohon sudah tidak mampu lagi memberikan keturunan.</li>
<li>Bahawa Pemohon memiliki penghasilan rata-rata perbulan Rp. 6.000.000,- (enam juta rupiah), dan jika permohonan izin ini dikabulkan Pemohon sanggup untuk memenuhi kebutuhan hidup istri-istri dan anak-anak Pemohon dengan baik.</li>
<li>Bahwa selama ikatan pernikahan Pemohon dan Termohon telah memperoleh harta berupa kendaraan roda 2 dengan nomor polisi DN 6396 JD.</li>
<li>Bahwa Termohon menyatakan rela dan tidak keberatan apabila Pemohon menikah lagi dengan calon isteri kedua Pemohon tersebut.</li>
</ol>`;

const POSITA_POLIGAMI_B = `<p>Bahwa pemohon hendak menikah lagi (poligami) dengan seorang perempuan:</p>
<p>Nama istri kedua              : Xxxa binti Yyyb</p>
<p>Umur                                : 22 tahun</p>
<p>Agama                             : Islam</p>
<p>Pekerjaan                         : Guru Ponpes</p>
<p>Alamat                              : Dusun Gunung Sari, Desa Tamarunang Kec. Doripoku</p>
<p>Bahwa antara pemohon dengan calon isteri kedua pemohon tidak ada larangan melakukan perkawinan.</p>
<p>Bahwa antara Pemohon dan Termohon selama menikah memperoleh harta sebagai berikut :</p>
<p>Rumah 1 unit</p><p>Lokasi : Desa Sibualong</p><p>Kendaraan Motor 1 unit</p>
<p>Bahwa pemohon bekerja sebagai Direktur CV. Arus Nusantara yang mempunyai penghasilan sebesar Rp. 18.500.000,- per bulan.</p>`;
const PETITUM_POLIGAMI_B = `<p>Mengabulkan permohonan pemohon;</p><p>Memberi ijin kepada pemohon untuk menikah lagi/poligami dengan seorang perempuan bernama: Xxxa;</p>`;

describe("deteksi izin poligami (341)", () => {
  it("calon istri, keterangannya, alasan, huruf alasan, penghasilan, dan harta dari posita", () => {
    const h = poligami.deteksi(POSITA_POLIGAMI_A, {});
    expect(h["8723"]).toMatchObject({ nilai: "Zzzc binti Wwwd", yakin: "cukup" });
    expect(h["8724"].nilai).toBe(
      "umur 40 tahun, pekerjaan Urusan Rumah Tangga, bertempat tinggal di RT.001 RW.001, Jalan Tanggul Mas Palu, Desa Petobo, Kecamatan Palu Selatan, Kota Palu"
    );
    expect(h["1152"]).toMatchObject({ nilai: "Termohon sudah tidak mampu lagi memberikan keturunan", yakin: "ragu" });
    // Huruf alasan adalah penilaian hukum: selalu ragu.
    expect(h["8720"]).toMatchObject({ nilai: "c", yakin: "ragu" });
    expect(h["8725"]).toMatchObject({ nilai: "Rp6.000.000,00 (enam juta rupiah)", yakin: "ragu" });
    expect(h["8722"].nilai).toBe("1. kendaraan roda 2 dengan nomor polisi DN 6396 JD;");
    // Istri pertama (Termohon) tidak pernah dibaca sebagai calon.
    expect(h["8723"].nilai).not.toContain("Xxxa");
  });

  it("bentuk 'Nama istri kedua :' + petitum bernama pendek -> nama lengkap; daftar harta bergaris rincian", () => {
    const h = poligami.deteksi(POSITA_POLIGAMI_B, { petitum: PETITUM_POLIGAMI_B });
    expect(h["8723"]).toMatchObject({ nilai: "Xxxa binti Yyyb", yakin: "cukup" });
    expect(h["8724"].nilai).toBe("umur 22 tahun, pekerjaan Guru Ponpes, bertempat tinggal di Dusun Gunung Sari, Desa Tamarunang Kec. Doripoku");
    expect(h["8722"].nilai).toBe("1. Rumah 1 unit, Lokasi: Desa Sibualong;<br>2. Kendaraan Motor 1 unit;");
    expect(h["8725"].nilai).toBe("Rp18.500.000,00 (delapan belas juta lima ratus ribu rupiah)");
  });

  it("penghasilan & huruf alasan dari SIPP (perkara_alasan_nikah) - penghasilan SIPP tercentang", () => {
    const h = poligami.deteksi(POSITA_POLIGAMI_B, { sipp: { alasanNikah: [{ alasan_id: 1, nama: "Istri tidak dapat menjalankan kewajiban", nominal_penghasilan: "15000000" }] } });
    expect(h["8725"]).toMatchObject({ nilai: "Rp15.000.000,00 (lima belas juta rupiah)", yakin: "ragu", asal: "sipp" }); // posita 18,5 jt berbeda -> ragu
    const h2 = poligami.deteksi("<p>Bahwa Pemohon hendak menikah lagi.</p>", { sipp: { alasanNikah: [{ alasan_id: 3, nominal_penghasilan: "3000000" }] } });
    expect(h2["8725"]).toMatchObject({ nilai: "Rp3.000.000,00 (tiga juta rupiah)", yakin: "cukup" });
    expect(h2["8720"]).toMatchObject({ nilai: "c", yakin: "ragu", asal: "sipp" });
  });

  it("rentang penghasilan tidak dipilihkan ALETA", () => {
    const h = poligami.deteksi(
      "<p>Bahawa Pemohon memiliki penghasilan total Rp.4.000.000,- (empat juta rupiah) sampai dengan Rp.5.000.000,- (lima juta rupiah) perbulan.</p>",
      {}
    );
    expect(h["8725"]).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ PENETAPAN AHLI WARIS */

const POSITA_PAW_A = `<p>Bahwa XXXA Binti YYYB wafat di Palu pada tanggal 18 Mei 2023 dalam usia 58 tahun. Almarhumah wafat karena sakit dan dalam keadaan beragama Islam, bertempat tinggal terakhir di Desa Baliase, Kecamatan Marawola Kabupaten Sigi. Kematian/wafatnya XXXA Binti YYYB dikuatkan dengan kutipan Akta Kematian Nomor : 7210-KM-09062023-0004 tertanggal 09 Juni 2023;</p>
<p>Bahwa semasa hidupnya, alm. XXXA Binti YYYB pernah melangsungkan pernikahan dengan seseorang lelaki yang bernama ZZZC DUNGGIO Bin. WWWD DUNGGIO, namun dari hubungan perkawinan tersebut tidak dikarunai keturunan/anak.</p>`;

const POSITA_PAW_B = `<p>Bahwa pada tanggal 27 Januari 2024 telah meninggal dunia suami dari PEMOHON yang bernama XXXA LAMAHAYU bin YYYB di Kabupaten Sigi Provinsi Sulawesi Tengah;</p>
<p>Bahwa XXXA LAMAHAYU bin YYYB meninggal dunia karena sakit dan meninggal dalam keadaan beragama Islam;</p>`;

const POSITA_PAW_C = `<p>Bahwa pada tanggal 06 Juli 1995 Xxxa alias Hafsa binti Yyyb dan Pemohon I melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Palu Barat. Dengan Kutipan Akta Nikah Nomor: 373/52/VII/1995 tanggal 25 Juli 1995 dan telah dikaruniai seorang anak yang bernama Zzzc binti Drs. Wwwd, usia 21 tahun ;</p>
<p>Bahwa Xxxa alias Hafsa binti Yyyb yang telah meninggal dunia pada tanggal 24 Mei 2023 dikarenakan kecelakaan sesuai dengan Kutipan Akta Kematian Nomor : 7210-KM-26052023-0006 tanggal 26 Mei 2023 ;</p>
<p>Bahwa Xxxa alias Hafsa binti Yyyb meninggalkan seorang suami dan seorang anak, juga meninggalkan harta warisan berupa Dana tabungan di Bank Mandiri cabang Palu atas nama HAFSA, S.E.;</p>`;

describe("deteksi penetapan ahli waris (371)", () => {
  it("pewaris, tanggal, tempat, dan sebab wafat - tanggal akta kematian TIDAK dipakai", () => {
    const h = waris.deteksi(POSITA_PAW_A, { jenisPerkara: 371 });
    expect(h["1025"].nilai).toBe("XXXA Binti YYYB");
    expect(h["1246"].nilai).toBe("18 Mei 2023");
    expect(h["1509"].nilai).toBe("Palu");
    expect(h["1247"].nilai).toBe("sakit");
    expect(h["8610"].nilai).toBe("ZZZC DUNGGIO Bin. WWWD DUNGGIO");
    for (const k of ["1509", "8610"]) expect(h[k].yakin).toBe("ragu");
    // F2.3 (16 Okt): gerbang 90% (keputusan pengguna) - 1025/1246/1247 terukur atas amar & isian petugas server
    // -> cukup, hanya untuk PAW (371).
    for (const k of ["1025", "1246", "1247"]) expect(h[k].yakin).toBe("cukup");
  });

  it("'meninggal dunia suami ... yang bernama X di Kabupaten Y'", () => {
    const h = waris.deteksi(POSITA_PAW_B, { jenisPerkara: "371" });
    expect(h["1025"].nilai).toBe("XXXA LAMAHAYU bin YYYB");
    expect(h["1246"].nilai).toBe("27 Januari 2024");
    expect(h["1247"].nilai).toBe("sakit");
    expect(h["1509"].nilai).toBe("Kabupaten Sigi Provinsi Sulawesi Tengah");
  });

  it("'dan Pemohon I melangsungkan pernikahan' -> nama Pemohon I dari SIPP; anak, tanggal nikah, harta", () => {
    const h = waris.deteksi(POSITA_PAW_C, { jenisPerkara: 371, sipp: { pihak1: [{ nama: "Qqqe bin Rrrf", urutan: 1 }] } });
    expect(h["1025"].nilai).toBe("Xxxa alias Hafsa binti Yyyb");
    expect(h["1246"].nilai).toBe("24 Mei 2023");
    expect(h["1247"].nilai).toBe("kecelakaan");
    expect(h["8610"]).toMatchObject({ nilai: "Qqqe bin Rrrf", asal: "sipp" });
    expect(h["5197"].nilai).toBe("06 Juli 1995");
    expect(h["8614"].nilai).toBe("Dana tabungan di Bank Mandiri cabang Palu atas nama HAFSA, S.E");
    expect(h["8608"].nilai).toBe("Zzzc binti Drs. Wwwd");
  });

  it("nama ayah ('X bin Pewaris') bukan kalimat wafat pewaris; petitum mendahului posita", () => {
    const satu = "Bahwa Labido Bin Xxxa tidak menikah dan telah meninggal Dunia karena Sakit di Desa Pandere pada Tanggal 17 Januari 1949";
    expect(waris.kalimatWafat(satu, "Xxxa")).toEqual([]);
    const h = waris.deteksi(`<p>${satu};</p>`, {
      jenisPerkara: 371,
      petitum: "<p>Menyatakan Xxxa telah meninggal Dunia karena Sakit dalam keadaan beragama Islam di Desa Pandere pada Tanggal 21-09-1971;</p>",
    });
    expect(h["1025"].nilai).toBe("Xxxa");
    expect(h["1246"].nilai).toBe("21 September 1971");
  });
});

/* ------------------------------------------------------------------ KEWARISAN & HARTA BERSAMA */

describe("deteksi kewarisan (364) dan harta bersama (348)", () => {
  it("kewarisan: tirkah dari butir benda berbatas bila tidak ada kalimat pembuka daftar", () => {
    const posita = `<p>Bahwa ibu penggugat bernama almarhumah Hj. XXXA Binti YYYB meninggal dunia tahun 2002.</p>
<p>Bahwa tanah beserta bangunan rumah tersebut terletak di Jl. H. Samauna, Kelurahan Labuan Bajo, Kecamatan Banawa, Kabupaten Donggala, dengan ukuran panjang + 15 m dan lebar + 9 m atau luas + 135 M2 dengan batas-batas sebagai berikut :</p>
<p>Sebelah Utara dengan:Rumah TONG HU</p><p>Sebelah Timur:Jl. H. Samauna</p>
<p>Bahwa tanah dan bangunan rumah tersebut sebagai obyek sengketa belum pernah dibagi.</p>`;
    const h = waris.deteksi(posita, { jenisPerkara: 364 });
    expect(h["8718"].nilai).toMatch(/^1\. tanah beserta bangunan rumah tersebut terletak di Jl\. H\. Samauna.*Sebelah Utara dengan: Rumah TONG HU, Sebelah Timur: Jl\. H\. Samauna;$/);
    expect(h["8718"].yakin).toBe("ragu");
    expect(h["8610"]).toBeUndefined(); // khusus P3HP
  });

  it("harta bersama: daftar benda (baris 'Ditaksir' digabung), garis/kalimat cerita dibuang; dasar putus", () => {
    const posita = `<p>Bahwa Penggugat dan Tergugat dulunya adalah suami istri yang berdasarkan putusan Pengadilan Agama Donggala Nomor: 478/Pdt.G/2021/PA Dgl tanggal 25 November 2021 yang amarnya menyebutkan:</p>
<p>Bahwa selama pernikahan Penggugat dan Tergugat telah memperoleh harta berupa:</p>
<p>Sebidang tanah dengan luas 352 m2 berlokasi di Dusun V Desa Siweli Kecamatan Balaesang;</p>
<p>1 ( Satu ) unit mobil Mitsubishi Xpander 1.5 L, plat nomor DN 1370 MG, warna Silver Metalik;</p>
<p>Ditaksir seharga Rp. 200.000.000.- ( Dua Ratus Juta Rupiah );</p>
<p>-------------------------------------------;</p>
<p>Bahwa harta bersama tersebut diatas masih dalam penguasaan Tergugat;</p>`;
    const h = hb.deteksi(posita, {});
    expect(h["8730"].nilai).toBe(
      "2.1 Sebidang tanah dengan luas 352 m2 berlokasi di Dusun V Desa Siweli Kecamatan Balaesang;<br>2.2 1 ( Satu ) unit mobil Mitsubishi Xpander 1.5 L, plat nomor DN 1370 MG, warna Silver Metalik, Ditaksir seharga Rp. 200.000.000.- ( Dua Ratus Juta Rupiah );"
    );
    expect(h["8730"].yakin).toBe("ragu");
    expect(h["8706"].nilai).toBe("Pengadilan Agama Donggala berdasarkan Putusan Nomor 478/Pdt.G/2021/PA.Dgl");
  });

  it("kalimat umum 'beberapa bidang tanah ... dikuasai Tergugat' bukan benda", () => {
    const h = hb.deteksi("<p>Bahwa selama perkawinan telah memperoleh harta bersama berupa beberapa bidang tanah, bangunan, kendaraan. Namun demikian seluruhnya berada dalam penguasaan Tergugat;</p>", {});
    expect(h["8730"]).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ SAMBUNGAN, PEMUAT, CERMIN EKSTENSI */

describe("sambungan rute posita-lain dan cermin ekstensi", () => {
  it("modul terdaftar di pemuat bersama; id jenis dari nama", () => {
    for (const n of ["poligami", "waris", "hartaBersama"]) expect(pemuat.DAFTAR).toContain(n);
    expect(pemuat.modulUntuk(371)?.kunci).toBe("waris");
    expect(pemuat.modulUntuk("341")?.kunci).toBe("izin-poligami");
    expect(sambungan.idJenis("P3HP/Penetapan Ahli Waris")).toBe(371);
    expect(sambungan.idJenis("Izin Poligami")).toBe(341);
    expect(sambungan.idJenis("Cerai Gugat")).toBe(0);
  });

  it("usulan modul MENGGANTI usulan kamus lama berkode sama; diberi jagaIsianLama", () => {
    const lama = { ok: true, usulan: [{ kode: "1025", nilai: "Bahwa XXXA", keyakinan: "ragu" }, { kode: "8171", nilai: "pencairan", keyakinan: "ragu" }], bawaanAbt: [], belumSiap: [], catatan: "" };
    const h = sambungan.tambahUsulanPwh(lama, POSITA_PAW_A, { jenisPerkara: "371" });
    const kode1025 = h.usulan.filter((u) => u.kode === "1025");
    expect(kode1025).toHaveLength(1);
    expect(kode1025[0]).toMatchObject({ nilai: "XXXA Binti YYYB", jagaIsianLama: true });
    expect(h.usulan.some((u) => u.kode === "8171")).toBe(true);
    // Jenis yang dulu "tidak dilayani" kini dijawab.
    const baru = sambungan.tambahUsulanPwh({ ok: false, alasan: "jenis_perkara_tidak_dilayani", usulan: [] }, POSITA_POLIGAMI_A, { jenisPerkara: "Izin Poligami" });
    expect(baru.ok).toBe(true);
    expect(baru.usulan.find((u) => u.kode === "8723")).toMatchObject({ keyakinan: "cukup" });
  });

  it("bacaSipp hanya SELECT", async () => {
    const sql: string[] = [];
    const s = await sambungan.bacaSipp("1/Pdt.G/2026/PA.Dgl", async (q) => {
      sql.push(q);
      return /FROM perkara WHERE/.test(q) ? [{ perkara_id: 7, jenis_perkara_id: 341, petitum: "x" }] : [];
    });
    expect(s).toMatchObject({ perkaraId: 7, jenisPerkaraId: 341 });
    expect(sql.every((q) => /^\s*SELECT\b/i.test(q))).toBe(true);
  });

  it("PWH_VARIABEL_JENIS di abt.js = variabel modul per jenis", () => {
    const teks = readFileSync(path.join(akar, "ekstensi-sipp", "abt.js"), "utf8");
    const blok = teks.match(/const PWH_VARIABEL_JENIS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
    expect(blok).not.toBeNull();
    const cermin: Record<string, string[]> = {};
    for (const m of blok![1].matchAll(/(\d{3}): Object\.freeze\(\[([^\]]*)\]\)/g)) cermin[m[1]] = [...m[2].matchAll(/"(\d{4,5})"/g)].map((x) => x[1]).sort();
    const dariModul: Record<string, string[]> = {};
    for (const m of [poligami, waris, hb]) {
      for (const id of m.jenisPerkaraId) dariModul[String(id)] = m.variabel.filter((v) => !v.jenis || v.jenis.includes(id)).map((v) => v.kode).sort();
    }
    expect(cermin).toEqual(dariModul);
  });
});
