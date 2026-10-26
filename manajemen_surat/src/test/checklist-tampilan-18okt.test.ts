/**
 * ============================================================================
 * CHECKLIST TAMPILAN JADWAL SIDANG DAN JADWAL MEDIASI + TEKS TAMPIL AWAM (18 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim: tiap fitur yang tampil di layar punya satu baris di panel Tampilan
 * (bisa dinyalakan atau dimatikan), dan teks yang dibaca petugas tidak memuat penjelasan
 * teknis (nama tabel atau kolom SIPP, catatan sistem, kode, jalur API).
 *
 * Yang dijaga, dan DIJALANKAN atas berkas sungguhan:
 *   - kesembilan saklar Jadwal Sidang yang ditambahkan 18 Okt terdaftar, menyala bawaan, bukan wajib,
 *     punya contoh, dan benar-benar dipakai menggambar;
 *   - tiap kunci yang dipakai layar terdaftar di daftar saklarnya, dan sebaliknya tiap saklar yang
 *     boleh dimatikan dipakai (tidak ada baris mati, tidak ada fitur tanpa baris);
 *   - Jadwal Mediasi: sembilan baris, semuanya dipakai, semuanya menyala bawaan;
 *   - aturan munculnya tombol Pertanyaan saksi (disidang 1..10) dan bahwa rincian tidak lagi
 *     membuka panduan sendiri;
 *   - teks tampil kedua layar (beserta pop-up yang dibukanya) tidak memuat pola teknis;
 *   - terjemahan langkah tulis SIPP menjadi kalimat awam.
 *
 * Nomor perkara dan data di sini karangan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { CONTOH_TAMPILAN } from "@/components/portal/contoh-tampilan";
import { sudahMasukPemeriksaan } from "@/lib/pandu-saksi";
import { kalimatLangkah, keteranganAwam, langkahUntukPetugas, ringkasTabel, sebutanTabel } from "@/lib/ringkasan-langkah-sipp";
import { SAKLAR_TAMPILAN, SAKLAR_WAJIB, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";
import { SAKLAR_TAMPILAN_MEDIASI, bacaTampilanMediasi, tampilMediasi, tampilanMediasiBawaan } from "@/lib/tampilan-jadwal-mediasi";

const SRC = path.join(process.cwd(), "src");
const baca = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const LAYAR_SIDANG = "components/portal/aleta-ecourt-sidang.tsx";
const LAYAR_MEDIASI = "components/portal/aleta-ecourt-mediasi.tsx";

/** Semua komponen yang digambar oleh kedua layar (satu tingkat impor) beserta daftar saklarnya. */
function berkasLayar(): string[] {
  const hasil = new Set<string>([
    LAYAR_SIDANG,
    LAYAR_MEDIASI,
    "components/portal/panduan-pemeriksaan-saksi.tsx",
    "components/portal/contoh-tampilan.tsx",
    "lib/tampilan-antrian-sidang.ts",
    "lib/tampilan-jadwal-mediasi.ts",
    "lib/ringkasan-langkah-sipp.ts",
  ]);
  for (const akar of [LAYAR_SIDANG, LAYAR_MEDIASI]) {
    for (const m of baca(akar).matchAll(/from "@\/components\/portal\/([a-z0-9-]+)"/g)) {
      const rel = `components/portal/${m[1]}.tsx`;
      try {
        readFileSync(path.join(SRC, rel));
        hasil.add(rel);
      } catch {
        // pengait (hook) tanpa teks tampil, ditemukan sebagai .ts atau tidak ada
      }
    }
  }
  return Array.from(hasil).sort();
}

