// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KETERANGAN SAKSI: YANG DIISI, DAN YANG DAPAT DIPINDAHKAN
 * ============================================================================
 *
 * Lima permintaan dari layar ABT, 16 September 2026:
 *
 *   1. jawaban templat yang masih "...", "___", "melihat/mendengar" harus
 *      DIISI dari gugatan - bukan sekadar dihitung dan dilaporkan;
 *   2. baris keterangan dapat digeser (atas, bawah, menyeberang), disalin,
 *      ditambah, dan dihapus;
 *   3. tombol "Susun posita dari keterangan saksi" menjadi "Input ke ABT";
 *   4. kartu alasan perceraian dirapikan menjadi blok;
 *   5. "Tuliskan huruf alasan" berdiri bersama "Terapkan yang dicentang".
 *
 * Butir 1 diuji dengan MENJALANKAN layanannya; sisanya menyisir sumber
 * panel, sebab ia menyentuh DOM yang tidak dapat dirender di sini.
 */

const AKAR = path.resolve(__dirname, "../../..");
const abt = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8");
const gaya = readFileSync(path.join(AKAR, "ekstensi-sipp/panel.css"), "utf8");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const layanan = require(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

const POSITA = [
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Januari 2019;",
  "Bahwa sejak bulan Oktober 2025 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran;",
  "Bahwa sejak bulan Januari 2026 Penggugat dan Tergugat telah pisah rumah selama 8 bulan;",
  "Bahwa yang meninggalkan kediaman bersama adalah Penggugat;",
].join("\n");

describe("butir 1 - jawaban templat diisi dari gugatan", () => {
  it("fakta gugatan terbaca: awal konflik, sejak kapan pisah, berapa lama, siapa yang pergi", () => {
    const fakta = layanan.faktaDariPosita(POSITA, "Siti", "Budi");
    expect(fakta.awalKonflik).toMatch(/Oktober 2025/i);
    expect(fakta.pisahSejak).toMatch(/Januari 2026/i);
    expect(fakta.lamaPisah).toMatch(/8 bulan/i);
    expect(fakta.siapaPergi).toBe("Siti");
  });

  it("titik-titik pada jawaban diganti fakta itu", () => {
    const fakta = layanan.faktaDariPosita(POSITA, "Siti", "Budi");
    const isi = (tanya: string, jawab: string) =>
      layanan.lengkapiJawabanTemplat({ tanya, jawab, fakta });

    expect(isi("Kapan mulai terjadi perselisihan?", "Ya, perselisihan terjadi sejak ...;")).toContain(
      "Oktober 2025"
    );
    expect(isi("Sudah berapa lama berpisah tempat tinggal?", "berpisah kurang lebih ...;")).toContain(
      "8 bulan"
    );
    expect(isi("Siapa yang meninggalkan tempat tinggal bersama?", "yang meninggalkan adalah ...;")).toContain(
      "Siti"
    );
  });

  it("angka yang TIDAK ada di gugatan tidak dikarang", () => {
    // Berapa kali saksi menyaksikan pertengkaran tidak tertulis di gugatan
    // mana pun, dan angka karangan pada berita acara adalah keterangan palsu.
    const fakta = layanan.faktaDariPosita(POSITA, "Siti", "Budi");
    const hasil = layanan.lengkapiJawabanTemplat({
      tanya: "Berapa kali saksi melihat mereka bertengkar?",
      jawab: "saya melihat mereka bertengkar _ kali;",
      fakta,
    });
    expect(hasil).toContain("beberapa kali");
    expect(hasil).not.toMatch(/\d+\s*kali/);
  });

  it("pilihan templat melihat/mendengar diselesaikan", () => {
    const hasil = layanan.lengkapiJawabanTemplat({
      tanya: "Apakah saksi melihat sendiri?",
      jawab: "saya melihat/mendengar sendiri;",
      fakta: layanan.faktaDariPosita(POSITA, "Siti", "Budi"),
    });
    expect(hasil).toContain("melihat dan mendengar");
    expect(hasil).not.toContain("melihat/mendengar");
  });

  it("gugatan yang TIDAK menyebutkannya dibiarkan bertitik-titik", () => {
    // Mengarang tanggal pisah rumah ke dalam berita acara sidang jauh lebih
    // berbahaya daripada titik-titik yang terlihat dan dapat diisi orang.
    const fakta = layanan.faktaDariPosita("Bahwa Penggugat dan Tergugat menikah;", "Siti", "Budi");
    const hasil = layanan.lengkapiJawabanTemplat({
      tanya: "Kapan mulai terjadi perselisihan?",
      jawab: "perselisihan terjadi sejak ...;",
      fakta,
    });
    expect(hasil).toContain("...");
  });

  it("jawaban yang sudah lengkap tidak disentuh sama sekali", () => {
    const fakta = layanan.faktaDariPosita(POSITA, "Siti", "Budi");
    const semula = "Benar, saya mengetahui karena saya melihat sendiri;";
    expect(layanan.lengkapiJawabanTemplat({ tanya: "Apakah saksi tahu?", jawab: semula, fakta })).toBe(
      semula
    );
  });
});

describe("butir 1b - modus saksi yang hanya tahu pisahnya", () => {
  const templat = [
    { no: "1", tanya: "Apakah saksi tahu penyebab perselisihan?", jawab: "penyebabnya ...;" },
    { no: "2", tanya: "Berapa kali saksi melihat mereka bertengkar?", jawab: "saya melihat _ kali;" },
    { no: "3", tanya: "Apakah saksi masih sanggup mendamaikan?", jawab: "saya tidak sanggup;" },
    { no: "4", tanya: "Sejak kapan mereka pisah rumah?", jawab: "sejak ...;" },
  ];

  it("modusnya dikenali dan dipakai", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat,
      posita: POSITA,
      modus: { saksi1: { modus: "tahu-pisah" }, saksi2: { modus: "sama" } },
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.modus.saksi1).toBe("tahu-pisah");
  });

  it("ia TIDAK menerangkan pertengkaran yang tidak dilihatnya", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat,
      posita: POSITA,
      modus: { saksi1: { modus: "tahu-pisah" }, saksi2: { modus: "sama" } },
    });
    const jawabNo = (n: string) => hasil.saksi1.find((b: { no: string }) => b.no === n).jawab;
    expect(jawabNo("1")).toMatch(/tidak (mengetahui|pernah mengetahui)/i);
    expect(jawabNo("2")).toMatch(/(tidak|belum) pernah (melihat|menyaksikan)/i);
  });

  it("tetapi pisah rumahnya TETAP diterangkan - itu yang ia ketahui", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat,
      posita: POSITA,
      modus: { saksi1: { modus: "tahu-pisah" }, saksi2: { modus: "sama" } },
    });
    const pisah = hasil.saksi1.find((b: { no: string }) => b.no === "4").jawab;
    expect(pisah).toMatch(/Januari 2026|8 bulan/i);
    expect(pisah).not.toContain("...");
  });

  it("yang terisi dari gugatan disebut terpisah dari yang masih kosong", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat,
      posita: POSITA,
      modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } },
    });
    expect(Array.isArray(hasil.terisiDariPosita)).toBe(true);
    expect(hasil.terisiDariPosita.length).toBeGreaterThan(0);
    expect(hasil.catatan).toContain("diisi dari gugatan");
  });
});

