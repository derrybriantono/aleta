import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { KAPABILITAS_EKSTENSI, KETERANGAN_KAPABILITAS } from "@/server/modules/aleta-ecourt/akses";

/**
 * Layar pengaturan akses ekstensi.
 *
 * ============================================================================
 * KEGAGALAN YANG PALING SUNYI
 * ============================================================================
 *
 * Dua kemampuan penunjukan pernah ditambahkan di server, menjaga rutenya
 * dengan benar, dan tidak pernah muncul di layar pengaturan - sebab daftar
 * kolomnya diketik tangan di berkas komponen. Tidak ada galat, tidak ada yang
 * hilang; hanya kolom yang tidak pernah ada, dan kewenangan yang tidak dapat
 * diubah siapa pun.
 *
 * Berkas uji ini menutup jalan itu: kolomnya harus diturunkan dari keterangan
 * yang dikirim server, dan tidak boleh ada daftar kemampuan yang diketik tetap
 * di dalam komponen mana pun.
 */
const bacaBerkas = (relatif: string) =>
  readFileSync(path.resolve(process.cwd(), relatif), "utf8");

/**
 * Membuang komentar sebelum memeriksa bentuk kodenya.
 *
 * Komentar yang menerangkan mengapa bentuk lama keliru MEMUAT bentuk lama itu,
 * dan pemeriksaan yang memindai seluruh berkas akan menjatuhkannya - lalu
 * keterangan yang paling perlu bertahan justru yang pertama dihapus orang.
 */
function tanpaKomentar(isi: string) {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

const layarPeran = () =>
  bacaBerkas("src/components/portal/aleta-ecourt-akses-peran.tsx");
const layarPengguna = () =>
  bacaBerkas("src/components/portal/aleta-ecourt-akses-pengguna.tsx");
const layarAdmin = () => bacaBerkas("src/components/portal/aleta-ecourt-admin.tsx");
const ruteAkses = () => bacaBerkas("src/app/api/aleta-ecourt/akses/route.ts");
const rutePengguna = () => bacaBerkas("src/app/api/aleta-ecourt/akses/pengguna/route.ts");

describe("kolom pengaturan diturunkan dari server, tidak diketik di layar", () => {
  it("layar peran tidak memuat satu pun daftar kemampuan yang diketik tetap", () => {
    const isi = tanpaKomentar(layarPeran());
    // Bentuk lamanya: const URUTAN: Kapabilitas[] = ["panel", "berkas", ...]
    expect(isi).not.toMatch(/const\s+URUTAN/);
    expect(isi).not.toMatch(/\[\s*"panel"\s*,/);
    expect(layarPeran()).toContain("function urutanKapabilitas(");
    expect(layarPeran()).toContain("Object.keys(keterangan)");
  });

  it("layar pengguna juga membaca kuncinya dari keterangan server", () => {
    expect(layarPengguna()).toContain("Object.keys(keterangan)");
    expect(tanpaKomentar(layarPengguna())).not.toMatch(/\[\s*"panel"\s*,/);
  });

  it("rute akses menyusun kemampuan penuh dari daftarnya, bukan mengetiknya", () => {
    // Bentuk lamanya persis ini, dan ia diam-diam menghilangkan dua kemampuan.
    expect(tanpaKomentar(ruteAkses())).not.toContain("saya: { panel: true");
    expect(ruteAkses()).toContain("saya: kemampuanPenuh()");
  });
});

describe("kemampuan baru benar-benar sampai ke layar", () => {
  it("tiap kemampuan punya keterangan, sehingga pasti tergambar kolomnya", () => {
    for (const kunci of KAPABILITAS_EKSTENSI) {
      expect(Object.keys(KETERANGAN_KAPABILITAS), kunci).toContain(kunci);
    }
    // Dan tidak ada keterangan bagi kemampuan yang tidak ada - kolom yang
    // pengalihannya selalu ditolak server juga sebuah kebohongan kecil.
    for (const kunci of Object.keys(KETERANGAN_KAPABILITAS)) {
      expect(KAPABILITAS_EKSTENSI as readonly string[], kunci).toContain(kunci);
    }
  });

  it("kartu pengecualian per pegawai terpasang di halaman admin e-Court", () => {
    const isi = layarAdmin();
    expect(isi).toContain("AletaEcourtAksesPengguna");
    // Di bawah kartu peran: pengecualian hanya bermakna sebagai selisih
    // terhadap kewenangan jabatan, jadi jabatannya harus terbaca lebih dulu.
    expect(isi.indexOf("<AletaEcourtAksesPeran />")).toBeLessThan(
      isi.indexOf("<AletaEcourtAksesPengguna />")
    );
    // Jangkar tombol "Atur kewenangan ekstensi" tidak boleh ikut hilang.
    expect(isi).toContain('id="pengaturan-ekstensi"');
  });
});

describe("rute pengecualian menjaga dirinya sendiri", () => {
  it("membaca pun menuntut Super Admin atau Admin", () => {
    const isi = rutePengguna();
    expect(isi).toContain("pastikanAdminIstimewa(db, actorUserId");
  });

  it('ruas "aktif" yang tidak dikirim tidak boleh terbaca sebagai pencabutan', () => {
    const isi = rutePengguna();
    expect(isi).toContain("mentah !== true && mentah !== false && mentah !== null");
  });
});

describe("panel ABT menyembunyikan tombol yang akan ditolak", () => {
  const abt = () => readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");

  it("kewenangan dibaca lewat sumber siapa, dan tombolnya disembunyikan bila ditolak", () => {
    const isi = abt();
    expect(isi).toContain("function bolehAbt(kunci) {");
    expect(isi).toContain('if (!bolehAbt("blangko-abt")) {');
    expect(isi).toContain("tombol.hidden = true");
  });

  it("selama jawabannya belum tiba, tombolnya dibiarkan tampak", () => {
    // Menyembunyikan lebih dulu lalu memunculkan membuat panel berkedip bagi
    // hampir semua orang yang membuka halaman blangko.
    const isi = abt();
    const potong = isi.slice(isi.indexOf("function bolehAbt(kunci) {"));
    expect(potong.slice(0, 160)).toContain("if (!kapabilitasAletaAbt) return true;");
  });
});
