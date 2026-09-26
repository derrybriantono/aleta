// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENGURUTAN KENDALI BERKAS e-COURT - BUTIR 4, 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Layar Kendali Berkas TIDAK berpenjaga sama sekali sampai hari ini: disisir
 * seluruh src/test/ dan tidak satu berkas pun menyebut aleta-ecourt-arsip-
 * berkas.tsx, daftarArsipPerkara, atau "Kendali Berkas". Itulah sebabnya kolom
 * cermin yang basi dapat bertahan di sana berbulan-bulan setelah diperbaiki di
 * tempat lain.
 *
 * Disisir sebagai TEKS MENTAH, bukan dengan memuat modulnya: ecourtStoreService
 * menarik botDbService, yang membuka sambungan MySQL saat dimuat - dan MySQL
 * bot tidak ada di laptop.
 *
 * ============================================================================
 * KEGAGALAN YANG PALING MUNGKIN DAN PALING TIDAK TERLIHAT
 * ============================================================================
 *
 * Kunci kepala kolom yang tidak dikenal peladen dijatuhkan susunUrutan ke
 * "terakhir" TANPA GALAT. Anak panahnya tetap digambar di kolom itu, tabelnya
 * memuat ulang, dan urutannya tidak pernah berubah. Tidak ada yang merah, tidak
 * ada yang tercatat di log, dan yang memakainya menyangka kolom itu memang
 * berisi begitu. Bagian b di bawah yang menangkapnya.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (...bagian: string[]) => readFileSync(path.join(akar, ...bagian), "utf8");

const layar = baca("manajemen_surat", "src", "components", "portal", "aleta-ecourt-arsip-berkas.tsx");
const layanan = baca("aleta_bot", "services", "ecourtStoreService.js");
const rute = baca(
  "manajemen_surat",
  "src",
  "app",
  "api",
  "aleta-ecourt",
  "arsip",
  "perkara",
  "route.ts"
);
const gerbangBot = baca("aleta_bot", "routes", "internalGatewayRoutes.js");
const klien = baca(
  "manajemen_surat",
  "src",
  "server",
  "modules",
  "aleta-bot",
  "whatsapp-gateway-client.ts"
);

/** Potongan sumber yang memuat daftar kolom yang boleh diurutkan. */
const blokKolom = layanan.slice(
  layanan.indexOf("const KOLOM_URUT_ARSIP"),
  layanan.indexOf("const URUTAN_LAMA")
);