describe("butir 2 - baris keterangan dapat digeser, disalin, ditambah, dihapus", () => {
  const badan = () => {
    const mulai = abt.indexOf("function gambarPratinjauSdg(");
    expect(mulai).toBeGreaterThan(-1);
    return abt.slice(mulai, abt.indexOf("\n  function gambarFormSdg(", mulai));
  };

  it("menyeberang berarti DISISIPKAN sebagai baris tambahan, bukan menimpa", () => {
    // Diputuskan pengguna 16 September 2026. Menimpa akan menghapus
    // keterangan yang sudah benar tanpa dapat dibatalkan.
    const isi = badan();
    expect(isi).toContain("function pindahkan(dariKolom, dariIndeks, keKolom, keIndeks)");
    expect(isi).toContain("dataSaksi[keKolom].splice(batas, 0, butir);");
    expect(isi).toContain("pindahkan(k, i, 1 - k, dataSaksi[1 - k].length)");
  });

  it("naik, turun, salin, hapus, dan tambah semuanya ada", () => {
    const isi = badan();
    expect(isi).toContain('tombol("↑", "Naikkan"');
    expect(isi).toContain('tombol("↓", "Turunkan"');
    expect(isi).toContain('tombol("⇄"');
    expect(isi).toContain('tombol("⧉"');
    expect(isi).toContain('tombol("✕", "Hapus keterangan ini"');
    expect(isi).toContain('"+ Tambah keterangan"');
  });

  it("salin TIDAK memindahkan - yang disalin tetap di tempatnya", () => {
    const isi = badan();
    const mulai = isi.indexOf('tombol("⧉"');
    expect(isi.slice(mulai, mulai + 300)).toContain("dataSaksi[1 - k].push({");
    expect(isi.slice(mulai, mulai + 300)).not.toContain("splice(i, 1)");
  });

  it("diseret dengan peristiwa seret sungguhan, bukan hanya tombol", () => {
    const isi = badan();
    expect(isi).toContain("baris.draggable = true;");
    for (const peristiwa of ["dragstart", "dragend", "dragover", "drop"]) {
      expect(isi, peristiwa).toContain(`addEventListener("${peristiwa}"`);
    }
    // Menjatuhkan di ruang kosong kolom berarti "taruh paling bawah".
    expect(isi).toContain("pindahkan(asal.kolom, asal.indeks, k, dataSaksi[k].length);");
  });

  it("penyimpan tetap membaca wadah yang sama walau barisnya berubah", () => {
    // kolomIsian ditutup dalam closure penyimpan; isinya yang diganti, bukan
    // wadahnya - kalau tidak, menyimpan sesudah menggeser akan menyimpan
    // susunan yang lama.
    const isi = badan();
    expect(isi).toContain("const kolomIsian = [[], []];");
    expect(isi).toContain("kolomIsian[k].length = 0;");
    // Dan nomornya dihitung ulang menurut posisi saat disimpan.
    expect(isi).toContain("no: String(n + 1)");
  });

  it("jawaban yang diisi dari gugatan ditandai berbeda dari yang masih kosong", () => {
    const isi = badan();
    expect(isi).toContain("aleta-sdg-dari-gugatan");
    expect(isi).toContain("Diisi ALETA dari gugatan - periksa dahulu sebelum disimpan.");
    expect(gaya).toContain(".aleta-sdg-dari-gugatan");
  });
});

