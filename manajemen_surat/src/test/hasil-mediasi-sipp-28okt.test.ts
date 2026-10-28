// @vitest-environment node
/**
 * ============================================================================
 * HASIL MEDIASI KE SIPP DARI JADWAL MEDIASI - 28 OKT 2026
 * ============================================================================
 *
 * Tiga lapis, semuanya perilaku nyata (bukan membaca teks sumber):
 *   A. bot: hasilMediasiTulisService atas basis data tiruan yang SUNGGUH
 *      menyimpan baris (perkara_mediasi, perkara_proses, perkara, audit);
 *   B. aturan murni portal: lib/hasil-mediasi-sipp;
 *   C. rute portal: hak (golongan + kepemilikan perkara), kering bawaan,
 *      teks kesepakatan -> HTML SIPP, bawaan dari laporan .rtf.
 *
 * Bentuk tulisan dibandingkan dengan baris audit SIPP satker 506518 (T, 8 Okt
 * 2026) dan kode SIPP (tab_mediasi_c::update_hasil_mediasi, mediasi_m).
 */
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  bot: [] as Array<{ jalur: string; pilihan?: { method?: string; body?: Record<string, unknown> } }>,
  jawabanGet: {} as Record<string, unknown>,
  jawabanPost: { ok: true, kering: true } as Record<string, unknown>,
  draf: null as unknown,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => null,
    queryAll: async () => [],
    prepare: () => ({ all: async () => [], get: async () => null, run: async () => ({ changes: 0 }) }),
  }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
  getUserByIdFromDb: async () => keadaan.aktor,
  getUsersFromDb: async () => (keadaan.aktor ? [keadaan.aktor] : []),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({ akunSippPengguna: async () => ({ milik: ["akun.sipp"] }) }));
