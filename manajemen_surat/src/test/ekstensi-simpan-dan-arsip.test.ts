// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tiga hal yang diperbaiki bersama, dan ketiganya bertemu pada satu keluhan:
 * "sudah dikerjakan ALETA" yang ternyata tidak sampai ke mana-mana.
 *
 *   1. Borang putusan terisi, lalu berhenti - Simpan menunggu tangan.
 *   2. Berkas putusan terunggah, lalu halamannya tidak memperlihatkannya.
 *   3. Arsip e-Court tercatat lengkap, sementara berkasnya hilang atau rusak
 *      dan tidak ada satu pun yang pernah memeriksanya.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8");
const gaya = readFileSync(path.join(akar, "ekstensi-sipp/panel.css"), "utf8");
const penjadwal = readFileSync(
  path.join(akar, "aleta_bot/services/ecourtSchedulerService.js"),
  "utf8"
);

function aturan(css: string, pemilih: string): string {
  const mulai = css.indexOf(`${pemilih} {`);
  if (mulai < 0) throw new Error(`aturan ${pemilih} tidak ketemu`);
  return css.slice(mulai, css.indexOf("}", mulai));
}

describe("lebar label ikut ukuran hurufnya", () => {
  // Hurufnya dihitung calc(... * var(--aleta-skala-huruf)), lebarnya dulu px
  // MATI. Begitu pembaca membesarkan huruf panel, labelnya tidak muat, tumpah
  // keluar kotak yang flex: none, lalu bertindihan dengan nilainya.
  for (const pemilih of [".aleta-abt-label", ".aleta-praperiksa-label"]) {
    it(`${pemilih} tidak dapat lebih sempit daripada tulisannya`, () => {
      const isi = aturan(gaya, pemilih);
      expect(isi).toContain("min-width:");
      expect(isi).toMatch(/min-width:\s*[\d.]+em/);
      expect(isi).toContain("white-space: nowrap");
      // flex: none mengunci lebarnya - itu yang membuatnya tumpah.
      expect(isi).not.toMatch(/flex:\s*none/);
      expect(isi).not.toMatch(/\bwidth:\s*\d+px/);
    });
  }
});

describe("blangko putusan disimpan, dan tersimpannya dibuktikan", () => {
  it("Simpan ditekan lewat penunjuk yang pasti, bukan ditebak dari tulisannya", () => {
    // "Simpan" juga nama tombol pada belasan borang lain di halaman yang sama.
    expect(konten).toContain("const PENUNJUK_SIMPAN_PUTUSAN = [");
    expect(konten).toContain('"#frm_putusan #simpan"');
  });

  it("tersimpannya dibaca dari SIPP, bukan dari tombol yang berhasil ditekan", () => {
    // frm_putusan memakai SubmitHandling (AJAX): tombolnya "berhasil ditekan"
    // walau simpanannya ditolak pengesahan di sisi peladen.
    expect(konten).toContain("async function bacaPutusanSegar(");
    expect(konten).toContain("cache: \"no-store\"");
    const badan = konten.slice(konten.indexOf("async function simpanPutusanLaluBuka("));
    // Disesuaikan perbaikan 30 Sep 2026 (butir 10): keadaan SEBELUM boleh sudah
    // dibaca pemanggil - Baru & UI Baru membacanya berbarengan dengan pengisian,
    // dan antrean massal memakai ulang bacaan langkah 1 - dan KEDUANYA lewat
    // bacaPutusanSegar. Tanpa itu dibaca di sini seperti semula. Penjaganya
    // sama kuat: "sebelum" selalu bacaan SIPP segar, bukan tombol yang ditekan.
    expect(badan.slice(0, 2500)).toContain("const sebelum = dibacaPemanggil || (await bacaPutusanSegar(nomorPerkara));");
    expect(konten).toContain("const sebelumA30 = a30Nyala ? bacaPutusanSegar(nomorPerkara) : null;");
    expect(konten).toContain("const segar = await bacaPutusanSegar(butir.nomor);");
    expect(konten).toContain("return { sebelum: segar || null, jajakCepat: true };");
    expect(badan.slice(0, 2500)).toContain("samaPutusan(sebelum, sesudah)");
  });

  it("halaman dibuka kembali HANYA sesudah terbukti tersimpan", () => {
    const badan = konten.slice(
      konten.indexOf("async function simpanPutusanLaluBuka("),
      konten.indexOf("function bagianIsiPutusan(")
    );
    const buktiDulu = badan.indexOf("samaPutusan(sebelum, sesudah)");
    const muatUlang = badan.indexOf("muatUlangHalamanPerkara");
    expect(buktiDulu).toBeGreaterThan(-1);
    expect(muatUlang).toBeGreaterThan(buktiDulu);
  });

  it("satu isian gagal berarti Simpan TIDAK ditekan sama sekali", () => {
    // Menyimpan borang yang belum utuh menghasilkan putusan yang salah di
    // berkas perkara yang sungguhan.
    expect(konten).toContain("Simpan TIDAK ditekan selama masih ada yang gagal.");
  });

  it("memuat ulang lewat alamat perkara, bukan location.reload", () => {
    // Halaman borang SIPP dibuka lewat sesi kilat; memuat ulangnya
    // mendaratkan petugas di dasbor.
    const badan = konten.slice(konten.indexOf("async function simpanPutusanLaluBuka("));
    expect(badan.slice(0, 2500)).not.toContain("location.reload()");
  });
});

