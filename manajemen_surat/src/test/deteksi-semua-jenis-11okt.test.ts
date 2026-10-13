// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DETEKSI SEMUA JENIS PERKARA (batch 11 Okt B, Agen 3)
 * ============================================================================
 *
 * Perilaku yang dijaga (bot sungguhan, tanpa basis data):
 *   - jenis perkara dikenali dari id SIPP / nama SIPP ("Istbat", "Wali Adhol"); cerai = null;
 *   - sebutan pihak dari alur/jenis_perkara_id, bukan kata;
 *   - usulan variabel per jenis dari kamus (itsbat 8171/1357, ahli waris 1025/1247/8171,
 *     wali adhol 1029/1030/6087/1046/1217, DK 1014) - "ragu" = keyakinan ragu (TIDAK tercentang);
 *   - jalur lama tidak diulang/ditimpa (keputusan sumber terukur tetap berlaku);
 *   - templat saksi ABT per jenis: variabel "..." diisi dari posita HANYA bila lulus gerbang
 *     ukur; yang sudah diisi ABT tidak disentuh; yang belum terukur disebut "tertahan";
 *   - peringatan syarat saksi per jenis; peringatan syiqaq dibuang untuk non-cerai;
 *   - rute /abt/usulan (posita-lain, itsbat, saksi-sdg) memakai semuanya;
 *   - cermin J3_VARIABEL_JENIS di ekstensi = kamus.
 * Nama orang di posita contoh adalah pengganti (Xxxa, Yyyb, ...), bukan data pihak.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const J = require_(path.join(akar, "aleta_bot", "services", "deteksiJenisPerkaraService.js"));
const U = require_(path.join(akar, "aleta_bot", "services", "abtUsulanService.js"));
const L = require_(path.join(akar, "aleta_bot", "services", "abtUsulanLainService.js"));
const D = require_(path.join(akar, "aleta_bot", "services", "deteksiSaksiService.js"));
const kamus = require_(path.join(akar, "aleta_bot", "services", "kamusDeteksi.js"));

const POSITA_ITSBAT = `<ol>
<li>Bahwa pada tanggal 21 November 1996 telah dilangsungkan pernikahan antara Pemohon I dengan Pemohon II menurut agama Islam di Desa Aaaa di wilayah hukum Kantor Urusan Agama Kecamatan Bbbb, Kabupaten Donggala, Provinsi Sulawesi Tengah;</li>
<li>Bahwa yang menjadi wali nikah adalah Ayah Kandung Pemohon II bernama Xxxa dan yang menikahkan adalah Imam Desa Aaaa bernama Yyyb, dengan dihadiri 2 (dua) orang saksi masing-masing bernama Zzzc dan Wwwd, dengan mahar berupa uang Rp100.000 dibayar tunai;</li>
<li>Bahwa pada saat pernikahan tersebut Pemohon I berstatus Jejaka dalam usia 23 tahun, dan Pemohon II berstatus Perawan dalam usia 19 tahun;</li>
<li>Bahwa pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan Bbbb, Kabupaten Donggala, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepentingan hukum lainnya;</li>
<li>Bahwa sejak menikah para Pemohon tidak pernah bercerai dan telah dikaruniai 2 (dua) orang anak;</li>
<li>Bahwa selama pernikahan tersebut tidak ada pihak ketiga yang mengganggu gugat pernikahan Pemohon I dan Pemohon II tersebut;</li>
</ol>`;

const POSITA_PAW = `1. Bahwa Xxxa binti Yyyb telah meninggal dunia pada tanggal 06 Mei 2026 dikarenakan sakit sesuai dengan Surat Keterangan Kematian Nomor : 7210-KM-08052026-0061;
2. Bahwa semasa hidupnya Xxxa binti Yyyb tetap beragama Islam;
3. Bahwa para Pemohon membutuhkan penetapan ahli waris untuk keperluan pencairan dana BPJS Ketenagakerjaan atas nama almarhumah;`;

const POSITA_WA = `Bahwa Pemohon hendak menikah dengan seorang laki-laki bernama Xxxa bin Yyyb, umur 27 tahun; Bahwa ayah kandung Pemohon bernama Zzzc bin Wwwd menolak menjadi wali nikah dengan alasan calon suami Pemohon bukan dari suku yang sama;`;