vi.mock("@/server/modules/aleta-ecourt/kehadiran-mediasi", () => ({ bacaKehadiran: async () => ({ adaCatatan: false, baris: [] }) }));
vi.mock("@/server/modules/aleta-ecourt/hasil-mediasi", () => ({ bacaDrafTerbaruPerkara: async () => keadaan.draf }));
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({
  panggilBotJadwalSidang: async (jalur: string, pilihan?: { method?: string; body?: Record<string, unknown> }) => {
    keadaan.bot.push({ jalur, pilihan });
    return { ok: true, data: pilihan?.method === "POST" ? keadaan.jawabanPost : keadaan.jawabanGet };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

import {
  bawaanHasilSipp,
  bolehIsiHasilMediasiSipp,
  htmlKesepakatanSipp,
  kodeSippDariHasil,
  teksDariHtmlSipp,
  teksDariPasal,
} from "@/lib/hasil-mediasi-sipp";
import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";

// ============================================================================
// A. BOT
// ============================================================================

const AKAR = path.resolve(process.cwd(), "..");
const bot_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Layanan = {
  keadaanHasil: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  susunRencanaHasil: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  jalankanRencanaHasil: (r: Record<string, any>, o?: Record<string, unknown>) => Promise<Record<string, any>>;
};
const modul = bot_(path.join(AKAR, "aleta_bot/services/hasilMediasiTulisService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  DAFTAR_TABEL_HASIL_MEDIASI: Set<string>;
};

type Proses = { perkara_id: number; tahapan_id: number; tahapan_nama: string; proses_id: number; proses_nama: string; urutan: number; tanggal?: string; diinput_oleh?: string; diinput_tanggal?: string };

const ALUR: Record<number, [number, string, string]> = {
  110: [13, "Mediasi", "Penetapan Mediator"],
  130: [13, "Mediasi", "Kesepakatan Mediasi"],
  150: [13, "Mediasi", "Mediasi Tidak Berhasil"],
  151: [13, "Mediasi", "Mediasi Tidak Dapat Dilaksanakan"],
  180: [13, "Mediasi", "Mediasi Berhasil"],
  181: [13, "Mediasi", "Mediasi Berhasil Sebagian"],
  200: [14, "Persidangan", "Persidangan"],
};
const proses = (pid: number, urutan: number): Proses => ({
  perkara_id: 10200,
  tahapan_id: ALUR[pid][0],
  tahapan_nama: ALUR[pid][1],
  proses_id: pid,
  proses_nama: ALUR[pid][2],
  urutan,
});

function bdTiruan(opsi: { dihadiri?: string | null; putus?: string; terakhir?: boolean; tanpaPp?: boolean; tanggalPertemuan?: string } = {}) {
  const med: Record<string, any> = {
    hasil_mediasi: null,
    keputusan_mediasi: null,
    tgl_laporan_mediator: null,
    tgl_kesepakatan_perdamaian: null,
    isi_kesepakatan_perdamaian: null,
    catatan_mediasi: "",
    diinput_oleh: "sudarmin",
    diinput_tanggal: "2026-10-08 10:49:31",
  };
  const jadwal = [
    { id: 1320, urutan: 1, tanggal: "2026-10-15", jam: "09:00", sampaiJam: "", tempat: "Ruang Mediasi", dihadiriOleh: "1", ditunda: "Y" },
    { id: 1330, urutan: 2, tanggal: opsi.tanggalPertemuan ?? "2026-10-22", jam: "09:00", sampaiJam: "", tempat: "Ruang Mediasi", dihadiriOleh: opsi.dihadiri === undefined ? "1" : opsi.dihadiri, ditunda: "T" },
  ];
  let barisProses: Proses[] = [proses(110, 1), proses(200, 1), proses(200, 2)];
  const perkara: Record<string, unknown> = { tahapan_terakhir_id: 14, proses_terakhir_id: 200 };
  const audit: Array<Record<string, unknown>> = [];
  const ditulis: string[] = [];

  const kueri = async (teks: string, params: any[] = []): Promise<any> => {
    const sql = teks.replace(/\s+/g, " ").trim();
    if (/^(UPDATE|INSERT|DELETE)/i.test(sql)) {
      ditulis.push(sql);
      if (/^INSERT INTO sys_audittrail/.test(sql)) {
        audit.push({ datetime: params[0], ipaddress: params[1], username: params[2], tablename: params[3], formname: params[4], action: params[5], title: params[6], description: params[7] });
        return {};
      }
      if (/^UPDATE perkara_mediasi SET/.test(sql)) {
        const kolom = /SET (.+) WHERE/.exec(sql)![1].split(",").map((x) => x.trim().replace(/ = \?$/, ""));
        kolom.forEach((k, i) => (med[k] = params[i]));
        med.__kolom = kolom;
        return {};
      }
      if (/^DELETE FROM perkara_proses/.test(sql)) {
        barisProses = barisProses.filter((b) => !(b.proses_id === params[0] && b.perkara_id === params[1] && b.urutan === params[2]));
        return {};
      }
      if (/^UPDATE perkara SET/.test(sql)) {
        Object.assign(perkara, { tahapan_terakhir_id: params[0], tahapan_terakhir_text: params[1], proses_terakhir_id: params[2], proses_terakhir_text: params[3] });
        return {};
      }
      if (/^INSERT INTO perkara_proses/.test(sql)) {
        const [perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal, urutan, diinput_oleh, diinput_tanggal] = params;
        if (barisProses.some((b) => b.proses_id === proses_id && b.urutan === urutan)) throw new Error("Duplicate entry PRIMARY");
        barisProses.push({ perkara_id, tahapan_id, tahapan_nama, proses_id, proses_nama, tanggal, urutan, diinput_oleh, diinput_tanggal });
        return {};
      }
      if (/^UPDATE perkara_jadwal_mediasi SET dihadiri_oleh/.test(sql)) {
        const j = jadwal.find((x) => x.id === params[3]);
        if (j) j.dihadiriOleh = String(params[0]);
        return {};
      }
      throw new Error(`tulisan tak dikenal: ${sql}`);
    }
    if (/FROM perkara_mediasi m JOIN perkara p/.test(sql)) {
      return [{ mediasiId: 795, perkaraId: 10200, nomorPerkara: "123/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, mediator: "Fahri, S.H.I.", mediatorId: "12", penetapan: "2026-10-08", laporan: med.tgl_laporan_mediator, sidangPertama: "2026-10-07" }];
    }
    if (/FROM perkara_jadwal_mediasi WHERE mediasi_id = \?/.test(sql)) return jadwal.map((j) => ({ ...j }));
    if (/FROM perkara_mediasi m LEFT JOIN perkara_putusan/.test(sql)) {
      return [{ hasil: med.hasil_mediasi, keputusan: med.keputusan_mediasi, kesepakatan: med.tgl_kesepakatan_perdamaian, isiKesepakatan: med.isi_kesepakatan_perdamaian, catatan: med.catatan_mediasi, diinputOleh: med.diinput_oleh, diinputTanggal: med.diinput_tanggal, tanggalPutusan: opsi.putus ?? null }];
    }
    if (/SELECT mediasi_id AS id FROM perkara_mediasi WHERE perkara_id/.test(sql)) return opsi.terakhir === false ? [{ id: 795 }, { id: 800 }] : [{ id: 795 }];
    if (/FROM perkara_mediasi WHERE mediasi_id = \? FOR UPDATE/.test(sql)) {
      return [{ hasil: med.hasil_mediasi, laporan: med.tgl_laporan_mediator, diinputTanggal: med.diinput_tanggal }];
    }
    if (/FROM proses_alur_perkara/.test(sql)) return Object.entries(ALUR).map(([pid, [tid, tn, pn]]) => ({ proses_id: Number(pid), tahapan_id: tid, tahapan_nama: tn, proses_nama: pn }));
    if (/FROM perkara_proses WHERE perkara_id = \? ORDER BY proses_id DESC LIMIT 1/.test(sql)) {
      return barisProses.slice().sort((a, b) => b.proses_id - a.proses_id).slice(0, 1);
    }
    if (/AND urutan = \?\)/.test(sql)) {
      const sama = barisProses.filter((b) => b.urutan === params[2]);
      if (!sama.length) return [];
      const maks = Math.max(...sama.map((b) => b.proses_id));
      return barisProses.filter((b) => b.proses_id === maks);
    }
    if (/SELECT MAX\(proses_id\) FROM perkara_proses WHERE perkara_id = \?\)/.test(sql)) {
      const maks = Math.max(...barisProses.map((b) => b.proses_id));
      return barisProses.filter((b) => b.proses_id === maks);
    }
    if (/FROM perkara_proses WHERE perkara_id = \?/.test(sql)) return barisProses.map((b) => ({ ...b }));
    return [];
  };
  const transaksi = async (kerja: (k: typeof kueri) => Promise<any>) => {
    const salin = { med: { ...med }, proses: barisProses.map((b) => ({ ...b })), audit: audit.length };
    try {
      return await kerja(kueri);
    } catch (g) {
      Object.assign(med, salin.med);
      barisProses = salin.proses;
      audit.length = salin.audit;
      throw Object.assign(g as Error, { dipulihkan: true });
    }
  };
  const layanan = modul.buatLayanan({
    kueri,
    transaksi,
    waktu: async () => "2026-10-28 14:10:23",
    paniteraSidang: async () => (opsi.tanpaPp ? { ok: false, alasan: "x" } : { ok: true, akun: { username: "andini", fullname: "Andini, S.H." } }),
    pesanSidang: () => "Panitera pengganti perkara ini tidak tercatat.",
  });
  return { layanan, med, jadwal, audit, ditulis, perkara, proses: () => barisProses };
}

const ISIAN_T = { mediasiId: 795, operator: "usr_uji", hasil: "T", tanggalLaporan: "2026-10-22", keterangan: "Kedua belah pihak menghendaki perceraian", ip: "192.168.9.41" };

describe("A. bot: hasilMediasiTulisService", () => {
  it("KERING SEBAGAI BAWAAN: rencana tanpa satu tulisan pun; atas nama PP perkara", async () => {
    const bd = bdTiruan();
    const r = await bd.layanan.susunRencanaHasil(ISIAN_T);
    expect(r.ok).toBe(true);
    expect(r.atasNama).toMatchObject({ username: "andini", sebagai: "panitera" });
    const j = await bd.layanan.jalankanRencanaHasil(r);
    expect(j).toMatchObject({ ok: true, kering: true });
    expect(bd.ditulis).toHaveLength(0);
    expect(r.tahapanSesudah).toEqual({ tahapan: "Persidangan", proses: "Persidangan" });
  });

  it("Tidak Berhasil: kolom & urutan persis borang SIPP, satu baris audit EDIT atas akun PP, riwayat 130/150/200", async () => {
    const bd = bdTiruan();
    const j = await bd.layanan.jalankanRencanaHasil(await bd.layanan.susunRencanaHasil(ISIAN_T), { kering: false });
    expect(j.ok).toBe(true);
    expect(bd.med.__kolom).toEqual([
      "keputusan_mediasi", "catatan_mediasi", "diinput_oleh", "diinput_tanggal", "tgl_laporan_mediator", "hasil_mediasi",
      "akta_perdamaian", "isi_akta_perdamaian", "isi_akta_perdamaian_dok", "tgl_kesepakatan_perdamaian", "isi_kesepakatan_perdamaian",
    ]);
    expect(bd.med).toMatchObject({ keputusan_mediasi: "2026-10-22", hasil_mediasi: "T", diinput_oleh: "andini", diinput_tanggal: "2026-10-28 02:10:23", tgl_laporan_mediator: "2026-10-22" });
    expect(bd.audit).toHaveLength(1);
    expect(bd.audit[0]).toMatchObject({
      datetime: "2026-10-28 14:10:23",
      ipaddress: "192.168.9.41",
      username: "andini",
      tablename: "perkara_mediasi",
      formname: "Add Mediasi",
      action: "EDIT",
      title: "Edit Data Mediasi <br />Edit table <b>Perkara_Mediasi</b> dari halaman <b>Mediasi</b> dengan Primary Key [Mediasi_id=795]",
    });
    // Bentuk deskripsi = baris SIPP 506518 (NULL tampil kosong).
    expect(String(bd.audit[0].description)).toContain(
      "<tr><td>tgl_laporan_mediator</td><td>2026-10-22</td></tr><tr><td>hasil_mediasi</td><td>T</td></tr><tr><td>akta_perdamaian</td><td></td></tr>"
    );
    const baru = bd.proses().filter((b) => b.diinput_oleh === "andini").map((b) => [b.proses_id, b.urutan, b.tanggal, b.diinput_tanggal]);
    expect(baru).toEqual([
      [130, 1, "2026-10-22", "2026-10-28 14:10:23"],
      [150, 1, "2026-10-22", "2026-10-28 14:10:23"],
      [200, 1, "2026-10-22", "2026-10-28 14:10:23"],
    ]);
    // Persidangan urutan 2 tidak tersentuh; perkara.tahapan_terakhir seperti SIPP.
    expect(bd.proses().some((b) => b.proses_id === 200 && b.urutan === 2)).toBe(true);
    expect(bd.perkara).toMatchObject({ proses_terakhir_id: 200, tahapan_terakhir_text: "Persidangan" });
    expect(bd.ditulis.every((s) => !/aleta/i.test(s))).toBe(true);
  });

  it("IDEMPOTEN: isian yang sama dengan SIPP tidak ditulis ulang; hasil lain menyunting tanpa baris riwayat ganda", async () => {
    const bd = bdTiruan();
    await bd.layanan.jalankanRencanaHasil(await bd.layanan.susunRencanaHasil(ISIAN_T), { kering: false });
    const n = bd.ditulis.length;
    const ulang = await bd.layanan.susunRencanaHasil(ISIAN_T);
    expect(ulang.tanpaPerubahan).toBe(true);
    const j = await bd.layanan.jalankanRencanaHasil(ulang, { kering: false });
    expect(j).toMatchObject({ ok: true, tanpaPerubahan: true });
    expect(bd.ditulis.length).toBe(n);

    const isiS = "Pasal 1\n\nPara pihak sepakat hak asuh anak berada pada Penggugat dan Tergugat dapat bertemu anak.";
    const s = await bd.layanan.susunRencanaHasil({ ...ISIAN_T, hasil: "S", tanggalKesepakatan: "2026-10-22", isiKesepakatan: isiS, keterangan: "" });
    expect((await bd.layanan.jalankanRencanaHasil(s, { kering: false })).ok).toBe(true);
    expect(bd.proses().filter((b) => [130, 150, 181].includes(b.proses_id)).map((b) => b.proses_id).sort()).toEqual([130, 181]);
    expect(bd.med).toMatchObject({ hasil_mediasi: "S", tgl_kesepakatan_perdamaian: "2026-10-22", isi_kesepakatan_perdamaian: isiS, akta_perdamaian: null });
    expect(bd.audit).toHaveLength(2);
  });

  it("penolakan SIPP: laporan sebelum hasil / melebihi hari ini, kesepakatan pendek atau melebihi laporan, keterangan pendek, kata ALETA", async () => {
    const bd = bdTiruan();
    const s = bd.layanan.susunRencanaHasil;
    expect((await s({ ...ISIAN_T, tanggalLaporan: "2026-10-21" })).alasan).toBe("laporan_sebelum_hasil");
    expect((await s({ ...ISIAN_T, tanggalLaporan: "2026-10-29" })).alasan).toBe("laporan_melebihi_hari_ini");
    expect((await s({ ...ISIAN_T, hasil: "X" })).alasan).toBe("hasil_tidak_sah");
    expect((await s({ ...ISIAN_T, keterangan: "ok" })).alasan).toBe("keterangan_terlalu_pendek");
    expect((await s({ ...ISIAN_T, hasil: "Y2", tanggalKesepakatan: "2026-10-22", isiKesepakatan: "rukun" })).alasan).toBe("kesepakatan_isi_pendek");
    expect((await s({ ...ISIAN_T, hasil: "Y2", tanggalLaporan: "2026-10-23", tanggalKesepakatan: "2026-10-24", isiKesepakatan: "x".repeat(60) })).alasan).toBe("kesepakatan_melebihi_laporan");
    expect((await s({ ...ISIAN_T, keterangan: "dicatat lewat ALETA" })).alasan).toBe("teks_menyebut_aleta");
    expect((await s({ ...ISIAN_T, operator: "" })).alasan).toBe("operator_tidak_disebut");
    expect(bd.ditulis).toHaveLength(0);
  });

  it("aturan tampil SIPP: hanya mediasi terakhir, perkara belum putus; kehadiran kosong diisi sekalian", async () => {
    expect((await bdTiruan({ terakhir: false }).layanan.susunRencanaHasil(ISIAN_T)).alasan).toBe("bukan_mediasi_terakhir");
    expect((await bdTiruan({ putus: "2026-10-27" }).layanan.keadaanHasil({ mediasiId: 795 })).kodeTolak).toBe("perkara_sudah_putus");
    const bd = bdTiruan({ dihadiri: null });
    const k = await bd.layanan.keadaanHasil({ mediasiId: 795 });
    expect(k).toMatchObject({ boleh: true, perluKehadiran: true, tanggalHasil: "2026-10-22" });
    expect((await bd.layanan.susunRencanaHasil(ISIAN_T)).alasan).toBe("kehadiran_belum_diisi");
    const r = await bd.layanan.susunRencanaHasil({ ...ISIAN_T, kehadiran: "2" });
    expect(r.langkah[0].tabel).toBe("perkara_jadwal_mediasi");
    await bd.layanan.jalankanRencanaHasil(r, { kering: false });
    expect(bd.jadwal[1].dihadiriOleh).toBe("2");
    const nanti = bdTiruan({ dihadiri: null, tanggalPertemuan: "2026-11-02" });
    expect((await nanti.layanan.keadaanHasil({ mediasiId: 795 })).kodeTolak).toBe("pertemuan_belum_tiba");
  });

  it("akun PP tidak tersedia = ditolak, tidak menebak; diubah orang lain di tengah jalan = dibatalkan utuh", async () => {
    const tanpa = await bdTiruan({ tanpaPp: true }).layanan.susunRencanaHasil(ISIAN_T);
    expect(tanpa).toMatchObject({ ok: false, alasan: "akun_tidak_tersedia" });

    const bd = bdTiruan();
    const r = await bd.layanan.susunRencanaHasil(ISIAN_T);
    bd.med.diinput_tanggal = "2026-10-28 09:00:00"; // petugas lain menyimpan di SIPP
    const j = await bd.layanan.jalankanRencanaHasil(r, { kering: false });
    expect(j).toMatchObject({ ok: false, alasan: "mediasi_berubah" });
    expect(bd.ditulis).toHaveLength(0);
    expect([...modul.DAFTAR_TABEL_HASIL_MEDIASI].sort()).toEqual(["perkara", "perkara_jadwal_mediasi", "perkara_mediasi", "perkara_proses", "sys_audittrail"]);
  });
});

// ============================================================================
// B. ATURAN MURNI PORTAL
// ============================================================================

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = [], name = `Uji ${roleId}`): UserPersona {
  return { id: `usr-${roleId}`, username: roleId, password: "", name, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
}
const PETUGAS = { mediator: "Fahri, S.H.I.", majelis: ["Idris, S.H."], panitera: ["Andini, S.H."] };

describe("B. aturan murni: lib/hasil-mediasi-sipp", () => {
  it("kode SIPP dari laporan .rtf: seluruhnya dibedakan penutup akta/cabut", () => {
    expect(kodeSippDariHasil("berhasil-seluruhnya", "akta")).toBe("Y1");
    expect(kodeSippDariHasil("berhasil-seluruhnya", "cabut")).toBe("Y2");
    expect(kodeSippDariHasil("berhasil-sebagian")).toBe("S");
    expect(kodeSippDariHasil("tidak-berhasil")).toBe("T");
    expect(kodeSippDariHasil("tidak-dapat-dilaksanakan")).toBe("D");
    expect(kodeSippDariHasil("")).toBe("");
  });

  it("teks kesepakatan -> HTML ala CKEditor SIPP dan kembali", () => {
    const teks = "Pasal 1\nPara pihak sepakat:\n1. Hak asuh anak pada Penggugat;\n2. Mobil menjadi milik Tergugat.\n\nPasal 2\nBiaya ditanggung <Pihak I> & dibayar lunas.";
    const html = htmlKesepakatanSipp(teks);
    expect(html).toBe(
      "<p><strong>Pasal 1</strong></p>\n\n<p>Para pihak sepakat:</p>\n\n<ol>\n <li>Hak asuh anak pada Penggugat;</li>\n <li>Mobil menjadi milik Tergugat.</li>\n</ol>\n\n<p><strong>Pasal 2</strong></p>\n\n<p>Biaya ditanggung &lt;Pihak I&gt; &amp; dibayar lunas.</p>"
    );
    expect(teksDariHtmlSipp(html)).toContain("1. Hak asuh anak pada Penggugat;");
    expect(teksDariHtmlSipp(html)).toContain("Biaya ditanggung <Pihak I> & dibayar lunas.");
    expect(teksDariPasal([{ isi: ["Para pihak rukun.", "1. Saling memaafkan"], asal: "x" }])).toBe("Pasal 1\nPara pihak rukun.\n1. Saling memaafkan");
  });

  it("bawaan: SIPP lebih dulu, lalu laporan .rtf, lalu tanggal pertemuan terakhir", () => {
    expect(bawaanHasilSipp({ sipp: { hasil: "T", laporan: "2026-10-20" }, tanggalHasil: "2026-10-20" })).toMatchObject({ hasil: "T", sumber: "sipp" });
    const dariRtf = bawaanHasilSipp({
      sipp: { hasil: "" },
      draf: { hasil: "berhasil-sebagian", penutup: "cabut", dokumen: { tanggalLaporan: "2026-10-23", tanggalKesepakatan: "2026-10-22" } as never },
      pasal: [{ isi: ["Hak asuh anak pada Penggugat."], asal: "x" }],
      tanggalHasil: "2026-10-22",
    });
    expect(dariRtf).toEqual({ hasil: "S", tanggalLaporan: "2026-10-23", tanggalKesepakatan: "2026-10-22", isiKesepakatan: "Pasal 1\nHak asuh anak pada Penggugat.", sumber: "laporan-rtf" });
    expect(bawaanHasilSipp({ tanggalHasil: "2026-10-22" })).toMatchObject({ hasil: "", tanggalLaporan: "2026-10-22", sumber: "" });
  });

  it("hak: Super Admin; PP/hakim/mediator HANYA bila namanya di perkara; Admin dan kasir tidak", () => {
    expect(AKSI["mediasi.hasil-sipp"].rute).toEqual(["POST /api/aleta-ecourt/hasil-mediasi-sipp"]);
    expect(bolehIsiHasilMediasiSipp(akun("super-admin", "pos-pranata-komputer"), PETUGAS)).toBe(true);
    expect(bolehIsiHasilMediasiSipp(akun("panitera-pengganti", "pos-panitera-pengganti", [], "Andini"), PETUGAS)).toBe(true);
    expect(bolehIsiHasilMediasiSipp(akun("panitera-pengganti", "pos-panitera-pengganti", [], "Qadariyah"), PETUGAS)).toBe(false);
    expect(bolehIsiHasilMediasiSipp(akun("hakim", "pos-hakim", [], "Fahri"), PETUGAS)).toBe(true);
    expect(bolehIsiHasilMediasiSipp(akun("hakim", "pos-hakim", [], "Idris"), PETUGAS)).toBe(true);
    expect(bolehIsiHasilMediasiSipp(akun("admin", "pos-pranata-komputer", [], "Andini"), PETUGAS)).toBe(false);
    expect(bolehAksi(akun("pelaksana", "pos-staf-umum", ["kasir"]), "mediasi.hasil-sipp")).toBe(false);
  });
});

// ============================================================================
// C. RUTE PORTAL
// ============================================================================

const permintaan = (url: string, method = "GET", body: unknown = {}) =>
  new NextRequest(`http://127.0.0.1:3000/aleta${url}`, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });

async function panggil(method: "GET" | "POST", url: string, body?: unknown) {
  const m = (await import("@/app/api/aleta-ecourt/hasil-mediasi-sipp/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const r = await m[method](permintaan(url, method, body));
  const isi = (await r.json().catch(() => ({}))) as { data?: Record<string, any>; error?: { message?: string } };
  return { status: r.status, data: isi.data ?? {}, pesan: String(isi.error?.message ?? "") };
}

const ALAMAT = "/api/aleta-ecourt/hasil-mediasi-sipp";

beforeEach(() => {
  keadaan.bot = [];
  keadaan.draf = null;
  keadaan.jawabanGet = { ok: true, boleh: true, mediator: "Fahri, S.H.I.", majelis: ["Idris, S.H."], panitera: ["Andini, S.H."], perkara: { perkaraId: 10200, nomorPerkara: "123/Pdt.G/2026/PA.Dgl" }, tanggalHasil: "2026-10-22", sipp: { hasil: "" } };
  keadaan.jawabanPost = { ok: true, kering: true };
});
afterEach(() => {
  keadaan.aktor = null;
});

describe("C. rute /api/aleta-ecourt/hasil-mediasi-sipp", () => {
  it("Admin tanpa nama di perkara dan PP perkara lain ditolak 403 - tidak sampai menulis", async () => {
    for (const a of [akun("admin", "pos-pranata-komputer", [], "Rahmat"), akun("panitera-pengganti", "pos-panitera-pengganti", [], "Qadariyah")]) {
      keadaan.aktor = a as unknown as Record<string, unknown>;
      const r = await panggil("POST", ALAMAT, { mediasiId: "795", hasil: "T", tanggalLaporan: "2026-10-22", kering: false });
      expect(r.status).toBe(403);
    }
    expect(keadaan.bot.every((b) => b.pilihan?.method !== "POST")).toBe(true);
  });

  it("KERING SEBAGAI BAWAAN; teks kesepakatan dikirim sebagai HTML SIPP; operator & akun penekan hanya untuk riwayat", async () => {
    keadaan.aktor = akun("panitera-pengganti", "pos-panitera-pengganti", [], "Andini") as unknown as Record<string, unknown>;
    await panggil("POST", ALAMAT, { mediasiId: "795", hasil: "T", tanggalLaporan: "2026-10-22", isiKesepakatan: "tidak dipakai" });
    await panggil("POST", ALAMAT, { mediasiId: "795", hasil: "y2", tanggalLaporan: "2026-10-22", tanggalKesepakatan: "2026-10-22", isiKesepakatan: "Pasal 1\nPara pihak rukun kembali.", kering: false, jamKerja: "antrekan" });
    const tulis = keadaan.bot.filter((b) => b.pilihan?.method === "POST").map((b) => b.pilihan!.body!);
    expect(tulis.map((b) => b.kering)).toEqual([true, false]);
    expect(tulis[0].isiKesepakatan).toBe("");
    expect(tulis[1]).toMatchObject({ hasil: "Y2", isiKesepakatan: "<p><strong>Pasal 1</strong></p>\n\n<p>Para pihak rukun kembali.</p>", atasNama: "panitera", operator: "usr_uji", operatorAkunSipp: "akun.sipp", jamKerja: "antrekan" });
  });

  it("GET: hak Anda + bawaan dari laporan .rtf mediator", async () => {
    keadaan.aktor = akun("panitera-pengganti", "pos-panitera-pengganti", [], "Andini") as unknown as Record<string, unknown>;
    keadaan.draf = { versi: 1, hasil: "tidak-berhasil", penutup: "cabut", butir: {}, dokumen: { jenisPerkara: "Cerai Gugat", tanggalLaporan: "2026-10-22" } };
    const r = await panggil("GET", `${ALAMAT}?mediasiId=795`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ bolehAnda: true, bawaan: { hasil: "T", tanggalLaporan: "2026-10-22", sumber: "laporan-rtf" } });
    expect(keadaan.bot.every((b) => !b.pilihan?.method)).toBe(true);
    keadaan.aktor = akun("hakim", "pos-hakim", [], "Rahman") as unknown as Record<string, unknown>;
    expect((await panggil("GET", `${ALAMAT}?mediasiId=795`)).data).toMatchObject({ bolehAnda: false });
  });
});
