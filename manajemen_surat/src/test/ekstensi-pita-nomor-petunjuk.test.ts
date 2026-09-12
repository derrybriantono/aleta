// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pita identitas, kaki ringkas, dan petunjuk dua detik.
 *
 * Tujuh perbaikan kecil pada satu baris yang dibaca tiap kali panel dibuka -
 * dan justru karena dibaca tiap kali, yang keliru di situ terbaca sebagai
 * ekstensi yang ceroboh.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

function potongFungsi(isi: string, nama: string): string {
  const mulai = isi.indexOf(`function ${nama}(`);
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  const selesai = isi.indexOf("\nfunction ", mulai + 10);
  return isi.slice(mulai, selesai < 0 ? undefined : selesai);
}

describe("akun SIPP tampil utuh di pita", () => {
  it("tidak lagi dipangkas 14rem dengan elipsis", () => {
    // "SIPP Super Adm…" pada pita selebar 460 piksel. Pemangkasan itu
    // warisan dari masa akun duduk di kepala bersama lima tombol.
    const css = baca("panel.css");
    const blok = css.slice(css.indexOf(".aleta-identitas-panel .aleta-akun-sipp {"));
    expect(blok.slice(0, 700)).toContain("max-width: none;");
    expect(blok.slice(0, 700)).toContain("white-space: normal;");
    expect(blok.slice(0, 700)).not.toContain("max-width: 14rem;");
  });
});

describe("kuasa hukum", () => {
  it("yang tidak berkuasa tidak diberi chip", () => {
    // "Tanpa kuasa hukum" adalah keadaan sebagian besar perkara, dan chip
    // yang ada di hampir setiap perkara berhenti dibaca - lalu chip kuasa
    // yang sungguhan, yang jarang dan menentukan kepada siapa surat
    // dialamatkan, ikut tidak dibaca.
    // Yang dijaga KODENYA - chip yang dibuat - bukan kosakata catatannya:
    // catatan di dalam fungsi itu justru menyebut frasa "Tanpa kuasa hukum"
    // untuk menerangkan kenapa chipnya tidak lagi dibuat.
    const badan = potongFungsi(baca("konten.js"), "barisIdentitas");
    expect(badan).not.toContain('buatElemen("span", "aleta-tanda-tanpa-kuasa"');
    expect(badan).not.toContain("aleta-tanda-tanpa-kuasa");
    expect(badan).not.toContain("} else {");
    // Yang berkuasa tetap disebut, beserta sisinya.
    expect(badan).toContain('"aleta-tanda-kuasa"');
    expect(badan).toContain("Kuasa: ${sisi.join");
  });
});

describe("chip jenis berwarna menurut keluarganya", () => {
  const konten = baca("konten.js");

  it("cerai gugat, cerai talak, permohonan, ekonomi syariah, dan selebihnya", () => {
    const badan = potongFungsi(konten, "kelasJenis");
    expect(badan).toContain('"aleta-jenis-gugat"');
    expect(badan).toContain('"aleta-jenis-talak"');
    expect(badan).toContain('"aleta-jenis-permohonan"');
    expect(badan).toContain('"aleta-jenis-syariah"');
    expect(badan).toContain('"aleta-jenis-lain"');
  });

  it("ekonomi syariah dan talak diperiksa SEBELUM pola gugat yang lebih umum", () => {
    // Ekonomi syariah adalah gugatan; cerai talak dan cerai gugat sama-sama
    // perceraian. Pola yang lebih umum harus datang belakangan atau ia
    // menelan yang khusus.
    const badan = potongFungsi(konten, "kelasJenis");
    const syariah = badan.indexOf("aleta-jenis-syariah");
    const talak = badan.indexOf("aleta-jenis-talak");
    const gugat = badan.indexOf("aleta-jenis-gugat");
    expect(syariah).toBeLessThan(gugat);
    expect(talak).toBeLessThan(gugat);
  });

  it("dipakai pada chip identitas badan panel - pita atas tidak lagi memuat jenis", () => {
    expect(konten).toContain("`aleta-tanda-jenis ${kelasJenis(identitas.jenisPerkara)}`");
    expect(konten).not.toContain("tambah(`aleta-id-jenis ${kelasJenis(");
  });

  it("kelima warnanya punya padanan tema terang", () => {
    const css = baca("panel.css");
    for (const kelas of ["gugat", "talak", "permohonan", "syariah", "lain"]) {
      expect(css, kelas).toContain(`.aleta-panel[data-tema="terang"] .aleta-jenis-${kelas}`);
    }
  });
});

