import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  PERAN_LIHAT_SEMUA,
  namaAdaDi,
  namaCocokSatu,
  pecahNamaPetugas,
  perkaraSendiri,
  potonganNamaPetugas,
  saringPerkaraSendiri,
} from "@/lib/perkara-sendiri";

/**
 * ============================================================================
 * "PERKARA SAYA" - DIJAGA DENGAN NAMA PEGAWAI SUNGGUHAN
 * ============================================================================
 *
 * Nama di bawah SALINAN APA ADANYA dari hakim_pn dan panitera_pn Donggala.
 * Nama karangan tidak dapat menjaga apa pun di sini: yang membuat aturan ini
 * sulit justru bentuk-bentuk yang tidak terpikirkan saat mengarang - gelar
 * yang memakai koma seperti pemisah nama, inisial satu huruf, dan dua orang
 * berbeda yang berbagi satu potongan nama.
 */

const AKAR = process.cwd();

describe("dua orang berbeda yang berbagi satu potongan nama", () => {
  /**
   * Terukur pada data satker - dan inilah kekeliruan yang menjatuhkan aturan
   * yang pertama ditulis:
   *
   *     "M. Tang"               NIP 195812311987031030
   *     "Sudarmin H.I.M. Tang"  NIP 197910092007041001
   *
   * Aturan "seluruh potongan harus ada" membuat perkara Sudarmin ikut terbawa
   * ke daftar M. Tang, sebab potongan namanya tinggal "tang" belaka.
   */
  const M_TANG = "M. Tang";
  const SUDARMIN = "Sudarmin H.I.M. Tang, S.H.I.,M.H";

  it("M. Tang tidak menyeret perkara Sudarmin", () => {
    expect(namaCocokSatu(M_TANG, SUDARMIN)).toBe(false);
    expect(namaAdaDi(M_TANG, `Mazidah, S.Ag., M.H., ${SUDARMIN}`)).toBe(false);
  });

  it("tetapi M. Tang mencocoki perkaranya SENDIRI", () => {
    // Perbaikan yang membuatnya tidak mencocoki apa pun akan menyelesaikan
    // masalahnya dengan mematikan fiturnya bagi orang itu.
    expect(namaCocokSatu(M_TANG, "Drs. M. Tang, M.H.")).toBe(true);
    expect(namaAdaDi(M_TANG, "Drs. M. Tang, M.H.")).toBe(true);
  });

  it("dan Sudarmin tetap mencocoki miliknya di majelis gabungan", () => {
    expect(namaAdaDi("Sudarmin H.I.M. Tang", `Mazidah, S.Ag., M.H., ${SUDARMIN}`)).toBe(true);
  });
});

describe("pecahNamaPetugas - koma gelar bukan pemisah nama", () => {
  it("memecah majelis gabungan menjadi orang, bukan menjadi potongan gelar", () => {
    // Bot menyatukan majelis dengan ", " - dan gelar juga memakai koma.
    // Memecah mentah menghasilkan lima potongan untuk dua orang.
    expect(pecahNamaPetugas("Mazidah, S.Ag., M.H., Sudarmin H.I.M. Tang, S.H.I.,M.H")).toEqual([
      "Mazidah, S.Ag., M.H.",
      "Sudarmin H.I.M. Tang, S.H.I., M.H",
    ]);
  });

  it("satu orang tetap satu", () => {
    expect(pecahNamaPetugas("Drs. M. Tang, M.H.")).toEqual(["Drs. M. Tang, M.H."]);
    expect(pecahNamaPetugas("Munifa, S.H.")).toEqual(["Munifa, S.H."]);
  });

  it("ruas kosong tidak menghasilkan nama hantu", () => {
    expect(pecahNamaPetugas("")).toEqual([]);
    expect(pecahNamaPetugas("  ,  , ")).toEqual([]);
  });
});

