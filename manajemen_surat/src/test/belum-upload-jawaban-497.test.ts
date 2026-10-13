/**
 * 13 Okt 2026: lencana "belum upload" SALAH pada 497/Pdt.G/2026/PA.Dgl,
 * sidang 12 Okt agenda "Jawaban Tergugat" - Jawaban sudah diunggah 08.15.
 *
 * Terukur di server (hanya baca):
 *   - aleta_bot_ecourt_documents untuk 497 hanya 4 berkas pendaftaran
 *     (tidak_perlu), terakhir terlihat 5 Okt - Jawaban tidak pernah tercatat;
 *   - tombol "belum upload" ditekan 13.59 dan 16.35 WITA (log bot UTC 05.59 & 08.35): keduanya
 *     "1 perkara berkasnya sudah lengkap, tidak dibuka" -> 0 perkara
 *     diperiksa. Penarikan tertarget ikut disaring "sudah lengkap" padahal
 *     kelengkapan diukur dari simpanan yang belum memuat dokumen baru.
 *     517/Pdt.G/2026 kena dua kali dengan cara yang sama (4/4 tarikan
 *     "belum upload" 12 Okt tidak membuka perkaranya).
 *   - Entri jadwal berikutnya 15 Okt (Replik), bukan 19 Okt; dugaan
 *     "dokumen menempel ke sidang berikutnya" tidak terbukti.
 *
 * Sekalian: pencocokan dokumen <-> agenda menurut JENIS e-Court (Jawaban,
 * Replik, Duplik, Rereplik, Kesimpulan), sejak awal babak agenda itu -
 * sidang yang ditunda dengan agenda yang sama tidak lagi menghapus dokumen
 * yang sudah diunggah untuknya.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { penandaVerifikasi, type DataVerifikasi } from "@/lib/penanda-verifikasi-ecourt";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Item = Record<string, unknown> & { keadaan: string };
type Layanan = { keadaanHari: (t?: string) => Promise<{ ok: boolean; perkara: Record<string, Item> }> };
type Dok = Record<string, unknown>;

const harian = require_(path.join(AKAR, "aleta_bot/services/ecourtVerifikasiHarianService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  unggahSesudah: (d: Dok[], lalu: string) => number;
  unggahUntukAgenda: (d: Dok[], o: { agenda: string; sidangLalu: string; awalBabak?: string }) => number;
  awalBabakAgenda: (agenda: string, riwayat: Array<{ tanggalSidang: string; agenda: string }>) => string;
};
const store = require_(path.join(AKAR, "aleta_bot/services/ecourtStoreService.js")) as {
  dokumenMenungguMajelis: (d: Dok) => boolean;
};
const jembatan = require_(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/run.js")) as {
  parseArgs: (argv: string[]) => Record<string, unknown>;
  saringYangLengkap: (args: Record<string, unknown>) => boolean;
};

const NOMOR = "497/Pdt.G/2026/PA.Dgl";

/** Riwayat jadwal 497 di SIPP (perkara_jadwal_sidang, perkara_id 10014). */
const RIWAYAT_497 = [
  { tanggalSidang: "2026-08-31", agenda: "Sidang Pertama" },
  { tanggalSidang: "2026-09-14", agenda: "Pemeriksaan pokok perkara" },
  { tanggalSidang: "2026-09-28", agenda: "laporan hasil mediasi" },
  { tanggalSidang: "2026-10-05", agenda: "Panggil Tergugat" },
];

/** Empat berkas pendaftaran yang tersimpan untuk 497 (bentuk nyata). */
function pendaftaran497(): Dok[] {
  return ["Dokumen Gugatan", "KTP", "Dokumen Bukti", "SURAT GUGATAN (Docx/Rtf)"].map((judul) => ({
    nomorPerkara: NOMOR,
    judulDokumen: judul,
    jenisDokumen: "",
    diunggahPada: null,
    statusVerifikasi: "tidak_perlu",
    terakhirTerlihat: "2026-10-05 03:26:11",
  }));
}