describe("nomor di baris pertama badan: klik menukar, klik ganda menyalin", () => {
  // Perilakunya pindah dari pita ke tombolNomorTukar (1.119.0) - satu tempat
  // untuk nomor perkara dan nomor register, menggantikan dua tombol salin.
  const badan = potongFungsi(baca("konten.js"), "tombolNomorTukar");

  it("nomor register e-Court ikut dari konteks", () => {
    expect(potongFungsi(baca("konten.js"), "jatiPita")).toContain(
      'nomorRegister: (konteks && konteks.nomorRegister) || ""'
    );
  });

  it("klik tunggal ditunda dan dibatalkan oleh klik ganda", () => {
    // Tanpa penundaan, tiap klik ganda menukar nomornya dua kali lalu
    // menyalin yang tampil sesudahnya - yakni yang semula.
    expect(badan).toContain("jamKlik = setTimeout(() => {");
    expect(badan).toContain('kotakNomor.addEventListener("dblclick"');
    const dbl = badan.slice(badan.indexOf('addEventListener("dblclick"'));
    expect(dbl.slice(0, 200)).toContain("clearTimeout(jamKlik)");
  });

  it("yang disalin adalah yang sedang TAMPIL", () => {
    expect(badan).toContain("salinTeks(tampilRegister ? register : nomor)");
  });

  it("tanpa nomor register, klik tidak menukar apa pun", () => {
    expect(badan).toContain("if (!register) return;");
  });

  it("penjelasannya mengikuti keadaan, termasuk sesudah dipindah petunjuk", () => {
    expect(badan).toContain('kotakNomor.hasAttribute("data-aleta-tip")');
  });
});

describe("kaki ringkas: pintasan, segarkan, seri", () => {
  it("pita tidak diulang di kaki ketiga panel", () => {
    expect(potongFungsi(baca("konten.js"), "kakiPanel")).not.toContain("appendChild(pitaIdentitas(");
    expect(baca("aleta.js")).not.toContain("kaki.appendChild(pitaIdentitas(siapa));");
    expect(baca("abt.js")).not.toContain("kaki.appendChild(pitaKaki);");
  });

  it("seri di baris kaki ketiga panel, dan tidak di pita mana pun", () => {
    for (const nama of ["konten.js", "aleta.js", "abt.js"]) {
      const isi = baca(nama);
      expect(isi, nama).toContain('buatElemen("span", "aleta-kaki-versi", `v${seri}`)');
      expect(isi, nama).not.toContain('tambah("aleta-id-versi aleta-kaki-versi"');
    }
  });
});

describe("petunjuk fitur muncul sesudah dua detik", () => {
  const alat = baca("panel-alat.js");

  it("jedanya dua detik, dan satu kotak untuk seluruh halaman", () => {
    expect(alat).toContain("const ALAT_PETUNJUK_JEDA_MS = 2000;");
    expect(alat).toContain("function alatKotakPetunjuk()");
    expect(alat).toContain('kotak.setAttribute("role", "tooltip")');
  });

  it("title DIPINDAHKAN ke data-aleta-tip, bukan disalin", () => {
    // Tanpa itu peramban tetap memunculkan petunjuk bawaannya pada detik
    // pertama - dua kotak untuk satu pertanyaan.
    const badan = potongFungsi(alat, "alatPasangPetunjuk");
    expect(badan).toContain('elemen.setAttribute("data-aleta-tip", title)');
    expect(badan).toContain('elemen.removeAttribute("title")');
    // Kalimatnya tetap tersedia bagi pembaca layar.
    expect(badan).toContain('elemen.setAttribute("aria-label", title)');
  });

  it("menekan, menggulung, atau mengetik menyembunyikannya", () => {
    const badan = potongFungsi(alat, "alatPasangPetunjuk");
    // pointerdown, bukan mousedown - satu jalur untuk tetikus, sentuh, dan
    // pena, sama dengan seluruh pegangan panel lainnya. Diubah di 1.123.0;
    // penjaga ini sempat tertinggal menuntut yang lama, dan dua penjaga yang
    // saling bertentangan membuat rangkaian uji tidak dapat hijau sama sekali.
    expect(badan).toContain('akar.addEventListener("pointerdown", sembunyikan, true)');
    expect(badan).toContain('akar.addEventListener("scroll", sembunyikan, true)');
    expect(badan).toContain('akar.addEventListener("keydown", sembunyikan, true)');
  });

  it("dipasang pada ketiga panel", () => {
    expect(alat).toContain("alatPasangPetunjuk(panel);");
    expect(potongFungsi(baca("konten.js"), "tampilkan")).toContain("alatPasangPetunjuk(elemen);");
  });

  it("kotaknya mengikuti tema panel, dan gayanya ada untuk kedua tema", () => {
    const badan = potongFungsi(alat, "alatPasangPetunjuk");
    expect(badan).toContain('akar.getAttribute("data-tema")');
    const css = baca("panel.css");
    expect(css).toContain(".aleta-petunjuk {");
    expect(css).toContain('.aleta-petunjuk[data-tema="terang"]');
    expect(css).toContain("pointer-events: none;");
  });
});
