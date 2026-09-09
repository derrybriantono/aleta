// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * Usulan isian blangko ABT, dan penyunting di tempat yang memakainya.
 *
 * ============================================================================
 * DUA JENIS PENJAGA DALAM SATU BERKAS
 * ============================================================================
 *
 * Penurunan dari keterangan saksi diuji SUNGGUHAN - layanannya murni untuk
 * bagian itu, tidak menyentuh basis data, jadi ia dapat dipanggil apa adanya
 * dengan teks contoh yang bentuknya persis seperti yang diketik petugas.
 *
 * Sisanya penjaga sumber, dengan alasan yang sama seperti berkas ekstensi
 * lain: abt.js hidup di dalam halaman aplikasi orang lain, dan memalsukan
 * seluruh lingkungan itu lebih mungkin salah daripada kodenya sendiri.
 */

type Usulan = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: string;
  bentrok: string;
  sumber: { saksi: number; kalimat: string }[];
};

type Layanan = {
  butirKeterangan: (teks: string) => string[];
  dariKeteranganSaksi: (
    a: string,
    b: string
  ) => { butir: { saksi1: number; saksi2: number }; ciri: string[]; usulan: Usulan[] };
};

const require_ = createRequire(import.meta.url);
const berkasLayanan = path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js");
const layanan = require_(berkasLayanan) as Layanan;

const abtJs = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
const manifest = () =>
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/manifest.json"), "utf8")
  ) as { content_scripts: { js?: string[]; css?: string[]; matches: string[] }[] };

/** Bentuknya persis seperti yang diketik petugas di variabel 2021 dan 2022. */
const SAKSI_1 = [
  "- Bahwa saksi kenal dengan Penggugat karena saksi adalah tetangga Penggugat;",
  "- Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa yang biasa menjadi penyebab perselisihan adalah karena Tergugat sering cemburu buta, Tergugat tidak memberikan nafkah dan masalah KDRT;",
  "- Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2026, kira-kira sampai sekarang sudah sekitar 4 bulan lamanya;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat;",
  "- Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;",
].join("\n");

const SAKSI_2 = [
  "- Bahwa saksi kenal dengan Penggugat karena saksi adalah adik kandung Penggugat;",
  "- Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak 2018;",
  "- Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak Mei 2026, kira-kira sampai sekarang sudah sekitar 4 bulan;",
  "- Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat;",
  "- Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh pihak keluarga, namun tidak berhasil;",
].join("\n");

function ambil(hasil: ReturnType<Layanan["dariKeteranganSaksi"]>, kode: string) {
  const u = hasil.usulan.find((x) => x.kode === kode);
  expect(u, `usulan ${kode} tidak ada`).toBeTruthy();
  return u as Usulan;
}

describe("menurunkan kerangka fakta dari keterangan saksi", () => {
  it("memecah keterangan menjadi butir, bukan satu gumpalan", () => {
    // Satu fakta satu baris - bentuk itu yang membuat tiap usulan dapat
    // menunjuk KALIMAT asalnya, bukan sekadar "ada di keterangan saksi 1".
    const butir = layanan.butirKeterangan(SAKSI_1);
    expect(butir.length).toBe(6);
    expect(butir[0].startsWith("Bahwa saksi kenal")).toBe(true);
  });

  it("0222 awal konflik diambil tahunnya", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0222");
    expect(u.nilai).toBe("tahun 2018");
    expect(u.keyakinan).toBe("pasti");
  });

  it("0246 pisah rumah diambil bulan dan tahunnya", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0246");
    expect(u.nilai).toBe("bulan Mei 2026");
  });

  it("9944 lama pisah diambil angkanya", () => {
    expect(ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "9944").nilai).toBe("4 bulan");
  });

  it("7035 menjawab satu kata: siapa yang pergi", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "7035");
    expect(u.nilai).toBe("Tergugat");
    expect(u.keyakinan).toBe("pasti");
  });

  it("1268 memakai kalimat baku, bukan menyalin kalimat saksi", () => {
    // Supaya rumusannya tidak berbeda antar majelis untuk fakta yang sama.
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "1268");
    expect(u.nilai).toContain("namun tidak berhasil");
    expect(u.nilai).toContain("mendamaikan Penggugat dan Tergugat");
  });

  it("tiap usulan membawa kalimat asalnya beserta nomor saksinya", () => {
    // Tanpa ini, memeriksa satu usulan berarti membaca ulang dua blok
    // keterangan sepanjang layar.
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "0246");
    expect(u.sumber.length).toBeGreaterThan(0);
    expect(u.sumber[0].kalimat).toContain("pisah tempat tinggal");
    expect([1, 2]).toContain(u.sumber[0].saksi);
  });

  it("saksi yang berselisih ditandai bentrok, bukan dipilih diam-diam", () => {
    // Selisih antar saksi adalah soal pembuktian. Memilih salah satunya
    // diam-diam menyembunyikan persoalan yang justru harus dibaca hakim.
    const lain = SAKSI_2.replace("sejak 2018", "sejak 2021");
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, lain), "0222");
    expect(u.keyakinan).toBe("bentrok");
    expect(u.bentrok).toBe("tahun 2021");
  });

  it("satu saksi saja berarti cukup, bukan pasti", () => {
    expect(ambil(layanan.dariKeteranganSaksi(SAKSI_1, ""), "7035").keyakinan).toBe("cukup");
  });

  it("keterangan kosong tidak menghasilkan nilai karangan", () => {
    const hasil = layanan.dariKeteranganSaksi("", "");
    for (const u of hasil.usulan) {
      expect(u.nilai).toBe("");
      expect(u.keyakinan).toBe("kosong");
    }
  });

  it("5227 disusun dari ciri yang benar-benar disebut saksi", () => {
    const u = ambil(layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2), "5227");
    expect(u.nilai).toContain("kekerasan dalam rumah tangga");
    expect(u.nilai).toContain("nafkah");
    // Blangkonya mengingatkan "JANGAN LUPA TAMBAH DAN SEBELUM ALASAN TERAKHIR".
    expect(u.nilai).toContain(" dan ");
  });

  it("huruf alasan perceraian TIDAK pernah dipilih sendiri", () => {
    // Satu huruf yang salah mengubah dasar hukum putusan. Petanya harus
    // diambil dari naskah resmi lebih dulu - lihat catatan usulkanHuruf().
    const hasil = layanan.dariKeteranganSaksi(SAKSI_1, SAKSI_2);
    expect(hasil.usulan.some((u) => u.kode === "8503")).toBe(false);
    expect(hasil.usulan.some((u) => u.kode === "4020")).toBe(false);
    expect(hasil.ciri.length).toBeGreaterThan(0);
  });

  it("tidak ada arti huruf yang ditulis dari ingatan di dalam kodenya", () => {
    const sumber = readFileSync(berkasLayanan, "utf8");
    expect(sumber).not.toContain("Pasal 19 huruf");
    expect(sumber).not.toContain("huruf f Peraturan Pemerintah");
  });
});