/** Dunia tiruan satu perkara: SIPP (jadwal hari itu + riwayat) dan simpanan bot. */
function dunia(o: { nomor: string; perkaraId: number; tanggal: string; agenda: string; riwayat: typeof RIWAYAT_497; dokumen: Dok[] }) {
  const sidangLalu = o.riwayat.map((r) => r.tanggalSidang).sort().pop();
  const kueriSipp = async (sql: string) => {
    if (/perkara_efiling_id/.test(sql)) return [{ perkaraId: o.perkaraId, nomorPerkara: o.nomor, agenda: o.agenda, sidangLalu }];
    if (/FROM perkara_jadwal_sidang/.test(sql)) return o.riwayat.map((r) => ({ perkaraId: o.perkaraId, ...r }));
    return [];
  };
  const kueriBot = async (sql: string, nilai: unknown[] = []) =>
    /FROM aleta_bot_ecourt_documents/.test(sql) ? o.dokumen.filter((d) => (nilai as string[]).includes(String(d.nomorPerkara))) : [];
  const L = harian.buatLayanan({
    kueriSipp,
    kueriBot,
    menunggu: store.dokumenMenungguMajelis,
    tarik: async () => ({ kode: 0 }),
    akunSiap: () => true,
    bolehJalan: () => true,
    sekarang: () => new Date(`${o.tanggal}T10:00:00`),
  });
  return { L, dokumen: o.dokumen };
}

describe("jembatan e-Court: penarikan tertarget selalu membuka perkaranya", () => {
  it("--perkara tidak disaring 'sudah lengkap'; sapuan biasa tetap disaring; --paksa-ulang tidak", () => {
    expect(jembatan.saringYangLengkap(jembatan.parseArgs(["--perkara", NOMOR, "--maks-perkara", "0"]))).toBe(false);
    expect(jembatan.saringYangLengkap(jembatan.parseArgs(["--perkara", NOMOR, "--tanpa-unduh"]))).toBe(false);
    expect(jembatan.saringYangLengkap(jembatan.parseArgs(["--maks-perkara", "25"]))).toBe(true);
    expect(jembatan.saringYangLengkap(jembatan.parseArgs(["--hanya-belum-ada"]))).toBe(true);
    expect(jembatan.saringYangLengkap(jembatan.parseArgs(["--paksa-ulang"]))).toBe(false);
  });
});

describe("497/Pdt.G/2026/PA.Dgl, 12 Okt 2026, agenda Jawaban Tergugat", () => {
  it("simpanan hanya berkas pendaftaran (tarikan tidak membuka perkara) -> belum upload, menyebut Jawaban", async () => {
    const w = dunia({ nomor: NOMOR, perkaraId: 10014, tanggal: "2026-10-12", agenda: "Jawaban Tergugat", riwayat: RIWAYAT_497, dokumen: pendaftaran497() });
    const k = (await w.L.keadaanHari("2026-10-12")).perkara[NOMOR];
    expect(k).toMatchObject({ keadaan: "belum-upload", sidangLalu: "2026-10-05", awalBabak: "2026-10-05", unggahSejakSidangLalu: 0 });
    expect(k.jenisDituntut).toEqual(["jawaban"]);
  });

  it("Jawaban (PDF + Word) diunggah 08.15 dan sudah diverifikasi -> sudah; sebelum diverifikasi -> belum", async () => {
    const dokumen = pendaftaran497();
    const jawaban: Dok = {
      nomorPerkara: NOMOR,
      judulDokumen: "Jawaban dari Tergugat",
      jenisDokumen: "Jawaban",
      diunggahPada: "2026-10-12 08:15:00",
      statusVerifikasi: "belum",
      terakhirTerlihat: "2026-10-12 08:36:54",
    };
    dokumen.push(jawaban);
    const w = dunia({ nomor: NOMOR, perkaraId: 10014, tanggal: "2026-10-12", agenda: "Jawaban Tergugat", riwayat: RIWAYAT_497, dokumen });
    expect((await w.L.keadaanHari("2026-10-12")).perkara[NOMOR]).toMatchObject({ keadaan: "belum", menunggu: 1, unggahSejakSidangLalu: 1 });
    jawaban.statusVerifikasi = "valid";
    expect((await w.L.keadaanHari("2026-10-12")).perkara[NOMOR]).toMatchObject({ keadaan: "sudah", unggahSejakSidangLalu: 1 });
  });

  it("sidang 15 Okt (Replik Penggugat): Jawaban 12 Okt bukan Replik -> tetap belum upload", async () => {
    const dokumen = pendaftaran497();
    dokumen.push({ nomorPerkara: NOMOR, judulDokumen: "Jawaban dari Tergugat", jenisDokumen: "Jawaban", diunggahPada: "2026-10-12 08:15:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-10-13 08:00:00" });
    const riwayat = [...RIWAYAT_497, { tanggalSidang: "2026-10-12", agenda: "Jawaban Tergugat" }];
    const w = dunia({ nomor: NOMOR, perkaraId: 10014, tanggal: "2026-10-15", agenda: "Replik Penggugat", riwayat, dokumen });
    const k = (await w.L.keadaanHari("2026-10-15")).perkara[NOMOR];
    expect(k).toMatchObject({ keadaan: "belum-upload", sidangLalu: "2026-10-12", unggahSejakSidangLalu: 0 });
  });
});

