// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * EMPAT SEBAB DROPDOWN PENUNJUKAN TIDAK PERNAH MUNCUL
 * ============================================================================
 *
 * Dibuktikan dengan memanggil layanannya di server untuk perkara nyata
 * 399/Pdt.G/2026 dan 216/Pdt.P/2026 - keduanya bermajelis:
 *
 *   pmh.hitungan : 0   dropdown hakim dibuka hanya bila > 1
 *   pmh.anggota  : 3
 *   pmh.calon    : 5   daftar lengkapnya SUDAH dikirim, tidak pernah dipakai
 *   ppp kunci    : usulan, calon, sebab, peringatan, terbaca
 *   pjs kunci    : usulan, calon, sebab, peringatan, terbaca, alasan
 *   phs kunci    : usulan, sebut, sebab, jarakHari
 *
 *   (a) Cabang bermajelis memulangkan hitungan kosong, sehingga perkara
 *       bermajelis - hampir seluruh perkara di sana - tidak pernah punya
 *       pilihan hakim walau cara manual dinyalakan.
 *   (b) Layanan mengirim `calon`, ekstensi membaca `daftar`. Salah nama medan
 *       yang tidak menimbulkan galat apa pun: dropdown PP dan juru sita
 *       sekadar tidak pernah tergambar.
 *   (c) PHS tidak punya daftar calon sama sekali.
 *   (d) Pilihan manual PMH hanya menimpa KETUA - dua anggota lainnya tetap
 *       dari usulan, sehingga "manual" hanya berlaku atas sepertiga susunan.
 *
 * ============================================================================
 * SUSUNAN MAJELIS TIDAK DIAMBIL DARI SK
 * ============================================================================
 *
 * ref_majelis_tetap berisi 106 baris dan TIDAK SATU PUN aktif, jadi susunan
 * menurut SK terbaca kosong. Yang ditawarkan susunan yang benar-benar dipakai
 * tahun ini, dibaca dari perkara_hakim_pn - dan itu memang yang diminta:
 * tidak terikat SK.
 */

const require_ = createRequire(import.meta.url);
const berkasKonten = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const berkasLayanan = path.resolve(process.cwd(), "../aleta_bot/services/penunjukanService.js");
const konten = () => readFileSync(berkasKonten, "utf8");
const layanan = () => readFileSync(berkasLayanan, "utf8");

const penunjukan = require_(berkasLayanan) as {
  susunPmh: (arg: Record<string, unknown>) => {
    hitungan: Array<{ hakimId: number; nama: string; jumlah: number }>;
    anggota: Array<{ hakimId: number; nama: string }>;
    susunanTerpakai: Array<{ kunci: string }>;
  };
};

const HAKIM = [
  { hakimId: 32, kode: "A", nama: "Fahri Saifuddin", mulai: "2020-01-01" },
  { hakimId: 33, kode: "B", nama: "Sudarmin H.I.M. Tang", mulai: "2020-01-01" },
  { hakimId: 26, kode: "C1", nama: "Himawan Tatura Wijaya", mulai: "2020-01-01" },
  { hakimId: 28, kode: "C2", nama: "Idris", mulai: "2020-01-01" },
  { hakimId: 31, kode: "C3", nama: "Derry Briantono", mulai: "2020-01-01" },
];

function jalankanMajelis(opsi: Record<string, unknown> = {}) {
  return penunjukan.susunPmh({
    bentuk: { bentuk: "majelis", sebab: "gugatan", perluNilai: false },
    smart: { ada: true, hakimId: [26, 28, 31], diganti: false, keterangan: "" },
    susunan: { terbaca: false, majelis: [] },
    hakimAktif: HAKIM,
    namaHakim: new Map(HAKIM.map((x) => [x.hakimId, x])),
    beban: new Map(),
    // Beban MAJELIS, bukan beban hakim tunggal - angka nyata 2026.
    bebanMajelis: new Map([
      [31, 597],
      [28, 463],
      [26, 378],
      [33, 143],
      [32, 76],
    ]),
    susunanTerpakai: [
      { kunci: "26-28-31", hakimId: [26, 28, 31], anggota: [], perkara: 257 },
      { kunci: "33-28-31", hakimId: [33, 28, 31], anggota: [], perkara: 123 },
    ],
    aturan: {},
    ...opsi,
  });
}

describe("perkara bermajelis kini punya kolam hakim", () => {
  it("hitungan tidak lagi kosong", () => {
    // Inilah sebab (a). Tanpa ini, dropdown hakim tidak pernah digambar pada
    // perkara bermajelis - dan hampir seluruh perkara di sana bermajelis.
    expect(jalankanMajelis().hitungan.length).toBe(5);
  });

  it("usulan smart majelis TIDAK diganti", () => {
    // Kolam ditambahkan sebagai bahan memilih, bukan sebagai usulan tandingan.
    expect(jalankanMajelis().anggota.map((x) => x.hakimId)).toEqual([26, 28, 31]);
  });

  it("bebannya beban majelis, bukan beban hakim tunggal", () => {
    // Hakim yang setahun ini duduk pada 597 majelis akan tampak berbeban nol
    // bila yang dipakai hitungan hakim tunggal.
    const derry = jalankanMajelis().hitungan.find((x) => x.hakimId === 31);
    expect(derry?.jumlah).toBe(597);
  });

  it("yang paling ringan bebannya di atas", () => {
    // Urutan itulah keterangannya: yang memilih perlu melihat siapa yang
    // paling sedikit menerima, bukan daftar menurut abjad.
    expect(jalankanMajelis().hitungan[0].hakimId).toBe(32);
  });

  it("kolam tetap dikirim walau smart majelis tidak ada", () => {
    // Justru di situlah pilihannya paling dibutuhkan: tidak ada usulan sama
    // sekali, jadi seluruhnya harus dipilih tangan.
    const tanpa = jalankanMajelis({ smart: { ada: false, alasan: "belum ada" } });
    expect(tanpa.hitungan.length).toBe(5);
    expect(tanpa.susunanTerpakai.length).toBe(2);
  });
});

