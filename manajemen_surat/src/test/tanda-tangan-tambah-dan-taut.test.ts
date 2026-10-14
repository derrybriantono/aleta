/**
 * ============================================================================
 * TANDA TANGAN: MENAMBAH SENDIRI, DAN TERTAUT KE AKUN
 * ============================================================================
 *
 * Sampai 2.21.0 gambar tanda tangan hanya dapat masuk lewat satu jalan: skrip
 * pengimpor yang membaca berkas .doc satuan kerja di peladen, menyapu bitanya
 * mencari tanda berkas PNG dan JPEG. Pejabat yang tanda tangannya tidak ada di
 * dokumen itu - pejabat baru, pejabat yang tanda tangannya berubah - tidak
 * punya jalan sama sekali selain meminta seseorang menyunting .doc-nya lalu
 * menjalankan skrip di peladen.
 *
 * ============================================================================
 * NAMA SEBAGAI TEKS BEBAS SUDAH TERBUKTI RAPUH
 * ============================================================================
 *
 * Tabelnya menyimpan `nama_pejabat` sebagai teks yang diketik orang. Di tempat
 * lain di sistem yang sama, kerapuhan itu sudah menggigit: SK menulis
 * "Munifah, S.H." sedangkan SIPP menulis "Munifa" - beda satu huruf, dan
 * pencocokan nama yang meleset menetapkan orang yang salah tanpa berbunyi.
 *
 * Pada tanda tangan akibatnya lebih berat daripada salah nama di layar:
 * gambar yang terpasang pada nama yang keliru adalah TANDA TANGAN PALSU pada
 * penetapan pengadilan.
 *
 * Karena itu tiap tanda tangan kini dapat ditautkan ke AKUN portal, dan peran
 * beserta jabatannya DISALIN saat penautan - bukan dibaca ulang kelak. Yang
 * harus terbaca pada penetapan lama adalah jabatan orang itu KETIKA ia
 * menandatangani, bukan jabatannya hari ini.
 *
 * ============================================================================
 * YANG DIUNGGAH TETAP MENUNGGU PENGESAHAN
 * ============================================================================
 *
 * Gambar yang diunggah seseorang sambil mengetikkan nama orang lain persis
 * sama berbahayanya dengan gambar yang tertukar di dalam .doc. Pengesahan oleh
 * orang kedua adalah satu-satunya hal yang memisahkan keduanya dari tanda
 * tangan palsu - jadi jalan baru ini tidak boleh melewatinya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/tandaTanganService.js");
const app = baca("aleta_bot/app.js");
const gerbang = baca("aleta_bot/routes/internalGatewayRoutes.js");
const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/tanda-tangan/route.ts");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-tanda-tangan.tsx");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kode = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*|--)/.test(b))
  .join("\n");

describe("yang diunggah tetap menunggu pengesahan", () => {
  it("tambah() tidak pernah menyetel disahkan", () => {
    const potongan = kode.slice(kode.indexOf("async function tambah("), kode.indexOf("function jenisDariBita("));
    expect(potongan).not.toMatch(/disahkan\s*=\s*1/);
    expect(potongan).not.toContain("disahkan_oleh");
  });

  it("dan mengatakannya, bukan membiarkan layar menyimpulkan", () => {
    expect(kode).toContain("disahkan: false,");
    expect(kode).toContain("BELUM disahkan - ia belum dapat dipakai membubuhi penetapan");
  });

  it("layar mengulanginya kepada yang mengunggah", () => {
    expect(layar).toContain("belum sah");
    expect(layar).toContain("persis seperti yang diimpor dari berkas .doc");
  });
});

describe("gambar diperiksa dari BITANYA", () => {
  it("jenisnya dibaca dari tanda berkas, bukan dari nama atau kata peramban", () => {
    // Berkas bernama .png yang isinya bukan PNG akan gagal digambar pada
    // penetapan, dan gagalnya baru terlihat di kertas.
    expect(kode).toContain("function jenisDariBita(isi)");
    expect(kode).toContain("0x89");
    expect(kode).toContain("0xff && isi[1] === 0xd8");
    expect(kode).toContain("const jenis = jenisDariBita(isi);");
  });

  it("yang bukan PNG atau JPEG ditolak", () => {
    expect(kode).toContain('return { ok: false, alasan: "bukan_gambar_png_atau_jpeg" };');
  });

  it("batas besar dan kecil dipakai ulang, tidak dikarang lagi", () => {
    expect(kode).toContain("isi.length > BATAS_BESAR");
    expect(kode).toContain("isi.length < BATAS_KECIL");
  });

  it("gambar yang sama persis tidak masuk dua kali", () => {
    const potongan = kode.slice(kode.indexOf("async function tambah("));
    expect(potongan).toContain('crypto.createHash("sha1")');
    expect(potongan).toContain('alasan: "gambar_sudah_ada"');
  });
});

describe("badan permintaannya muat", () => {
  it("alamat unggah punya batas sendiri, bukan 1 MB umum", () => {
    // Layanannya menerima gambar sampai 8 MB, dan 8 MB menjadi ~10,7 MB
    // sesudah base64. Batas 1 MB akan menolaknya dengan "request entity too
    // large" - kalimat yang tidak menyebut gambar mana pun.
    expect(app).toContain('app.use("/internal/aleta-bot/tanda-tangan/tambah", express.json({ limit: "12mb" }));');
    const iKhusus = app.indexOf('/internal/aleta-bot/tanda-tangan/tambah');
    const iUmum = app.indexOf('app.use(express.json({ limit: "1mb" }));');
    // Yang khusus harus dipasang LEBIH DAHULU; dipasang sesudahnya ia tidak
    // pernah terpakai.
    expect(iKhusus).toBeGreaterThan(-1);
    expect(iKhusus).toBeLessThan(iUmum);
  });
});

describe("tautan ke akun portal", () => {
  it("tiga kolomnya ada, dan lahir juga pada tabel yang SUDAH ada", () => {
    // CREATE TABLE IF NOT EXISTS tidak menyentuh tabel yang sudah berisi -
    // di peladen tabel ini sudah memuat lima puluh gambar.
    for (const kolom of ["pengguna_id", "peran", "sub_peran"]) {
      expect(layanan, kolom).toContain(kolom);
    }
    expect(kode).toContain("ALTER TABLE ${TABEL} ADD COLUMN");
    expect(kode).toContain("information_schema.COLUMNS");
  });

  it("peran dan jabatannya DISALIN, bukan dibaca ulang kelak", () => {
    expect(layanan).toContain("jabatan orang itu KETIKA ia menandatangani");
    expect(kode).toContain("peran = ?, sub_peran = ?");
  });

  it("boleh kosong - pejabat luar satker memang tidak punya akun", () => {
    expect(gerbang).toContain("tanda tangan pejabat dari");
    expect(layar).toContain("tanpa akun (ketik namanya sendiri)");
  });

  it("dipulangkan pada daftarnya supaya layar tahu yang sudah tertaut", () => {
    expect(kode).toContain("penggunaId: String(b.pengguna_id || \"\")");
  });
});

describe("daftar pengguna dikirim rute tanda tangan sendiri", () => {
  it("bukan dibiarkan layar memanggil /api/users", () => {
    // Kewenangannya berbeda: layar ini menuntut "blangko-abt", /api/users
    // menuntut aktor modul pengguna. Pemilih yang kosong akan terbaca sebagai
    // "tidak ada pegawai", bukan "Anda tidak berhak melihatnya".
    expect(rute).toContain("listUsersFromDb(db, actorUserId");
    expect(rute).toContain("daftarPenggunaTaut(sesi.db, sesi.actorUserId)");
    expect(layar).not.toContain("/api/users");
  });

  it("seperlunya saja - tanpa surel, NIP, atau nomor WhatsApp", () => {
    const potongan = rute.slice(rute.indexOf("async function daftarPenggunaTaut"), rute.indexOf("function statusUbah"));
    expect(potongan).toContain("(daftar ?? [])");
    for (const bocor of ["email", "nip", "whatsapp", "password"]) {
      expect(potongan.toLowerCase(), bocor).not.toContain(bocor);
    }
  });

  it("gagalnya daftar pengguna tidak menjatuhkan layar", () => {
    expect(rute).toContain("penggunaAlasan");
    expect(layar).toContain("Namanya tetap dapat diketik sendiri");
  });

  it("hanya pengguna aktif yang ditawarkan", () => {
    expect(rute).toContain("u.isActive !== false");
  });
});

describe("jalur lamanya tidak dirusak", () => {
  it("pengimpor .doc tetap ada", () => {
    expect(kode).toContain("async function impor(isiDoc,");
    expect(layar).toContain("impor-tanda-tangan.js");
  });

  it("mengganti nama tetap membatalkan pengesahan", () => {
    // Gambar yang sudah disahkan atas nama A tidak boleh tetap sah begitu
    // namanya diganti menjadi B.
    expect(kode).toContain("disahkan = 0, disahkan_oleh = '', disahkan_pada = NULL");
  });

  it("menyimpan nama membawa tautannya sekalian", () => {
    expect(layar).toContain('tindakan: "nama"');
    expect(layar).toContain("penggunaId: u?.id ?? \"\"");
  });
});