describe("butir 4 - kepala kolom Kendali Berkas", () => {
  it("satu mekanisme, bukan dua: daftar Urutkan ditiadakan", () => {
    // <select> yang dihidupkan kembali akan bertentangan dengan anak panah
    // kepala kolom - penekan "Belum ada" melihat daftar itu tetap bertuliskan
    // "Terakhir dibaca (terbaru)" - dan pertentangannya tidak menggagalkan apa
    // pun. Itulah yang diperingatkan kepala tabel-kendali.tsx sendiri.
    expect(layar).not.toMatch(/<option value="belumTerbanyak"/);
    expect(layar).not.toMatch(/<option value="menungguTerbanyak"/);
    expect(layar).not.toContain("setUrutkan");
  });

  it("tiap kunci kepala kolom dikenal peladen", () => {
    const kunciLayar = [...layar.matchAll(/<KepalaUrut[\s\S]*?kunci="([a-zA-Z]+)"/g)].map(
      (m) => m[1]
    );
    // Penyapu yang menemukan nol akan lulus tanpa memeriksa apa pun.
    expect(kunciLayar.length).toBeGreaterThanOrEqual(7);
    expect(blokKolom.length).toBeGreaterThan(200);
    for (const kunci of kunciLayar) {
      expect(blokKolom, `kunci "${kunci}" tidak ada di KOLOM_URUT_ARSIP`).toContain(`${kunci}:`);
    }
  });

  it("nomor perkara diurut sebagai angka, dan tahunnya lebih dulu", () => {
    // "ORDER BY nomor_perkara" mengurut menurut huruf: 1, 10, 100, 101, ...
    // Perkara 2 berada 99 baris di bawah perkara 1, dan 10/Pdt.G/2016
    // mendahului 9/Pdt.G/2026. Diukur atas seluruh 10.120 perkara sipp_donggala.
    expect(blokKolom).toContain("SUBSTRING_INDEX(d.nomor_perkara, '/', 3)");
    expect(blokKolom).toContain("AS UNSIGNED");
    expect(blokKolom).not.toMatch(/perkara:\s*\{\s*bagian:\s*\["nomor_perkara"\]/);
  });

  it("arah tidak pernah disusun dari masukan", () => {
    // ORDER BY tidak dapat dijadikan parameter kueri, sehingga menyusunnya dari
    // teks yang dikirim pemanggil membuka jalan penyisipan SQL.
    expect(layanan).toContain('String(arah) === "naik" ? "ASC" : "DESC"');
    expect(layanan).not.toMatch(/ORDER BY \$\{[^}]*(urutkan|arah)[^}]*\}/);
    // Rute portal hanya meloloskan dua nilai.
    expect(rute).toContain('=== "naik" ? "naik" : "turun"');
  });

  it("pengikat terakhir selalu ada", () => {
    // Tanpa pengikat, dua baris bernilai sama berpindah-pindah antar pemuatan,
    // dan yang ada di baris ke-500 masuk-keluar tanpa sebab - cacat yang sama
    // dengan v_pihak_perkara yang urutannya berubah tiap jalan.
    expect(layanan).toContain('bagian.push("d.nomor_perkara ASC")');
  });

  it("nama urutan lama tetap diterjemahkan, bukan diabaikan", () => {
    // Bot dan portal tidak dipasang pada detik yang sama, dan satu tab yang
    // tertinggal terbuka semalaman masih mengirim "terlama". Tanpa peta ini ia
    // diam-diam berubah arti menjadi "terbaru" - persis terbalik.
    expect(layanan).toContain("const URUTAN_LAMA");
    expect(layanan).toContain('terlama: { kunci: "terakhir", arah: "naik" }');
    expect(layanan).toContain('belumTerbanyak: { kunci: "belumAda", arah: "turun" }');
  });

  it("arah diteruskan utuh dari layar sampai kueri", () => {
    expect(layar).toContain('arah: urutTabel?.arah ?? "turun"');
    expect(rute).toContain("arah:");
    expect(klien).toContain('arah: input.arah ?? "turun"');
    expect(gerbangBot).toContain('arah: String(req.query.arah || "")');
  });

  it("kolom hitungan dimulai dari yang terbanyak", () => {
    // "Belum ada" ditekan orang untuk satu pertanyaan saja: mana yang paling
    // banyak belum ada. Memulainya menaik menjawab pertanyaan yang tidak pernah
    // ditanya - perkara yang nol - dan menuntut tekanan kedua setiap kali.
    expect(layar).toContain("URUT_MULAI_TURUN");
    for (const kunci of ["dokumen", "berkasAda", "belumAda", "keadaan", "terakhir"]) {
      expect(layar.slice(layar.indexOf("const URUT_MULAI_TURUN"), layar.indexOf("const URUT_MULAI_TURUN") + 400)).toContain(
        `"${kunci}"`
      );
    }
    // Dan tekanan ketiga tetap ada jalan kembalinya: tanpa itu, satu klik yang
    // tidak disengaja mengunci tabelnya sampai halaman dimuat ulang.
    expect(layar).toContain('return { kunci: "terakhir", arah: "turun" };');
  });

  it("potongan daftar dikatakan, tidak didiamkan", () => {
    // Cacat aslinya: label menulis 222 perkara sementara yang digambar 100
    // baris, dan 122 perkara tidak pernah terlihat.
    expect(layar).toContain('batas: "500"');
    expect(layar).toContain("total > perkara.length");
    expect(layar).toContain("menampilkan {perkara.length} teratas");
  });
});