describe("checklist Jadwal Sidang: fitur yang ditambahkan 18 Okt 2026", () => {
  const BARU = [
    ["pertanyaan-saksi", "alat"],
    ["tombol-isi-ikrar", "alat"],
    ["ikrar-selesai", "penanda"],
    ["kesiapan-putusan", "penanda"],
    ["draf-putusan-agen", "penanda"],
    ["checklist-konseptor", "keterangan"],
    ["sedang-berjalan", "penanda"],
    ["ringkasan-ruang", "atas"],
    ["tombol-layar-penuh", "atas"],
  ] as const;

  it("terdaftar di kelompoknya, menyala bawaan, bukan wajib, ada contoh, dan dipakai menggambar", () => {
    const layar = baca(LAYAR_SIDANG);
    const bawaan = tampilanBawaan();
    for (const [kunci, kelompok] of BARU) {
      const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(saklar, kunci).toBeTruthy();
      expect(saklar?.kelompok, kunci).toBe(kelompok);
      expect(saklar?.wajib ?? false, kunci).toBe(false);
      expect(saklar?.bawaanMati ?? false, kunci).toBe(false);
      expect(bawaan[kunci], kunci).toBe(true);
      expect(CONTOH_TAMPILAN[kunci], kunci).toBeTruthy();
      expect(layar, kunci).toContain(`tampil(tampilan, "${kunci}")`);
      expect(saklar?.label.length, kunci).toBeGreaterThan(5);
    }
  });

  it("dimatikan = fiturnya hilang dari gambar; simpanan lama tanpa kuncinya tetap menyala", () => {
    for (const [kunci] of BARU) {
      expect(tampil({ [kunci]: false }, kunci), kunci).toBe(false);
      expect(tampil({}, kunci), kunci).toBe(true);
    }
  });

  it("tiap kunci yang dipakai layar terdaftar, dan tiap saklar yang boleh dimatikan dipakai", () => {
    const terdaftar = new Set(SAKLAR_TAMPILAN.map((x) => x.kunci));
    const dipakai = new Set<string>();
    for (const rel of berkasLayar().filter((r) => r.endsWith(".tsx"))) {
      for (const m of baca(rel).matchAll(/\btampil\(\s*(?:tampilan|pilihan)\w*\s*,\s*"([a-z0-9-]+)"/g)) dipakai.add(m[1]);
    }
    for (const kunci of dipakai) expect(terdaftar.has(kunci), `dipakai tetapi tanpa baris checklist: ${kunci}`).toBe(true);
    for (const saklar of SAKLAR_TAMPILAN) {
      if (SAKLAR_WAJIB.includes(saklar.kunci)) continue;
      expect(dipakai.has(saklar.kunci), `baris checklist tanpa fitur di layar: ${saklar.kunci}`).toBe(true);
    }
  });

  it("nama baris memakai bahasa awam (tanpa istilah teknis)", () => {
    for (const saklar of SAKLAR_TAMPILAN) {
      expect(`${saklar.label} ${saklar.keterangan}`, saklar.kunci).not.toMatch(/\b(peladen|borang|galat)\b|sys_|perkara_|audittrail|#\d{4}#/i);
    }
  });
});

describe("checklist Jadwal Mediasi", () => {
  const KUNCI = [
    "tombol-hasil-mediasi",
    "tombol-status-mediasi",
    // 26 Okt 2026: tombol Tunda mediasi (menulis ke SIPP).
    "tombol-tunda-mediasi",
    "lencana-status-mediasi",
    "lencana-ditunda",
    "penetapan-mediator",
    "kartu-ringkasan",
    "saring-keadaan",
    "pencarian-mediasi",
    "catatan-tenggang",
    // 22 Okt 2026 (W57): enam unsur yang dulu tampil tanpa centang.
    "pengantar-layar",
    "kalender-libur",
    "sebutan-mediator",
    "dihadiri-sipp",
    "batas-dan-laporan",
    "kehadiran-rincian",
  ];

  it("enam belas baris (sembilan + enam dari 22 Okt + Tunda 26 Okt), semuanya menyala bawaan", () => {
    expect(SAKLAR_TAMPILAN_MEDIASI.map((x) => x.kunci)).toEqual(KUNCI);
    const bawaan = tampilanMediasiBawaan();
    for (const kunci of KUNCI) {
      expect(bawaan[kunci], kunci).toBe(true);
      expect(tampilMediasi({}, kunci), kunci).toBe(true);
      expect(tampilMediasi({ [kunci]: false }, kunci), kunci).toBe(false);
    }
    // simpanan lama yang hanya memuat tombol hasil: lima belas lainnya menyala
    const lama = bacaTampilanMediasi(JSON.stringify({ "tombol-hasil-mediasi": false }));
    expect(lama["tombol-hasil-mediasi"]).toBe(false);
    for (const kunci of KUNCI.slice(1)) expect(lama[kunci], kunci).toBe(true);
  });

  it("tiap baris dipakai layar mediasi, dan tiap kunci yang dipakai terdaftar", () => {
    const layar = baca(LAYAR_MEDIASI);
    const dipakai = new Set<string>();
    for (const m of layar.matchAll(/tampilMediasi\(\s*tampilan\s*,\s*"([a-z0-9-]+)"/g)) dipakai.add(m[1]);
    for (const kunci of KUNCI) expect(dipakai.has(kunci), `baris tanpa fitur di layar: ${kunci}`).toBe(true);
    for (const kunci of dipakai) expect(KUNCI, `fitur tanpa baris checklist: ${kunci}`).toContain(kunci);
  });
});

describe("tombol Pertanyaan saksi di Jadwal Sidang", () => {
  it("muncul hanya bila sudah masuk pemeriksaan: disidang 1..9 (di ruang) atau 10 (selesai hari itu)", () => {
    for (let n = 1; n <= 10; n++) expect(sudahMasukPemeriksaan(n), String(n)).toBe(true);
    // menunggu, belum ada antrian, atau nilai tak dikenal: tidak muncul
    for (const nilai of [null, undefined, 0, -1, 11, 99, 1.5, Number.NaN]) expect(sudahMasukPemeriksaan(nilai as number | null | undefined), String(nilai)).toBe(false);
  });

  it("tanda manual petugas (berjalan, diskors, selesai) ikut dihitung; menunggu tanpa tanda tidak", () => {
    expect(sudahMasukPemeriksaan(null, { berjalan: true })).toBe(true);
    expect(sudahMasukPemeriksaan(undefined, { diskors: true })).toBe(true);
    expect(sudahMasukPemeriksaan(null, { selesai: true })).toBe(true);
    // antrian menunggu (NULL) dan tidak ada tanda: tidak muncul
    expect(sudahMasukPemeriksaan(null, { berjalan: false, diskors: false, selesai: false })).toBe(false);
    expect(sudahMasukPemeriksaan(null, {})).toBe(false);
    expect(sudahMasukPemeriksaan(undefined)).toBe(false);
    // tanda manual tidak menghapus aturan antrian
    expect(sudahMasukPemeriksaan(3, { berjalan: false })).toBe(true);
  });

  it("layar memakai aturan itu atas nilai antrian hari ini dan menggambar tombol, bukan bagian terbuka", () => {
    const layar = baca(LAYAR_SIDANG);
    expect(layar).toContain('sudahMasukPemeriksaan(disidangPerKunci[kunciTiga], {');
    expect(layar).toContain("berjalan: Boolean(berjalanIni),");
    expect(layar).toContain("diskors: Boolean(skorsIni),");
    expect(layar).toContain("selesai: selesaiTanda.ditandai,");
    expect(layar).toContain('bentuk="tombol"');
    // nilai disidang berasal dari waktu antrian yang sudah ditimpa keadaan langsung
    expect(layar).toContain("for (const b of waktuAntrianHidup.baris) peta[kunciWaktu(b.tanggalSidang, b.perkaraId)] = b.disidang;");
  });

  it("rincian sidang tidak lagi memuat bagian lipat panduan yang terbuka sendiri", () => {
    const layar = baca(LAYAR_SIDANG);
    expect(layar).not.toContain("penggunaPandu");
    expect(layar).not.toContain("pandu = null");
    expect(layar.match(/<PanduanPemeriksaanSaksi/g)?.length).toBe(1);
  });

  it("Status Perkara tetap memakai bagian lipat", () => {
    const status = baca("components/portal/aleta-ecourt-status-perkara.tsx");
    expect(status).toContain("<PanduanPemeriksaanSaksi");
    expect(status).not.toContain('bentuk="tombol"');
  });
});

// ─── Teks tampil tanpa penjelasan teknis ─────────────────────────────────────

/** Pola yang tidak boleh ada di teks yang dibaca petugas. */
const POLA_TEKNIS: ReadonlyArray<[string, RegExp]> = [
  ["catatan sistem (sys_...)", /\bsys_\w+/i],
  ["nama tabel perkara (perkara_...)", /\bperkara_[a-z_]+/i],
  ["audit trail", /audit\s?trail|audittrail|baris audit|catatan audit/i],
  ["kode #nnnn#", /#\d{4}#/],
  ["jalur API", /(^|\s)\/api\//],
  ["nama tabel SIPP lain", /\b(?:antrian_sidang|jadwal_sidang|sipp_turunan\w*|diinput_oleh|diperbaharui_oleh)\b/i],
  ["perintah SQL", /\b(?:SELECT\b.*\bFROM|INSERT INTO|UPDATE\b.*\bSET\b|DELETE FROM)\b/],
  ["istilah basis data", /\bbasis data\b|\bkoneksi sql\b|\bMAX\s?\+\s?1\b|tabel turunan/i],
  ["nama kolom berbentuk snake_case di kalimat", /\b[a-z]{3,}_[a-z]{3,}\b/],
];

function temuanTeknis(rel: string): string[] {
  const teks = baca(rel);
  const sf = ts.createSourceFile(rel, teks, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hasil: string[] = [];
  const kunjungi = (node: ts.Node) => {
    const k = node.kind;
    let isi: string | null = null;
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
      const ortu = node.parent;
      const kunci =
        ortu &&
        ((ts.isPropertyAssignment(ortu) && ortu.name === node) ||
          ts.isImportDeclaration(ortu) ||
          ts.isExportDeclaration(ortu) ||
          ts.isLiteralTypeNode(ortu) ||
          ts.isElementAccessExpression(ortu) ||
          ts.isCaseClause(ortu));
      if (!kunci) isi = (node as ts.StringLiteral).text;
    } else if (k === ts.SyntaxKind.TemplateHead || k === ts.SyntaxKind.TemplateMiddle || k === ts.SyntaxKind.TemplateTail) {
      isi = (node as ts.TemplateLiteralLikeNode).text;
    } else if (k === ts.SyntaxKind.JsxText) {
      isi = node.getText(sf);
    }
    // Hanya kalimat (ada spasi): kunci, nama kelas satu kata, dan alamat tidak dibaca petugas.
    if (isi !== null && /\s/.test(isi.trim())) {
      // Kelas CSS Tailwind (mis. "grid gap-2 sm:grid-cols-[11rem_1fr]") bukan teks tampil.
      const mirip_kelas = /^[\w\s:\-/[\]().%,#_]+$/.test(isi) && /(?:^|\s)(?:[a-z]+:)*(?:flex|grid|gap|px|py|mt|mb|ml|mr|text|bg|border|rounded|w|h|min|max|overflow|absolute|relative|font|space|items|justify|col|row|sm|md|lg|xl)(?:[-\s]|$)/.test(isi);
      if (!mirip_kelas) {
        for (const [nama, pola] of POLA_TEKNIS) {
          if (pola.test(isi)) {
            const baris = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
            hasil.push(`${rel}:${baris}: [${nama}] ${isi.replace(/\s+/g, " ").slice(0, 110)}`);
            break;
          }
        }
      }
    }
    ts.forEachChild(node, kunjungi);
  };
  kunjungi(sf);
  return hasil;
}

describe("teks tampil Jadwal Sidang dan Jadwal Mediasi tanpa pola teknis", () => {
  it("kedua layar, pop-up yang dibukanya, dan daftar saklarnya bersih", () => {
    const temuan = berkasLayar().flatMap(temuanTeknis);
    expect(temuan).toEqual([]);
  });

  it("penjaga sungguh menangkap pola teknis (bukan lolos karena tidak membaca apa pun)", () => {
    const contoh = [
      "baris akan ditulis termasuk barisnya di sys_audittrail",
      "ditulis ke perkara_court_calendar atas akun",
      "Persis blangko: perkara_biaya (id = MAX+1), satu baris Audit Trail SIPP",
      "nomor #0046# diisi",
      "periksa sambungan antrian_sidang di Admin",
    ];
    for (const kalimat of contoh) expect(POLA_TEKNIS.some(([, p]) => p.test(kalimat)), kalimat).toBe(true);
    expect(POLA_TEKNIS.some(([, p]) => p.test("Penundaan sidang tercatat di SIPP atas nama panitera."))).toBe(false);
    expect(berkasLayar().length).toBeGreaterThan(25);
  });
});

describe("langkah tulis SIPP menjadi kalimat awam", () => {
  it("catatan sistem tidak tampil; tabel disebut dengan sebutan petugas", () => {
    const langkah = [
      { tabel: "perkara_jadwal_sidang", aksi: "UPDATE", keterangan: "menunda sidang 2026-10-20 - pihak belum siap" },
      { tabel: "sys_audittrail", aksi: "INSERT", keterangan: "catatan audit perkara_jadwal_sidang atas nama panitera" },
      { tabel: "perkara_jadwal_sidang", aksi: "INSERT", keterangan: "sidang berikutnya 2026-11-03 09:00 - pemeriksaan saksi" },
      { tabel: "perkara", aksi: "CALL", keterangan: "status perkara dihitung ulang" },
    ];
    const tampilkan = langkahUntukPetugas(langkah);
    expect(tampilkan).toHaveLength(3);
    const kalimat = tampilkan.map((l) => kalimatLangkah(l));
    expect(kalimat[0]).toBe("Jadwal sidang: menunda sidang 2026-10-20 - pihak belum siap");
    expect(kalimat[2]).toBe("Perkara: status perkara dihitung ulang");
    expect(kalimatLangkah(langkah[1])).toBeNull();
    expect(ringkasTabel(langkah)).toBe("Jadwal sidang, Perkara");
    for (const k of kalimat) for (const [, pola] of POLA_TEKNIS) expect(pola.test(k ?? ""), k ?? "").toBe(false);
  });

  it("tabel tak dikenal tidak membocorkan namanya; keterangan dibersihkan dari nomor dalam", () => {
    expect(sebutanTabel("perkara_entah_apa")).toBe("Data perkara");
    expect(keteranganAwam("catatan audit Tambah Data Biaya atas nama panitera")).toBe("");
    expect(keteranganAwam("sunting Court Calendar #12: 2026-10-20 09:00 Sidang")).toBe("sunting Court Calendar: 2026-10-20 09:00 Sidang");
    expect(keteranganAwam("set_jurusita SIPP: bersihkan juru sita baris ini")).toBe("bersihkan juru sita baris ini");
    expect(kalimatLangkah({ tabel: "perkara_putusan", aksi: "INSERT", keterangan: "" })).toBe("Putusan ditambahkan");
  });
});