const POSITA_DK = `<ol><li>Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxa binti Yyyb (calon mempelai wanita) dengan seorang laki-laki yang bernama Zzzc bin Wwwd (calon mempelai laki-laki);</li>
<li>Bahwa anak para Pemohon yang bernama Xxxa binti Yyyb masih di bawah umur yang sampai saat ini masih berusia 16 tahun, sedangkan Zzzc bin Wwwd berumur 21 tahun;</li>
<li>Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Bbbb, Kabupaten Donggala, guna mencatatkan pernikahan tersebut, namun ditolak dengan alasan belum cukup umur;</li>
<li>Bahwa anak para Pemohon dengan calon suaminya telah saling mengenal, dan hubungan mereka telah sedemikian eratnya sehingga anak para Pemohon sekarang sedang hamil 20 minggu (Surat Keterangan Hamil);</li></ol>`;

/** Templat IN2 (ABT) - bentuk mentah, dan jawaban yang dikembalikan ABT bila variabelnya belum terisi. */
const IN2_MENTAH: Array<{ no: string; tanya: string; mentah: string }> = [
  { no: "4", tanya: "Dimana Pemohon I dengan Pemohon II menikah?", mentah: "Pemohon I dengan Pemohon II menikah di #5105#, pada tanggal #5197#;" },
  { no: "5", tanya: "Siapa yang bertindak sebagai wali nikah Pemohon II pada pernikahan tersebut?", mentah: "Yang bertindak sebagai wali nikah  adalah #1046# bernama #1217##1357#;" },
  { no: "6", tanya: "Siapa yang menikahkan Pemohon I dengan Pemohon II?", mentah: "Yang menikahkan Pemohon I dengan Pemohon II adalah #8087#;<br> Yang menikahkan Pemohon I dengan Pemohon II adalah saya sendiri sebagai wali nikah;" },
  { no: "7", tanya: "Siapakah yang bertindak sebagai saksi nikah pada saat terjadinya ijab kabul antara #8087# dan Pemohon I?", mentah: "Yang bertindak sebagai saksi nikah pada saat terjadinya ijab kabul adalah #0650# dan #0651#;" },
  { no: "8", tanya: "Apa mahar yang diberikan Pemohon I kepada Pemohon II?", mentah: "Mahar yang diberikan Pemohon I kepada Pemohon II berupa #1001#;" },
  { no: "9", tanya: "Apa status Pemohon I dan Pemohon II saat menikah?", mentah: "Sebelum menikah Pemohon I berstatus #1002# dan Pemohon II berstatus #1003#;" },
  { no: "14", tanya: "Apa tujuan Pemohon I dan Pemohon II mengajukan permohonan itsbat nikah?", mentah: "Itsbat nikah para Pemohon dimaksudkan untuk  untuk #8171#;" },
];
/** Seperti replace_array_template ABT: variabel tak berisi -> "...", berisi -> nilainya; huruf awal dibesarkan. */
function templatAbt(isian: Record<string, string> = {}) {
  return IN2_MENTAH.map((b) => {
    const jawab = b.mentah.replace(/#(\d{4})#/g, (_, k: string) => (isian[k] !== undefined ? isian[k] : "..."));
    return { no: b.no, tanya: b.tanya, jawab: jawab.charAt(0).toUpperCase() + jawab.slice(1), jawabMentah: b.mentah };
  });
}

describe("jenis perkara & sebutan dari id SIPP", () => {
  it("mengenali jenis dari id dan dari nama SIPP; cerai bukan urusan lapis ini", () => {
    expect(J.kenaliJenis(360).kunci).toBe("itsbat-nikah");
    expect(J.kenaliJenis("Pengesahan Perkawinan/Istbat Nikah").kunci).toBe("itsbat-nikah");
    expect(J.kenaliJenis("Wali Adhol").kunci).toBe("wali-adhol");
    expect(J.kenaliJenis("371").kunci).toBe("penetapan-ahli-waris");
    expect(J.kenaliJenis(364).kunci).toBe("kewarisan");
    expect(J.kenaliJenis(348).kebendaan).toBe(true);
    expect(J.kenaliJenis(346)).toBeNull();
    expect(J.kenaliJenis("Cerai Gugat")).toBeNull();
    expect(J.kenaliJenis("")).toBeNull();
  });

  it("sebutan pihak dari alur/jenis_perkara_id", () => {
    expect(J.sebutanJenis(J.kenaliJenis(360), 16)).toMatchObject({ pemohon1: "Pemohon I", pemohon2: "Pemohon II", permohonan: true });
    // 341 izin poligami: Pemohon/Termohon walau beralur gugatan
    expect(J.sebutanJenis(J.kenaliJenis(341), 15)).toMatchObject({ satu: "Pemohon", dua: "Termohon" });
    expect(J.sebutanJenis(J.kenaliJenis(348), 15)).toMatchObject({ satu: "Penggugat", dua: "Tergugat", permohonan: false });
  });
});

describe("usulan variabel per jenis dari kamus", () => {
  it("itsbat: 8171 tujuan itsbat terbaca dari posita, keyakinan ragu (tidak tercentang), membawa kodePola + kalimat", () => {
    const h = J.usulanJenis(POSITA_ITSBAT, { jenisPerkara: 360, alur: 16 });
    expect(h.ok).toBe(true);
    const u = h.usulan.find((x: { kode: string }) => x.kode === "8171");
    expect(u.nilai).toBe("mengurus Buku Nikah dan untuk kepentingan hukum lainnya");
    expect(u.keyakinan).toBe("ragu");
    expect(u.siap).toBe(false);
    expect(u.kodePola).toBe("itsbat-tujuan-membutuhkan-untuk");
    expect(u.sumber[0].asal).toBe("posita");
    expect(u.sumber[0].kalimat).toMatch(/membutuhkan Akta Nikah/);
    // pengurai itsbat lama tidak diulang di jalur ini
    expect(h.usulan.some((x: { kode: string }) => x.kode === "1217")).toBe(false);
  });

  it("itsbat: alasan wali hakim berawalan ', ' seperti blangko 'bernama #1217##1357#', berhenti sebelum 'yang menikahkan'", () => {
    const h = J.usulanJenis("Bahwa wali nikah yaitu Xxxa (Paman Pemohon II karena Ayah dari Pemohon II telah meninggal dunia) dan yang menikahkan adalah Yyyb;", { jenisPerkara: 360, alur: 16 });
    expect(h.usulan.find((x: { kode: string }) => x.kode === "1357").nilai).toBe(", karena Ayah dari Pemohon II telah meninggal dunia");
  });

  it("penetapan ahli waris: pewaris, sebab wafat, keperluan; fakta tanggal wafat", () => {
    const h = J.usulanJenis(POSITA_PAW, { jenisPerkara: 371, alur: 16 });
    const nilai = Object.fromEntries(h.usulan.map((x: { kode: string; nilai: string }) => [x.kode, x.nilai]));
    expect(nilai["1025"]).toBe("Xxxa binti Yyyb");
    expect(nilai["1247"]).toBe("sakit");
    expect(nilai["8171"]).toBe("pencairan dana BPJS Ketenagakerjaan atas nama almarhumah");
    expect(h.fakta.find((x: { kunci: string }) => x.kunci === "fakta-tanggal-wafat").nilai).toBe("06 Mei 2026");
  });

  it("wali adhol: calon suami, umur, alasan wali menolak, hubungan & nama wali", () => {
    const h = J.usulanJenis(POSITA_WA, { jenisPerkara: "Wali Adhol", alur: 16 });
    const nilai = Object.fromEntries(h.usulan.map((x: { kode: string; nilai: string }) => [x.kode, x.nilai]));
    expect(nilai).toMatchObject({
      "1029": "Xxxa bin Yyyb",
      "1030": "27",
      "6087": "calon suami Pemohon bukan dari suku yang sama",
      "1046": "ayah kandung",
      "1217": "Zzzc bin Wwwd",
    });
  });

  it("jenis yang dulu 'tidak dilayani' kini dijawab; DK lama tetap, kode lama tidak diulang", () => {
    const tidak = L.dariPositaLain(POSITA_PAW, { jenisPerkara: "371" });
    expect(tidak).toMatchObject({ ok: false, alasan: "jenis_perkara_tidak_dilayani" });
    const kini = J.tambahUsulanJenis(tidak, POSITA_PAW, { jenisPerkara: "371", alur: "16" });
    expect(kini.ok).toBe(true);
    expect(kini.jenis).toBe("penetapan-ahli-waris");
    expect(kini.usulan.map((u: { kode: string }) => u.kode).sort()).toEqual(["1025", "1247", "8171"]);

    const dk = L.dariPositaLain(POSITA_DK, { jenisPerkara: "362" });
    expect(dk.ok).toBe(true);
    const kodeLama = dk.usulan.map((u: { kode: string }) => u.kode);
    const dk2 = J.tambahUsulanJenis(dk, POSITA_DK, { jenisPerkara: "362", alur: "16" });
    // usulan lama utuh dan di depan
    expect(dk2.usulan.slice(0, dk.usulan.length)).toEqual(dk.usulan);
    const tambahan = dk2.usulan.slice(dk.usulan.length);
    expect(tambahan.map((u: { kode: string }) => u.kode)).toEqual(["1014"]);
    expect(tambahan[0].keyakinan).toBe("ragu");
    for (const k of kodeLama) expect(dk2.usulan.filter((u: { kode: string }) => u.kode === k)).toHaveLength(1);
    // tanpa posita: alasan jujur, bukan "tidak dilayani"
    expect(J.tambahUsulanJenis(tidak, "", { jenisPerkara: "371" })).toMatchObject({ ok: false, alasan: "posita_kosong" });
    // cerai tidak disentuh
    const cerai = { ok: true, usulan: [] };
    expect(J.tambahUsulanJenis(cerai, POSITA_PAW, { jenisPerkara: "347" })).toBe(cerai);
  });
});

describe("templat saksi per jenis - variabel '...' diisi dari posita, bergerbang ukur", () => {
  it("itsbat IN2: tanggal, wali, saksi nikah, status kedua pemohon terisi; mahar/yang menikahkan/tujuan/tempat tertahan", () => {
    const h = J.isiTemplatSaksi(templatAbt(), { posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16" });
    const jawab = Object.fromEntries(h.templat.map((b: { no: string; jawab: string }) => [b.no, b.jawab]));
    expect(jawab["4"]).toBe("Pemohon I dengan Pemohon II menikah di ..., pada tanggal 21 November 1996;");
    // 13 Okt: status wali lengkap dengan sebutan ("Ayah Kandung Pemohon II" - 381 dari 680 isian 1046 manusia).
    expect(jawab["5"]).toContain("adalah Ayah Kandung Pemohon II bernama Xxxa");
    expect(jawab["7"]).toBe("Yang bertindak sebagai saksi nikah pada saat terjadinya ijab kabul adalah Zzzc dan Wwwd;");
    expect(jawab["9"]).toBe("Sebelum menikah Pemohon I berstatus Jejaka dan Pemohon II berstatus Perawan;");
    // belum lulus gerbang: tidak ditulis
    expect(jawab["8"]).toBe("Mahar yang diberikan Pemohon I kepada Pemohon II berupa ...;");
    expect(jawab["6"]).toMatch(/^Yang menikahkan Pemohon I dengan Pemohon II adalah \.\.\.;/);
    expect(jawab["14"]).toBe("Itsbat nikah para Pemohon dimaksudkan untuk  untuk ...;");
    const tertahan = h.tertahan.map((t: { kunci: string }) => t.kunci);
    expect(tertahan).toEqual(expect.arrayContaining(["1001", "8087", "8171", "5105"]));
    expect(tertahan).not.toContain("1002");
    // tiap isian membawa kodePola
    for (const t of h.terisi) expect(t.kodePola).toBeTruthy();
    // masukan tidak diubah
    expect(templatAbt()[3].jawab).toMatch(/\.\.\./);
  });

  it("isian yang sudah diberikan ABT tidak disentuh", () => {
    const h = J.isiTemplatSaksi(templatAbt({ "1217": "Hhhh", "1046": "Paman" }), { posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16" });
    expect(h.templat.find((b: { no: string }) => b.no === "5").jawab).toBe("Yang bertindak sebagai wali nikah  adalah Paman bernama Hhhh...;");
    expect(h.terisi.some((t: { variabel: string }) => t.variabel === "1217")).toBe(false);
  });

  it("DK Pr: nama & umur anak dan calon suami dari aturan DK; perkara cerai tidak disentuh", () => {
    const templat = [
      { no: "4", tanya: "Apakah Saudara mengenal anak para Pemohon yang dimintakan dispensasi kawin tersebut?", jawabMentah: "Ya, saya mengenal anak para Pemohon yang dimintakan dispensasi kawin bernama #0606#;", jawab: "Ya, saya mengenal anak para Pemohon yang dimintakan dispensasi kawin bernama ...;" },
      { no: "5", tanya: "Berapa umur anak para Pemohon tersebut sekarang?", jawabMentah: "Anak para Pemohon tersebut sekarang sudah berumur #0607# tahun;", jawab: "Anak para Pemohon tersebut sekarang sudah berumur ... tahun;" },
    ];
    const h = J.isiTemplatSaksi(templat, { posita: POSITA_DK, jenisPerkara: "362", alur: "16" });
    expect(h.templat[0].jawab).toBe("Ya, saya mengenal anak para Pemohon yang dimintakan dispensasi kawin bernama Xxxa binti Yyyb;");
    expect(h.templat[1].jawab).toBe("Anak para Pemohon tersebut sekarang sudah berumur 16 tahun;");
    const cerai = J.isiTemplatSaksi(templat, { posita: POSITA_DK, jenisPerkara: "347" });
    expect(cerai.templat).toBe(templat);
    expect(cerai.terisi).toEqual([]);
  });

  it("gerbang membaca ukur kamus: tanpa gerbang (uji) mahar ikut terisi, dengan gerbang tidak", () => {
    const bebas = J.isiTemplatSaksi(templatAbt(), { posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16", tanpaGerbang: true });
    expect(bebas.templat.find((b: { no: string }) => b.no === "8").jawab).toBe("Mahar yang diberikan Pemohon I kepada Pemohon II berupa uang Rp100.000 dibayar tunai;");
    expect(J.GERBANG_ISI_SAKSI).toEqual({ ketepatan: 0.75, nMinimal: 10 });
    // pola tanya wali benar-benar terukur >= 75% n >= 10 di kamus (bukan angka karangan uji)
    const wali = kamus.polaKelompok("itsbat").find((p: { kode: string }) => p.kode === "itsbat-tanya-wali");
    expect(wali.ukur.n).toBeGreaterThanOrEqual(10);
    expect(wali.ukur.tepat / wali.ukur.n).toBeGreaterThanOrEqual(0.75);
    const mahar = kamus.polaKelompok("itsbat").find((p: { kode: string }) => p.kode === "itsbat-tanya-mahar");
    expect(mahar.ukur.tepat / mahar.ukur.n).toBeLessThan(0.75);
  });
});

describe("peringatan syarat saksi per jenis", () => {
  it("itsbat: saksi yang tidak hadir saat akad = de auditu; rukun yang belum terisi disebut", () => {
    const saksiSdg = {
      saksi: [
        { ke: 1, pihak: "P", urutPihak: 1, jawaban: [{ tanya: "Apakah Saudara hadir sewaktu Pemohon I dengan Pemohon II menikah?", jawab: "Tidak, saya tidak hadir sewaktu Pemohon I dengan Pemohon II menikah, namun saya mendapat informasi dari orang-orang yang hadir." }, { tanya: "Siapa yang menikahkan Pemohon I dengan Pemohon II?", jawab: "Yang menikahkan adalah ...", belumTerisi: false }] },
        { ke: 2, pihak: "P", urutPihak: 2, jawaban: [{ tanya: "Apakah Saudara hadir sewaktu Pemohon I dengan Pemohon II menikah?", jawab: "Ya, saya hadir sewaktu Pemohon I dengan Pemohon II menikah." }] },
      ],
    };
    const p = J.peringatanJenis({ jenisPerkara: 360, saksiSdg });
    const kode = p.map((x: { kode: string }) => x.kode);
    expect(kode).toEqual(["itsbat-nikah-de-auditu", "itsbat-nikah-rukun-kosong"]);
    expect(p[0].saksi).toBe("Saksi 1 P");
    expect(p[0].pesan).toMatch(/Pasal 14 KHI/);
    expect(p[1].pesan).toMatch(/yang menikahkan/);
    for (const x of p) expect(x.kodePola).toMatch(/^itsbat-peringatan-/);
  });

  it("DK: umur calon >= 19 disebut; hamil disebut; Perma 5/2019 selalu", () => {
    const fakta = J.faktaDariPosita(POSITA_DK, { jenisPerkara: 362, alur: 16 }).fakta;
    const p = J.peringatanJenis({ jenisPerkara: 362, saksiSdg: { saksi: [] }, fakta });
    expect(p.map((x: { kode: string }) => x.kode)).toEqual(["dispensasi-kawin-perma-dk", "dispensasi-kawin-umur-cukup", "dispensasi-kawin-hamil"]);
    expect(p[1].pesan).toMatch(/Zzzc bin Wwwd.*21 tahun/);
  });

  it("perkara kebendaan: saksi keluarga garis lurus diingatkan (Pasal 172 RBg); PAW tidak", () => {
    const paragraf = [
      { label: "Saksi 1 P", hubungan: { kunci: "Anak Kandung" } },
      { label: "Saksi 2 P", hubungan: { kunci: "Tetangga" } },
    ];
    const hb = J.peringatanJenis({ jenisPerkara: 348, saksiSdg: { saksi: [] }, paragraf });
    expect(hb.filter((x: { kode: string }) => x.kode === "harta-bersama-saksi-garis-lurus").map((x: { saksi: string }) => x.saksi)).toEqual(["Saksi 1 P"]);
    const paw = J.peringatanJenis({ jenisPerkara: 371, saksiSdg: { saksi: [] }, paragraf });
    expect(paw.some((x: { kode: string }) => /garis-lurus/.test(x.kode))).toBe(false);
  });
});

describe("susunan saksi lengkap untuk perkara itsbat (layanan sungguhan)", () => {
  it("templat terisi -> susun -> paragraf -> ruas jenis; syiqaq dibuang; kalimat pokok hanya fakta terukur", () => {
    const isi = J.isiTemplatSaksi(templatAbt(), { posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16" });
    const sdg = U.susunKeteranganSaksiSdg({ templat: isi.templat, posita: POSITA_ITSBAT, pelaku: "Termohon", lawan: "Pemohon", nomorPerkara: "1/Pdt.P/2026/PA.Uji", kodeKumpulan: "IN2", jenisPerkara: "360", alur: "16" });
    expect(sdg.ok).toBe(true);
    Object.assign(sdg, D.lengkapiSusunan(sdg, { identitas: null, lawan: "Pemohon", pelaku: "Termohon", kelompokTanya: require_(path.join(akar, "aleta_bot", "services", "pemilihRagam.js")).kelompokTanya }));
    sdg.peringatanSaksi = [...(sdg.peringatanSaksi || []), { kode: "syiqaq-tanpa-keluarga", tingkat: "ringan", pesan: "x" }];
    // posita itsbat terbaca beralasan perceraian ("pihak lain ... keberatan") - itu yang dibuang
    expect(sdg.asalAlasan).toBe("posita");
    expect(sdg.alasan.length).toBeGreaterThan(0);
    J.lengkapiSaksiJenis(sdg, isi, { posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16" });
    expect(sdg.jenisPerkara).toEqual({ kunci: "itsbat-nikah", nama: "Itsbat Nikah" });
    expect(sdg.alasan).toEqual([]);
    expect(sdg.alasanDibuangJenis.length).toBeGreaterThan(0);
    const wali = sdg.saksi1.find((b: { no: string }) => b.no === "5");
    expect(wali.jawab).toMatch(/Xxxa/);
    expect(sdg.terisiDariPosita.map((x: { no: string }) => String(x.no))).toEqual(expect.arrayContaining(["4", "5", "7", "9"]));
    expect(sdg.peringatanSaksi.some((x: { kode: string }) => /^syiqaq/.test(x.kode))).toBe(false);
    expect(sdg.catatan).toMatch(/diisi dari posita/);
    expect(sdg.catatan).toMatch(/belum terukur cukup, TIDAK diisikan/);
    expect(sdg.kalimatPokokJenis.ringkas).toMatch(/^Bahwa saksi menerangkan Pemohon I dan Pemohon II telah menikah pada tanggal 21 November 1996/);
    expect(sdg.kalimatPokokJenis.ringkas).not.toMatch(/Rp100\.000/); // mahar belum terukur -> tidak dikarang ke kalimat
    // gaya lengkap: satu butir "- Bahwa ..." per baris, wali dengan hubungannya
    const butir = sdg.kalimatPokokJenis.lengkap.split("\n");
    expect(butir.every((b: string) => b.startsWith("- Bahwa "))).toBe(true);
    expect(butir).toContain("- Bahwa yang menjadi wali nikah adalah Ayah Kandung Pemohon II bernama Xxxa;");
    expect(butir.some((b: string) => /mahar/i.test(b))).toBe(false);
  });
});

describe("rute /abt/usulan memakai deteksi per jenis", () => {
  type Jawab = Record<string, unknown> & { positaLain?: any; itsbat?: any; saksiSdg?: any };
  async function panggil(body: Record<string, unknown>): Promise<Jawab> {
    const router = require_(path.join(akar, "aleta_bot", "routes", "internalGatewayRoutes.js"));
    const lapis = router.stack.find((l: any) => l.route && l.route.path === "/abt/usulan" && l.route.methods.post);
    const penangan = lapis.route.stack[lapis.route.stack.length - 1].handle;
    let keluar: Jawab = {};
    await penangan({ body, headers: {}, query: {} }, { json: (x: Jawab) => (keluar = x), status() { return this; } });
    return keluar;
  }

  it("posita-lain: penetapan ahli waris kini berusulan", async () => {
    const j = await panggil({ sumber: "posita-lain", posita: POSITA_PAW, jenisPerkara: "371", alur: "16" });
    expect(j.positaLain.ok).toBe(true);
    expect(j.positaLain.usulan.map((u: { kode: string }) => u.kode).sort()).toEqual(["1025", "1247", "8171"]);
  });

  it("itsbat: 8171 ikut sebagai usulan ragu di belakang usulan pengurai", async () => {
    const j = await panggil({ sumber: "itsbat", posita: POSITA_ITSBAT, pemohon: "Pemohon" });
    const kode = j.itsbat.usulan.map((u: { kode: string }) => u.kode);
    expect(kode).toContain("1217");
    expect(kode[kode.length - 1]).toBe("8171");
    expect(j.itsbat.usulan.find((u: { kode: string }) => u.kode === "8171").keyakinan).toBe("ragu");
  });

  it("saksi-sdg: templat itsbat terisi dari posita dan bertanda jenis", async () => {
    const j = await panggil({ sumber: "saksi-sdg", templat: templatAbt(), posita: POSITA_ITSBAT, jenisPerkara: "360", alur: "16", pelaku: "Termohon", lawan: "Pemohon", kodeKumpulan: "IN2" });
    expect(j.saksiSdg.ok).toBe(true);
    expect(j.saksiSdg.jenisPerkara.kunci).toBe("itsbat-nikah");
    expect(j.saksiSdg.saksi1.find((b: { no: string }) => b.no === "7").jawab).toMatch(/Zzzc dan Wwwd/);
    expect(j.saksiSdg.terisiDariJenis.length).toBeGreaterThan(0);
  });
});

describe("cermin ekstensi = kamus", () => {
  it("J3_VARIABEL_JENIS di abt.js sama dengan variabel pola fakta kamus per jenis", () => {
    const teks = readFileSync(path.join(akar, "ekstensi-sipp", "abt.js"), "utf8");
    const blok = teks.match(/const J3_VARIABEL_JENIS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
    expect(blok).not.toBeNull();
    const cermin: Record<string, string[]> = {};
    for (const m of blok![1].matchAll(/(\d{3}): Object\.freeze\(\[([^\]]*)\]\)/g)) {
      cermin[m[1]] = [...m[2].matchAll(/"(\d{4,5})"/g)].map((x) => x[1]).sort();
    }
    const dariKamus: Record<string, string[]> = {};
    for (const j of J.JENIS_SEMUA) {
      const kode = [j.kelompok, ...(j.pinjam || [])]
        .flatMap((k: string) => kamus.polaKelompok(k))
        .filter((p: { jenis?: string; kunci: string }) => (p.jenis || "fakta") === "fakta" && /^\d{4,5}$/.test(p.kunci))
        .map((p: { kunci: string }) => p.kunci);
      for (const id of j.ids) dariKamus[String(id)] = [...new Set(kode)].sort() as string[];
    }
    expect(cermin).toEqual(dariKamus);
  });
});
