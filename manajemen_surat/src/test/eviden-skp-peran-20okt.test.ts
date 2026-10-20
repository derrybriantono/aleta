// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { susunNaskahEvidenSkp } from "@/lib/eviden-skp-cetak";
import {
  JABATAN_EVIDEN_PERAN,
  KEGIATAN_EVIDEN_JABATAN,
  butirIsianManual,
  butirOtomatisTanpaKegiatan,
  kegiatanUntukButir,
  kegiatanUntukJabatan,
  pegawaiDitawarkan,
} from "@/lib/eviden-skp-peran";
import { susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import { hitungLembarSkp } from "@/lib/skp-jabatan-hitung";
import { susunPaketSkpJabatan, sebutanOrangSkp } from "@/lib/skp-jabatan-lembar";
import {
  KUNCI_FAKTA_ALETA_SKP_JABATAN,
  KUNCI_FAKTA_SKP_JABATAN,
  PEMBACA_KEGIATAN_ALETA,
  SKP_JABATAN_2026,
} from "@/lib/skp-jabatan-katalog";
import {
  JABATAN_SKP,
  USERNAME_SISTEM,
  type DataSkpJabatan,
  type FaktaAkunSkp,
  type JabatanSkp,
  type PegawaiSkp,
} from "@/lib/skp-jabatan-tipe";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { gambarDocxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-docx";
import { gambarPdfEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-pdf";
import { gambarXlsxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-xlsx";

import { bacaPdfUji, bacaZip } from "./eviden-skp-baca";
import { INSTANSI_CONTOH } from "./eviden-skp-contoh";

vi.mock("@/server/modules/aleta-ecourt/eviden-skp-data", () => ({
  ambilDataSkpJabatan: vi.fn(),
  ambilDataEvidenSkpPeriode: vi.fn(),
}));

const { ambilDataSkpJabatan } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
const { bacaAktorSkp } = await import("@/server/modules/skp/pegawai");
const { simpanPemetaan } = await import("@/server/modules/skp/pemetaan");
const { siapkanSkp } = await import("@/server/modules/skp/lembar");
const { PEMBACA_KEGIATAN, bacaFaktaSistem, geserTanggal, namaKegiatan, tanggalKegiatan } =
  await import("@/server/modules/skp/kegiatan-aleta");
const { akunDariRekap, pegawaiDariRekap, JABATAN_REKAP } = await import("@/server/modules/skp/rekap-pegawai");
const ambilBot = vi.mocked(ambilDataSkpJabatan);

/**
 * ============================================================================
 * EVIDEN SKP SEMUA PERAN (20 Oktober 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. peta kegiatan nyata -> butir SKP per jabatan selaras dengan katalog
 *      (tidak ada butir hantu, tidak ada indikator otomatis yang tertinggal);
 *   2. kegiatan di e-Court dan aplikasi pengadilan dibaca portal sebagai
 *      fakta (surat, disposisi, e-Court, jejak aplikasi), tanggal menurut WITA,
 *      milik SATU pegawai, dan yang tak terbaca "—" (bukan 0);
 *   3. Sekretaris/Kasubag/Analis tidak bergantung pada bot SIPP;
 *   4. halaman Rekap Petugas -> akun SIPP -> Pemetaan -> pegawai: hak unduh,
 *      pegawai nonaktif tidak ditawarkan, jabatan belum dipetakan disebut;
 *   5. sisi bot: mediator (hakim dan tanpa akun) serta jejak audit operator;
 *   6. berkas PDF/Excel/Word terbentuk tanpa kata "ALETA".
 */

const PERIODE = susunPeriodeSkpJabatan("tw3", 2026);
const DIHITUNG = "2026-10-05T02:00:00.000Z";

// ===========================================================================
// 1. PETA KEGIATAN -> BUTIR
// ===========================================================================

describe("peta kegiatan nyata -> butir SKP per jabatan", () => {
  const semuaButir = (j: JabatanSkp) => new Set(SKP_JABATAN_2026[j].flatMap((r) => r.indikator.map((i) => i.kunci)));

  it("setiap jabatan SKP punya entri peta, dan setiap butir yang disebut ada di katalog jabatan itu", () => {
    for (const j of JABATAN_SKP) {
      expect(Object.keys(KEGIATAN_EVIDEN_JABATAN), j).toContain(j);
      const ada = semuaButir(j);
      for (const keg of kegiatanUntukJabatan(j)) {
        expect(keg.butir.length, `${j}: ${keg.kegiatan}`).toBeGreaterThan(0);
        for (const b of keg.butir) expect(ada.has(b), `${j}: butir ${b}`).toBe(true);
      }
    }
  });

  it("tidak ada indikator yang dihitung otomatis tanpa kegiatan di peta (peta tidak tertinggal dari katalog)", () => {
    for (const j of JABATAN_SKP) expect(butirOtomatisTanpaKegiatan(j), j).toEqual([]);
  });

  it("sumber kegiatan sejalan dengan katalog: SIPP dibaca bot, e-Court/Sistem dibaca portal", () => {
    for (const j of JABATAN_SKP) {
      const indikator = new Map(SKP_JABATAN_2026[j].flatMap((r) => r.indikator).map((i) => [i.kunci, i]));
      for (const keg of kegiatanUntukJabatan(j)) {
        for (const b of keg.butir) {
          const aleta = Boolean(indikator.get(b)?.aleta);
          // Butir turunan (kualitas/waktu) yang hanya `dari` kuantitasnya tetap mengikuti sumber kegiatan.
          if (keg.sumber === "SIPP") expect(aleta, `${j}:${b} bersumber SIPP tetapi dibaca portal`).toBe(false);
          else expect(aleta, `${j}:${b} bersumber ${keg.sumber} tetapi dibaca bot`).toBe(true);
        }
      }
    }
  });

  it("peran yang diminta pengguna semuanya didukung dengan kegiatan nyata", () => {
    const wajib: JabatanSkp[] = [
      "panitera",
      "pp",
      "panmud-hukum",
      "panmud-gugatan",
      "panmud-permohonan",
      "jurusita",
      "jurusita-pengganti",
      "mediator",
      "petugas-meja",
      "kasir",
      "sekretaris",
      "kasubag",
      "operator",
      "analis-perkara",
    ];
    for (const j of wajib) {
      expect(JABATAN_EVIDEN_PERAN, j).toContain(j);
      expect(kegiatanUntukJabatan(j).length, j).toBeGreaterThan(0);
    }
    expect(JABATAN_EVIDEN_PERAN).not.toContain("ketua");
    expect(JABATAN_EVIDEN_PERAN).not.toContain("wakil-ketua");
  });

  it("butir yang tak punya sumber otomatis tetap isian manual (peta tidak mengarang angka)", () => {
    expect(butirIsianManual("sekretaris")).toEqual(
      expect.arrayContaining(["sk-manajemen-kuantitas", "sk-manajemen-kualitas", "sk-manajemen-waktu"]),
    );
    for (const b of butirIsianManual("pp")) expect(kegiatanUntukButir("pp", b)).toEqual([]);
    expect(kegiatanUntukJabatan("informasi")).toEqual([]);
  });

  it("jabatan baru tanpa target karangan: semua target 'Belum ada target' kecuali batas hukum yang tertulis", () => {
    for (const j of ["mediator", "sekretaris", "kasubag", "analis-perkara"] as const) {
      for (const r of SKP_JABATAN_2026[j]) {
        for (const i of r.indikator) expect(i.targetNilai, `${j}:${i.kunci}`).toBeNull();
      }
    }
  });
});

describe("katalog: fakta bot dan fakta portal tidak beririsan", () => {
  it("setiap kunci fakta portal tidak dikirim bot, dan setiap pembaca dikenal dan dikerjakan", () => {
    const dikenal = new Set<string>(PEMBACA_KEGIATAN_ALETA);
    for (const j of JABATAN_SKP) {
      for (const [kunci, pembaca] of Object.entries(KUNCI_FAKTA_ALETA_SKP_JABATAN[j])) {
        expect(KUNCI_FAKTA_SKP_JABATAN[j], `${j}:${kunci}`).not.toContain(kunci);
        expect(dikenal.has(pembaca), `${j}:${kunci} pembaca ${pembaca}`).toBe(true);
      }
    }
    for (const id of PEMBACA_KEGIATAN_ALETA) expect(typeof PEMBACA_KEGIATAN[id], id).toBe("function");
    // Setiap pembaca dipakai oleh katalog.
    const dipakai = new Set(JABATAN_SKP.flatMap((j) => Object.values(KUNCI_FAKTA_ALETA_SKP_JABATAN[j])));
    for (const id of PEMBACA_KEGIATAN_ALETA) expect(dipakai.has(id), `pembaca ${id} tak dipakai`).toBe(true);
  });
});

// ===========================================================================
// 5. SISI BOT: MEDIATOR DAN JEJAK AUDIT OPERATOR
// ===========================================================================

const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const requireBot = createRequire(path.join(AKAR_BOT, "services/_uji.js"));
const bot = requireBot("./evidenSkpJabatanService.js") as {
  buatLayanan: (deps: Record<string, unknown>) => {
    skpJabatan: (m: Record<string, unknown>, o?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    daftarAkun: (m: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  KUNCI_FAKTA: Record<string, string[]>;
};

describe("bot: mediator dan operator", () => {
  const mediasi = [
    {
      id: 100,
      nomor: "10/Pdt.G/2026/PA.Dgl",
      penetapan: "2026-07-10",
      laporan: "2026-07-25",
      hasil: "Y1",
    },
    {
      id: 101,
      nomor: "11/Pdt.G/2026/PA.Dgl",
      penetapan: "2026-07-20",
      laporan: null,
      hasil: null,
    },
    {
      id: 102,
      nomor: "12/Pdt.G/2026/PA.Dgl",
      penetapan: "2026-08-01",
      laporan: "2026-09-20",
      hasil: "T",
    },
    // Mediasi kedua pada perkara 100: yang berlaporan menang, perkara dihitung sekali.
    {
      id: 100,
      nomor: "10/Pdt.G/2026/PA.Dgl",
      penetapan: "2026-07-12",
      laporan: null,
      hasil: null,
    },
  ];
  const sqlDiminta: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    sqlDiminta.push({ sql, params });
    if (/FROM sys_users u/.test(sql)) return [{ userid: 90, username: "operator1", nama: "Operator Uji", aktif: 1 }];
    if (/FROM sys_user_group ug/.test(sql)) return [];
    if (/FROM user_hakim uh JOIN mediator m/.test(sql)) return [{ userid: 91, mediatorId: 11 }];
    if (/FROM mediator m WHERE m.id/.test(sql)) return params[0] === 9 ? [{ id: 9, nama: "Mediator Nonhakim", aktif: "Y" }] : [];
    if (/FROM perkara_mediasi m/.test(sql)) return mediasi;
    if (/FROM sys_audittrail a/.test(sql)) {
      return [
        {
          tanggal: "2026-08-03",
          tabel: "perkara_biaya",
          aksi: "INSERT",
          jumlah: 40,
        },
        {
          tanggal: "2026-08-03",
          tabel: "perkara_xyz",
          aksi: "HAPUS",
          jumlah: 2,
        },
      ];
    }
    return [];
  };
  const layanan = () =>
    bot.buatLayanan({
      kueri,
      tabelAda: async () => true,
      pilihKolom: async (_t: string, calon: string[]) => calon[0],
      jam: () => Date.parse("2026-10-17T02:00:00Z"),
    });
  const pegawaiBaru = (jabatan: JabatanSkp): PegawaiSkp => ({
    userId: "u1",
    nama: "Uji",
    nip: null,
    pangkatGolongan: null,
    jabatanUtama: jabatan,
    jabatanTambahan: [],
  });

  it("kunci fakta bot untuk jabatan baru selaras katalog", () => {
    for (const j of ["mediator", "sekretaris", "kasubag", "analis-perkara", "operator"] as const) {
      expect([...bot.KUNCI_FAKTA[j]].sort(), j).toEqual([...KUNCI_FAKTA_SKP_JABATAN[j]].sort());
    }
    expect(KUNCI_FAKTA_SKP_JABATAN.sekretaris).toEqual([]);
  });

  it("mediator tanpa akun SIPP ('mediator:9'): satu fakta per perkara, laporan dan ketepatan 30 hari dihitung portal", async () => {
    const data = (await layanan().skpJabatan(
      {
        tahun: "2026",
        periode: "tw3",
        jabatan: "mediator",
        username: ["mediator:9"],
      },
      { hariIni: "2026-10-17" },
    )) as unknown as DataSkpJabatan;
    expect(data.ok).toBe(true);
    expect(data.akun.map((a) => a.username)).toEqual(["mediator:9"]);
    const fakta = Object.fromEntries(data.akun[0].fakta.map((f) => [f.kunci, f.kejadian]));
    expect(fakta["md-mediasi-kuantitas"]).toHaveLength(3); // perkara 10, 11, 12
    expect(fakta["md-mediasi-laporan"]).toHaveLength(2);
    expect(fakta["md-mediasi-kuantitas"][0].keterangan).toBe("Mediasi - Berhasil dengan kesepakatan");
    expect(fakta["md-mediasi-kuantitas"][1].keterangan).toBe("Mediasi - Belum ada hasil");
    const hasil = hitungLembarSkp({
      jenis: "mediator",
      periode: PERIODE,
      pegawai: pegawaiBaru("mediator"),
      pejabatPenilai: null,
      data,
      dihitungPada: "2026-10-17T02:00:00.000Z",
    });
    const i = Object.fromEntries(hasil.lembar.rhk.flatMap((r) => r.indikator).map((x) => [x.kunci, x]));
    expect(i["md-mediasi-kuantitas"]).toMatchObject({
      realisasi: 3,
      sumber: "sipp",
    });
    expect(i["md-mediasi-kualitas"]).toMatchObject({
      pembilang: 2,
      penyebut: 3,
    });
    // 10: 15 hari (ya); 12: 50 hari (tidak); 11: belum dilaporkan, sudah >30 hari sejak penetapan (tidak) -> 1 dari 3.
    expect(i["md-mediasi-waktu"]).toMatchObject({ pembilang: 1, penyebut: 3 });
    expect(i["md-mediasi-waktu"].targetTeks).toBe("Belum ada target");
  });

  it("mediator yang tidak ada di tabel mediator dicatat untuk petugas, tidak diam-diam nol", async () => {
    const data = (await layanan().skpJabatan(
      {
        tahun: "2026",
        periode: "tw3",
        jabatan: "mediator",
        username: ["mediator:9", "mediator:404"],
      },
      { hariIni: "2026-10-17" },
    )) as unknown as DataSkpJabatan;
    expect(data.akun.map((a) => a.username)).toEqual(["mediator:9"]);
    expect((data.catatanOperator ?? []).some((c) => c.includes("mediator:404"))).toBe(true);
  });

  it("akun SIPP hakim mediator: id mediatornya dari user_hakim dan mediator.hakim_id; akun tanpa tautan = tidak terbaca beserta catatan", async () => {
    const lay = bot.buatLayanan({
      kueri: async (sql: string, params: unknown[] = []) => {
        if (/FROM sys_users u/.test(sql))
          return [
            { userid: 91, username: "hakimm", nama: "Hakim M", aktif: 1 },
            { userid: 92, username: "tanpa", nama: "Tanpa", aktif: 1 },
          ];
        return kueri(sql, params);
      },
      tabelAda: async () => true,
      pilihKolom: async (_t: string, calon: string[]) => calon[0],
      jam: () => Date.parse("2026-10-17T02:00:00Z"),
    });
    const data = (await lay.skpJabatan(
      {
        tahun: "2026",
        periode: "tw3",
        jabatan: "mediator",
        username: ["hakimm", "tanpa"],
      },
      { hariIni: "2026-10-17" },
    )) as unknown as DataSkpJabatan;
    const hakimm = data.akun.find((a) => a.username === "hakimm")!;
    const tanpa = data.akun.find((a) => a.username === "tanpa")!;
    expect(hakimm.fakta.find((f) => f.kunci === "md-mediasi-kuantitas")?.terbaca).toBe(true);
    expect(tanpa.fakta.find((f) => f.kunci === "md-mediasi-kuantitas")).toMatchObject({ terbaca: false, kejadian: [] });
    expect((data.catatanOperator ?? []).some((c) => c.includes('"tanpa"'))).toBe(true);
    // Mediasi dicari dengan FIND_IN_SET atas id mediator, bukan nama.
    const mediasiSql = sqlDiminta.filter((s) => /FROM perkara_mediasi m/.test(s.sql)).at(-1)!;
    expect(mediasiSql.sql).toContain("FIND_IN_SET");
    expect(mediasiSql.params).toContain(11);
  });

  it("operator: jejak audit SIPP dirangkum per hari; username dibandingkan sebagai parameter (bukan JOIN)", async () => {
    const data = (await layanan().skpJabatan(
      {
        tahun: "2026",
        periode: "tw3",
        jabatan: "operator",
        username: ["operator1"],
      },
      { hariIni: "2026-10-17" },
    )) as unknown as DataSkpJabatan;
    const kejadian = data.akun[0].fakta.find((f) => f.kunci === "op-layanan-kuantitas")!.kejadian;
    expect(kejadian).toHaveLength(2);
    expect(kejadian[0]).toMatchObject({
      tanggal: "2026-08-03",
      nilai: 40,
      keterangan: "Biaya perkara - input baru (40 kali)",
    });
    expect(kejadian[1].keterangan).toBe("Data SIPP (perkara_xyz) - penghapusan (2 kali)");
    const sql = sqlDiminta.filter((s) => /FROM sys_audittrail a/.test(s.sql)).at(-1)!;
    expect(sql.sql).not.toMatch(/\bJOIN\b/);
    expect(sql.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM)?\s*sys_/i);
    expect(sql.params[0]).toBe("operator1");
    const hasil = hitungLembarSkp({
      jenis: "operator",
      periode: PERIODE,
      pegawai: pegawaiBaru("operator"),
      pejabatPenilai: null,
      data,
      dihitungPada: "2026-10-17T02:00:00.000Z",
    });
    const i = hasil.lembar.rhk[0].indikator[0];
    expect(i).toMatchObject({ realisasi: 42, sumber: "sipp" });
    expect(i.dasar).toBe("42 kegiatan pengoperasian tercatat di SIPP pada 1 hari dalam periode.");
  });

  it("daftarAkun memuat id panitera/jurusita/hakim/mediator untuk menautkan halaman Rekap", async () => {
    const lay = bot.buatLayanan({
      kueri: async (sql: string, params: unknown[] = []) => {
        if (/FROM user_panitera up/.test(sql)) return [{ userid: 90, paniteraId: 5 }];
        if (/FROM user_jurusita uj/.test(sql)) return [{ userid: 90, jabatan: "1", jurusitaId: 8 }];
        if (/FROM user_hakim uh\b(?! JOIN)/.test(sql)) return [{ userid: 90, hakimId: 3 }];
        return kueri(sql, params);
      },
      tabelAda: async () => true,
      pilihKolom: async (_t: string, calon: string[]) => calon[0],
    });
    const jawaban = (await lay.daftarAkun({ semua: "1" })) as {
      ok: boolean;
      akun: Array<Record<string, unknown>>;
    };
    expect(jawaban.ok).toBe(true);
    expect(jawaban.akun[0]).toMatchObject({
      username: "operator1",
      paniteraId: 5,
      jurusitaId: 8,
      hakimId: 3,
      mediatorIds: [],
    });
  });
});

let db: AletaDatabase;

describe("atas pg-mem berbenih", () => {
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  // ===========================================================================
  // 2. PEMBACA KEGIATAN SISTEM ATAS PG-MEM
  // ===========================================================================

  async function profil(userId: string, idProfil: string, atasanProfil: string | null) {
    const u = await db.queryOne<{ name: string }>("SELECT name FROM users WHERE id = ?", [userId]);
    await db.run(
      `INSERT INTO employee_profiles (id, user_id, nip, full_name, rank_grade, is_active, supervisor_employee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, '2026-01-01', '2026-01-01')`,
      [idProfil, userId, `nip-${userId}`, u!.name, "Penata / III.c", atasanProfil],
    );
  }

  async function surat(
    id: string,
    p: {
      type: string;
      nomor: string;
      perihal: string;
      dibuat?: string;
      oleh?: string;
      disetujuiOleh?: string;
      disetujui?: string;
    },
  ) {
    await db.run(
      `INSERT INTO letters (id, type, nomor_surat, tanggal_surat, pengirim, perihal, status, assigned_unit, confidentiality, ringkasan,
                          asal_surat, tujuan_surat, klasifikasi_utama, qr_code_label, created_by_user_id, approved_by_user_id,
                          approved_at, created_at, updated_at)
     VALUES (?, ?, ?, '2026-08-01', 'Pengirim', ?, 'baru', 'Sekretariat', 'biasa', '-', 'A', 'B', 'umum', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.type,
        p.nomor,
        p.perihal,
        `qr-${id}`,
        p.oleh ?? null,
        p.disetujuiOleh ?? null,
        p.disetujui ?? null,
        p.dibuat ?? "2026-08-10T02:00:00.000Z",
        p.dibuat ?? "2026-08-10T02:00:00.000Z",
      ],
    );
  }

  async function disposisi(id: string, suratId: string, penerima: string, p: { dibuat: string; dibaca?: string; tindak?: string }) {
    await db.run(
      `INSERT INTO dispositions (id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi, status, approval_qr_code,
                               created_at, read_at, follow_up_note, updated_at)
     VALUES (?, ?, 'usr-ketua', ?, 'pos-ketua', 'Tindak lanjuti', 'baru', ?, ?, ?, ?, ?)`,
      [id, suratId, penerima, `qr-${id}`, p.dibuat, p.dibaca ?? null, p.tindak ?? null, p.dibuat],
    );
  }

  async function aksiEcourt(id: string, userId: string, aksi: string, hasil: string, waktu: string, nomor = "5/Pdt.G/2026/PA.Dgl") {
    await db.run(
      `INSERT INTO aleta_ecourt_aksi_jejak (id, pengguna_id, pengguna_nama, aksi, nomor_perkara, sasaran, hasil, dibuat_pada)
     VALUES (?, ?, '', ?, ?, 'Berkas uji', ?, ?)`,
      [id, userId, aksi, nomor, hasil, waktu],
    );
  }

  async function audit(id: string, userId: string, aksi: string, waktu: string) {
    await db.run(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, 'x', 'y', NULL, ?)`,
      [id, userId, aksi, waktu],
    );
  }

  beforeEach(async () => {
    await db.run("UPDATE employee_profiles SET supervisor_employee_id = NULL");
    for (const t of [
      "aleta_skp_akun_pegawai",
      "aleta_skp_target",
      "aleta_skp_isian",
      "aleta_skp_penetapan",
      "employee_profiles",
      "external_app_credentials",
      "aleta_ecourt_aksi_jejak",
      "dispositions",
      "letters",
      "audit_logs",
    ]) {
      await db.run(`DELETE FROM ${t}`);
    }
    await db.run("UPDATE users SET is_active = 1");
    ambilBot.mockReset();
    await profil("usr-ketua", "pf-ketua", null);
    await profil("usr-panitera", "pf-panitera", "pf-ketua");
    await profil("usr-ppg", "pf-ppg", "pf-panitera");
    await profil("usr-rina", "pf-rina", "pf-panitera");
    await profil("usr-budi", "pf-budi", "pf-panitera");
  });

  const aktorDari = async (userId: string) => (await bacaAktorSkp(db, userId)).aktor;

  async function isiKegiatanRina() {
    // Surat: L1 masuk (dibuat 10 Agt), L2 disetujui 30 Sep 17.30 UTC = 1 Okt WITA (di luar Triwulan III), L3 dibuat 30 Jun 17.00 UTC = 1 Jul WITA (di dalam).
    await surat("l1", {
      type: "masuk",
      nomor: "001/Sek/VIII/2026",
      perihal: "Undangan rapat",
      oleh: "usr-rina",
    });
    await surat("l2", {
      type: "keluar",
      nomor: "002/Sek/IX/2026",
      perihal: "Laporan bulanan",
      dibuat: "2026-09-01T02:00:00.000Z",
      disetujuiOleh: "usr-rina",
      disetujui: "2026-09-30T17:30:00.000Z",
    });
    await surat("l3", {
      type: "masuk",
      nomor: "003/Sek/VII/2026",
      perihal: "Edaran",
      oleh: "usr-rina",
      dibuat: "2026-06-30T17:00:00.000Z",
    });
    await surat("l4", {
      type: "masuk",
      nomor: "004/Sek/VIII/2026",
      perihal: "Milik orang lain",
      oleh: "usr-budi",
    });
    // Disposisi: D1 dibuka 2 hari kemudian dan ditindaklanjuti; D2 belum dibuka; D3 milik orang lain.
    await disposisi("d1", "l1", "usr-rina", {
      dibuat: "2026-08-11T01:00:00.000Z",
      dibaca: "2026-08-13T01:00:00.000Z",
      tindak: "Sudah dijawab",
    });
    await disposisi("d2", "l1", "usr-rina", {
      dibuat: "2026-08-12T01:00:00.000Z",
    });
    await disposisi("d3", "l1", "usr-budi", {
      dibuat: "2026-08-12T01:00:00.000Z",
      dibaca: "2026-08-12T02:00:00.000Z",
      tindak: "x",
    });
    // e-Court: dua verifikasi berhasil, satu gagal, satu TTE berhasil, satu unggah salinan gagal, satu verifikasi orang lain.
    await aksiEcourt("a1", "usr-rina", "verifikasi", "berhasil", "2026-08-05T03:00:00.000Z");
    await aksiEcourt("a2", "usr-rina", "verifikasi", "berhasil", "2026-08-05T04:00:00.000Z");
    await aksiEcourt("a3", "usr-rina", "verifikasi", "gagal", "2026-08-06T04:00:00.000Z");
    await aksiEcourt("a4", "usr-rina", "tte", "berhasil", "2026-08-07T04:00:00.000Z");
    await aksiEcourt("a5", "usr-rina", "unggah_salinan", "gagal", "2026-08-07T05:00:00.000Z");
    await aksiEcourt("a6", "usr-budi", "verifikasi", "berhasil", "2026-08-05T05:00:00.000Z");
    // Jejak aplikasi: tiga kegiatan sama pada satu hari + yang bukan kegiatan kerja (masuk, gagal, unduh eviden sendiri).
    await audit("j1", "usr-rina", "BAS_LEMBAR_SIMPAN", "2026-08-05T03:10:00.000Z");
    await audit("j2", "usr-rina", "BAS_LEMBAR_SIMPAN", "2026-08-05T03:20:00.000Z");
    await audit("j3", "usr-rina", "BAS_LEMBAR_SIMPAN", "2026-08-05T03:30:00.000Z");
    await audit("j4", "usr-rina", "SESSION_LOGIN", "2026-08-05T03:00:00.000Z");
    await audit("j5", "usr-rina", "BAS_LEMBAR_SIMPAN_FAILED", "2026-08-05T03:40:00.000Z");
    await audit("j6", "usr-rina", "EVIDEN_SKP_UNDUH", "2026-08-05T03:50:00.000Z");
    await audit("j7", "usr-budi", "BAS_LEMBAR_SIMPAN", "2026-08-05T03:55:00.000Z");
  }

  describe("pembaca kegiatan sistem", () => {
    it("tanggal menurut WITA dan geser tanggal kalender", () => {
      expect(tanggalKegiatan("2026-09-30T17:30:00.000Z")).toBe("2026-10-01");
      expect(tanggalKegiatan("2026-08-10")).toBe("2026-08-10");
      expect(tanggalKegiatan("")).toBeNull();
      expect(geserTanggal("2026-09-30", 2)).toBe("2026-10-02");
      expect(namaKegiatan("BAS_LEMBAR_SIMPAN")).toBe("Bas lembar simpan");
    });

    it("Sekretaris: surat, disposisi ditindaklanjuti, dan waktu tanggapan hanya milik pegawai itu pada periodenya", async () => {
      await isiKegiatanRina();
      const sistem = await bacaFaktaSistem(db, {
        userId: "usr-rina",
        jabatan: ["sekretaris"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      expect(sistem?.username).toBe(USERNAME_SISTEM);
      const fakta = (kunci: string) => sistem!.fakta.find((f) => f.kunci === kunci)!;
      // L1 dan L3 (1 Juli WITA); L2 jatuh 1 Oktober WITA; L4 milik orang lain.
      expect(fakta("sk-persuratan-kuantitas").kejadian.map((k) => k.keterangan)).toEqual([
        expect.stringContaining("003/Sek/VII/2026"),
        expect.stringContaining("001/Sek/VIII/2026"),
      ]);
      expect(fakta("sk-persuratan-diterima").kejadian).toHaveLength(2);
      expect(fakta("sk-persuratan-selesai").kejadian).toHaveLength(1);
      expect(fakta("sk-persuratan-waktu").kejadian).toHaveLength(1);
      expect(fakta("sk-persuratan-waktu").kejadian[0]).toMatchObject({
        tanggal: "2026-08-13",
        tanggalAcuan: "2026-08-11",
      });
      expect(sistem!.fakta.every((f) => f.terbaca)).toBe(true);
    });

    it("jabatan tanpa catatan sistem: tidak ada fakta; pembaca dipakai sekali walau dipakai beberapa kunci", async () => {
      expect(
        await bacaFaktaSistem(db, {
          userId: "usr-rina",
          jabatan: ["pp"],
          mulai: PERIODE.mulai,
          selesai: PERIODE.selesai,
        }),
      ).toBeNull();
      expect(
        await bacaFaktaSistem(db, {
          userId: "usr-rina",
          jabatan: ["ketua"],
          mulai: PERIODE.mulai,
          selesai: PERIODE.selesai,
        }),
      ).toBeNull();
      await isiKegiatanRina();
      const spy = vi.spyOn(db, "queryAll");
      await bacaFaktaSistem(db, {
        userId: "usr-rina",
        jabatan: ["sekretaris"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      // sk-persuratan: surat (1 kueri) + disposisi (satu kueri untuk tiga kunci).
      const kueriDisposisi = spy.mock.calls.filter((c) => String(c[0]).includes("FROM dispositions")).length;
      expect(kueriDisposisi).toBe(3); // tiga pembaca berbeda (diterima/selesai/tanggapan), masing-masing sekali
      spy.mockRestore();
    });

    it("Petugas Meja: verifikasi dokumen e-Court berhasil dan persentasenya dari seluruh percobaan", async () => {
      await isiKegiatanRina();
      const sistem = await bacaFaktaSistem(db, {
        userId: "usr-rina",
        jabatan: ["petugas-meja"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      const hasil = hitungLembarSkp({
        jenis: "petugas-meja",
        periode: PERIODE,
        pegawai: {
          userId: "usr-rina",
          nama: "Rina",
          nip: null,
          pangkatGolongan: null,
          jabatanUtama: "petugas-meja",
          jabatanTambahan: [],
        },
        pejabatPenilai: null,
        data: {
          ok: true,
          periode: PERIODE,
          jabatan: null,
          akun: [sistem!],
          catatan: [],
          galat: [],
          dihitungPada: DIHITUNG,
        },
        dihitungPada: DIHITUNG,
      });
      const i = Object.fromEntries(hasil.lembar.rhk.flatMap((r) => r.indikator).map((x) => [x.kunci, x]));
      expect(i["mj-ecourt-kuantitas"]).toMatchObject({
        realisasi: 2,
        sumber: "sistem",
      });
      expect(i["mj-ecourt-kuantitas"].dasar).toContain("tercatat di sistem");
      expect(i["mj-ecourt-kuantitas"].dasar).not.toMatch(/SIPP|ALETA/);
      expect(i["mj-ecourt-kualitas"]).toMatchObject({
        pembilang: 2,
        penyebut: 3,
        sumber: "sistem",
      });
      expect(i["mj-ecourt-kualitas"].realisasiTeks).toBe("66,7%");
      // Indikator SIPP milik meja (minutasi) tidak ada datanya -> "—", bukan 0.
      expect(i["mj-minutasi-kuantitas"].realisasi).toBeNull();
      expect(i["mj-minutasi-kuantitas"].realisasiTeks).toBe("—");
    });

    it("Operator: kegiatan dirangkum per hari (jumlah-kegiatan), yang bukan kerja tidak dihitung, berkas e-Court terpisah", async () => {
      await isiKegiatanRina();
      const sistem = await bacaFaktaSistem(db, {
        userId: "usr-rina",
        jabatan: ["operator"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      const kegiatan = sistem!.fakta.find((f) => f.kunci === "op-sistem-kuantitas")!;
      // Hanya fakta portal: op-layanan-kuantitas milik bot tidak dibuat di sini.
      expect(sistem!.fakta.map((f) => f.kunci).sort()).toEqual(["op-sistem-kualitas", "op-sistem-kuantitas"]);
      const bas = kegiatan.kejadian.find((k) => /Bas lembar simpan/.test(k.keterangan ?? ""));
      expect(bas).toMatchObject({ tanggal: "2026-08-05", nilai: 3 });
      expect(kegiatan.kejadian.some((k) => /session|failed|eviden/i.test(k.keterangan ?? ""))).toBe(false);
      const hasil = hitungLembarSkp({
        jenis: "operator",
        periode: PERIODE,
        pegawai: {
          userId: "usr-rina",
          nama: "Rina",
          nip: null,
          pangkatGolongan: null,
          jabatanUtama: "operator",
          jabatanTambahan: [],
        },
        pejabatPenilai: null,
        data: {
          ok: true,
          periode: PERIODE,
          jabatan: null,
          akun: [sistem!],
          catatan: [],
          galat: [],
          dihitungPada: DIHITUNG,
        },
        dihitungPada: DIHITUNG,
      });
      const i = Object.fromEntries(hasil.lembar.rhk.flatMap((r) => r.indikator).map((x) => [x.kunci, x]));
      // 3 BAS + 2 verifikasi berhasil + 1 TTE berhasil = 6 kegiatan.
      expect(i["op-sistem-kuantitas"]).toMatchObject({
        realisasi: 6,
        sumber: "sistem",
      });
      expect(i["op-sistem-kuantitas"].dasar).toContain("pada 2 hari");
      expect(i["op-sistem-kualitas"].realisasi).toBe(1);
    });

    it('pembaca yang gagal membuat kuncinya tidak terbaca ("—"), bukan nol', async () => {
      const rusak = new Proxy(db, {
        get(target, prop, penerima) {
          if (prop === "queryAll") {
            return async (sql: string, ...sisa: unknown[]) => {
              if (String(sql).includes("FROM letters")) throw new Error("tabel rusak");
              return (target.queryAll as (...a: unknown[]) => Promise<unknown[]>)(sql, ...sisa);
            };
          }
          return Reflect.get(target, prop, penerima);
        },
      }) as AletaDatabase;
      const sistem = await bacaFaktaSistem(rusak, {
        userId: "usr-rina",
        jabatan: ["sekretaris"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      const surat = sistem!.fakta.find((f) => f.kunci === "sk-persuratan-kuantitas")!;
      expect(surat).toMatchObject({ terbaca: false, kejadian: [] });
      expect(surat.galat).toBe("Catatan kegiatan di sistem tidak dapat dibaca saat ini.");
      const hasil = hitungLembarSkp({
        jenis: "sekretaris",
        periode: PERIODE,
        pegawai: {
          userId: "usr-rina",
          nama: "Rina",
          nip: null,
          pangkatGolongan: null,
          jabatanUtama: "sekretaris",
          jabatanTambahan: [],
        },
        pejabatPenilai: null,
        data: {
          ok: true,
          periode: PERIODE,
          jabatan: null,
          akun: [sistem!],
          catatan: [],
          galat: [],
          dihitungPada: DIHITUNG,
        },
        dihitungPada: DIHITUNG,
      });
      const i = hasil.lembar.rhk[0].indikator.find((x) => x.kunci === "sk-persuratan-kuantitas")!;
      expect(i.realisasi).toBeNull();
      expect(i.realisasiTeks).toBe("—");
      expect(i.dasar).toContain("Tidak terbaca dari sistem");
    });
  });

  // ===========================================================================
  // 3. LEMBAR SKP TANPA BOT UNTUK JABATAN BERSUMBER SISTEM
  // ===========================================================================

  describe("penyiapan Lembar SKP jabatan bersumber catatan sistem", () => {
    it("Sekretaris: bot SIPP tidak dipanggil, angka dari catatan sistem, nama tanpa kata ALETA di tabel", async () => {
      await isiKegiatanRina();
      await simpanPemetaan(db, await aktorDari("usr-super"), {
        usernameSipp: "rina.sek",
        userId: "usr-rina",
        jabatanUtama: "sekretaris",
        berlakuDari: "2026-01-01",
      });
      const siap = await siapkanSkp(db, await aktorDari("usr-rina"), {
        jenis: "sekretaris",
        pegawaiUserId: "usr-rina",
        idSipp: null,
        tahun: 2026,
        periode: "tw3",
        sertakanTambahan: true,
        langsung: false,
        ketat: true,
        denganDataHakim: false,
      });
      expect(ambilBot).not.toHaveBeenCalled();
      const kuantitas = siap.hasil.lembar.rhk[0].indikator[0];
      expect(kuantitas).toMatchObject({
        kunci: "sk-persuratan-kuantitas",
        realisasi: 2,
        sumber: "sistem",
      });
      const paket = susunPaketSkpJabatan(siap.hasil);
      const bukti = paket.dokumen.find((d) => d.kunci === "bukti-sk-persuratan")!;
      expect(bukti.tabel.baris.map((b) => b.keterangan).join(" | ")).toContain("Surat masuk 001/Sek/VIII/2026 - Undangan rapat");
      // Tanpa akun SIPP pun tidak ada catatan "belum ditautkan ke akun SIPP": jabatan ini tak memakai SIPP.
      expect(siap.hasil.lembar.catatan.join(" ")).not.toContain("belum ditautkan ke akun SIPP");
      expect(JSON.stringify(paket)).not.toMatch(/ALETA/i);
    });

    it("Operator: bot dipanggil untuk jejak SIPP dan fakta portal bergabung di satu Lembar", async () => {
      await isiKegiatanRina();
      await simpanPemetaan(db, await aktorDari("usr-super"), {
        usernameSipp: "operator1",
        userId: "usr-rina",
        jabatanUtama: "operator",
        berlakuDari: "2026-01-01",
      });
      const bot: DataSkpJabatan = {
        ok: true,
        periode: PERIODE,
        jabatan: "operator",
        akun: [
          {
            username: "operator1",
            userIdSipp: "77",
            nama: "Operator",
            grup: [],
            jabatanDugaan: null,
            aktif: true,
            fakta: [
              {
                kunci: "op-layanan-kuantitas",
                terbaca: true,
                kejadian: [
                  {
                    perkaraId: null,
                    nomorPerkara: null,
                    tanggal: "2026-08-03",
                    tanggalAcuan: null,
                    nilai: 40,
                    keterangan: "Biaya perkara - input baru (40 kali)",
                  },
                ],
                galat: null,
              },
            ],
          },
        ],
        catatan: [],
        galat: [],
        dihitungPada: DIHITUNG,
      };
      ambilBot.mockResolvedValue({ ok: true, data: bot });
      const siap = await siapkanSkp(db, await aktorDari("usr-rina"), {
        jenis: "operator",
        pegawaiUserId: "usr-rina",
        idSipp: null,
        tahun: 2026,
        periode: "tw3",
        sertakanTambahan: true,
        langsung: false,
        ketat: true,
        denganDataHakim: false,
      });
      expect(ambilBot).toHaveBeenCalledTimes(1);
      expect(ambilBot.mock.calls[0][0]).toMatchObject({
        jabatan: "operator",
        username: ["operator1"],
      });
      const i = Object.fromEntries(siap.hasil.lembar.rhk.flatMap((r) => r.indikator).map((x) => [x.kunci, x]));
      expect(i["op-layanan-kuantitas"]).toMatchObject({
        realisasi: 40,
        sumber: "sipp",
      });
      expect(i["op-sistem-kuantitas"]).toMatchObject({
        realisasi: 6,
        sumber: "sistem",
      });
    });
  });

  // ===========================================================================
  // 4. HALAMAN REKAP -> AKUN SIPP -> PEGAWAI
  // ===========================================================================

  describe("halaman Rekap Petugas -> pegawai (hak, nonaktif, belum dipetakan)", () => {
    const akunSipp = [
      {
        username: "ppg1",
        userIdSipp: "50",
        nama: "PP Uji",
        aktif: true,
        jabatanDugaan: "pp",
        paniteraId: 5,
        jurusitaId: null,
        hakimId: null,
        mediatorIds: [],
      },
      {
        username: "js1",
        userIdSipp: "51",
        nama: "JS Uji",
        aktif: true,
        jabatanDugaan: "jurusita",
        paniteraId: null,
        jurusitaId: 8,
        hakimId: null,
        mediatorIds: [],
      },
      {
        username: "hakimm",
        userIdSipp: "52",
        nama: "Hakim Mediator",
        aktif: true,
        jabatanDugaan: null,
        paniteraId: null,
        jurusitaId: null,
        hakimId: 3,
        mediatorIds: [11, 12],
      },
    ];

    it("akunDariRekap: panitera/jurusita/mediator menurut id; mediator selalu juga akun tiruan mediator:<id>", () => {
      expect(akunDariRekap(akunSipp, "panitera", 5)).toEqual(["ppg1"]);
      expect(akunDariRekap(akunSipp, "jurusita", 8)).toEqual(["js1"]);
      expect(akunDariRekap(akunSipp, "mediator", 11)).toEqual(["hakimm", "mediator:11"]);
      expect(akunDariRekap(akunSipp, "mediator", 99)).toEqual(["mediator:99"]);
      expect(akunDariRekap(akunSipp, "panitera", 99)).toEqual([]);
      expect(JABATAN_REKAP.jurusita).toEqual(["jurusita", "jurusita-pengganti"]);
    });

    it("PP: pemilik dan atasan langsung boleh; rekan, hakim biasa tidak; Admin boleh", async () => {
      await simpanPemetaan(db, await aktorDari("usr-super"), {
        usernameSipp: "ppg1",
        userId: "usr-ppg",
        jabatanUtama: "pp",
        berlakuDari: "2026-01-01",
      });
      for (const [id, alasan] of [
        ["usr-ppg", "sendiri"],
        ["usr-panitera", "atasan-langsung"],
        ["usr-ketua", "ketua"],
        ["usr-admin", "admin"],
      ] as const) {
        const h = await pegawaiDariRekap(db, await aktorDari(id), { peran: "panitera", id: 5 }, akunSipp);
        expect(h, id).toMatchObject({
          tersedia: true,
          jenis: "pp",
          labelJenis: "Panitera Pengganti",
          alasanHak: alasan,
        });
      }
      for (const id of ["usr-rina", "usr-hakim"]) {
        const h = await pegawaiDariRekap(db, await aktorDari(id), { peran: "panitera", id: 5 }, akunSipp);
        expect(h, id).toMatchObject({ tersedia: false });
      }
    });

    it("akun belum tertaut / belum dipetakan / jabatan belum dipetakan disebut dengan kalimatnya", async () => {
      const super_ = await aktorDari("usr-super");
      expect(await pegawaiDariRekap(db, super_, { peran: "panitera", id: 404 }, akunSipp)).toEqual({
        tersedia: false,
        alasan: "Orang ini belum tertaut ke akun SIPP.",
      });
      const belumPemetaan = await pegawaiDariRekap(db, super_, { peran: "panitera", id: 5 }, akunSipp);
      expect(belumPemetaan).toMatchObject({
        tersedia: false,
        alasan: expect.stringContaining("belum ditautkan ke pegawai"),
      });
      await simpanPemetaan(db, super_, {
        usernameSipp: "ppg1",
        userId: "usr-rina",
        jabatanUtama: "kasir",
        berlakuDari: "2026-01-01",
      });
      const salahJabatan = await pegawaiDariRekap(db, super_, { peran: "panitera", id: 5 }, akunSipp);
      expect(salahJabatan).toMatchObject({
        tersedia: false,
        alasan: expect.stringContaining("belum dipetakan sebagai Panitera Pengganti"),
      });
    });

    it("pejabat mutasi (nonaktif) tidak ditawarkan, juga untuk Super Admin", async () => {
      const super_ = await aktorDari("usr-super");
      await simpanPemetaan(db, super_, {
        usernameSipp: "js1",
        userId: "usr-rina",
        jabatanUtama: "jurusita-pengganti",
        berlakuDari: "2026-01-01",
      });
      expect(await pegawaiDariRekap(db, super_, { peran: "jurusita", id: 8 }, akunSipp)).toMatchObject({
        tersedia: true,
        jenis: "jurusita-pengganti",
      });
      await db.run("UPDATE users SET is_active = 0 WHERE id = 'usr-rina'");
      const nonaktif = await pegawaiDariRekap(db, super_, { peran: "jurusita", id: 8 }, akunSipp);
      expect(nonaktif).toMatchObject({
        tersedia: false,
        alasan: expect.stringContaining("tidak aktif"),
      });
    });

    it("Mediator tanpa akun SIPP ditautkan lewat 'mediator:<id>'; hakim mediator lewat akun hakimnya", async () => {
      const super_ = await aktorDari("usr-super");
      await simpanPemetaan(db, super_, {
        usernameSipp: "mediator:9",
        userId: "usr-budi",
        jabatanUtama: "mediator",
        berlakuDari: "2026-01-01",
      });
      expect(await pegawaiDariRekap(db, super_, { peran: "mediator", id: 9 }, akunSipp)).toMatchObject({
        tersedia: true,
        jenis: "mediator",
        pegawai: { userId: "usr-budi" },
      });
      await simpanPemetaan(db, super_, {
        usernameSipp: "hakimm",
        userId: "usr-hakim",
        jabatanUtama: "mediator",
        berlakuDari: "2026-01-01",
      });
      expect(await pegawaiDariRekap(db, await aktorDari("usr-hakim"), { peran: "mediator", id: 12 }, akunSipp)).toMatchObject({
        tersedia: true,
        jenis: "mediator",
        alasanHak: "sendiri",
      });
    });

    it("daftar pegawai yang ditawarkan hanya yang aktif", () => {
      expect(
        pegawaiDitawarkan([
          { aktif: true, n: 1 },
          { aktif: false, n: 2 },
          { aktif: true, n: 3 },
        ]).map((p) => p.n),
      ).toEqual([1, 3]);
    });
  });

  // ===========================================================================
  // 6. BERKAS TERBENTUK
  // ===========================================================================

  describe("berkas eviden PP/Mediator/Sekretaris lewat penggambar PDF, Excel, dan Word yang ada", () => {
    it("Lembar dan bukti dukung Sekretaris terbentuk, kiri pegawai kanan pejabat penilai, tanpa kata ALETA", async () => {
      await isiKegiatanRina();
      const sistem = await bacaFaktaSistem(db, {
        userId: "usr-rina",
        jabatan: ["sekretaris"],
        mulai: PERIODE.mulai,
        selesai: PERIODE.selesai,
      });
      const akun: FaktaAkunSkp = sistem!;
      const hasil = hitungLembarSkp({
        jenis: "sekretaris",
        periode: PERIODE,
        pegawai: {
          userId: "usr-rina",
          nama: "Rina Sekretaris, S.H.",
          nip: "198001012005012001",
          pangkatGolongan: "Penata / III.c",
          jabatanUtama: "sekretaris",
          jabatanTambahan: [],
        },
        pejabatPenilai: {
          nama: "Ketua Uji, S.H.I.",
          nip: "197505052001121002",
          jabatan: "Ketua Pengadilan Agama Donggala",
        },
        data: {
          ok: true,
          periode: PERIODE,
          jabatan: null,
          akun: [akun],
          catatan: [],
          galat: [],
          dihitungPada: DIHITUNG,
        },
        dihitungPada: DIHITUNG,
      });
      const paket = susunPaketSkpJabatan(hasil);
      expect(paket.dokumen.map((d) => d.kunci)).toEqual(["lembar-skp", "bukti-sk-persuratan", "bukti-sk-manajemen"]);
      const opsi = {
        instansi: INSTANSI_CONTOH,
        tanggalTandaTangan: "2026-10-20",
        sebutanOrang: sebutanOrangSkp("sekretaris"),
      };
      const naskah = susunNaskahEvidenSkp(paket, paket.dokumen[1], opsi);
      expect(naskah.tandaTangan.kiri.nama).toBe("Rina Sekretaris, S.H.");
      expect(naskah.tandaTangan.kanan.atas).toContain("Pejabat Penilai Kinerja,");
      expect(naskah.indikator?.baris).toHaveLength(3);

      const pdf = await gambarPdfEvidenSkp(naskah);
      const teks = (await bacaPdfUji(Buffer.from(pdf.berkas))).map((h) => h.teks).join("\n");
      expect(teks).toContain("Surat masuk 001/Sek/VIII/2026");
      expect(teks).toContain("Rina Sekretaris");
      expect(teks).not.toMatch(/ALETA/i);
      const xlsx = bacaZip(Buffer.from(await gambarXlsxEvidenSkp(naskah)));
      expect([...xlsx.keys()].some((n) => n.startsWith("xl/worksheets/"))).toBe(true);
      const docx = bacaZip(Buffer.from(await gambarDocxEvidenSkp(naskah)));
      expect(docx.get("word/document.xml")?.toString("utf8")).not.toMatch(/ALETA/i);
    }, 60000);
  });
});
