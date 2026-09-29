// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KETERANGAN PERKARA - CATATAN BEBAS YANG TIDAK PERNAH DITIMPA
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: tombol di bawah tunjuk konseptor, abu-abu
 * ketika kosong dan MERAH ketika ada isinya, dapat diisi siapa pun pegawai
 * pengadilan. Diklik: keluar isinya, siapa yang menulis (nama dan jabatan),
 * tanggal dan jam, dan perubahan keberapa. Keterangan lama tersembunyi sampai
 * diminta, tersusun menurut nomornya.
 *
 * ============================================================================
 * YANG PALING PENTING DIJAGA: TAMBAH SAJA
 * ============================================================================
 *
 * Catatan semacam ini dibaca orang untuk mengambil keputusan - menunda sidang,
 * menunggu berkas, menghubungi pihak. Ketika keputusan itu kelak dipertanyakan,
 * yang ditanyakan justru "waktu itu tulisannya apa".
 *
 * Satu UPDATE atau DELETE yang masuk kelak menghapus jawabannya, dan hilangnya
 * tidak akan berbunyi apa pun - layarnya tetap menampilkan sesuatu.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const modul = baca("manajemen_surat/src/server/modules/aleta-ecourt/keterangan-perkara.ts");
const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/keterangan-perkara/route.ts");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const migrasi = baca("manajemen_surat/drizzle/0047_keterangan_perkara.sql");
const skema = baca("manajemen_surat/src/server/db/schema.ts");

describe("tambah saja - tidak pernah diubah, tidak pernah dihapus", () => {
  it("modulnya tidak punya UPDATE maupun DELETE", () => {
    expect(modul).not.toMatch(/UPDATE\s+aleta_keterangan_perkara/i);
    expect(modul).not.toMatch(/DELETE\s+FROM\s+aleta_keterangan_perkara/i);
  });

  it("rutenya hanya GET dan POST - tidak ada PUT, PATCH, DELETE", () => {
    expect(rute).toContain("export async function GET(");
    expect(rute).toContain("export async function POST(");
    expect(rute).not.toContain("export async function PUT(");
    expect(rute).not.toContain("export async function PATCH(");
    expect(rute).not.toContain("export async function DELETE(");
  });

  it("nomor urutnya dihitung dari yang TERTINGGI, bukan dari jumlah baris", () => {
    // Menghitung dari jumlah membuat nomor berulang bila suatu hari ada baris
    // yang terhapus dengan tangan - dan nomor yang berulang membuat riwayatnya
    // tidak dapat dibaca.
    expect(modul).toContain("MAX(urutan)");
    expect(modul).not.toContain("COUNT(*) AS puncak");
  });

  it("sebab tambah-saja TERTULIS, supaya tidak 'dirapikan' jadi UPDATE", () => {
    expect(modul).toContain("waktu itu");
    expect(migrasi).toContain("TIDAK PERNAH DIUBAH");
  });
});

describe("siapa yang menulis tidak dapat diketik sendiri", () => {
  it("nama dan jabatan diambil dari sesi, bukan dari badan permintaan", () => {
    // Catatan ini dibaca sebagai keterangan resmi tentang perkara orang. Nama
    // penulis yang dapat diketik sendiri membuat seluruh riwayatnya tidak
    // berarti apa pun sebagai pertanggungjawaban.
    expect(rute).toContain("listUsersFromDb");
    expect(rute).toContain("ditulisOleh: String(actorUserId");
    const i = rute.indexOf("type Masukan = {");
    const blok = rute.slice(i, rute.indexOf("};", i));
    expect(blok, "badan permintaan tidak boleh memuat nama penulis").not.toContain("namaPenulis");
    expect(blok).not.toContain("jabatan");
  });

  it("nama yang tidak terbaca tidak membatalkan catatannya", () => {
    // Catatan yang hilang lebih merugikan daripada catatan yang namanya harus
    // dicari lewat akunnya.
    const i = rute.indexOf("let namaPenulis");
    const blok = rute.slice(i, rute.indexOf("const hasil = await tambahKeteranganPerkara", i));
    expect(blok).toContain("} catch {");
  });

  it("jabatan DISALIN saat menulis, bukan dibaca ulang saat menampilkan", () => {
    // Jabatan orang berubah. Membacanya ulang membuat catatan tiga bulan lalu
    // tampak ditulis oleh jabatan yang baru dijabat pekan ini.
    expect(migrasi).toContain("DISALIN");
    expect(modul).toContain("jabatan: teks(masukan.jabatan)");
  });
});

