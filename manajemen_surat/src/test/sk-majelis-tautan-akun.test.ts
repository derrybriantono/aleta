/**
 * ============================================================================
 * SK MAJELIS: TAUTAN AKUN, DAN HANYA DI DALAM MAJELIS
 * ============================================================================
 *
 * 0044 membuat susunan majelis tersimpan dari SK - siapa ketua, siapa anggota,
 * panitera sidang siapa. Yang masih hilang: tautan ke AKUN PORTAL. ALETA tahu
 * "perkara ini majelis A" tetapi tidak tahu akun mana yang boleh membukanya,
 * siapa yang harus diberi tahu, dan tanda tangan siapa yang dibubuhkan.
 *
 * ============================================================================
 * TIDAK ADA TABEL TERSENDIRI, DAN ITU YANG MEMBUAT ATURANNYA BERLAKU
 * ============================================================================
 *
 * Satker meminta dengan tegas:
 *
 *     "hanya bisa ditautkan apabila masuk majelis, tidak bisa satu per satu"
 *
 * Itu permintaan yang benar secara kelembagaan - yang menyidangkan perkara
 * adalah MAJELIS, bukan orang lepas - dan cara memenuhinya bukan dengan
 * melarangnya di layar, melainkan dengan tidak menyediakan tempat untuk
 * menyimpannya:
 *
 *   - satu kolom pada baris majelisnya, bukan tabel pasangan orang-akun
 *   - satu-satunya alamat yang menerimanya adalah alamat simpan MAJELIS
 *   - menghapus majelisnya menghapus tautannya
 *
 * Larangan di layar dapat dilewati siapa pun yang memanggil alamatnya
 * langsung. Tidak adanya tempat menyimpan tidak dapat dilewati.
 *
 * ============================================================================
 * BERPASANGAN, BUKAN DUA DAFTAR SEJAJAR
 * ============================================================================
 *
 * Bentuknya 'A=usr_7f3a,C1=usr_22b1' - sama dengan panitera_id pada 0044, dan
 * dengan alasan yang sama persis: daftar sejajar bergeser diam-diam begitu
 * satu kode dihapus dari tengahnya. C1 menjadi milik orang yang seharusnya C3,
 * dan tidak ada yang berbunyi sampai penetapan berikutnya menyebut orang yang
 * salah.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const migrasi = baca("manajemen_surat/drizzle/0045_tautan_akun_majelis.sql");
const jurnal = baca("manajemen_surat/drizzle/meta/_journal.json");
const skema = baca("manajemen_surat/src/server/db/schema.ts");
const drizzle = baca("manajemen_surat/src/server/db/drizzle-schema.ts");
const layanan = baca("manajemen_surat/src/server/modules/aleta-ecourt/penunjukan-pengaturan.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sk-majelis/route.ts");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sk-majelis.tsx");

describe("migrasi 0045", () => {
  it("terdaftar pada jurnal dengan nomornya sendiri", () => {
    expect(jurnal).toContain('"tag": "0045_tautan_akun_majelis"');
    // 0046 belum boleh ada - sesi lain yang mengklaimnya akan terlihat di sini.
    expect(jurnal).not.toContain('"idx": 46');
  });

  it("menambah kolom, bukan membuat tabel baru", () => {
    expect(migrasi).toContain("ALTER TABLE aleta_sipp_hari_sidang");
    expect(migrasi).toContain("ADD COLUMN IF NOT EXISTS akun_id TEXT NOT NULL DEFAULT ''");
    expect(migrasi).not.toMatch(/CREATE TABLE/i);
  });

  it("sebab tidak adanya tabel tersendiri tertulis di migrasinya", () => {
    expect(migrasi).toContain("hanya bisa ditautkan apabila masuk majelis");
    // Kalimatnya terpotong baris pada berkas SQL - yang dituntut gagasannya,
    // bukan susunan barisnya.
    expect(migrasi).toContain("tempat untuk hidup sendirian");
    expect(migrasi).toContain("Menghapus majelisnya menghapus tautannya");
  });

  it("berbawaan kosong - baris lama tetap berjalan seperti sediakala", () => {
    expect(migrasi).toContain("NOT NULL DEFAULT ''");
    expect(skema).toContain("akun_id TEXT NOT NULL DEFAULT ''");
    expect(drizzle).toContain('akunId: text("akun_id").notNull().default("")');
  });
});

describe("tidak ada jalan menautkan di luar majelis", () => {
  it("hanya alamat simpan majelis yang menerimanya", () => {
    const pemakai = rute.match(/akunId:/g) || [];
    expect(pemakai.length).toBe(1);
    expect(rute).toContain('akunId: String(badan.akunId ?? "")');
  });

  it("layar mengirimnya bersama majelisnya, bukan sendiri", () => {
    expect(layar).toContain("akunId: (gabung.akun ?? []).map((a) => `${a.kode}=${a.akunId}`).join(\",\")");
    // Tidak ada pemanggilan simpan yang membawa akun tanpa majelisnya.
    expect(layar).not.toMatch(/fetch\([^)]*sk-majelis[^)]*\)[\s\S]{0,200}akunId[^]{0,80}majelisKode/);
  });

  it("tersimpan pada baris majelis, jadi ikut terhapus bersamanya", () => {
    expect(layanan).toContain("akun_id = excluded.akun_id");
    expect(drizzle).toContain("bukan orang lepas");
  });
});

describe("bentuknya berpasangan", () => {
  it("dibaca sebagai pasangan kode=akun", () => {
    expect(layanan).toContain("function bacaPasanganAkun(tersimpan: string)");
    expect(layanan).toContain("const [kodeMentah, idMentah] = potong.split(\"=\");");
  });

  it("yang tidak berbentuk pasangan dibuang sebelum tersimpan", () => {
    expect(layanan).toContain("if (!bersih || !akun) return \"\";");
    expect(layanan).toContain("bukan dibiarkan sampai ke\n * berkas perkara");
  });

  it("id akun TEKS, bukan bilangan - tidak disalin mentah dari panitera", () => {
    // panitera_id memeriksa kebilangan; akun portal berid teks, dan memeriksa
    // kebilangannya akan membuang setiap id yang sah.
    expect(layanan).toContain("BUKAN bilangan - ia teks");
    expect(layanan).not.toContain("Number.isInteger(nomor) && nomor > 0 ? nomor : 0}`;\n          })\n          .filter(Boolean)\n          .join(\",\"),\n        String(akunId");
  });

  it("satu kode menunjuk satu orang - yang kedua dibuang", () => {
    expect(layanan).toContain("if (sudah.has(kode)) continue;");
  });
});

describe("hakim dan panitera satu daftar", () => {
  it("layar menawarkan keduanya pada blok yang sama", () => {
    expect(layar).toContain("[...satu.hakimKode, ...satu.paniteraKode].map((kode)");
  });

  it("perannya disebut - ketua, hakim, atau panitera", () => {
    expect(layar).toContain('satu.hakimKode[0] === kode ? "ketua" : "hakim"');
    expect(layar).toContain('"panitera"');
  });

  it("kode yang belum diisi menjelaskan urutannya, bukan diam", () => {
    expect(layar).toContain("isi kodenya lebih dahulu");
  });
});

describe("daftar akun dan kewenangannya", () => {
  it("dikirim rute SK majelis sendiri", () => {
    expect(rute).toContain("listUsersFromDb(db, actorUserId)");
    expect(layar).not.toContain("/api/users");
  });

  it("gagalnya tidak menjatuhkan layar", () => {
    expect(rute).toContain("akunAlasan");
    expect(layar).toContain("Susunan majelisnya tetap dapat disunting");
  });

  it("hanya akun aktif, dan seperlunya saja", () => {
    expect(rute).toContain("u.isActive !== false");
    const potongan = rute.slice(rute.indexOf("akun = (daftar ?? [])"), rute.indexOf("} catch (galat)"));
    for (const bocor of ["email", "nip", "whatsapp", "password"]) {
      expect(potongan.toLowerCase(), bocor).not.toContain(bocor);
    }
  });

  it("pengikatan ke orang SIPP tidak diganti, hanya ditambahi", () => {
    // Yang lama menunjuk orang di SIPP; yang baru menunjuk akun di portal.
    // Keduanya perlu dan tidak dapat saling menggantikan.
    expect(layar).toContain("Panitera sidang menurut SK");
    expect(layar).toContain("Akun portal tiap anggota majelis");
  });
});