describe("gelar dibuang, orang yang sama tetap satu orang", () => {
  it("nama polos mencocoki tulisan bergelarnya", () => {
    // Terukur: 63 dari 63 hakim dan panitera satker.
    for (const [polos, bergelar] of [
      ["Mazidah", "Mazidah, S.Ag., M.H."],
      ["Munifa", "Munifa, S.H."],
      ["Sudarmin H.I.M. Tang", "Sudarmin H.I.M. Tang, S.H.I.,M.H"],
      ["M. Tang", "Drs. M. Tang, M.H."],
    ]) {
      expect(namaCocokSatu(polos, bergelar), `${polos} vs ${bergelar}`).toBe(true);
    }
  });

  it("pecahan gelar satu huruf tidak pernah menjadi potongan nama", () => {
    // "S.H., M.H." meninggalkan s, h, m, h begitu titiknya dipecah. Daftar
    // gelar tidak akan pernah lengkap menghadapi pecahan seperti itu.
    expect(potonganNamaPetugas("Drs. H. Fulan, S.H., M.H.")).toEqual(["fulan"]);
  });

  it("nama tanpa potongan tidak pernah cocok dengan apa pun", () => {
    // Mencocokkan nama kosong akan memulangkan SELURUH daftar seolah-olah
    // semuanya milik orang itu.
    for (const nama of ["", "   ", "Hj.", "S.H."]) {
      expect(namaAdaDi(nama, "Mazidah, S.Ag., M.H."), nama).toBe(false);
    }
  });
});

describe("perkaraSendiri - dan sebagai apa", () => {
  const BARIS = {
    majelisNama: "Mazidah, S.Ag., M.H., Sudarmin H.I.M. Tang, S.H.I.,M.H",
    paniteraNama: "Munifa, S.H.",
    jurusitaNama: "Fulan Hadi",
  };

  it("menyebut kedudukannya, bukan sekadar cocok", () => {
    expect(perkaraSendiri(BARIS, { nama: "Mazidah", peran: "hakim" })).toEqual({
      cocok: true,
      sebagai: "majelis",
    });
    expect(perkaraSendiri(BARIS, { nama: "Munifa", peran: "panitera-pengganti" })).toEqual({
      cocok: true,
      sebagai: "panitera pengganti",
    });
    expect(perkaraSendiri(BARIS, { nama: "Fulan Hadi", peran: "jurusita" })).toEqual({
      cocok: true,
      sebagai: "jurusita",
    });
  });

  it("peran hanya mengatur URUTAN, tidak membatasi", () => {
    // Panitera muda yang masih menjadi panitera pengganti, hakim yang juga
    // ketua majelis lain - peran portal dan tugas SIPP kerap tidak sejalan.
    // Membatasi pada satu ruas akan menyembunyikan perkara yang sungguh
    // miliknya.
    expect(perkaraSendiri(BARIS, { nama: "Munifa", peran: "hakim" }).cocok).toBe(true);
    expect(perkaraSendiri(BARIS, { nama: "Mazidah", peran: "jurusita" }).cocok).toBe(true);
  });

  it("orang luar tetap tidak cocok", () => {
    expect(perkaraSendiri(BARIS, { nama: "Sarifah Umar", peran: "hakim" }).cocok).toBe(false);
  });
});