describe("butir 3 - satu sumber kebenaran untuk 'ada berkasnya?'", () => {
  const konteks = baca("aleta_bot", "services", "sippKonteksService.js");
  const kendali = baca("aleta_bot", "services", "kendaliBerkasService.js");

  it("tabel utama berhenti membaca kolom cermin", () => {
    // Cermin terisi 23 pdf dan 8 word dari 394 dokumen, sementara
    // aleta_bot_ecourt_files mencatat 400 berkas.
    expect(layanan).not.toMatch(/berkas_pdf IS NOT NULL/);
    expect(layanan).not.toMatch(/berkas_word IS NOT NULL/);
  });

  it("ekstensi tidak lagi memakai cermin sebagai cadangan", () => {
    // Cermin longgar membuat ekstensi menyalakan tombol unduh untuk berkas yang
    // sudah lenyap dari cakram - sementara portal menyembunyikannya. Satu
    // dokumen dengan dua jawaban, dan yang longgar menjanjikan unduhan gagal.
    expect(konteks).not.toMatch(/\|\| Boolean\(row\.berkas_pdf\)/);
    expect(konteks).not.toMatch(/\|\| Boolean\(row\.berkas_word\)/);
  });

  it("Kendali SIPP menghitung belum-terunduh dari tabel berkas", () => {
    expect(kendali).not.toMatch(/d\.berkas_pdf IS NULL OR d\.berkas_pdf = ''/);
    expect(kendali).toContain("FROM aleta_bot_ecourt_files fb");
  });

  it("perkara e-Court dibaca dari tabel pemetaan, bukan dari perkara_efiling", () => {
    // perkara_efiling berkunci (efiling_id, satker_id); kolom perkara_id TIDAK
    // ADA, dan kueri lamanya menjawab ERROR 1054 tiap kali - galat yang ditelan
    // .catch(() => new Set()), sehingga lewat_ecourt tersimpan 0 untuk seluruh
    // 10.120 perkara padahal 2.527 di antaranya memang lewat e-Court.
    expect(kendali).toContain("FROM perkara_efiling_id k");
    const kode = kendali.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(kode).not.toMatch(/FROM perkara_efiling\s+e\b/);
    expect(kode).not.toMatch(/perkaraLewatEcourt\([\s\S]{0,80}\)\.catch\(\(\) => new Set\(\)\)/);
  });

  it("aturan belum-pernah-ditarik hanya untuk perkara e-Court", () => {
    // Perkara biasa tidak punya arsip e-Court dan tidak akan pernah punya;
    // menuduhnya "belum pernah ditarik" berarti menaruh pekerjaan yang tidak
    // ada di daftar kerja panitera - tiga perempat daftarnya karangan.
    expect(kendali).toContain("perkara.lewatEcourt && dariSipp.dokumen > 0 && aleta.dokumen === 0");
  });

  it("sumber tunggalnya benar-benar dipanggil, bukan sekadar ada", () => {
    // Fungsi baru yang tidak dipanggil siapa pun lulus tsc, lulus mata, dan
    // tidak memperbaiki apa pun.
    expect(layanan).toContain("const berkasPerDokumen = await keadaanBerkasPerkara(");
    expect(layanan).toContain("await keadaanBerkasBanyakPerkara(");
    expect(layanan).toContain("await ringkasKekuranganBerkas([nomor])");
  });

  it("tipe gerbang tidak lagi memotong ruas yang sudah dikirim bot", () => {
    const blok = klien.slice(
      klien.indexOf("export type ArsipDokumenBaris = {"),
      klien.indexOf("/** Daftar perkara beserta keadaan berkasnya")
    );
    expect(blok.length).toBeGreaterThan(200);
    for (const ruas of [
      "namaBerkasPdf",
      "namaBerkasWord",
      "berkasHilang",
      "dihapusRetensi",
      "tidakTersediaPada",
    ]) {
      expect(blok, `ruas ${ruas} berhenti di gerbang`).toContain(ruas);
    }
    // ANGKA, bukan boolean: "3 berkas hilang" dan "1 berkas hilang" menuntut
    // kesungguhan yang berbeda.
    expect(blok).toContain("berkasHilang: number;");
  });

  it("tombol ZIP digantungkan pada cakram, bukan pada catatan", () => {
    // ZIP yang disusun dari baris yang berkasnya sudah lenyap menghasilkan
    // arsip kosong - dan yang mengunduhnya baru tahu sesudah membukanya.
    expect(layar).toContain("baris.adaPdfCakram + baris.adaWordCakram > 0");
    expect(layar).not.toContain("baris.adaPdf + baris.adaWord > 0");
  });

  it("yang berkasnya lenyap dari cakram tetap dapat ditarik ulang", () => {
    expect(layar).toContain("baris.tanpaBerkas > 0 || baris.berkasHilang > 0");
  });
});