describe("unggah putusan membuka kembali halaman perkaranya", () => {
  const badan = konten.slice(konten.indexOf("function bagianUnggahPutusanSipp("));

  it("dimuat ulang hanya bila ada berkas yang sungguh masuk", () => {
    expect(badan.slice(0, 9000)).toContain("const adaYangMasuk = (jawab.berkas || []).some((b) => b.ok);");
    expect(badan.slice(0, 9000)).toContain("setTimeout(muatUlangHalamanPerkara,");
  });

  it("bukan location.reload - itu mendarat di dasbor", () => {
    const potong = badan.slice(0, 9000);
    const letak = potong.indexOf("adaYangMasuk");
    expect(potong.slice(letak, letak + 400)).not.toContain("location.reload");
  });
});

describe("panel menandai peran pemakainya", () => {
  const alat = readFileSync(path.join(akar, "ekstensi-sipp/panel-alat.js"), "utf8");
  const abt = readFileSync(path.join(akar, "ekstensi-sipp/abt.js"), "utf8");
  const aleta = readFileSync(path.join(akar, "ekstensi-sipp/aleta.js"), "utf8");

  it("satu penanda dipakai ketiga panel - SIPP, ABT, dan halaman ALETA", () => {
    expect(alat).toContain("function alatTandaiPeranPanel(");
    for (const [nama, isi] of [
      ["konten.js", konten],
      ["abt.js", abt],
      ["aleta.js", aleta],
    ] as const) {
      expect(isi, nama).toContain("alatTandaiPeranPanel(");
    }
  });

  it("nilainya diambil dari kelas chipnya - keduanya tidak dapat berselisih", () => {
    const badan = alat.slice(alat.indexOf("function alatTandaiPeranPanel("));
    expect(badan.slice(0, 700)).toContain("const kelas = alatKelasPeran(peran);");
    expect(badan.slice(0, 700)).toContain('kelas.replace(/^aleta-peran-/, "")');
  });

  it("super admin berkilau, peran lain berwarna diam - relnya tetap ada", () => {
    // Relnya tidak boleh HILANG pada peran lain: tepi panel akan berpindah
    // tempat antar peran, dan itu terbaca sebagai panel yang rusak.
    expect(gaya).toContain('.aleta-panel[data-peran]::before');
    expect(gaya).toContain('.aleta-panel[data-peran="super"]::before');
    expect(gaya).toContain('.aleta-panel[data-peran="admin"]::before');
    const badan = aturan(gaya, '.aleta-panel[data-peran="super"]::before');
    expect(badan).toContain("animation: aleta-kilau");
  });

  it("tidak ada latar bergradasi di belakang tulisan panel", () => {
    // Isinya nomor perkara, nama pihak, dan kutipan putusan - yang harus
    // dibaca. Gradasi di belakangnya menurunkan ketajaman huruf tiap baris.
    expect(gaya).not.toMatch(/\.aleta-panel\[data-peran="super"\]\s*\{[^}]*linear-gradient/);
    expect(gaya).not.toMatch(/\.aleta-panel\[data-peran="super"\]\s+\.aleta-isi\b/);
  });

  it("yang tidak menghendaki gerakan tetap mendapat relnya, hanya diam", () => {
    // Ada beberapa blok prefers-reduced-motion di berkas ini - yang dicari
    // blok yang menyebut relnya, bukan blok pertama yang kebetulan ketemu.
    const blok = gaya
      .split("@media (prefers-reduced-motion: reduce)")
      .slice(1)
      .map((x) => x.slice(0, 400));
    expect(blok.some((x) => x.includes('[data-peran="super"]::before { animation: none; }'))).toBe(true);
  });
});