describe("saringPerkaraSendiri - gagal-TERBUKA, bukan layar kosong", () => {
  const DAFTAR = [
    { majelisNama: "Mazidah, S.Ag., M.H.", paniteraNama: "Munifa, S.H.", jurusitaNama: "" },
    { majelisNama: "Drs. M. Tang, M.H.", paniteraNama: "Sarifah, S.H.", jurusitaNama: "" },
  ];

  it("menyaring ke miliknya sendiri ketika ada yang cocok", () => {
    const hasil = saringPerkaraSendiri(DAFTAR, { nama: "Mazidah", peran: "hakim" }, true);
    expect(hasil.baris.length).toBe(1);
    expect(hasil.berlaku).toBe(true);
    expect(hasil.adaYangCocok).toBe(true);
    expect(hasil.sebagai).toBe("majelis");
  });

  it("memulangkan SELURUH daftar ketika namanya tidak cocok satu pun", () => {
    // Layar kosong pada daftar sidang terbaca sebagai "hari ini tidak ada
    // sidang" - kabar yang salah, dan salah pada arah paling berbahaya.
    const hasil = saringPerkaraSendiri(DAFTAR, { nama: "Sarifah Umar", peran: "hakim" }, true);
    expect(hasil.baris.length).toBe(2);
    expect(hasil.berlaku).toBe(true);
    // Justru inilah yang WAJIB dikatakan layar: daftarnya penuh, bukan
    // tersaring.
    expect(hasil.adaYangCocok).toBe(false);
  });

  it("peran lintas satker melihat semuanya tanpa penyaringan", () => {
    for (const peran of [...PERAN_LIHAT_SEMUA]) {
      const hasil = saringPerkaraSendiri(DAFTAR, { nama: "Mazidah", peran }, true);
      expect(hasil.baris.length, peran).toBe(2);
      expect(hasil.berlaku, peran).toBe(false);
    }
  });

  it("penyaring yang dimatikan memulangkan semuanya dan mengatakan tidak berlaku", () => {
    const hasil = saringPerkaraSendiri(DAFTAR, { nama: "Mazidah", peran: "hakim" }, false);
    expect(hasil.baris.length).toBe(2);
    expect(hasil.berlaku).toBe(false);
  });

  it("tanpa akun, tidak ada yang dapat disaring", () => {
    const hasil = saringPerkaraSendiri(DAFTAR, null, true);
    expect(hasil.baris.length).toBe(2);
    expect(hasil.berlaku).toBe(false);
  });
});

describe("terpasang di layar antrian", () => {
  const layar = fs.readFileSync(
    path.join(AKAR, "src/components/portal/aleta-ecourt-sidang.tsx"),
    "utf8"
  );

  it("menyala sejak awal - tombolnya menawarkan melihat semuanya", () => {
    // Kalimat penawarannya hanya masuk akal bila yang tampil sebelumnya belum
    // semuanya.
    //
    // 2.29.0 memindahkan tombolnya ke sudut kanan atas dan memendekkan
    // tulisannya dari "Tampilkan semua perkara" menjadi "Semua perkara" -
    // kepala kartu tidak memuat kalimat sepanjang itu di samping judul.
    // Yang DIJAGA tetap sama: keadaan awalnya menyaring, dan tombolnya
    // menawarkan kebalikannya.
    expect(layar).toContain("const [hanyaMilikSaya, setHanyaMilikSaya] = useState(true);");
    expect(layar).toContain('hanyaMilikSaya ? "Perkara saya" : "Semua perkara"');
  });

  it("disaring PALING AKHIR, sesudah saringan kartu", () => {
    // Disaring lebih dahulu, keterangan "tidak ada perkara Anda" akan muncul
    // juga ketika yang mengosongkan daftar sebenarnya saringan Retur.
    const iKartu = layar.indexOf("const sidangSetelahKartu");
    const iMilik = layar.indexOf("const milikSaya = saringPerkaraSendiri(");
    expect(iKartu).toBeGreaterThan(-1);
    expect(iMilik).toBeGreaterThan(iKartu);
    expect(layar).toContain("const sidangTampil = milikSaya.baris;");
  });

  it("keadaan berlaku-tanpa-cocok punya keterangannya sendiri di layar", () => {
    // Diam pada keadaan itu membuat daftar penuh terbaca sebagai daftar yang
    // sudah disaring.
    expect(layar).toContain("milikSaya.berlaku && !milikSaya.adaYangCocok");
    expect(layar).toContain("seluruh");
  });

  it("keadaannya tidak diingat peramban", () => {
    // Yang diingat akan terbawa ke akun lain pada komputer bersama di ruang
    // panitera.
    const i = layar.indexOf("const [hanyaMilikSaya");
    const sekitar = layar.slice(Math.max(0, i - 900), i);
    expect(sekitar).not.toContain("localStorage");
  });
});