/**
 * ============================================================================
 * BAGIAN YANG DIJALANKAN - 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Delapan belas uji di atas LULUS SEMUA sementara kolom "Register e-Court"
 * mematikan panel Kendali Berkas. Sebabnya: tidak satu pun menjalankan SQL.
 * susunUrutan menaruh alias agregat `nomorRegister` di dalam ekspresi bendera
 * kosong, dan MariaDB menjawab
 *
 *   ERROR 1247 (42S22) Reference 'nomorRegister' not supported
 *                      (reference to group function)
 *
 * Terukur dengan menjalankan daftarArsipPerkara apa adanya atas basis data
 * aleta_bot setempat, 25 Sep 2026: 12 dari 14 panggilan (tujuh kunci x dua
 * arah) lolos, dan dua yang melempar keduanya milik kunci "register".
 *
 * Karena itu bagian ini MENJALANKAN yang diujinya, atas basis data aleta_bot di
 * MySQL setempat. Tabelnya boleh berisi nol baris - ERROR 1247 adalah galat
 * PENGURAIAN, ia menyala sebelum satu baris pun dibaca - tetapi untuk cacat
 * kedua dan ketiga barisnya disemai sendiri lalu dihapus kembali.
 *
 * MySQL setempat WAJIB hidup. Bila mati, bagian ini merah - dan itu memang
 * jawabannya: penjaga yang berpura-pura hijau tanpa basis data adalah penjaga
 * yang sudah gagal sekali dengan cara yang sama.
 */
const requireBot = createRequire(path.join(akar, "aleta_bot", "package.json"));

type KolomUrut = { bagian: string[]; teks?: boolean };
type BarisArsip = {
  nomorPerkara: string;
  nomorRegister: string;
  dokumen: number;
  adaPdf: number;
  adaPdfCakram: number;
  berkasHilang: number;
  tanpaBerkas: number;
  tidakTersedia: number;
  dihapusRetensi: number;
};
type Toko = {
  ensureSchema: () => Promise<boolean>;
  KOLOM_URUT_ARSIP: Record<string, KolomUrut>;
  susunUrutan: (kunci: string, arah: string) => string;
  TIDAK_TERSEDIA_JEDA_HARI: number;
  daftarArsipPerkara: (arg: Record<string, unknown>) => Promise<{
    total: number;
    perkara: BarisArsip[];
  }>;
  ringkasKekuranganBerkas: (
    nomor: string[]
  ) => Promise<Map<string, { dokumen: number; tanpaBerkas: number; menunggu: number }>>;
  keadaanBerkasPerkara: (nomor: string) => Promise<Map<string, unknown>>;
  perkaraSudahLengkap: (nomor: string) => Promise<boolean>;
};
type BotDb = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  toMysqlDate: (d: Date) => string;
};

const toko = requireBot("./services/ecourtStoreService.js") as Toko;
const botDb = requireBot("./services/botDbService.js") as BotDb;
const logService = requireBot("./services/logService.js") as {
  logSystemEvent: (d: Record<string, unknown>) => Promise<unknown>;
};
const kolam = requireBot("./bot_db_config.js") as { end: () => void };

/** Nomor semaian sengaja 99xx: tidak ada perkara sungguhan di rentang itu. */
const RETENSI = "9901/Pdt.G/2026/PA.Dgl";
const JEDA_HABIS = "9902/Pdt.G/2026/PA.Dgl";
const HIDUP = "9903/Pdt.G/2026/PA.Dgl";
const TANPA_REGISTER = "9904/Pdt.G/2026/PA.Dgl";
const SEMAIAN = [RETENSI, JEDA_HABIS, HIDUP, TANPA_REGISTER];

function hariLalu(n: number): string {
  return botDb.toMysqlDate(new Date(Date.now() - n * 86400000));
}

async function hapusSemaian(): Promise<void> {
  const isian = SEMAIAN.map(() => "?").join(", ");
  await botDb.query(
    `DELETE FROM aleta_bot_ecourt_files WHERE nomor_perkara IN (${isian})`,
    SEMAIAN
  );
  await botDb.query(
    `DELETE FROM aleta_bot_ecourt_documents WHERE nomor_perkara IN (${isian})`,
    SEMAIAN
  );
}