describe("penyunting di tempat pada halaman ABT", () => {
  it("menyimpan lewat rute ABT sendiri, bukan ke basis data", () => {
    // Apa pun yang masuk tetap melewati pemeriksaan ABT dan tercatat lewat
    // jalur yang sama dengan pengisian tangan.
    const isi = abtJs();
    expect(isi).toContain("/edit_data?no_var=");
    expect(isi).toContain('badan.set("aksi", "Simpan")');
  });

  it("tidak pernah menyentuh folder APS Badilag", () => {
    const isi = abtJs();
    expect(isi).not.toContain("_blangko_abt");
    expect(isi).not.toContain("file_penetapan");
  });

  it("tipe data dibaca dari ABT, tidak ditebak", () => {
    // Menebaknya berarti mengirim tanggal sebagai teks - dan ABT
    // menyimpannya tanpa mengeluh.
    const isi = abtJs();
    expect(isi).toContain('name="var_type"');
    expect(isi).toContain("function dapatDisimpan(tipe)");
  });

  it("jawaban 200 tanpa kalimat DATA DISIMPAN dianggap gagal", () => {
    // Mengaku berhasil karena statusnya 200 adalah cara paling halus
    // kehilangan satu isian.
    const isi = abtJs();
    expect(isi).toContain("DATA DISIMPAN");
    expect(isi).toContain("anggap belum tersimpan");
  });

  it("hanya baris yang ABT sendiri izinkan yang dapat disunting", () => {
    // Baris tanpa tombol edit isinya dihitung - data_sipp atau data_sql - dan
    // menyuntingnya hanya akan tertimpa pada pemuatan berikutnya.
    const isi = abtJs();
    expect(isi).toContain("item.selAksi.querySelector");
  });

  it("perkara_id dibaca dari tombol edit, bukan ditebak dari alamat", () => {
    // Alamat halaman ABT tersandi; yang menyimpan keduanya justru atribut
    // onclick pada tombol edit.
    const isi = abtJs();
    expect(isi).toContain("function jatiDiriPerkara()");
    expect(isi).toContain("load_form");
    expect(isi).toContain("perkTemp");
  });

  it("Esc membatalkan dan Ctrl+Enter menyimpan", () => {
    const isi = abtJs();
    expect(isi).toContain('peristiwa.key === "Escape"');
    expect(isi).toContain("peristiwa.ctrlKey || peristiwa.metaKey");
  });

  it("usulan yang bentrok tidak pernah tercentang sendiri", () => {
    const isi = abtJs();
    expect(isi).toContain('u.keyakinan !== "bentrok"');
  });

  it("variabel yang tidak ada di blangko yang dibuka dilewati", () => {
    const isi = abtJs();
    expect(isi).toContain("if (!item) continue;");
  });
});

describe("ekstensi terdaftar untuk halaman ABT", () => {
  it("abt.js dipasang pada halaman aps_badilag/abt", () => {
    const m = manifest();
    const abt = m.content_scripts.find((s) => (s.js || []).includes("abt.js"));
    expect(abt).toBeTruthy();
    expect(abt?.matches).toContain("http://192.168.10.10/aps_badilag/abt/*");
    expect(abt?.css).toContain("panel.css");
  });

  it("skrip SIPP TIDAK ikut berjalan di halaman ABT", () => {
    // Seluruh logikanya menganggap dirinya berada di SIPP; menjalankannya di
    // aplikasi lain hanya menghasilkan galat diam-diam.
    const m = manifest();
    const sipp = m.content_scripts.find((s) => (s.js || []).includes("konten.js"));
    expect(sipp?.matches).toEqual(["http://192.168.10.10/SIPP/*"]);
  });

  it("abt.js ikut ditanam ke portal", () => {
    const daftar = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(daftar).toContain('"abt.js"');
  });
});