describe("butir 3, 4, 5 - nama tombol, kerapian kartu, letak tombol", () => {
  it("tombolnya bernama Input ke ABT", () => {
    expect(abt).toContain('buatElemen("button", "aleta-permintaan-tombol", "Input ke ABT")');
    expect(abt).not.toContain('"Susun posita dari keterangan saksi"');
  });

  it("tiap kelompok alasan menjadi blok berkepala nama dan jumlahnya", () => {
    expect(abt).toContain("aleta-alasan-kelompok");
    expect(abt).toContain('buatElemen("span", "aleta-alasan-jumlah", String(daftar.length))');
    expect(abt).toContain("aleta-alasan-deret");
    // Yang SIAP memakai pembantu yang sama - bukan disusun sendiri.
    expect(abt).toContain('"Siap dipakai",');
    expect(gaya).toContain(".aleta-alasan-kelompok {");
    expect(gaya).toContain(".aleta-alasan-butir {");
  });

  it("Tuliskan huruf alasan berdiri di baris tindakan bersama Terapkan yang dicentang", () => {
    expect(abt).toContain("hurufMenunggu = { tombol: terap, kabar: kabarHuruf };");
    expect(abt).toContain('const barisTindakan = buatElemen("div", "aleta-abt-tindakan");');
    expect(abt).toContain("barisTindakan.appendChild(hurufMenunggu.tombol);");
    expect(gaya).toContain(".aleta-abt-tindakan {");
  });

  it("bila daftar usulannya kosong, tombol hurufnya tidak ikut hilang", () => {
    const mulai = abt.indexOf("Tidak satu pun variabel itu ada di blangko yang sedang dibuka.");
    expect(mulai).toBeGreaterThan(-1);
    expect(abt.slice(mulai, mulai + 400)).toContain("wadahUsulan.appendChild(hurufMenunggu.tombol);");
  });
});