describe("siapa pun pegawai boleh mengisi", () => {
  it("kapabilitasnya panel - sama dengan yang boleh melihat jadwal", () => {
    // Menuntut kewenangan lebih tinggi berarti catatan yang paling berguna -
    // dari petugas yang mengangkat telepon, dari jurusita yang baru pulang -
    // tidak pernah tertulis, sebab merekalah yang kewenangannya paling sempit.
    const semua = rute.match(/pastikanKapabilitas\(db, actorUserId, "(\w+)"\)/g) ?? [];
    expect(semua.length, "kapabilitas tidak diperiksa").toBeGreaterThan(0);
    for (const satu of semua) {
      expect(satu).toContain('"panel"');
    }
  });
});

describe("layarnya - abu-abu, merah, dan tersembunyi sampai diminta", () => {
  it("dipasang DI BAWAH tunjuk konseptor", () => {
    const iKonseptor = layar.indexOf("<SelKonseptorSementara");
    const iKeterangan = layar.indexOf("<SelKeteranganPerkara");
    expect(iKonseptor).toBeGreaterThan(-1);
    expect(iKeterangan).toBeGreaterThan(iKonseptor);
  });

  it("merah ketika ada isinya, abu-abu ketika kosong", () => {
    const i = layar.indexOf("function SelKeteranganPerkara(");
    const blok = layar.slice(i, layar.indexOf("function BorangKeteranganPerkara(", i));
    expect(blok).toContain("const adaIsi = Boolean(keadaan?.terkini?.isi)");
    expect(blok).toContain("border-rose-400");
    expect(blok).toContain("border-dashed border-muted-foreground/40");
  });

  it("isinya TIDAK tampil sebelum ditekan", () => {
    // Diminta begitu. Memajangnya di tiap baris mengubah daftar sidang menjadi
    // daftar catatan.
    const i = layar.indexOf("function SelKeteranganPerkara(");
    const blok = layar.slice(i, layar.indexOf("function BorangKeteranganPerkara(", i));
    expect(blok).toContain("if (!terbuka) {");
    // Yang digambar saat tertutup hanya tombolnya - isinya tidak disebut.
    const tertutup = blok.slice(blok.indexOf("if (!terbuka) {"), blok.indexOf("return <BorangKeterangan"));
    expect(tertutup).not.toContain("terkini.isi");
  });

  it("riwayatnya ditarik saat blangkonya lahir, bukan saat daftar digambar", () => {
    // Dua puluh tujuh perkara berisi sepuluh revisi berarti dua ratus tujuh
    // puluh catatan yang tidak satu pun dibaca.
    const i = layar.indexOf("function BorangKeteranganPerkara(");
    const blok = layar.slice(i, i + 3000);
    expect(blok).toContain("perkaraId=${encodeURIComponent(baris.perkaraId)}");
    const daftar = layar.indexOf("const muatKeterangan = useCallback(");
    const blokDaftar = layar.slice(daftar, layar.indexOf("}, [perkaraTampil]);", daftar));
    expect(blokDaftar, "daftar tidak boleh menarik riwayat").toContain("perkaraIds=");
  });

  it("menyebutkan nomor perubahan, penulis, jabatan, dan waktunya", () => {
    const i = layar.indexOf("function BorangKeteranganPerkara(");
    const blok = layar.slice(i, i + 7000);
    expect(blok).toContain("Perubahan ke-{terkini.urutan}");
    expect(blok).toContain("terkini.namaPenulis");
    expect(blok).toContain("terkini.jabatan");
    expect(blok).toContain("sebutWaktu(terkini.ditulisAt)");
  });

  it("riwayat lama tersembunyi sampai diminta", () => {
    const i = layar.indexOf("function BorangKeteranganPerkara(");
    const blok = layar.slice(i, i + 7000);
    expect(blok).toContain("const [lihatRiwayat, setLihatRiwayat] = useState(false)");
    expect(blok).toContain("keterangan sebelumnya");
  });
});

describe("migrasi 0047", () => {
  it("nomornya diklaim di journal, dan tidak kembar", () => {
    const jurnal = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const idx = jurnal.entries.map((e) => e.idx);
    expect(new Set(idx).size, "ada idx kembar di journal").toBe(idx.length);
    const punya = jurnal.entries.find((e) => e.tag === "0047_keterangan_perkara");
    expect(punya, "0047 belum terdaftar di journal").toBeTruthy();
    expect(punya?.idx).toBe(47);
  });

  it("tabelnya juga ada di jalur idempoten schema.ts", () => {
    // Migrasi saja tidak cukup: basis data dalam memori dan pemasangan yang
    // melewati migrasi mengandalkan jalur ini.
    expect(skema).toContain("CREATE TABLE IF NOT EXISTS aleta_keterangan_perkara");
    expect(skema).toContain("idx_keterangan_perkara_urut");
  });

  it("punya indeks per perkara dan urutan", () => {
    // Tabel catatan tumbuh terus - tidak pernah ada baris yang dibuang.
    expect(migrasi).toContain("CREATE INDEX IF NOT EXISTS idx_keterangan_perkara_urut");
    expect(migrasi).toContain("(perkara_id, urutan)");
  });
});