describe("nama medan layanan dan ekstensi tidak boleh berselisih", () => {
  it("PP dan JS dibaca sebagai calon, sesuai yang dikirim layanan", () => {
    // Sebab (b): layanan mengirim `calon`, ekstensi dulu membaca `daftar`.
    // Salah nama medan yang tidak menimbulkan galat - dropdown-nya sekadar
    // tidak pernah tergambar.
    const isi = konten();
    expect(isi).toContain("pilihanDari(ppp.calon, pilihanManual.ppp)");
    expect(isi).toContain("pilihanDari(pjs.calon, pilihanManual.pjs)");
    expect(isi).not.toContain("ppp.daftar");
    expect(isi).not.toContain("pjs.daftar");
  });

  it("layanan memang mengirim calon, bukan daftar", () => {
    // Dijaga dari dua arah: menamainya ulang di layanan tanpa mengubah
    // ekstensi akan mematikan dropdown-nya lagi, tanpa satu pun galat.
    const isi = layanan();
    expect(isi).toContain("calon: calonSk,");
    expect(isi).toContain("calon: jurusita.daftar,");
  });
});

describe("tiga kursi majelis, bukan hanya ketua", () => {
  it("ketiganya dapat dipilih sendiri-sendiri", () => {
    // Sebab (d): sebelumnya "manual" hanya berlaku atas sepertiga susunan.
    const isi = konten();
    expect(isi).toContain('[0, "hakim_ketua"]');
    expect(isi).toContain('[1, "hakim_anggota_1"]');
    expect(isi).toContain('[2, "hakim_anggota_2"]');
    expect(isi).toContain("pilihanManual.pmhKursi");
  });

  it("satu orang tidak dapat menempati dua kursi", () => {
    // SIPP akan menolaknya belakangan dengan galat yang tidak menyebut
    // sebabnya - lebih baik tidak ditawarkan sejak awal.
    expect(konten()).toContain("dipakaiLain.includes");
  });

  it("susunan majelis yang dipilih MENANG atas pilihan per kursi", () => {
    // Yang memilih satu susunan utuh sedang menyatakan maksud yang lebih besar
    // daripada satu kursi; kursi sisa pilihan sebelumnya tidak boleh menyelinap.
    expect(konten()).toContain("const orang = dariSusunan || dariOrang || anggota[urutan];");
  });

  it("berpindah cara membuang pilihan cara sebelumnya", () => {
    // Pilihan yang tidak terlihat lagi tetapi masih mengisi formulir adalah
    // saklar yang berbohong tentang apa yang akan terjadi.
    const isi = konten();
    expect(isi).toContain("if (nilai === \"majelis\") pilihanManual.pmhKursi = [];");
    expect(isi).toContain("else pilihanManual.majelis = \"\";");
  });
});

describe("PHS pun dapat dipilih", () => {
  it("layanan mengirim tanggal calon", () => {
    // Sebab (c). PHS-lah yang paling sering perlu digeser.
    expect(layanan()).toContain("calon: tanggalSidang");
  });

  it("hanya hari sidang majelis itu yang ditawarkan", () => {
    // Hari sembarang akan menghasilkan penetapan hari sidang pada hari majelis
    // itu tidak bersidang - itu bukan kelonggaran, itu kekeliruan.
    expect(layanan()).toContain("[0, 7, 14, 21]");
  });

  it("tanggal yang tidak ada di daftar jatuh kembali ke usulan", () => {
    // Daftarnya dapat berubah sesudah papan digambar.
    expect(konten()).toContain("const dipilih = calon.find((x) => x.tanggal === pilihanManual.phs);");
  });
});

describe("catatan menyebut mana yang dipilih tangan", () => {
  it("asal nilai tidak lagi selalu otomatis", () => {
    // Sebelumnya seluruh baris catatan bertanda "otomatis", bahkan yang jelas
    // dipilih tangan - catatan yang menghapus jejak keputusan manusia.
    const isi = konten();
    expect(isi).toContain('asal: dipilihTangan(medan) ? "manual" : "otomatis",');
    expect(isi).not.toContain('asal: "otomatis",');
  });

  it("manual hanya untuk medan yang memang ada pilihannya", () => {
    // Petugas dapat menyalakan manual lalu tidak mengubah apa pun; mencatat
    // seluruhnya manual akan menghapus jejak bahwa usulan ALETA yang dipakai.
    expect(konten()).toContain("const dipilihTangan = (medan) => {");
  });
});