describe("jenis dokumen <-> agenda, termasuk sidang yang ditunda (bentuk nyata dari server)", () => {
  it("314/Pdt.G/2026: Duplik diunggah 14 Jul, sidang Duplik 15 Jul ditunda ke 22 Jul -> sudah (aturan lama: belum upload)", async () => {
    const nomor = "314/Pdt.G/2026/PA.Dgl";
    const riwayat = [
      { tanggalSidang: "2026-06-24", agenda: "Sidang Pertama" },
      { tanggalSidang: "2026-07-01", agenda: "Jawaban Termohon" },
      { tanggalSidang: "2026-07-08", agenda: "Replik Pemohon" },
      { tanggalSidang: "2026-07-15", agenda: "Duplik Termohon" },
    ];
    const dokumen: Dok[] = [
      { nomorPerkara: nomor, jenisDokumen: "Jawaban", diunggahPada: "2026-06-24 10:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-07-21 09:00:00" },
      { nomorPerkara: nomor, jenisDokumen: "Replik", diunggahPada: "2026-07-05 10:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-07-21 09:00:00" },
      { nomorPerkara: nomor, jenisDokumen: "Duplik", diunggahPada: "2026-07-14 10:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-07-21 09:00:00" },
    ];
    expect(harian.unggahSesudah(dokumen, "2026-07-15")).toBe(0);
    expect(harian.awalBabakAgenda("Duplik Tergugat Rekonvensi", riwayat)).toBe("2026-07-08");
    const w = dunia({ nomor, perkaraId: 1, tanggal: "2026-07-22", agenda: "Duplik Tergugat Rekonvensi", riwayat, dokumen });
    expect((await w.L.keadaanHari("2026-07-22")).perkara[nomor]).toMatchObject({ keadaan: "sudah", awalBabak: "2026-07-08", unggahSejakSidangLalu: 1 });
  });

  it("419/Pdt.G/2026: agenda Duplik, hanya Replik yang diunggah sesudah sidang lalu -> belum upload (aturan lama: 'sudah' palsu)", async () => {
    const nomor = "419/Pdt.G/2026/PA.Dgl";
    const riwayat = [
      { tanggalSidang: "2026-08-11", agenda: "Jawaban Tergugat" },
      { tanggalSidang: "2026-08-18", agenda: "Replik Penggugat" },
    ];
    const dokumen: Dok[] = [
      { nomorPerkara: nomor, jenisDokumen: "Jawaban", diunggahPada: "2026-08-11 08:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-08-24 08:00:00" },
      { nomorPerkara: nomor, jenisDokumen: "Replik", diunggahPada: "2026-08-19 08:00:00", statusVerifikasi: "valid", terakhirTerlihat: "2026-08-24 08:00:00" },
    ];
    expect(harian.unggahSesudah(dokumen, "2026-08-18")).toBe(1);
    const w = dunia({ nomor, perkaraId: 2, tanggal: "2026-08-24", agenda: "Duplik Tergugat", riwayat, dokumen });
    expect((await w.L.keadaanHari("2026-08-24")).perkara[nomor]).toMatchObject({ keadaan: "belum-upload", unggahSejakSidangLalu: 0 });
  });

  it("agenda gabungan dan jenis serupa: 'Duplik Rekonvensi' menerima Rereplik; Jawaban lama tidak memenuhi 'Replik Konvensi/jawaban Rekonvensi' dari babak sebelumnya", () => {
    const rereplik: Dok[] = [{ jenisDokumen: "Rereplik", diunggahPada: "2026-09-24 09:00:00", statusVerifikasi: "valid" }];
    expect(harian.unggahUntukAgenda(rereplik, { agenda: "Duplik Rekonvensi", sidangLalu: "2026-09-23" })).toBe(1);

    const riwayat = [
      { tanggalSidang: "2026-09-01", agenda: "Sidang Pertama" },
      { tanggalSidang: "2026-09-08", agenda: "Jawaban dan Gugatan Rekonvensi Termohon" },
    ];
    const awal = harian.awalBabakAgenda("Replik Konvensi/jawaban Rekonvensi", riwayat);
    expect(awal).toBe("2026-09-08");
    const jawabanLama: Dok[] = [{ jenisDokumen: "Jawaban", diunggahPada: "2026-09-07 09:00:00", statusVerifikasi: "valid" }];
    expect(harian.unggahUntukAgenda(jawabanLama, { agenda: "Replik Konvensi/jawaban Rekonvensi", sidangLalu: "2026-09-08", awalBabak: awal })).toBe(0);
  });

  it("dokumen tanpa jenis atau berjenis lain tetap memakai aturan lama (tidak memunculkan belum upload palsu)", () => {
    const d: Dok[] = [
      { jenisDokumen: "", diunggahPada: "2026-10-10 09:00:00", statusVerifikasi: "valid" },
      { jenisDokumen: "Perbaikan Gugatan", diunggahPada: "2026-10-01 09:00:00", statusVerifikasi: "valid" },
    ];
    expect(harian.unggahUntukAgenda(d, { agenda: "Kesimpulan", sidangLalu: "2026-10-05" })).toBe(1);
    // Berkas pendaftaran (tidak_perlu) tidak pernah dihitung.
    expect(harian.unggahUntukAgenda(pendaftaran497(), { agenda: "Jawaban Tergugat", sidangLalu: "2026-10-05" })).toBe(0);
  });
});

describe("portal: keterangan lencana menyebut jenis dokumen yang dituntut", () => {
  it("belum upload 497 -> 'dokumen Jawaban ... sejak sidang 2026-10-05'", () => {
    const data: DataVerifikasi = {
      terbaca: true,
      tanggal: "2026-10-12",
      perkara: {
        [NOMOR]: {
          nomorPerkara: NOMOR,
          keadaan: "belum-upload",
          menunggu: 0,
          dokumen: 4,
          terakhirDiperiksa: "2026-10-12 08:36:54",
          diverifikasiOleh: [],
          sidangLalu: "2026-10-05",
          awalBabak: "2026-10-05",
          jenisDituntut: ["jawaban"],
          unggahSejakSidangLalu: 0,
        },
      },
    };
    const p = penandaVerifikasi(
      { nomorPerkara: NOMOR, tanggalSidang: "2026-10-12", lewatEcourt: true, agenda: "Jawaban Tergugat", urutanSidang: 5 },
      data,
      "2026-10-12"
    );
    expect(p?.label).toBe("belum upload");
    expect(p?.keterangan).toContain("dokumen Jawaban di e-Court sejak sidang 2026-10-05");
  });
});
