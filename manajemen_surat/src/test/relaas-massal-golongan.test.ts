// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pihakDipanggil as pihakDariPohon } from "@/lib/pohon-blangko";

/**
 * ============================================================================
 * GOLONGAN PANGGILAN RELAAS - DIJALANKAN ATAS DATA SUNGGUHAN, BUKAN DISISIR
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026: "di sipp dan abt deteksi apa saja
 * panggilan untuk sidang pertama, sidang yang ditunda dan pemberitahuan
 * putusan, blangkonya ambil dari abt serta jalankan saranmu".
 *
 * Berkas ini menjaga sisi BOT-nya: relaasMassalService benar-benar dijalankan
 * atas sipp_donggala setempat, dengan db_config dijembatani mysql.exe. Tidak ada
 * satu pun pemeriksaan di sini yang membaca teks sumber - penjaga penyisir teks
 * di repositori ini sudah tiga kali hijau atas kode yang melempar galat.
 *
 * ============================================================================
 * TIGA HAL YANG DIJAGA, DAN APA YANG RUSAK BILA PENJAGANYA HILANG
 * ============================================================================
 *
 * 1. GOLONGAN "SIDANG PERTAMA" TIDAK BERGANTUNG PADA ARTI KOLOM `urutan`.
 *
 *    Komentar kolom perkara_jadwal_sidang.urutan berbunyi "Urutan Jadwal Sidang
 *    Salam Satu Hari yang sama: (by system)" - kalau itu benar, memakainya
 *    sebagai nomor sidang salah. Karena itu di sini nomor sidang diperiksa
 *    terhadap turunan yang BERDIRI SENDIRI: banyaknya sidang yang benar-benar
 *    lebih awal pada perkara yang sama. Diukur 25 September 2026 atas seluruh
 *    20.109 baris, keduanya cocok 20.109 kali dan berselisih NOL kali - jadi
 *    kolomnya memang nomor sidang dan komentarnya yang tidak menggambarkan
 *    datanya. Bila suatu hari selisih itu muncul, uji ini merah lebih dahulu.
 *
 * 2. dihadiri_oleh KOSONG MENJADI "tidak-diketahui", BUKAN "keduanya"; SANDI 1
 *    MENJADI "tidak-perlu", BUKAN "tidak-diketahui".
 *
 *    Sebaran terukur atas 20.109 baris: 2 -> 10.041, 1 -> 7.486, KOSONG ->
 *    1.354, 4 -> 1.055, 3 -> 169, 10 -> 4. Arti sandinya dibaca dari BORANG
 *    SIPP (jadwal_sidang_p_edit.php): 1 "Semua Pihak" - yang hadir diperintahkan
 *    datang lagi di muka sidang, jadi TIDAK dipanggil. Sampai 25 September 2026
 *    sandi 1 dijawab "tidak-diketahui" dan 7.486 sidang yang jawabannya sudah
 *    tercatat disodorkan kepada juru sita sebagai pertanyaan. Kosong tetap
 *    "tidak-diketahui": notifikasi.js menjatuhkannya ke "semua" - tidak merugikan
 *    untuk MEMBERI TAHU, merugikan untuk MEMANGGIL: 1.354 baris akan terbaca
 *    "semua sudah hadir" lalu tidak dipanggil, dan sidangnya batal. Petanya
 *    dibandingkan dengan kembarannya di pohon-blangko.ts, sebab dua salinan yang
 *    bergeser sendiri lebih buruk daripada satu yang salah.
 *
 * 3. HITUNGAN PER GOLONGAN BERJUMLAH SAMA DENGAN SELURUH BARISNYA.
 *
 *    Layar menggambar angka ringkas di atas dan daftar baris di bawah. Bila
 *    jumlahnya tidak sama, salah satunya berbohong - dan yang membaca tidak
 *    punya cara mengetahui yang mana.
 *
 * ============================================================================
 * JEMBATAN db_config -> mysql.exe, DAN MENGAPA SQL LEWAT BERKAS
 * ============================================================================
 *
 * Bot yang sungguhan memakai penggerak mysql lewat soket. Di sini query
 * dititipkan ke mysql.exe XAMPP setempat, dan SQL-nya ditulis ke BERKAS lalu
 * dijalankan dengan `source`: baris perintah Windows menolak SQL panjang dengan
 * ENAMETOOLONG - batas sistem, bukan batas MySQL.
 *
 * Bila mysql.exe tidak ada di mesin ini, ujinya DILEWATI beserta sebabnya yang
 * disebut - dan hanya untuk sebab itu. Query yang GAGAL tidak pernah dilewati:
 * ia dilempar apa adanya, sebab "nol baris" dan "tidak dapat dibaca" adalah dua
 * jawaban yang berbeda.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const AKAR_BOT = path.join(AKAR, "aleta_bot");
const MYSQL = "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const BASIS = "sipp_donggala";
// Berkas sementara ke D: - disk C: tidak disentuh. Namanya memuat pid supaya dua
// jalanan uji yang bersamaan (sesi paralel) tidak saling menimpa kuerinya.
const KERJA = "D:/aleta-dev/kerja/uji-relaas-massal";
const BERKAS_SQL = path.join(KERJA, `_uji-golongan-${process.pid}.sql`);

const ADA_MYSQL = existsSync(MYSQL);

type BarisPekerjaan = {
  jenis: string;
  perkaraId: number;
  nomorPerkara: string;
  pihak: string;
  sebutanPihak: string;
  golongan: string;
  urutanSidang: number;
  dihadiriOleh: number | string | null;
  pihakDipanggil: string;
  sudahAdaRelaas: boolean;
  tanggalSidang: string;
  tanggalPutusan: string;
  caraSandi: string;
  caraLabel: string;
  resi: string;
  adaBerkas: boolean;
};

type Jurusita = {
  nama: string;
  relaas: number;
  pemberitahuan: number;
  belumAdaRelaas: number;
  baris: BarisPekerjaan[];
};

type Hasil = {
  ok: boolean;
  tanggal: string;
  ringkas: {
    relaas: number;
    pemberitahuan: number;
    perkara: number;
    jurusita: number;
    tanpaJurusita: number;
    berselisih: number;
    belumAdaRelaas: number;
    tidakPerlu: number;
    golongan: Record<string, number>;
  };
  jurusita: Jurusita[];
  catatan: string[];
};

type Layanan = {
  relaasMassal: (tanggal: string) => Promise<Hasil>;
  GOLONGAN: string[];
  golonganSidang: (x: {
    nomorSidang: number;
    ditunda?: string | null;
    ikrarTalak?: string | null;
  }) => string;
  pihakDipanggilDariSandi: (nilai: unknown) => string;
  pihakUntukGolongan: (golongan: string, sandi: unknown) => string;
  sisiUntukPihak: (pihak: string) => number[];
};

type ModulCjs = new (id: string) => { filename: string; loaded: boolean; exports: unknown };

/** Mengubah isian `?` menjadi nilai SQL. Larik menjadi daftar untuk `IN (?)`. */
function kutip(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "NULL";
  if (Array.isArray(nilai)) return nilai.length === 0 ? "NULL" : nilai.map(kutip).join(",");
  if (typeof nilai === "number") return String(nilai);
  if (nilai instanceof Date) return `'${nilai.toISOString().slice(0, 19).replace("T", " ")}'`;
  return `'${String(nilai).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

let jumlahKueri = 0;

function jalankanSql(sql: string, isian: unknown[]): Array<Record<string, string | null>> {
  let i = 0;
  const utuh = sql.replace(/\?/g, () => kutip(isian[i++]));
  mkdirSync(KERJA, { recursive: true });
  writeFileSync(BERKAS_SQL, utuh, "utf8");
  jumlahKueri += 1;
  const keluar = execFileSync(
    MYSQL,
    ["-u", "root", "-B", BASIS, `--execute=source ${BERKAS_SQL}`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  ).trim();
  if (!keluar) return [];
  const baris = keluar.split(/\r?\n/);
  const kepala = baris[0].split("\t");
  return baris.slice(1).map((b) => {
    const sel = b.split("\t");
    const o: Record<string, string | null> = {};
    kepala.forEach((k, j) => (o[k] = sel[j] === "NULL" ? null : sel[j]));
    return o;
  });
}

/**
 * Memuat layanan bot dengan db_config DIGANTI jembatan mysql.exe.
 *
 * Penggantinya dipasang di require.cache SEBELUM layanannya dimuat, supaya
 * kolam sambungan mysql yang sungguhan tidak pernah dibuat - kalau ia dibuat,
 * uji ini akan menggantung menunggu SIPP peladen yang mati.
 */
function muatLayanan(): Layanan {
  const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config"));
  const Modul = require_("node:module") as unknown as ModulCjs;
  const palsu = new Modul(jalurDb);
  palsu.filename = jalurDb;
  palsu.loaded = true;
  palsu.exports = {
    query: (
      sql: string,
      isian: unknown[],
      balik: (galat: Error | null, hasil: unknown) => void
    ) => {
      try {
        balik(null, jalankanSql(sql, isian || []));
      } catch (e) {
        // Galat SQL diteruskan APA ADANYA. Mengubahnya menjadi larik kosong akan
        // membuat uji ini hijau atas layanan yang tidak dapat membaca apa pun.
        const galat = e as { stderr?: string; message?: string };
        const pesan = String(galat.stderr || galat.message || e)
          .split(/\r?\n/)[0]
          .slice(0, 400);
        balik(new Error(pesan), null);
      }
    },
  };
  const cache = require_.cache as unknown as Record<string, unknown>;
  cache[jalurDb] = palsu;
  return require_(path.join(AKAR_BOT, "services", "relaasMassalService.js")) as Layanan;
}

const layanan = muatLayanan();

/**
 * Tanggal yang dipakai, dan mengapa masing-masing dipilih. Seluruhnya diukur
 * pada sipp_donggala 25 September 2026.
 *
 *   2026-04-29  hari tersibuk relaas: 58 relaas, 6 pemberitahuan, 3 juru sita.
 *               Angka yang sudah terbukti sebelum golongan ada - ia yang
 *               membuktikan tambahan ini tidak mengubah belahan pertama.
 *   2026-08-18  memuat KEDUA belahan sekaligus: 20 relaas dan 15 pemberitahuan
 *               tercatat, serta 9 baris yang relaasnya belum ada.
 *   2026-09-22  relaas 0 dan pemberitahuan 0, tetapi 22 sidang hari itu belum
 *               punya relaas - hari yang sebelum ini dijawab "tidak ada apa-apa".
 *   2026-09-04  18 sidang yang sidang sebelumnya dihadiri SEMUA pihak (sandi 1)
 *               dan 14 putusan yang dibacakan di hadapan semua pihak - inilah
 *               yang menguji "tidak-perlu" (32 bukan pekerjaan) - serta 4
 *               putusan Pdt.P yang sidang pembacaannya tanpa sandi kehadiran
 *               (diinput susulan pukul 22.44-22.49), yang menguji
 *               "tidak-diketahui".
 *   2026-06-30  memuat 3 relaas yang sidang_id-nya milik PERKARA LAIN.
 */
const TANGGAL = {
  tersibuk: "2026-04-29",
  duaBelahan: "2026-08-18",
  tampakKosong: "2026-09-22",
  kehadiranTakTerbaca: "2026-09-04",
  sidangPerkaraLain: "2026-06-30",
} as const;

const hasil: Record<string, Hasil> = {};

beforeAll(async () => {
  if (!ADA_MYSQL) return;
  for (const tanggal of Object.values(TANGGAL)) {
    hasil[tanggal] = await layanan.relaasMassal(tanggal);
  }
}, 300000);

// Berkas SQL milik proses ini saja - dibuang supaya berkas ber-pid tidak menumpuk.
afterAll(() => {
  rmSync(BERKAS_SQL, { force: true });
});

function semuaBaris(h: Hasil): BarisPekerjaan[] {
  return h.jurusita.flatMap((x) => x.baris);
}

// ===========================================================================
// SATUAN - TANPA BASIS DATA. PETANYA SENDIRI, DAN KEMBARANNYA DI POHON BLANGKO
// ===========================================================================

describe("peta sandi kehadiran - kosong bukan keduanya", () => {
  it("4, 3, dan 2 diterjemahkan sesuai notifikasi.js", () => {
    expect(layanan.pihakDipanggilDariSandi(4)).toBe("keduanya");
    expect(layanan.pihakDipanggilDariSandi(3)).toBe("pertama");
    expect(layanan.pihakDipanggilDariSandi(2)).toBe("kedua");
  });

  it("kosong, null, 10, dan sandi kombinasi menjadi tidak-diketahui - BUKAN keduanya, BUKAN tidak-perlu", () => {
    // 1.354 baris kosong dan 4 bersandi 10 dari 20.109. Menjatuhkannya ke
    // "keduanya" mencetak panggilan yang tidak perlu; menjatuhkannya ke
    // "tidak-perlu" MELEWATKAN panggilan yang perlu.
    for (const sandi of [null, undefined, "", 10, 11, 0, 5, 7, 8, 9, 13, 14, 15, 99, "abc"]) {
      expect(layanan.pihakDipanggilDariSandi(sandi)).toBe("tidak-diketahui");
    }
  });

  it("sandi 1 (borang SIPP: Semua Pihak) menjadi tidak-perlu - BUKAN tidak-diketahui", () => {
    // Semua pihak hadir -> diperintahkan datang lagi di muka sidang, tidak
    // dipanggil dengan relaas. 7.486 dari 20.109 baris bersandi 1.
    expect(layanan.pihakDipanggilDariSandi(1)).toBe("tidak-perlu");
    expect(layanan.pihakDipanggilDariSandi("1")).toBe("tidak-perlu");
  });

  it("petanya sama persis dengan pihakDipanggil() di pohon-blangko.ts", () => {
    // Dua salinan memang ada - bot JavaScript, layar TypeScript - dan yang
    // dijaga di sini bukan keberadaannya melainkan bahwa keduanya menjawab sama.
    const sandiDiuji = [null, undefined, "", 0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15];
    for (const sandi of [...sandiDiuji, "1", "2", "3", "4", "abc"]) {
      expect(layanan.pihakDipanggilDariSandi(sandi)).toBe(pihakDariPohon(sandi));
    }
  });
});

describe("golongan satu sidang", () => {
  it("nomor 1 sidang pertama; nomor > 1 ditunda atau lanjutan menurut bendera", () => {
    expect(layanan.golonganSidang({ nomorSidang: 1, ditunda: "T", ikrarTalak: "T" })).toBe(
      "sidang-pertama"
    );
    expect(layanan.golonganSidang({ nomorSidang: 3, ditunda: "Y", ikrarTalak: "T" })).toBe(
      "sidang-ditunda"
    );
    expect(layanan.golonganSidang({ nomorSidang: 3, ditunda: "T", ikrarTalak: "T" })).toBe(
      "sidang-lanjutan"
    );
    expect(layanan.golonganSidang({ nomorSidang: 7, ditunda: "T", ikrarTalak: "Y" })).toBe(
      "ikrar-talak"
    );
  });

  it("sidang pertama yang DITUNDA tetap sidang pertama", () => {
    // Terukur 5.019 baris bernomor 1 yang benderanya ditunda='Y'. Panggilan
    // untuk sidang itu sendiri tetap panggilan sidang pertama - blangkonya
    // "P dan T". Yang lahir dari penundaannya panggilan sidang BERIKUTNYA.
    expect(layanan.golonganSidang({ nomorSidang: 1, ditunda: "Y", ikrarTalak: "T" })).toBe(
      "sidang-pertama"
    );
  });

  it("nomor sidang yang TIDAK terbaca bukan sidang pertama", () => {
    // 0 berarti sidangnya tidak terbaca. Menjatuhkannya ke sidang pertama akan
    // mencetak blangko dua pihak untuk panggilan satu pihak tanpa satu pun galat.
    expect(layanan.golonganSidang({ nomorSidang: 0, ditunda: "T", ikrarTalak: "T" })).toBe("");
    expect(layanan.golonganSidang({ nomorSidang: 0, ditunda: "T", ikrarTalak: "T" })).not.toBe(
      "sidang-pertama"
    );
  });

  it("sidang pertama dan ikrar talak TIDAK menanyakan sandi kehadiran", () => {
    // Blangko ABT keduanya satu berkas untuk dua pihak, jadi sandi apa pun tidak
    // mengubah jawabannya - termasuk sandi 2 yang kalau ditanyakan akan
    // menjawab "kedua" lalu memanggil satu pihak untuk sidang pertama.
    for (const sandi of [null, "", 1, 2, 3, 4, 10]) {
      expect(layanan.pihakUntukGolongan("sidang-pertama", sandi)).toBe("keduanya");
      expect(layanan.pihakUntukGolongan("ikrar-talak", sandi)).toBe("keduanya");
    }
  });

  it("sidang ditunda dan lanjutan MEMANG menanyakannya, dan kosongnya diakui", () => {
    expect(layanan.pihakUntukGolongan("sidang-ditunda", 3)).toBe("pertama");
    expect(layanan.pihakUntukGolongan("sidang-lanjutan", 2)).toBe("kedua");
    expect(layanan.pihakUntukGolongan("sidang-ditunda", null)).toBe("tidak-diketahui");
    expect(layanan.pihakUntukGolongan("sidang-lanjutan", 10)).toBe("tidak-diketahui");
    expect(layanan.pihakUntukGolongan("sidang-lanjutan", 1)).toBe("tidak-perlu");
    expect(layanan.pihakUntukGolongan("sidang-ditunda", 1)).toBe("tidak-perlu");
  });

  it("sisi yang dipanggil mengikuti pihaknya, dan yang tidak diketahui/tidak perlu tidak memilih sisi", () => {
    expect(layanan.sisiUntukPihak("keduanya")).toEqual([1, 2]);
    expect(layanan.sisiUntukPihak("pertama")).toEqual([1]);
    expect(layanan.sisiUntukPihak("kedua")).toEqual([2]);
    expect(layanan.sisiUntukPihak("tidak-diketahui")).toEqual([]);
    expect(layanan.sisiUntukPihak("tidak-perlu")).toEqual([]);
  });
});

// ===========================================================================
// DATA SUNGGUHAN - LAYANANNYA DIJALANKAN, BUKAN SUMBERNYA DIBACA
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("kolom urutan diperiksa terhadap kronologi sidang", () => {
  it("nomor 1 berarti tidak ada sidang lebih awal - atas SELURUH baris jadwal", () => {
    // Inilah pemeriksaan yang membuat golongan "sidang pertama" tidak bergantung
    // pada arti kolom `urutan` yang tertulis di komentarnya. Turunannya berdiri
    // sendiri: banyaknya sidang yang benar-benar lebih awal pada perkara itu.
    const baris = jalankanSql(
      `SELECT COUNT(*) AS total,
              SUM(a.urutan = 1 AND EXISTS (SELECT 1 FROM perkara_jadwal_sidang b
                     WHERE b.perkara_id = a.perkara_id
                       AND (b.tanggal_sidang < a.tanggal_sidang
                            OR (b.tanggal_sidang = a.tanggal_sidang AND b.id < a.id)))) AS satuTetapiAdaSebelumnya,
              SUM(a.urutan > 1 AND NOT EXISTS (SELECT 1 FROM perkara_jadwal_sidang b
                     WHERE b.perkara_id = a.perkara_id
                       AND (b.tanggal_sidang < a.tanggal_sidang
                            OR (b.tanggal_sidang = a.tanggal_sidang AND b.id < a.id)))) AS lebihTetapiTidakAdaSebelumnya
         FROM perkara_jadwal_sidang a`,
      []
    );
    expect(baris.length).toBe(1);
    // Diukur 25 September 2026: 20.109 baris, dan kedua selisihnya nol.
    expect(Number(baris[0].total)).toBeGreaterThan(20000);
    expect(Number(baris[0].satuTetapiAdaSebelumnya)).toBe(0);
    expect(Number(baris[0].lebihTetapiTidakAdaSebelumnya)).toBe(0);
  });

  it("perkara yang dua sidangnya sehari pun urutannya tidak berulang", () => {
    // 46 perkara punya dua sidang pada tanggal yang sama - keadaan yang persis
    // dimaksud komentar kolomnya. Kalau `urutan` benar-benar menomori "dalam
    // satu hari yang sama", pasangan (perkara, urutan) akan berulang di situ.
    const baris = jalankanSql(
      `SELECT COUNT(*) AS berulang FROM (
         SELECT perkara_id, urutan, COUNT(*) AS n
           FROM perkara_jadwal_sidang GROUP BY perkara_id, urutan HAVING n > 1) t`,
      []
    );
    expect(Number(baris[0].berulang)).toBe(0);
  });
});

describe.skipIf(!ADA_MYSQL)("hitungan ringkas berjumlah sama dengan barisnya", () => {
  it("jumlah seluruh golongan = jumlah seluruh baris, pada tiap tanggal", () => {
    for (const tanggal of Object.values(TANGGAL)) {
      const h = hasil[tanggal];
      expect(h.ok).toBe(true);
      const baris = semuaBaris(h);
      const jumlahGolongan = Object.values(h.ringkas.golongan).reduce((a, b) => a + b, 0);
      expect(jumlahGolongan, `golongan tidak berjumlah pada ${tanggal}`).toBe(baris.length);
    }
  });

  it("keenam kunci golongan selalu disebut, walau nol", () => {
    for (const tanggal of Object.values(TANGGAL)) {
      const kunci = Object.keys(hasil[tanggal].ringkas.golongan).sort();
      expect(kunci).toEqual([...layanan.GOLONGAN].sort());
    }
  });

  it("relaas + pemberitahuan + belumAdaRelaas = seluruh baris", () => {
    for (const tanggal of Object.values(TANGGAL)) {
      const h = hasil[tanggal];
      const baris = semuaBaris(h);
      const jumlah = h.ringkas.relaas + h.ringkas.pemberitahuan + h.ringkas.belumAdaRelaas;
      expect(jumlah, `ketiga angka tidak berjumlah pada ${tanggal}`).toBe(baris.length);
      expect(h.ringkas.belumAdaRelaas).toBe(baris.filter((x) => !x.sudahAdaRelaas).length);
    }
  });

  it("hitungan tiap juru sita berjumlah sama dengan barisnya sendiri", () => {
    for (const tanggal of Object.values(TANGGAL)) {
      for (const js of hasil[tanggal].jurusita) {
        expect(js.relaas + js.pemberitahuan + js.belumAdaRelaas).toBe(js.baris.length);
      }
    }
  });

  it("belahan pertama TIDAK berubah - 29 April 2026 tetap 58 relaas dan 6 pemberitahuan", () => {
    // Angka yang sudah terbukti sebelum golongan dan belahan kedua ada.
    const h = hasil[TANGGAL.tersibuk];
    expect(h.ringkas.relaas).toBe(58);
    expect(h.ringkas.pemberitahuan).toBe(6);
    expect(h.ringkas.jurusita).toBe(3);
  });
});

describe.skipIf(!ADA_MYSQL)("dua belahan, dan keduanya ditandai", () => {
  it("18 Agustus 2026 memuat yang sudah tercatat DAN yang belum ada relaasnya", () => {
    const baris = semuaBaris(hasil[TANGGAL.duaBelahan]);
    const sudah = baris.filter((x) => x.sudahAdaRelaas);
    const belum = baris.filter((x) => !x.sudahAdaRelaas);
    expect(sudah.length).toBeGreaterThan(0);
    expect(belum.length).toBeGreaterThan(0);
    // Keduanya dalam satu daftar, dan bedanya hanya satu ruas - itu yang membuat
    // layar dapat memisahkannya tanpa memanggil rute kedua.
    expect(sudah.length + belum.length).toBe(baris.length);
  });

  it("hari yang relaasnya nol TIDAK berarti hari tanpa pekerjaan", () => {
    // 22 September 2026: tidak ada satu pun relaas maupun pemberitahuan
    // tercatat, sementara sidang hari itu menunggu dipanggil. Sebelum belahan
    // kedua ada, tanggal ini dijawab "tidak ada apa-apa".
    const h = hasil[TANGGAL.tampakKosong];
    expect(h.ringkas.relaas).toBe(0);
    expect(h.ringkas.pemberitahuan).toBe(0);
    expect(h.ringkas.belumAdaRelaas).toBeGreaterThan(0);
    expect(semuaBaris(h).length).toBe(h.ringkas.belumAdaRelaas);
  });

  it("putusan yang belum ada pemberitahuannya muncul sebagai pekerjaan", () => {
    // 4 September 2026: 18 putusan, dan tidak satu pun punya pemberitahuan.
    const baris = semuaBaris(hasil[TANGGAL.kehadiranTakTerbaca]);
    const pbtBelum = baris.filter(
      (x) => x.jenis === "pemberitahuan" && !x.sudahAdaRelaas
    );
    expect(pbtBelum.length).toBeGreaterThan(0);
    for (const b of pbtBelum) {
      expect(b.golongan).toBe("pemberitahuan-putusan");
      // Pemberitahuan putusan bukan panggilan sidang - ia tidak bernomor sidang.
      expect(b.urutanSidang).toBe(0);
      expect(b.tanggalPutusan).toBe(TANGGAL.kehadiranTakTerbaca);
    }
  });

  it("baris yang relaasnya belum ada tidak membawa resi maupun cara panggil", () => {
    // Belum dikerjakan berarti belum ada cara panggil - dan "belum bertemu"
    // adalah hal lain. Mengisinya membuat lembar cetak tampak sudah dikerjakan.
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal]).filter((x) => !x.sudahAdaRelaas)) {
        expect(b).toMatchObject({ caraSandi: "", caraLabel: "", resi: "", adaBerkas: false });
      }
    }
  });
});

describe.skipIf(!ADA_MYSQL)("pihak yang dipanggil pada baris sungguhan", () => {
  it("tiap baris yang membawa sandi kehadiran cocok dengan peta pohon-blangko", () => {
    // Sandi yang dikirim ke layar HARUS sandi yang dipakai bot memutuskan.
    // Kalau keduanya berbeda, layar menggambar sebab yang bukan sebabnya.
    let diperiksa = 0;
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal])) {
        if (b.dihadiriOleh === null) continue;
        diperiksa += 1;
        expect(b.pihakDipanggil, `${tanggal} ${b.nomorPerkara}`).toBe(
          pihakDariPohon(b.dihadiriOleh)
        );
      }
    }
    expect(diperiksa).toBeGreaterThan(0);
  });

  it("sandi kehadiran yang tidak terbaca BENAR-BENAR terjadi, dan jawabannya tidak-diketahui", () => {
    // 4 September 2026: empat putusan Pdt.P yang sidang pembacaannya diinput
    // susulan tanpa sandi kehadiran. Bila uji ini tidak menemukan satu pun,
    // tanggalnya berubah dan penjaganya berhenti menjaga apa pun.
    const baris = semuaBaris(hasil[TANGGAL.kehadiranTakTerbaca]);
    const takTerbaca = baris.filter((x) => x.pihakDipanggil === "tidak-diketahui");
    expect(takTerbaca.length).toBeGreaterThan(0);
    for (const b of takTerbaca) {
      expect(b.pihakDipanggil).not.toBe("keduanya");
      // Sandi 1-4 SUDAH dijawab borang SIPP; yang tidak diketahui hanya boleh
      // kosong atau sandi di luar keempatnya.
      if (b.dihadiriOleh !== null) {
        expect([1, 2, 3, 4]).not.toContain(Number(b.dihadiriOleh));
      }
    }
  });

  it("sidang dan putusan yang dihadiri SEMUA pihak tidak menjadi pekerjaan, tetapi dihitung", () => {
    // Sandi 1 = "Semua Pihak" pada borang SIPP: tidak ada relaas maupun
    // pemberitahuan yang perlu dibuat. Hitungannya dicocokkan dengan SQL yang
    // berdiri sendiri, bukan dengan fungsi yang sama.
    const h = hasil[TANGGAL.kehadiranTakTerbaca];
    const hitung = jalankanSql(
      `SELECT
         (SELECT COUNT(*) FROM perkara_jadwal_sidang j
            JOIN perkara_jadwal_sidang pv ON pv.perkara_id = j.perkara_id AND pv.urutan = j.urutan - 1
           WHERE j.tanggal_sidang = ? AND j.urutan > 1 AND COALESCE(j.ikrar_talak, '') <> 'Y'
             AND pv.dihadiri_oleh = 1) AS sidang,
         (SELECT COUNT(*) FROM perkara_putusan pu
           WHERE pu.tanggal_putusan = ?
             AND (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
                   WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
                   ORDER BY j.urutan DESC LIMIT 1) = 1) AS putusan`,
      [TANGGAL.kehadiranTakTerbaca, TANGGAL.kehadiranTakTerbaca]
    );
    const harap = Number(hitung[0].sidang) + Number(hitung[0].putusan);
    // Diukur 25 September 2026: 18 sidang + 14 putusan.
    expect(harap).toBeGreaterThan(0);
    expect(h.ringkas.tidakPerlu).toBe(harap);
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal]).filter((x) => !x.sudahAdaRelaas)) {
        expect(b.pihakDipanggil, `${tanggal} ${b.nomorPerkara}`).not.toBe("tidak-perlu");
        if (b.golongan !== "sidang-pertama" && b.golongan !== "ikrar-talak") {
          expect(Number(b.dihadiriOleh), `${tanggal} ${b.nomorPerkara}`).not.toBe(1);
        }
      }
    }
  });

  it("tidak ada baris ditunda atau lanjutan yang keduanya tanpa sandi 4", () => {
    // Inilah cacat yang paling mahal: memanggil dua pihak karena kehadirannya
    // tidak diketahui. Sandi 4 - tidak ada yang hadir - satu-satunya yang
    // membenarkan "keduanya" pada golongan yang bergantung kehadiran.
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal])) {
        if (b.golongan !== "sidang-ditunda" && b.golongan !== "sidang-lanjutan") continue;
        if (b.pihakDipanggil !== "keduanya") continue;
        expect(Number(b.dihadiriOleh), `${tanggal} ${b.nomorPerkara}`).toBe(4);
      }
    }
  });

  it("sidang pertama dan ikrar talak keduanya, dan tanpa sandi kehadiran", () => {
    let pertama = 0;
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal])) {
        if (b.golongan !== "sidang-pertama" && b.golongan !== "ikrar-talak") continue;
        if (b.golongan === "sidang-pertama") pertama += 1;
        expect(b.pihakDipanggil).toBe("keduanya");
        // Sandi dikosongkan sebab ia tidak menentukan apa pun di sini - kalau ia
        // ikut dikirim, layar akan menyebut sebab yang tidak dipakai.
        expect(b.dihadiriOleh).toBeNull();
      }
    }
    expect(pertama).toBeGreaterThan(0);
  });
});

describe.skipIf(!ADA_MYSQL)("golongan tiap baris konsisten dengan nomor sidangnya", () => {
  it("sidang pertama selalu bernomor 1, dan nomor 1 tidak pernah lanjutan", () => {
    let pertama = 0;
    let lanjutan = 0;
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal])) {
        if (b.golongan === "sidang-pertama") {
          pertama += 1;
          expect(b.urutanSidang, `${tanggal} ${b.nomorPerkara}`).toBe(1);
        }
        if (b.golongan === "sidang-ditunda" || b.golongan === "sidang-lanjutan") {
          lanjutan += 1;
          expect(b.urutanSidang, `${tanggal} ${b.nomorPerkara}`).toBeGreaterThan(1);
        }
      }
    }
    expect(pertama).toBeGreaterThan(0);
    expect(lanjutan).toBeGreaterThan(0);
  });

  it("golongan yang dipakai hanya yang terdaftar - tidak ada yang dikarang", () => {
    for (const tanggal of Object.values(TANGGAL)) {
      for (const b of semuaBaris(hasil[tanggal])) {
        // "" berarti sidangnya tidak terbaca; ia dihitung sebagai tidak-terbaca.
        expect([...layanan.GOLONGAN, ""]).toContain(b.golongan);
      }
    }
  });

  it("sidang milik PERKARA LAIN tidak dipinjam golongannya", () => {
    // 30 Juni 2026 memuat 3 relaas yang sidang_id-nya jadwal perkara lain -
    // 103 baris se-riwayat dari 14.495 (0,7%). Sebelum syarat perkaranya
    // ditambahkan, ketiganya meminjam nomor sidang dan bendera ditunda perkara
    // orang lain lalu digolongkan dengan yakin dan salah.
    const h = hasil[TANGGAL.sidangPerkaraLain];
    const takTerbaca = semuaBaris(h).filter((x) => x.golongan === "");
    expect(takTerbaca.length).toBeGreaterThan(0);
    expect(h.ringkas.golongan["tidak-terbaca"]).toBe(takTerbaca.length);
    for (const b of takTerbaca) {
      expect(b.urutanSidang).toBe(0);
      expect(b.pihakDipanggil).toBe("tidak-diketahui");
    }
    expect(h.catatan.join(" ")).toContain("PERKARA LAIN");
  });

  it("jumlah kueri per tanggal tetap sedikit - ia dipanggil tiap layar dibuka", () => {
    // Bukan pemeriksaan teks: angkanya dihitung jembatan ini sendiri saat
    // layanannya berjalan. 10 kueri untuk satu tanggal; bila suatu suntingan
    // membuatnya satu kueri per baris, uji ini merah sebelum layarnya lambat.
    jumlahKueri = 0;
    return layanan.relaasMassal(TANGGAL.duaBelahan).then((h) => {
      expect(h.ok).toBe(true);
      expect(jumlahKueri).toBeLessThanOrEqual(14);
      expect(jumlahKueri).toBeGreaterThan(5);
    });
  });
});
