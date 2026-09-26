// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DASAR_BAWAAN,
  KELAS_NADA,
  PERIODE_BAWAAN,
  PERIODE_TAG,
  kelasNada,
  periodeButuhTanggal,
} from "@/lib/tag-perkara";

/**
 * ============================================================================
 * BUTIR 7 PERMINTAAN 25 SEPTEMBER 2026 - TAG DAN RENTANG WAKTU
 * ============================================================================
 *
 * "buat pada tampilan awal status perkara itu menu tambahan disamping kanan
 * saringanlain ... yaitu tag apabila di klik maka keluar nomor perkara yang
 * dimaksud (buat semua tag yang variatif, buat super lengkap jangan ada yang
 * terlewat) dan juga tanggalnya hari ini atau antara tanggal atau antara
 * tahunan/semester/triwulan/mingguan/harian"
 *
 * ============================================================================
 * KATALOGNYA DIMUAT SUNGGUHAN, BUKAN DIBACA SEBAGAI TEKS
 * ============================================================================
 *
 * tagPerkaraService dimuat dengan createRequire, jadi yang diperiksa NILAI
 * katalognya. db_config membuat kolam sambungan MySQL secara malas - tidak ada
 * sambungan yang dibuka sampai ada kueri - sehingga memuatnya di sini tidak
 * menyentuh basis data mana pun.
 *
 * Yang dijaga terutama SAMBUNGAN ANTARBERKASNYA. Tiap cacat di bawah pernah
 * terjadi sungguhan pada batch ini, dan tak satu pun menimbulkan galat yang
 * terlihat:
 *
 *   - nada baru di bot tanpa warna di portal - lencana tanpa warna;
 *   - alias `a.` tidak ditulis ulang jadi `p.` - ERROR 1054 diam;
 *   - dua kolom latin1 berbeda di-COALESCE - ERROR 1267 diam;
 *   - medan `sampai` dipakai dua arti - tanggal tag ikut memotong pendaftaran.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
const katalog = require_(path.join(akar, "aleta_bot/services/tagPerkaraService.js")) as {
  KELOMPOK_TAG: ReadonlyArray<{ kunci: string; label: string }>;
  TAG: Record<
    string,
    {
      kelompok: string;
      label: string;
      nada: string;
      judul: string;
      tabel: string;
      syarat: string;
      balik?: boolean;
      lewatNomor?: boolean;
    }
  >;
  DASAR_TANGGAL: Record<string, { label: string; kolom: string }>;
  BATAS_ID: number;
  syaratLingkup: (dasar: string, dari: string, sampai: string) => { sql: string; nilai: string[] };
  rentang: (
    periode: string,
    acuan: string,
    dari: string,
    sampai: string
  ) => { dari: string; sampai: string };
};

const LAYANAN = baca("aleta_bot/services/tagPerkaraService.js");
const RUTE_BOT = baca("aleta_bot/routes/internalGatewayRoutes.js");
const PENCARIAN = baca("aleta_bot/services/sippStatusPerkaraService.js");
const RUTE_TAG = baca("manajemen_surat/src/app/api/aleta-ecourt/status-perkara/tag/route.ts");
const RUTE_CARI = baca("manajemen_surat/src/app/api/aleta-ecourt/status-perkara/route.ts");
const KLIEN = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const LAYAR = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
const LIB = baca("manajemen_surat/src/lib/tag-perkara.ts");

const kunciTag = Object.keys(katalog.TAG);

// ===========================================================================
// KATALOGNYA SENDIRI
// ===========================================================================

describe("butir 7 - katalog tag utuh", () => {
  it("cukup banyak dan cukup beragam - pengguna menuntut super lengkap", () => {
    // Batas BAWAH, bukan angka pasti - dan sebabnya masih berlaku: pengguna
    // memang meminta tagnya ditambah terus, dan uji yang mematok jumlah
    // persisnya akan patah justru ketika permintaan itu dipenuhi. Naik dari
    // 40/8 ke 80/11 setelah katalognya menjadi 88 tag dalam 12 kelompok.
    expect(kunciTag.length).toBeGreaterThanOrEqual(80);
    expect(katalog.KELOMPOK_TAG.length).toBeGreaterThanOrEqual(11);
  });

  it("tidak ada kelompok yang kosong", () => {
    // Kelompok tanpa anggota menggambar judul kelompok tanpa isi - terbaca
    // seperti bagian yang gagal memuat.
    for (const g of katalog.KELOMPOK_TAG) {
      const anggota = kunciTag.filter((k) => katalog.TAG[k].kelompok === g.kunci);
      expect(anggota.length, `kelompok ${g.kunci} kosong`).toBeGreaterThan(0);
    }
  });

  it("setiap tag berkelompok yang memang ada", () => {
    const sah = new Set(katalog.KELOMPOK_TAG.map((x) => x.kunci));
    for (const k of kunciTag) {
      expect(sah.has(katalog.TAG[k].kelompok), `${k} -> ${katalog.TAG[k].kelompok}`).toBe(true);
    }
  });

  it("setiap tag membawa label, penjelasan, tabel, dan syarat", () => {
    for (const k of kunciTag) {
      const t = katalog.TAG[k];
      expect(t.label.trim(), `${k} tanpa label`).not.toBe("");
      expect(t.tabel.trim(), `${k} tanpa tabel`).not.toBe("");
      expect(t.syarat.trim(), `${k} tanpa syarat`).not.toBe("");
      // Penjelasannya bukan hiasan: "Verstek 4.113" tidak memberi tahu apa pun
      // tentang APA yang dihitung, dan tag yang artinya tidak jelas akan
      // dipakai untuk menyimpulkan hal yang salah.
      expect(t.judul.trim().length, `${k} penjelasannya terlalu pendek`).toBeGreaterThanOrEqual(15);
    }
  });

  it("kunci tag memakai huruf kecil berpenghubung - ia masuk ke URL", () => {
    for (const k of kunciTag) {
      expect(k, `kunci ${k}`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("tag ketiadaan selalu atas tabel anak, bukan atas tabel perkara sendiri", () => {
    // NOT EXISTS atas tabel perkara sendiri memulangkan perkara yang bukan
    // dirinya - pertanyaannya tidak punya arti.
    for (const k of kunciTag) {
      const t = katalog.TAG[k];
      if (!t.balik) continue;
      expect(t.tabel.startsWith("perkara a"), `${k} balik atas tabel sendiri`).toBe(false);
    }
  });

  it("tidak ada galat kueri yang ditelan", () => {
    // Inilah cacat yang membuat chip "Belum ada relaas" menampilkan 10.120 -
    // SELURUH register - alih-alih 5.034, tanpa satu pesan. Untuk tag
    // "ketiadaan" bentuknya paling berbahaya: jumlahnya dihitung sebagai
    // perkaraLingkup dikurangi yang cocok, jadi kueri yang gagal memulangkan
    // nol cocok dan seluruh register dilaporkan kekurangan.
    const tanpaKomentar = LAYANAN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(tanpaKomentar).not.toMatch(/\.catch\(/);
  });

  it("hanya tag register yang dihitung dengan memindai tabel perkara", () => {
    // Bentuk "FROM perkara p JOIN anak" adalah yang membuat penghitung memakan
    // 24-29 detik. Ia hanya sah untuk tag yang syaratnya memang kolom tabel
    // perkara; tag tabel anak harus dihitung DARI tabel anaknya.
    const dariAnak = kunciTag.filter((k) => !/^perkara /.test(katalog.TAG[k].tabel));
    expect(dariAnak.length, "tidak ada tag yang dihitung dari tabel anak?").toBeGreaterThan(20);
  });

  it("sepuluh tag tahapan menutup seluruh register", () => {
    // Invarian yang dapat diperiksa siapa pun: tiap perkara berada tepat pada
    // SATU tahapan terakhir, jadi jumlah seluruh tag tahapan harus sama dengan
    // seluruh register. Sebelum ini katalognya hanya memuat lima dari sepuluh
    // keranjang dan MELEWATKAN "Putusan" yang memuat 54% register - dan tidak
    // ada yang dapat memeriksanya.
    const tahapan = kunciTag.filter((k) => /^tahap-/.test(k));
    expect(tahapan.length, `tahapan: ${tahapan.join(", ")}`).toBe(10);
  });

  it("tag jenis perkara ada dan cukup banyak untuk menutup register", () => {
    // Dihitung per KELOMPOK, bukan per awalan kunci. Awalan kunci sempat
    // menipu: satu tag mutu data bernama "jenis-nama-berselisih" berawalan
    // sama, sehingga penjumlahan menurut awalan menghitung 89 perkara dua kali
    // dan invariannya terbaca 10.209 lawan 10.120. Kuncinya sudah diganti
    // menjadi mutu-jenis-berselisih, dan penjaga ini tidak lagi bergantung
    // pada ejaan kuncinya.
    const jenis = kunciTag.filter((k) => katalog.TAG[k].kelompok === "jenis");
    expect(jenis.length).toBeGreaterThanOrEqual(15);
    // Awalan kunci dan kelompoknya harus sejalan - itu yang membuat invarian
    // dapat dihitung dengan cara mana pun tanpa menipu.
    for (const k of kunciTag) {
      if (/^jenis-/.test(k)) {
        expect(katalog.TAG[k].kelompok, `${k} berawalan jenis- tetapi bukan kelompok jenis`).toBe(
          "jenis"
        );
      }
    }
  });

  it("pagu daftar id tidak memotong register satker ini", () => {
    // Pagu 3.000 membuat irisan DUA tag salah: verstek 4.113 dan
    // sudah-diarsipkan 4.277 keduanya terpotong, sehingga irisannya terbaca
    // 1.680 padahal sesungguhnya 2.302 - 622 perkara, 27%, dan angka itulah
    // yang digambar sebagai "perkara cocok".
    //
    // Register satker ini 10.120 perkara. Pagunya harus melebihinya supaya
    // tidak mungkin memotong walau seluruh perkara cocok dengan satu tag.
    expect(katalog.BATAS_ID).toBeGreaterThan(10120);
  });

  it("ambang tunggakan tag sama dengan ambang saringan umur di layar yang sama", () => {
    // Keduanya TIDAK dapat berbagi teks: saringan memakai NOT EXISTS
    // berkorelasi, tag memakai sambungan turunan yang jauh lebih murah. Yang
    // diikat karena itu BENTUK AMBANGNYA - bulan yang sama, kolom yang sama,
    // dan tidak satu pun memotong kelonggaran perkara khusus. Terukur keduanya
    // menjawab 7 dan 1 pada 25 September 2026.
    const saringan = require_(
      path.join(akar, "aleta_bot/services/sippStatusPerkaraService.js")
    ) as { UMUR_SYARAT: Record<string, string> };

    for (const [bulan, kunciTagUmur, kunciSaringan] of [
      ["3", "tunggakan-3bulan", "lewat3bulan"],
      ["5", "tunggakan-5bulan", "lewat5bulan"],
    ] as const) {
      const sTag = katalog.TAG[kunciTagUmur].syarat;
      const sSaringan = saringan.UMUR_SYARAT[kunciSaringan];
      expect(sTag, kunciTagUmur).toContain(`INTERVAL ${bulan} MONTH`);
      expect(sSaringan, kunciSaringan).toContain(`INTERVAL ${bulan} MONTH`);
      expect(sTag, kunciTagUmur).toContain("tanggal_pendaftaran <");
      expect(sSaringan, kunciSaringan).toContain("tanggal_pendaftaran <");
      // Tidak satu pun boleh memotong kelonggaran: batas lima bulan SEMA
      // 2/2014 tidak mengenal pengecualian perkara khusus.
      expect(sTag.toLowerCase(), kunciTagUmur).not.toContain("kelonggaran");
      expect(sSaringan.toLowerCase(), kunciSaringan).not.toContain("kelonggaran");
    }
  });

  it("dasar tanggal lengkap dan tiap satunya menyebut kolomnya", () => {
    const dasar = Object.keys(katalog.DASAR_TANGGAL);
    expect(dasar).toContain(DASAR_BAWAAN);
    for (const d of dasar) {
      expect(katalog.DASAR_TANGGAL[d].label.trim(), d).not.toBe("");
      expect(katalog.DASAR_TANGGAL[d].kolom.trim(), d).not.toBe("");
    }
  });
});

// ===========================================================================
// SAMBUNGAN BOT KE PORTAL
// ===========================================================================

describe("butir 7 - setiap nada punya warnanya di portal", () => {
  it("tidak ada nada di bot yang tidak dikenal layar", () => {
    // Inilah penjaga yang paling berharga di berkas ini: menambah nada baru di
    // bot tidak menimbulkan galat apa pun, lencananya hanya tergambar tanpa
    // warna - dan tidak ada yang melihatnya sampai pengguna bertanya.
    const dipakai = new Set(kunciTag.map((k) => katalog.TAG[k].nada));
    for (const nada of dipakai) {
      expect(Object.keys(KELAS_NADA), `nada ${nada} tanpa warna`).toContain(nada);
    }
  });

  it("warna menyala berbeda dari warna mati - kalau sama, tag terpilih tak terlihat", () => {
    for (const nada of Object.keys(KELAS_NADA)) {
      expect(kelasNada(nada, true), nada).not.toBe(kelasNada(nada, false));
    }
  });

  it("nada tak dikenal jatuh ke netral, bukan ke kelas kosong", () => {
    expect(kelasNada("tidak-ada-nada-ini", false)).toBe(KELAS_NADA.netral.mati);
    expect(kelasNada("tidak-ada-nada-ini", true)).toBe(KELAS_NADA.netral.hidup);
  });

  it("tidak memakai bg-popover - token itu tidak ada pada tema ALETA", () => {
    // Memori token-popover-tidak-ada: bg-popover menghasilkan panel tembus
    // pandang, dan isinya bertumpuk dengan yang di belakangnya.
    // Komentar dibuang lebih dahulu: penjelasan di berkas itu memang MENYEBUT
    // bg-popover untuk menerangkan mengapa ia tidak dipakai.
    const tanpaKomentar = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(tanpaKomentar(LIB)).not.toContain("bg-popover");
    const iPanel = LAYAR.indexOf("function PanelTagPerkara(");
    expect(iPanel).toBeGreaterThan(-1);
    expect(LAYAR.slice(iPanel)).not.toContain("bg-popover");
  });

  it("layar tidak menyalin ulang daftar tagnya", () => {
    // Dua daftar yang harus dijaga selaras adalah cara paling pasti membuat
    // layar menyimpang diam-diam - persis cacat daftar tabel SIPP yang sudah
    // tiga kali terjadi. Katalognya datang dari bot, lengkap.
    for (const contoh of ["belum-putus", "putus-belum-bht", "ghaib"]) {
      expect(katalog.TAG[contoh], `tag contoh ${contoh} hilang dari katalog`).toBeTruthy();
      expect(LIB, `lib menyalin kunci ${contoh}`).not.toContain(contoh);
    }
    // Rute portal meneruskan katalognya utuh - itu yang membuat layar tidak
    // perlu menyalinnya, dan karena itu tidak dapat menyimpang darinya.
    expect(RUTE_TAG).toContain("tag: hasil.data.tag");
    expect(RUTE_TAG).toContain("kelompok: hasil.data.kelompok");
    expect(RUTE_TAG).toContain("dasar: hasil.data.dasar");
  });
});

// ===========================================================================
// RENTANG WAKTU YANG DIMINTA PENGGUNA
// ===========================================================================

describe("butir 7 - rentang waktu selengkap yang diminta", () => {
  it("memuat seluruh pilihan yang disebut pengguna", () => {
    const nilai = PERIODE_TAG.map((x) => String(x.nilai));
    // "hari ini atau antara tanggal atau antara tahunan/semester/triwulan/
    //  mingguan/harian" - tiap satunya harus ada.
    for (const wajib of ["hari", "rentang", "tahun", "semester", "triwulan", "minggu"]) {
      expect(nilai, `periode ${wajib} hilang`).toContain(wajib);
    }
  });

  it("bawaannya seluruhnya, bukan tahun berjalan", () => {
    // Tag seperti "Putus belum BHT" justru bertumpuk pada perkara TAHUN LALU.
    // Kalau layar terbuka dengan saringan tahun berjalan, yang paling perlu
    // dikerjakan malah yang paling tidak terlihat.
    expect(PERIODE_BAWAAN).toBe("total");
    expect(PERIODE_TAG[0].nilai).toBe("total");
  });

  it("hanya antara-tanggal yang menuntut dua tanggal diisi", () => {
    expect(periodeButuhTanggal("rentang")).toBe(true);
    for (const p of ["total", "hari", "kemarin", "minggu", "bulan", "triwulan", "semester", "tahun"]) {
      expect(periodeButuhTanggal(p), p).toBe(false);
    }
  });

  it("seluruhnya tidak memakai rentang tiruan 1900-2999", () => {
    // Rentang apa pun memaksa kolom lingkup dihitung untuk tiap baris, dan
    // tiga dari lima dasar tanggal adalah subkueri. Kosong berarti tidak ada
    // WHERE sama sekali.
    const total = katalog.rentang("total", "2026-09-25", "", "");
    expect(total.dari).toBe("");
    expect(total.sampai).toBe("");
  });

  it("hari ini dan kemarin dihitung dari acuannya, bukan dari jam mesin", () => {
    expect(katalog.rentang("hari", "2026-09-25", "", "")).toEqual({
      dari: "2026-09-25",
      sampai: "2026-09-25",
    });
    expect(katalog.rentang("kemarin", "2026-09-25", "", "")).toEqual({
      dari: "2026-09-24",
      sampai: "2026-09-24",
    });
  });

  it("antara tanggal memakai tanggal yang diisi apa adanya", () => {
    expect(katalog.rentang("rentang", "2026-09-25", "2026-01-01", "2026-03-31")).toEqual({
      dari: "2026-01-01",
      sampai: "2026-03-31",
    });
  });

  it("triwulan, semester, tahun jatuh pada batas yang benar", () => {
    expect(katalog.rentang("triwulan", "2026-09-25", "", "")).toEqual({
      dari: "2026-07-01",
      sampai: "2026-09-30",
    });
    expect(katalog.rentang("semester", "2026-09-25", "", "")).toEqual({
      dari: "2026-07-01",
      sampai: "2026-12-31",
    });
    expect(katalog.rentang("tahun", "2026-09-25", "", "")).toEqual({
      dari: "2026-01-01",
      sampai: "2026-12-31",
    });
  });

  it("lingkup kosong tidak menghasilkan WHERE sama sekali", () => {
    expect(katalog.syaratLingkup("daftar", "", "")).toEqual({ sql: "", nilai: [] });
  });

  it("tanggalnya lewat tanda tanya, kolomnya dari katalog", () => {
    // Tanggal dari peramban TIDAK PERNAH masuk ke teks SQL.
    const s = katalog.syaratLingkup("putus", "2026-01-01", "2026-03-31");
    expect(s.nilai).toEqual(["2026-01-01", "2026-03-31"]);
    expect(s.sql).not.toContain("2026-01-01");
    expect(s.sql.split("?").length - 1).toBe(2);
  });

  it("dasar tanggal yang tidak dikenal jatuh ke pendaftaran, bukan ke SQL bikinan", () => {
    const asing = katalog.syaratLingkup("'; DROP TABLE perkara; --", "2026-01-01", "");
    expect(asing.sql).toContain(katalog.DASAR_TANGGAL.daftar.kolom);
    expect(asing.sql).not.toContain("DROP");
  });
});

// ===========================================================================
// JALAN DARI PERAMBAN KE SQL
// ===========================================================================

describe("butir 7 - tidak ada SQL yang datang dari peramban", () => {
  it("kunci tag disaring dengan Object.hasOwn, bukan dengan kebenaran TAG[x]", () => {
    // TAG adalah objek biasa yang dibekukan, jadi TAG["toString"] dan
    // TAG["constructor"] BERNILAI BENAR. Kunci itu lolos penyaring, lalu
    // melempar TypeError di idPerkaraTag sebab tag.tabel undefined, dan rute
    // menjawab 500 - bukan hasil tanpa tag. Bukan lubang keamanan (tidak ada
    // SQL yang lolos), tetapi penyaring katalog yang seharusnya TERTUTUP
    // ternyata berlubang pada lima nama bawaan Object.
    expect(RUTE_BOT).toContain("Object.hasOwn(tagPerkaraService.TAG, x)");
    expect(RUTE_BOT).not.toContain(".filter((x) => tagPerkaraService.TAG[x])");
  });

  it("nama bawaan Object memang tidak lolos penyaring katalog", () => {
    // Diperiksa atas katalog yang SUNGGUHAN, bukan atas tiruan: bila kelak
    // TAG berganti bentuk menjadi Map atau objek tanpa prototipe, uji ini tetap
    // menjawab pertanyaan yang benar.
    for (const asing of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
      expect(Object.hasOwn(katalog.TAG, asing), `nama bawaan ${asing} lolos`).toBe(false);
    }
    expect(Object.hasOwn(katalog.TAG, "ghaib")).toBe(true);
  });

  it("jumlah tag sekali kirim dibatasi", () => {
    // Tanpa pagu, satu URL dengan lima ratus kunci menjalankan lima ratus
    // kueri berurutan dan menggantung peladen tanpa ada yang tahu sebabnya.
    expect(RUTE_BOT).toMatch(/\.slice\(0,\s*8\)/);
  });

  it("alias tabel ditulis ulang pada KEDUA fungsi penghitung", () => {
    // Tujuh tag bersumber pada tabel perkara sendiri, jadi tidak di-JOIN, dan
    // aliasnya `p` bukan `a`. Yang lupa menuliskannya kembali memulangkan
    // ERROR 1054 Unknown column 'a.tahapan_terakhir_text' - dan galatnya
    // ditelan lalu terbaca sebagai nol.
    const cocok = LAYANAN.match(/replace\(\/\\ba\\\.\/g, "p\."\)/g) || [];
    expect(cocok.length, "alias hanya ditulis ulang di satu tempat").toBeGreaterThanOrEqual(2);
    const sendiri = kunciTag.filter((k) => katalog.TAG[k].tabel.startsWith("perkara a"));
    expect(sendiri.length, "tidak ada tag atas tabel perkara sendiri lagi?").toBeGreaterThan(0);
  });

  it("tabel arsip ditautkan lewat nomor, sebab perkara_id-nya nol", () => {
    const lewatNomor = kunciTag.filter((k) => katalog.TAG[k].lewatNomor);
    expect(lewatNomor.length).toBeGreaterThan(0);
    expect(LAYANAN).toContain("TRIM(TRAILING '.' FROM a.nomor_perkara)");
  });
});

describe("butir 7 - daftar id kosong memulangkan nol baris", () => {
  it("kosong berarti tidak ada yang cocok, bukan tagnya diabaikan", async () => {
    // Mengabaikan tag yang tidak menjaring apa pun akan menampilkan SELURUH
    // register seolah tagnya menyala - jawaban yang salah dengan tampilan
    // yang meyakinkan.
    //
    // Sejak pencarian berhalaman (butir 7-8, 25 September 2026) jawabannya
    // berbentuk halaman - { perkara, adaLagi, ... } - jadi pulang awalnya
    // `kosong()`, bukan lagi `[]`. Teksnya tetap dipatok, dan kini
    // perilakunya juga DIJALANKAN: nol baris, tidak ada halaman berikutnya,
    // dan tidak satu kueri pun terkirim ke SIPP.
    expect(PENCARIAN).toContain("if (idTag.length === 0) return kosong();");

    type Kueri = (sql: unknown, ...sisa: unknown[]) => unknown;
    const db = require_(path.join(akar, "aleta_bot/db_config.js")) as { query: Kueri };
    const asli = db.query;
    const terkirim: string[] = [];
    db.query = (sql: unknown, ...sisa: unknown[]) => {
      terkirim.push(String(sql));
      const balik = sisa[sisa.length - 1];
      if (typeof balik === "function") balik(null, []);
      return undefined;
    };
    try {
      const layanan = require_(path.join(akar, "aleta_bot/services/sippStatusPerkaraService.js")) as {
        cariPerkaraHalaman: (
          kata: string,
          pilihan: Record<string, unknown>
        ) => Promise<{ perkara: unknown[]; adaLagi: boolean }>;
        cariPerkara: (kata: string, pilihan: Record<string, unknown>) => Promise<unknown[]>;
      };
      // Saringan lain ikut diisi: tanpa pulang awal, jenis perkara saja sudah
      // cukup untuk menjalankan kueri atas seluruh register.
      const halaman = await layanan.cariPerkaraHalaman("", { idTag: [], jenisPerkara: "Cerai" });
      expect(halaman.perkara).toEqual([]);
      expect(halaman.adaLagi).toBe(false);
      // Bentuk lama tetap larik kosong.
      expect(await layanan.cariPerkara("", { idTag: [], jenisPerkara: "Cerai" })).toEqual([]);
      expect(terkirim).toEqual([]);
    } finally {
      db.query = asli;
    }
  });

  it("daftar id masuk sebagai tanda tanya, bukan dirangkai ke teks SQL", () => {
    expect(PENCARIAN).toContain('const isianId = idTag.map(() => "?").join(", ");');
  });
});

describe("butir 7 - nama status putusan dan tabrakan collation", () => {
  it("nama status dibaca lewat JOIN atas idnya", () => {
    // status_putusan_nama kosong pada 94,8% baris - terukur. Kartu hasil yang
    // membacanya langsung menampilkan status kosong pada hampir semua perkara.
    expect(PENCARIAN).toContain("LEFT JOIN status_putusan sx ON sx.id = x.status_putusan_id");
  });

  it("kedua sisi dipaksa satu collation", () => {
    // ERROR 1267 Illegal mix of collations: perkara_putusan.status_putusan_nama
    // latin1_swedish_ci, status_putusan.nama latin1_general_ci. Tanpa CONVERT
    // pada KEDUANYA, kuerinya gagal seluruhnya - bukan hanya kolom itu.
    expect(PENCARIAN).toContain("CONVERT(x.status_putusan_nama USING utf8)");
    expect(PENCARIAN).toContain("CONVERT(sx.nama USING utf8)");
  });

  it("dicabut dan gugur dibaca dari status_putusan_id, bukan dari kolom tanggalnya", () => {
    // tanggal_cabut terisi pada 47 dari 535 perkara yang dicabut - 91% hilang
    // tanpa satu pun galat.
    expect(PENCARIAN).toContain("sp.nama = 'Dicabut'");
    expect(PENCARIAN).toContain("sp.nama IN ('Digugurkan', 'Gugur')");
    expect(katalog.TAG.dicabut.syarat).toContain("s.nama = 'Dicabut'");
  });
});

// ===========================================================================
// SATU NAMA SATU ARTI
// ===========================================================================

describe("butir 7 - tanggal tag tidak menyerobot saringan pendaftaran", () => {
  it("medannya bernama tagDari dan tagSampai", () => {
    // `sampai` pada rute yang sama sudah dipakai saringan tanggal PENDAFTARAN.
    // Satu nama untuk dua arti membuat tanggal panel tag ikut memotong
    // pendaftaran tanpa satu pun galat - ditemukan 25 September 2026.
    expect(KLIEN).toContain("tagDari?: string;");
    expect(KLIEN).toContain("tagSampai?: string;");
    expect(RUTE_CARI).toContain('p.get("tagDari")');
    expect(RUTE_CARI).toContain('p.get("tagSampai")');
  });

  it("bot membaca tagDari, bukan dari", () => {
    expect(RUTE_BOT).toContain("req.query.tagDari");
    expect(RUTE_BOT).toContain("req.query.tagSampai");
  });

  it("saringan pendaftaran tetap memakai sejak dan sampai seperti sebelumnya", () => {
    // Yang lama TIDAK BOLEH berubah artinya - pemanggil lain sudah memakainya.
    expect(KLIEN).toContain("sejak?: string;");
    expect(KLIEN).toContain("sampai?: string;");
    expect(RUTE_CARI).toContain('p.get("sejak")');
  });
});

// ===========================================================================
// YANG DIPOTONG DISEBUTKAN
// ===========================================================================

describe("butir 7 - batas tidak memotong dalam diam", () => {
  it("jumlah sesungguhnya dikirim bersama hasilnya", () => {
    expect(RUTE_BOT).toContain("jumlahTag: Array.isArray(idTag) ? idTag.length : null");
    expect(RUTE_CARI).toContain("jumlahTag");
    expect(LAYAR).toContain("ringkasTag.jumlah");
  });

  it("tag yang daftarnya mentok disebutkan namanya", () => {
    // BATAS_ID memotong perkara TERTUA. Tanpa disebutkan, layar tampak
    // menjawab pertanyaan yang sebenarnya hanya dijawab sebagian.
    expect(katalog.BATAS_ID).toBeGreaterThan(0);
    expect(RUTE_BOT).toContain("tagPerkaraService.BATAS_ID");
    expect(RUTE_BOT).toContain("tagDipotong");
    expect(LAYAR).toContain("ringkasTag.dipotong");
    expect(LAYAR).toContain("3.000");
  });

  it("layar menyebut berapa yang ditampilkan dari berapa yang cocok", () => {
    expect(LAYAR).toMatch(/perkara cocok dengan tag ini/);
    expect(LAYAR).toMatch(/ditampilkan \{hasilCari\.length/);
  });
});

describe("butir 7 - panelnya sendiri", () => {
  it("tombolnya berdiri di samping Saringan lain", () => {
    const iSaringan = LAYAR.indexOf('"Sembunyikan saringan" : "Saringan lain"');
    const iTag = LAYAR.indexOf('"Sembunyikan tag" : "Tag & rentang waktu"');
    expect(iSaringan).toBeGreaterThan(-1);
    expect(iTag).toBeGreaterThan(iSaringan);
    // Keduanya di dalam satu baris tombol yang sama - jaraknya tidak boleh
    // lebih dari beberapa ratus huruf, jangan sampai ia tersesat ke bagian
    // lain layar.
    expect(iTag - iSaringan).toBeLessThan(900);
  });

  it("jumlah tiap tag tertulis pada tagnya, sebelum ditekan", () => {
    const iPanel = LAYAR.indexOf("function PanelTagPerkara(");
    const panel = LAYAR.slice(iPanel);
    // Number(n) sejak angkanya boleh null - null berarti belum dihitung, dan
    // itu dibedakan dari nol.
    expect(panel).toContain('Number(n).toLocaleString("id-ID")');
    expect(panel).toContain("jumlah[x.kunci]");
  });

  it("tag bernilai nol tetap tampak, hanya dimatikan", () => {
    // Membuang yang nol membuat daftarnya berubah-ubah tiap rentang diganti,
    // dan petugas kehilangan jejak tag yang kemarin ada.
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain("const kosong = n === 0 && !hidup;");
    // Hanya `kosong`, TIDAK lagi `kosong || memuat`: menghitung 88 tag memakan
    // 6,6 detik, dan mematikan seluruh chip selama itu berarti panel yang
    // berdiri seketika tetap tidak dapat dipakai selama enam setengah detik.
    // Pencariannya tidak menunggu angkanya, jadi chipnya pun tidak perlu.
    expect(panel).toContain("disabled={kosong}");
    expect(panel).not.toContain("disabled={kosong || memuat}");
  });

  it("lingkup yang sedang dihitung ditulis apa adanya", () => {
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain("Dihitung atas");
    expect(panel).toContain("seluruh register");
    // Tanggalnya memakai bentuk butir 1, bukan ISO.
    expect(panel).toContain("tanggalDMY(lingkup.dari");
  });

  it("beberapa tag digabung dengan DAN, dan itu disebutkan", () => {
    expect(RUTE_BOT).toContain("idTag.filter((x) => daftar.includes(x))");
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain("digabung dengan DAN");
  });

  it("jumlah tag tidak menyusut mengikuti tag yang menyala", () => {
    // Kalau ikut menyusut, menyalakan satu tag membuat tag lain terbaca nol
    // dan mustahil diduga mana yang masih masuk akal dinyalakan berikutnya.
    const i = LAYAR.indexOf("useEffect(() => {\n    if (!tagTampil) return;");
    expect(i).toBeGreaterThan(-1);
    const efek = LAYAR.slice(i, LAYAR.indexOf("}, [tagTampil,", i));
    expect(efek).not.toContain("tagPilih");
  });

  it("sekali tekan, nomor perkaranya keluar - tanpa tombol kedua", () => {
    // Permintaan pengguna harfiah: "tag apabila di klik maka keluar nomor
    // perkara yang dimaksud". Daftar tagnya DITITIPKAN ke pencarian, tidak
    // dibaca dari keadaan React - keadaan itu belum tersetel ketika penanganan
    // tekanan berjalan, jadi membacanya akan selalu tertinggal satu tekanan.
    expect(LAYAR).toContain("const jalankanCari = useCallback(async (tagTimpa?: string[]) => {");
    expect(LAYAR).toContain("const tagDipilih = (tagTimpa ?? tagPilih).filter(Boolean);");
    expect(LAYAR).toContain("void jalankanCari(berikut);");
  });

  it("jawaban pencarian yang sudah ditinggalkan dibuang, bukan digambar", () => {
    // Satu tag memakan 3,5 sampai 10 detik (terukur), jadi dua tekanan beruntun
    // benar-benar dapat bersusulan - dan yang lebih lambat mendarat terakhir,
    // menggambar hasil tag yang sudah dilepas.
    expect(LAYAR).toContain("const putaranCari = useRef(0);");
    expect(LAYAR).toContain("if (putaranCari.current !== putaran) return;");
  });

  it("penghitungan tag yang ditinggalkan DIBATALKAN, bukan hanya dibuang jawabannya", () => {
    // hitungSemua 15-44 detik terukur, dan kolam sambungan bot hanya 10.
    // Mengganti dua pemilih tanpa pembatalan menjalankan 38 kueri berat
    // serentak di SIPP - antreannya ikut menahan kueri petugas lain.
    expect(LAYAR).toContain("const pembatal = new AbortController();");
    expect(LAYAR).toContain("signal: pembatal.signal");
    expect(LAYAR).toContain("pembatal.abort();");
    // Pembatalan bukan kegagalan; menampilkannya membuat layar berkedip merah
    // tiap kali penggunanya mengganti pilihan.
    expect(LAYAR).toContain('kesalahan.name === "AbortError"');
  });

  it("tanggal acuan dapat disunting, supaya triwulan lalu dapat ditanyakan", () => {
    // Tanpa kotak ini, "triwulan" hanya pernah berarti triwulan yang sedang
    // BERJALAN - sedangkan laporan triwulanan selalu tentang yang sudah lewat.
    expect(LAYAR).toContain("Tanggal acuan");
    expect(LAYAR).toContain("onUbahAcuan");
    expect(LAYAR).toContain("acuan: acuanTag || hariIniIso()");
  });

  it("rentang waktu boleh berdiri sendiri tanpa satu tag pun", () => {
    // Pengguna menyebutnya sebagai permintaan tersendiri: "dan juga tanggalnya
    // hari ini atau antara tanggal atau antara tahunan/semester/...".
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain('disabled={sedangMencari || (dipilih.length === 0 && periode === "total")}');
    // Rute portal pun harus menjalankan pencarian untuk periode sendirian.
    expect(RUTE_CARI).toContain('saringan.periode !== "total"');
  });

  it("satu sandi relaas, satu nama - di layar maupun di katalog tag", () => {
    // Sandi 'S' pernah diberi DUA nama yang berlawanan pada SATU layar:
    // "Pemanggilan gagal" pada Saringan lain, dan "Surat tercatat (POS)" pada
    // panel tag. Keduanya menjaring baris yang sama - ket_temu='S', terukur
    // 3.104 baris pada 1.431 perkara - jadi salah satunya mengarang angka
    // tunggakan panggilan sebesar 1.431 perkara.
    //
    // Yang benar SURAT TERCATAT, menurut komentar kolom ket_temu SIPP sendiri,
    // dan dikuatkan datanya: 829 dari 1.431 perkara itu ber-status_pos = 1 yang
    // berarti BERHASIL.
    expect(LAYAR).not.toContain('label: "Pemanggilan gagal"');
    expect(LAYAR).toContain('{ kunci: "surat_tercatat", label: "Dipanggil lewat surat tercatat" }');

    // Katalog tag menjaring sandi yang sama; labelnya harus menyebut surat
    // tercatat, bukan kegagalan.
    const tagSurat = Object.entries(katalog.TAG).find(([, x]) =>
      /ket_temu\s*=\s*'S'/.test(x.syarat)
    );
    expect(tagSurat, "tidak ada tag untuk sandi S").toBeTruthy();
    expect(tagSurat?.[1].label.toLowerCase()).toContain("surat tercatat");
    expect(tagSurat?.[1].label.toLowerCase()).not.toContain("gagal");
  });

  it("saringan jenis putusan membaca nama lewat JOIN, sama dengan kartu hasilnya", () => {
    // Terukur di sipp_donggala: keenam pilihan jenis putusan SALAH ketika
    // dibaca dari kolom status_putusan_nama yang kosong 94,8%.
    //   Dikabulkan 447 -> 8.910, Ditolak 4 -> 53, Tidak Dapat Diterima 1 -> 75,
    //   Dicabut 46 -> 535, Digugurkan 6 -> 255, Dicoret 15 -> 34.
    // Jumlahnya 519 lawan 9.862 - panitera membaca chip "Dikabulkan 8.910" lalu
    // mengetik kata yang sama ke kotak di sebelahnya dan mendapat 447.
    expect(PENCARIAN).not.toContain("pu.status_putusan_nama LIKE ?");
    // Kolom namanya TIDAK dibuang - ia satu-satunya sumber bagi perkara yang
    // status_putusan_id-nya menunjuk nama lain (terukur perkara_id 508:
    // nama 'Dikabulkan', id 65 = 'Digugurkan'). Karena itu COALESCE, dengan
    // kolom nama didahulukan, dan CONVERT pada KEDUA sisi.
    expect(PENCARIAN).toContain("CONVERT(pu.status_putusan_nama USING utf8)");
    expect(PENCARIAN).toContain("CONVERT(sp.nama USING utf8)");
  });

  it("panel berdiri seketika: katalog dijemput tanpa menyentuh SIPP", () => {
    // Menghitung 88 tag memakan 6,6 detik pada lingkup "Seluruhnya" (terukur).
    // Katalognya sendiri tetapan yang dibekukan di bot - nol kueri - jadi panel
    // tidak boleh menunggu angkanya untuk menggambar nama-nama tagnya.
    expect(LAYAR).toContain('status-perkara/tag?katalogSaja=1');
    expect(RUTE_BOT).toContain('String(req.query.katalogSaja || "") === "1"');
    // Jalur katalog-saja TIDAK boleh menyentuh penghitung.
    const iKatalog = RUTE_BOT.indexOf('if (String(req.query.katalogSaja');
    const iHitung = RUTE_BOT.indexOf("tagPerkaraService.hitungSemua", iKatalog);
    expect(iKatalog).toBeGreaterThan(-1);
    expect(iHitung).toBeGreaterThan(iKatalog);
  });

  it("belum dihitung dibedakan dari nol", () => {
    // jumlah null berarti belum dihitung; {} berarti sudah dihitung dan kosong.
    // Chip yang belum berangka digambar "…" dan TETAP dapat ditekan - kalau ia
    // dimatikan, seluruh panel mati selama enam setengah detik pertama.
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain("const belumDihitung = jumlah === null;");
    expect(panel).toContain('{belumDihitung ? "…" : Number(n).toLocaleString("id-ID")}');
    expect(panel).toContain("disabled={kosong}");
    expect(panel).not.toContain("disabled={kosong || memuat}");
  });

  it("delapan puluh delapan tag dapat disaring namanya", () => {
    const panel = LAYAR.slice(LAYAR.indexOf("function PanelTagPerkara("));
    expect(panel).toContain("Saring nama tag");
    // Dicocokkan ke label DAN penjelasan: kata yang dicari orang ("BHT",
    // "panjar") belum tentu ada di labelnya.
    expect(panel).toContain("x.judul.toLowerCase().includes(kataCari)");
    // Tag yang menyala tetap berlaku walau tersaring keluar dari pandangan -
    // dan itu dikatakan, bukan didiamkan.
    expect(panel).toContain("tetap berlaku walau tidak tampil");
  });

  it("pagu pemotongan disebut dari bot, tidak ditulis keras di layar", () => {
    // Peringatan ini pernah menyebut "3.000" sebagai teks, dan tetap menyebut
    // 3.000 sesudah pagunya dinaikkan menjadi 20.000 - berbohong tentang angka
    // yang dipotong.
    expect(LAYAR).toContain("(ringkasTag.batasId ?? 0).toLocaleString");
    expect(LAYAR).not.toContain("lebih dari 3.000 perkara");
    expect(RUTE_BOT).toContain("batasId: tagPerkaraService.BATAS_ID");
  });

  it("nomor perkara hasilnya dapat disalin sekaligus", () => {
    // "apabila di klik maka keluar nomor perkara yang dimaksud" - nomor itu
    // dipakai di tempat lain, jadi ia harus dapat dibawa keluar.
    expect(LAYAR).toContain("Salin daftar nomor");
    expect(LAYAR).toContain("navigator.clipboard.writeText");
    // Papan salin dapat ditolak peramban pada sambungan bukan HTTPS -
    // kegagalannya disebutkan, tidak ditelan.
    expect(LAYAR).toContain("Peramban menolak menyalin");
  });
});