async function semaiDokumen(
  id: string,
  nomorPerkara: string,
  register: string,
  tidakTersediaPada: string | null
): Promise<void> {
  const kini = botDb.toMysqlDate(new Date());
  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_documents
       (id, document_key, nomor_perkara, nomor_register, registrasi_ecourt, judul_dokumen,
        jenis_dokumen, status_verifikasi, pertama_terlihat, terakhir_terlihat, updated_at,
        tidak_tersedia_pada)
     VALUES (?, ?, ?, ?, ?, 'Gugatan', 'gugatan', 'valid', ?, ?, ?, ?)`,
    [id, id, nomorPerkara, register, register, kini, kini, kini, tidakTersediaPada]
  );
}

async function semaiBerkas(
  id: string,
  documentKey: string,
  nomorPerkara: string,
  jalur: string,
  dihapusRetensi: string | null
): Promise<void> {
  const kini = botDb.toMysqlDate(new Date());
  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_files
       (id, document_key, nomor_perkara, format, jalur_berkas, sidik_jari, ukuran_byte,
        diunduh_pada, terakhir_diperiksa, dihapus_retensi)
     VALUES (?, ?, ?, 'pdf', ?, ?, 10, ?, ?, ?)`,
    [id, documentKey, nomorPerkara, jalur, id, kini, kini, dihapusRetensi]
  );
}

/**
 * Semaian dibuat SEKALI untuk seluruh berkas ini, dan dihapus sekali di akhir.
 *
 * Bukan per-describe: bila dihapus di akhir describe pertama, barisnya sudah
 * lenyap sebelum describe berikutnya berjalan - dan uji "kedua fungsi menjawab
 * angka yang sama" akan lulus atas nol baris, yaitu lulus tanpa memeriksa apa
 * pun. Justru kegagalan yang dibiarkan penjaga lama.
 */
beforeAll(async () => {
  await toko.ensureSchema();
  await hapusSemaian();

  // (1) Dokumen yang SATU-SATUNYA berkasnya dihapus masa simpan. Dibentuk
  // persis seperti pembersih retensi membentuknya (ecourtArsipService.js:356):
  // jalur_berkas = '' BERSAMAAN dengan dihapus_retensi.
  await semaiDokumen("uji-urut-retensi", RETENSI, "REG-9901", null);
  await semaiBerkas("uji-urut-retensi-f", "uji-urut-retensi", RETENSI, "", hariLalu(400));

  // (2) Dokumen tanpa berkas yang e-Court jawab tidak tersedia, jedanya HABIS.
  await semaiDokumen(
    "uji-urut-jeda",
    JEDA_HABIS,
    "REG-9902",
    hariLalu(toko.TIDAK_TERSEDIA_JEDA_HARI * 2)
  );

  // (3) Dokumen dengan berkas hidup.
  await semaiDokumen("uji-urut-hidup", HIDUP, "REG-9903", null);
  await semaiBerkas("uji-urut-hidup-f", "uji-urut-hidup", HIDUP, "ecourt/2026/uji.pdf", null);

  // (4) Dokumen TANPA nomor register sama sekali - penguji kaidah "yang kosong
  // selalu di bawah", kaidah yang menuntut bendera kosong dan karena itu
  // menuntut ekspresi agregat, bukan aliasnya.
  await semaiDokumen("uji-urut-kosong", TANPA_REGISTER, "", null);
});

afterAll(async () => {
  await hapusSemaian();
  // Kolam mysql menahan proses tetap hidup bila tidak ditutup.
  kolam.end();
});