describe("keutuhan arsip e-Court diperiksa sendiri", () => {
  it("penjadwal memanggil pemeriksanya - bukan hanya layar portal", () => {
    // Sebelumnya satu-satunya jalan masuk POST /ecourt/audit-arsip, yang harus
    // dibuka orang. Berkas rusak baru ketahuan ketika ada yang membukanya.
    expect(penjadwal).toContain('require("./ecourtAuditArsipService")');
    expect(penjadwal).toContain("async function periksaArsipBerkala(");
    expect(penjadwal).toContain("void periksaArsipBerkala();");
  });

  it("memperbaiki, bukan sekadar melaporkan", () => {
    // Membiarkan yang rusak tercatat berarti perkaranya terhitung lengkap
    // selamanya, dan penarikan berikutnya melewatinya.
    const badan = penjadwal.slice(penjadwal.indexOf("async function periksaArsipBerkala("));
    expect(badan.slice(0, 1800)).toContain("perbaiki: true");
  });

  it("berdiri di luar jam kerja dan di luar jarak putaran", () => {
    // Ia tidak menyentuh Mahkamah Agung sama sekali - hanya membaca disk.
    // Berkas hilang justru paling sering terjadi di luar jam kerja: container
    // dibuat ulang saat pemasangan malam hari.
    const badan = penjadwal.slice(penjadwal.indexOf("function mulai()"));
    const periksa = badan.indexOf("void periksaArsipBerkala();");
    const jarak = badan.indexOf("if (Date.now() - terakhirPutaran < jarakMs) return;");
    expect(periksa).toBeGreaterThan(-1);
    expect(jarak).toBeGreaterThan(periksa);
    // Dan TIDAK di dalam detak(), yang berhenti di luar jam kerja.
    const detak = penjadwal.slice(
      penjadwal.indexOf("async function detak("),
      penjadwal.indexOf("function berhenti()")
    );
    expect(detak).not.toContain("periksaArsipBerkala");
  });

  it("bergilir - ada jeda, supaya satu putaran tidak membaca seluruh arsip", () => {
    expect(penjadwal).toContain("const JEDA_AUDIT_MS =");
    expect(penjadwal).toContain("if (Date.now() - auditTerakhir < JEDA_AUDIT_MS) return;");
  });

  it("gagal-terbuka - kegagalannya tidak menghentikan penarikan", () => {
    const badan = penjadwal.slice(penjadwal.indexOf("async function periksaArsipBerkala("));
    expect(badan.slice(0, 3000)).toContain("catch (galat)");
  });

  it("hilang MENYELURUH dibedakan dari beberapa berkas rusak", () => {
    // Dua keadaan yang menuntut tindakan berbeda: yang satu menunggu
    // penarikan berikutnya, yang satu menuntut baris mount di docker-compose.
    const badan = penjadwal.slice(penjadwal.indexOf("async function periksaArsipBerkala("));
    expect(badan.slice(0, 3000)).toContain("ecourt_arsip_hilang_menyeluruh");
    expect(badan.slice(0, 3000)).toContain("ter-mount ke volume di docker-compose");
    // Folder yang sedang dipakai IKUT disebut - tanpa itu yang membacanya
    // tidak tahu folder mana yang harus di-mount.
    expect(badan.slice(0, 3000)).toContain("ecourtDocumentService.resolveRoot()");
  });

  it("diperiksa sekali segera sesudah bot menyala", () => {
    // Bot yang baru menyala hampir selalu berarti container yang baru dibuat -
    // persis kejadian yang menghapus folder yang tidak ter-mount.
    const badan = penjadwal.slice(penjadwal.indexOf("function mulai()"));
    const segera = badan.indexOf("void periksaArsipBerkala();");
    const pewaktu = badan.indexOf("keadaan.timer = setInterval(");
    expect(segera).toBeGreaterThan(-1);
    expect(segera).toBeLessThan(pewaktu);
  });
});