describe("butir 4 dijalankan - kueri Kendali Berkas untuk SETIAP kepala kolom", () => {
  it("tidak satu kunci pun melempar - tujuh kunci, dua arah", async () => {
    const kunci = Object.keys(toko.KOLOM_URUT_ARSIP);
    // Penyapu yang menemukan nol lulus tanpa memeriksa apa pun.
    expect(kunci.length).toBeGreaterThanOrEqual(7);

    const melempar: string[] = [];
    for (const k of kunci) {
      for (const arah of ["naik", "turun"]) {
        try {
          await toko.daftarArsipPerkara({ urutkan: k, arah, batas: 10 });
        } catch (galat) {
          const e = galat as { code?: string; message?: string };
          melempar.push(`${k}/${arah}: ${e.code || ""} ${e.message || ""}`);
        }
      }
    }
    // Sebelum diperbaiki daftar ini berisi dua baris, keduanya
    // "register: ER_ILLEGAL_REFERENCE Reference 'nomorRegister' not supported".
    expect(melempar).toEqual([]);
  });

  it("kunci ber-teks memakai ekspresi agregatnya, bukan aliasnya", () => {
    // Bendera "kosong di bawah" adalah EKSPRESI, dan alias agregat di dalam
    // ekspresi menjawab ERROR 1247. Yang diperiksa keluaran susunUrutan -
    // ORDER BY yang sungguh dikirim - bukan kode sumbernya.
    for (const [nama, kolom] of Object.entries(toko.KOLOM_URUT_ARSIP)) {
      if (!kolom.teks) continue;
      const orderBy = toko.susunUrutan(nama, "naik");
      expect(orderBy, `kunci ${nama} memakai bendera kosong`).toContain("IS NULL OR");
      expect(orderBy, `kunci ${nama} masih memakai alias agregat`).not.toMatch(
        /\(\s*nomorRegister\s+IS NULL/
      );
      expect(orderBy).toContain("MAX(");
    }
  });

  it("yang nomor registernya kosong duduk di BAWAH, berapa pun arahnya", async () => {
    for (const arah of ["naik", "turun"]) {
      const hasil = await toko.daftarArsipPerkara({
        cari: "990",
        urutkan: "register",
        arah,
        batas: 500,
      });
      const urut = hasil.perkara
        .filter((p) => SEMAIAN.includes(p.nomorPerkara))
        .map((p) => p.nomorPerkara);
      expect(urut.length).toBe(SEMAIAN.length);
      expect(urut[urut.length - 1], `arah ${arah}`).toBe(TANPA_REGISTER);
    }
  });
});

describe("butir 3 dijalankan - SATU arti 'kekurangan berkas'", () => {
  it("kedua fungsi menjawab angka yang sama atas baris yang sama", async () => {
    // Terukur sebelum diperbaiki, atas baris semaian yang SAMA:
    //   tidak_tersedia_pada 60 hari lalu -> daftar 0, ringkas 1 (berselisih)
    //   retensi murni                    -> daftar 1, ringkas 1 (sama, dan
    //                                       keduanya salah - lihat cacat 3)
    for (const nomor of SEMAIAN) {
      const daftar = await toko.daftarArsipPerkara({ cari: nomor, batas: 10 });
      const baris = daftar.perkara.find((p) => p.nomorPerkara === nomor);
      const ringkas = (await toko.ringkasKekuranganBerkas([nomor])).get(nomor);
      expect(baris, `baris ${nomor} tidak ketemu`).toBeTruthy();
      expect(ringkas, `ringkas ${nomor} tidak ketemu`).toBeTruthy();
      expect(baris?.tanpaBerkas, `tanpaBerkas berselisih pada ${nomor}`).toBe(
        ringkas?.tanpaBerkas
      );
    }
  });

  it("berkas yang dihapus masa simpan TIDAK dihitung belum ada", async () => {
    // Komentar fungsinya sudah mengatakan ini sejak lama; SQL-nya tidak.
    // Pembersih retensi mengosongkan jalur_berkas bersamaan dengan menandainya,
    // sehingga saringan `jalur_berkas <> ''` membuang barisnya dan dokumennya
    // terbaca "belum ada" - lalu jembatan mengunduh isinya ulang dari server
    // Mahkamah Agung setiap 6 atau 168 jam, dan membuangnya tiap kali.
    const ringkas = (await toko.ringkasKekuranganBerkas([RETENSI])).get(RETENSI);
    expect(ringkas?.dokumen).toBe(1);
    expect(ringkas?.tanpaBerkas).toBe(0);

    const daftar = await toko.daftarArsipPerkara({ cari: RETENSI, batas: 10 });
    const baris = daftar.perkara.find((p) => p.nomorPerkara === RETENSI);
    expect(baris?.tanpaBerkas).toBe(0);
    expect(baris?.dihapusRetensi).toBe(1);

    // Dan karenanya perkaranya TIDAK dibuka lagi oleh penarik.
    await expect(toko.perkaraSudahLengkap(RETENSI)).resolves.toBe(true);
  });

  it("jeda tidak-tersedia yang HABIS membuat dokumennya belum ada lagi", async () => {
    // Yang tidak pernah kedaluwarsa bukan lagi jeda, melainkan penghapusan.
    // Sebelum diperbaiki layar berkata "Lengkap" untuk dokumen ini sementara
    // jembatan membukanya terus tiap putaran - dua jawaban, satu baris.
    const ringkas = (await toko.ringkasKekuranganBerkas([JEDA_HABIS])).get(JEDA_HABIS);
    expect(ringkas?.tanpaBerkas).toBe(1);

    const daftar = await toko.daftarArsipPerkara({ cari: JEDA_HABIS, batas: 10 });
    const baris = daftar.perkara.find((p) => p.nomorPerkara === JEDA_HABIS);
    expect(baris?.tanpaBerkas).toBe(1);
    // Jumlah yang e-Court tolak tetap dilaporkan tersendiri - dipisahkan,
    // bukan disembunyikan.
    expect(baris?.tidakTersedia).toBe(1);
    await expect(toko.perkaraSudahLengkap(JEDA_HABIS)).resolves.toBe(false);
  });

  it("saringan 'hanya belum lengkap' memakai arti yang sama", async () => {
    // Sekaligus penjaga URUTAN PARAMETER: SUM(kurang) di SELECT, syarat WHERE,
    // lalu SUM(kurang) di HAVING. Salah urut membuat jumlah hari jeda menjadi
    // kata cari, dan jawabannya kosong tanpa satu galat pun.
    const hasil = await toko.daftarArsipPerkara({
      cari: "990",
      hanyaBelumLengkap: true,
      batas: 500,
    });
    const nomor = hasil.perkara
      .filter((p) => SEMAIAN.includes(p.nomorPerkara))
      .map((p) => p.nomorPerkara)
      .sort();
    // DUA, bukan satu: 9902 sebab jedanya habis, dan 9904 sebab ia memang tidak
    // punya baris berkas sama sekali. Yang TIDAK ikut justru yang dahulu ikut -
    // 9901, yang berkasnya dihapus masa simpan. Nilai yang dipaku dibetulkan ke
    // dua sesudah diukur; ketatnya tidak dikurangi.
    expect(nomor).toEqual([JEDA_HABIS, TANPA_REGISTER].sort());
    expect(hasil.total).toBe(2);
  });
});

describe("butir 3 dijalankan - kueri yang gagal DICATAT, bukan ditelan", () => {
  it("keadaan berkas yang tidak terbaca tidak menjadi 'tidak ada berkas'", async () => {
    // Pola `.catch(() => [])` yang dihapus di sini persis pola yang
    // menyembunyikan perkara_efiling.perkara_id: satu nama kolom yang salah
    // melenyapkan SELURUH tombol unduh dan ZIP, tanpa satu baris log.
    const dicatat: Array<Record<string, unknown>> = [];
    const logAsli = logService.logSystemEvent;
    const queryAsli = botDb.query;
    logService.logSystemEvent = (d) => {
      dicatat.push(d);
      return Promise.resolve(d);
    };
    // Hanya kueri keadaan berkas yang dibuat gagal; kueri tabel utama tetap
    // jalan, supaya yang diukur benar-benar cadangannya.
    botDb.query = (sql: string, params?: unknown[]) =>
      /jalur_berkas AS jalur/.test(String(sql))
        ? Promise.reject(
            Object.assign(new Error("Unknown column 'karangan' in 'field list'"), {
              code: "ER_BAD_FIELD_ERROR",
            })
          )
        : queryAsli(sql, params);

    try {
      await expect(toko.keadaanBerkasPerkara(HIDUP)).rejects.toThrow(/karangan/);
      expect(dicatat.length).toBeGreaterThan(0);
      expect(dicatat[0].severity).toBe("error");
      expect(String(dicatat[0].eventType)).toContain("keadaan_berkas");

      // Panel Kendali Berkas tetap menjawab, dan angkanya turun ke yang
      // TERCATAT - bukan ke nol, yang berarti "tidak satu perkara pun punya
      // berkas" dan menyembunyikan seluruh tombol unduh.
      const daftar = await toko.daftarArsipPerkara({ cari: HIDUP, batas: 10 });
      const baris = daftar.perkara.find((p) => p.nomorPerkara === HIDUP);
      expect(baris?.adaPdf).toBe(1);
      expect(baris?.adaPdfCakram).toBe(1);
      expect(baris?.berkasHilang).toBe(0);
    } finally {
      botDb.query = queryAsli;
      logService.logSystemEvent = logAsli;
    }
  });

  it("pola yang ditelan tidak boleh kembali ke kedua fungsi sumber tunggal", () => {
    // Penjaga teks, dan disengaja: yang di atas membuktikan perilakunya, yang
    // ini menahan pola penyebabnya supaya tidak diketik lagi di sebelahnya.
    const blok = layanan.slice(
      layanan.indexOf("async function keadaanBerkasPerkara"),
      layanan.indexOf("async function daftarArsipPerkara")
    );
    expect(blok.length).toBeGreaterThan(500);
    expect(blok).not.toContain(".catch(() => [])");
    expect(blok).toContain("bacaBerkasAtauCatat(");
  });
});
