// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { penekanAdalahPp } from "@/lib/kehadiran-sidang";
import { AKSI } from "@/lib/matriks-peran";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * G4 4.4 (30 Okt 2026) - usul pembetulan kehadiran sidang SIPP dari BAS / amar verstek.
 * Yang dijaga (perilaku, bukan teks kode):
 *   - aturan usulan IDENTIK paket relaas-penetapan-30okt: gugatan, amar memuat verstek, sidang dengan sandi
 *     T hadir (1,3,8,9,11,15) dan tanggal <= putusan; 11 tidak diusulkan; sidang ikrar dikecualikan;
 *   - BAS (nama blangko) yang berbeda dengan SIPP diusulkan; BAS dan verstek berselisih = tidak diusulkan;
 *   - rencana tulis = bentuk Edit Jadwal Sidang SIPP atas akun PP perkara (bukan penekan), satu UPDATE +
 *     satu baris audit [id=N], tanpa kata Aleta; kehadiran yang berubah sejak dibaca / sudah sama / PP ganda
 *     atau diblokir = ditolak; dijalankan atas basis data tiruan menghasilkan SQL persis;
 *   - rute portal: penekan harus PP perkara (akun SIPP tertaut atau nama), Admin yang bukan PP 403 dan tidak
 *     ada tulisan; PP lolos dan baru sesudah itu bot diminta menulis (kering: false).
 */

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const K = require_(path.join(AKAR, "aleta_bot/services/kehadiranSidangTulisService.js")) as Record<string, any>;
const sidangHasil = require_(path.join(AKAR, "aleta_bot/services/sidangHasilService.js")) as Record<string, any>;
const penetapan = require_(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js")) as Record<string, any>;

describe("nama blangko BAS -> kehadiran SIPP", () => {
  it("membaca nama BAS Derry sungguhan", () => {
    expect(K.kehadiranBas("[1] BAS 1 P & T Hadir - Mediasi.rtf")).toBe(1);
    expect(K.kehadiranBas("[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf")).toBe(2);
    expect(K.kehadiranBas("[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf")).toBe(4);
    expect(K.kehadiranBas("[3] BAS Putus P & T Tidak Hadir - Gugur.rtf")).toBe(4);
    expect(K.kehadiranBas("[2] BAS 2 P Hadir & T Tidak Hadir - Laporan Mediasi, Tunda Panggil T.rtf")).toBe(2);
    expect(K.kehadiranBas("[1] BAS Ikrar Talak P & T Hadir.rtf")).toBeNull();
    expect(K.kehadiranBas("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf")).toBeNull();
    expect(K.kehadiranBas("")).toBeNull();
  });
});

describe("usulan pembetulan (murni)", () => {
  const perkaraVerstek = { alurPerkaraId: 15, nomorPerkara: "315/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", amarVerstek: true, tanggalPutusan: "2026-07-07" };
  // Bentuk 9813 315/Pdt.G/2026 (dump 28 Okt): sidang 2 bersandi 1 padahal verstek.
  const sidang9813 = [
    { jadwalId: 19228, urutan: 1, tanggal: "2026-06-09", dihadiriOleh: 2, ikrarTalak: "T" },
    { jadwalId: 19339, urutan: 2, tanggal: "2026-06-23", dihadiriOleh: 1, ikrarTalak: "T" },
    { jadwalId: 19419, urutan: 3, tanggal: "2026-07-07", dihadiriOleh: 2, ikrarTalak: "T" },
  ];

  it("verstek + sandi T hadir sebelum putusan -> T tidak hadir", () => {
    const u = K.usulKehadiran({ perkara: perkaraVerstek, sidang: sidang9813 });
    expect(u.usul).toEqual([expect.objectContaining({ jadwalId: 19339, dari: 1, ke: 2, sebab: "verstek" })]);
    expect(u.usul[0].kalimat).toContain("Semua Pihak menjadi Penggugat Saja");
  });

  it("peta kode: 3->4, 9->7, 15->13, 8->5; 11 tanpa usul; sesudah putusan / ikrar / bukan gugatan / bukan verstek = tidak", () => {
    const s = (jadwalId: number, kode: number, tanggal = "2026-06-01", ikrar = "T") => ({ jadwalId, urutan: jadwalId, tanggal, dihadiriOleh: kode, ikrarTalak: ikrar });
    const u = K.usulKehadiran({ perkara: perkaraVerstek, sidang: [s(1, 3), s(2, 9), s(3, 15), s(4, 8), s(5, 11), s(6, 1, "2026-07-08"), s(7, 1, "2026-06-02", "Y")] });
    expect(u.usul.map((x: any) => [x.jadwalId, x.ke])).toEqual([[1, 4], [2, 7], [3, 13], [4, 5]]);
    expect(u.tanpaUsul.map((x: any) => x.jadwalId)).toEqual([5]);
    expect(K.usulKehadiran({ perkara: { ...perkaraVerstek, alurPerkaraId: 16 }, sidang: sidang9813 }).usul).toEqual([]);
    expect(K.usulKehadiran({ perkara: { ...perkaraVerstek, amarVerstek: false }, sidang: sidang9813 }).usul).toEqual([]);
    expect(K.usulKehadiran({ perkara: { ...perkaraVerstek, tanggalPutusan: "" }, sidang: sidang9813 }).usul).toEqual([]);
  });

  it("BAS berbeda dari SIPP diusulkan; BAS dan verstek berselisih = tidak diusulkan", () => {
    const belumPutus = { alurPerkaraId: 15, nomorPerkara: "700/Pdt.G/2026/PA.Dgl", amarVerstek: false, tanggalPutusan: "" };
    const sd = [{ jadwalId: 50, urutan: 1, tanggal: "2026-10-30", dihadiriOleh: 2, ikrarTalak: "T" }];
    const u = K.usulKehadiran({ perkara: belumPutus, sidang: sd, bas: { jadwalId: 50, kode: 1 } });
    expect(u.usul).toEqual([expect.objectContaining({ jadwalId: 50, dari: 2, ke: 1, sebab: "bas" })]);
    expect(K.usulKehadiran({ perkara: belumPutus, sidang: sd, bas: { jadwalId: 50, kode: 2 } }).usul).toEqual([]);
    // Kosong (belum diisi) juga diusulkan; intervensi (5..15) tidak dibaca dari nama BAS.
    expect(K.usulKehadiran({ perkara: belumPutus, sidang: [{ ...sd[0], dihadiriOleh: null }], bas: { jadwalId: 50, kode: 1 } }).usul[0]).toMatchObject({ dari: 0, ke: 1 });
    expect(K.usulKehadiran({ perkara: belumPutus, sidang: [{ ...sd[0], dihadiriOleh: 9 }], bas: { jadwalId: 50, kode: 1 } }).usul).toEqual([]);
    const tabrak = K.usulKehadiran({ perkara: perkaraVerstek, sidang: sidang9813, bas: { jadwalId: 19339, kode: 1 } });
    expect(tabrak.usul).toEqual([]);
    expect(tabrak.bertentangan).toEqual([expect.objectContaining({ jadwalId: 19339 })]);
  });

  it("sebutan pihak: cerai talak = Pemohon/Termohon", () => {
    const u = K.usulKehadiran({ perkara: { ...perkaraVerstek, jenisPerkara: "Cerai Talak" }, sidang: sidang9813 });
    expect(u.usul[0].kalimat).toContain("Pemohon Saja");
  });
});

// ---------------------------------------------------------------------------
// Rencana + penulisan atas basis data tiruan
// ---------------------------------------------------------------------------
type Kueri = { sql: string; params: unknown[] };
function tiruSipp(opsi: { dihadiri?: number | null; pp?: Array<Record<string, unknown>>; sesudah?: number; putus?: string; sifat?: string } = {}) {
  const tercatat: Kueri[] = [];
  const baris = {
    jadwalId: 17850,
    perkaraId: 9222,
    tanggalSidang: "2025-11-06",
    jamSidang: "09:00:00",
    sampaiJam: "09:50:00",
    agenda: "SIDANG PERTAMA",
    urutan: 1,
    ditunda: "Y",
    alasanDitundaAsli: "Tergugat tidak hadir",
    ruanganId: 1,
    ruangan: "Ruang Sidang 1",
    sidangKeliling: "T",
    sifatSidang: opsi.sifat ?? "Y",
    dihadiriOleh: opsi.dihadiri === undefined ? 1 : opsi.dihadiri,
    ikrarTalak: "T",
    keterangan: "",
    nomorPerkara: "627/Pdt.G/2025/PA.Dgl",
    alurPerkaraId: 15,
    jenisPerkaraId: 346,
    jenisPerkara: "Cerai Gugat",
    tanggalPutusan: opsi.putus ?? "2025-11-24",
    sidangSesudah: opsi.sesudah ?? 1,
  };
  const pp = opsi.pp ?? [{ panitera_id: 7, panitera_nama: "Qadariyah, S.H.", tanggal_penetapan: "2025-10-01", username: "qadariyah", fullname: "Qadariyah, S.H.", block: 0 }];
  const kueri = async (sql: string, params: unknown[] = []) => {
    tercatat.push({ sql, params });
    if (/FROM perkara_jadwal_sidang j JOIN perkara p/.test(sql)) return [{ ...baris }];
    if (/FROM perkara_panitera_pn c/.test(sql)) return pp;
    return [];
  };
  return { kueri, tercatat, baris };
}

function layananUji(t: ReturnType<typeof tiruSipp>) {
  return K.buatLayanan({
    kueri: t.kueri,
    waktuSipp: async () => "2026-10-30 10:15:07",
    // Jalankan persis seperti penulis bersama, tetapi ke basis data tiruan (tanpa kolam MySQL).
    jalankanUtuh: async (rencana: any, o: any) => {
      for (const pagar of rencana.periksaUlang || []) {
        const r = await t.kueri(pagar.sql, pagar.params);
        if (!pagar.cocok(r.length ? r : [{ dihadiri_oleh: t.baris.dihadiriOleh }])) return { ok: false, alasan: pagar.alasan };
      }
      return penetapan.jalankanRencana(rencana, { kering: o.kering, kueri: async (sql: string, params: unknown[]) => (t.tercatat.push({ sql, params }), { insertId: 0, affectedRows: 1 }) });
    },
  });
}

describe("rencana tulis kehadiran (basis data tiruan)", () => {
  it("bentuk Edit Jadwal Sidang atas akun PP perkara, bukan penekan; tanpa kata Aleta", async () => {
    const t = tiruSipp();
    const L = layananUji(t);
    const r = await L.susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, sebelum: 1, sebab: "verstek", operator: "usr-ppg", ip: "192.168.10.77" });
    expect(r.ok).toBe(true);
    expect(r.atasNama).toMatchObject({ username: "qadariyah" });
    expect(r.langkah.map((x: any) => [x.tabel, x.aksi])).toEqual([["perkara_jadwal_sidang", "UPDATE"], ["sys_audittrail", "INSERT"]]);
    expect(r.langkah[0].params).toEqual([2, "qadariyah", "2026-10-30 10:15:07", 17850, 1]);
    const audit = r.langkah[1].params;
    expect(audit.slice(0, 7)).toEqual([
      "2026-10-30 10:15:07",
      "192.168.10.77",
      "qadariyah",
      "perkara_jadwal_sidang",
      sidangHasil.NAMA_HALAMAN_EDIT,
      "UPDATE",
      "UPDATE table <b>perkara_jadwal_sidang</b> dari halaman <b>EDIT JADWAL SIDANG</b> dengan Primary Key [id=17850]",
    ]);
    // 13 kolom borang Edit, nilai kehadiran yang BARU.
    expect(audit[7]).toContain("<tr><td>dihadiri_oleh</td><td>2</td></tr>");
    expect(audit[7]).toContain("<tr><td>sidang_keliling</td><td>T</td></tr>");
    expect(JSON.stringify(r.langkah)).not.toMatch(/aleta/i);
    expect(JSON.stringify(r.langkah)).not.toContain("usr-ppg");
    // Sudah putus -> disebut terang bahwa borang SIPP sendiri tidak terbuka.
    expect(r.sepertiBorang).toBe(false);
    expect(r.andaian.join(" ")).toContain("sudah putus");
    const kering = await L.jalankanRencanaKehadiran(r, { kering: true });
    expect(kering).toMatchObject({ ok: true, kering: true, jumlahLangkah: 2 });
    const sebelumTulis = t.tercatat.length;
    const tulis = await L.jalankanRencanaKehadiran(r, { kering: false });
    expect(tulis.ok).toBe(true);
    const sql = t.tercatat.slice(sebelumTulis).map((k) => k.sql);
    expect(sql.some((s) => /UPDATE perkara_jadwal_sidang SET dihadiri_oleh = \?/.test(s))).toBe(true);
    expect(sql.some((s) => /INSERT INTO sys_audittrail/.test(s))).toBe(true);
    expect(sql.some((s) => /perkara_proses|UPDATE perkara SET/.test(s))).toBe(false);
  });

  it("sifat sidang kosong ikut diisi bawaan borang (seperti tombol Putus)", async () => {
    const t = tiruSipp({ sifat: "" });
    const r = await layananUji(t).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, operator: "usr-ppg" });
    expect(r.langkah[0].sql).toContain("sifat_sidang = ?");
    // Cerai gugat (jenis 346) = sidang tertutup menurut borang SIPP.
    expect(r.langkah[0].params).toEqual([2, "T", "qadariyah", "2026-10-30 10:15:07", 17850, 1]);
  });

  it("ditolak: kehadiran berubah sejak dibaca, sudah sama, kode tak sah, PP ganda, PP diblokir, tanpa penekan", async () => {
    expect((await layananUji(tiruSipp()).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, sebelum: 4, operator: "x" })).alasan).toBe("kehadiran_berubah");
    expect((await layananUji(tiruSipp({ dihadiri: 2 })).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, operator: "x" })).alasan).toBe("kehadiran_sudah_sama");
    expect((await layananUji(tiruSipp()).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 6, operator: "x" })).alasan).toBe("kehadiran_tidak_sah");
    expect((await layananUji(tiruSipp()).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2 })).alasan).toBe("operator_tidak_disebut");
    const ganda = tiruSipp({
      pp: [
        { panitera_id: 7, panitera_nama: "A", username: "a", fullname: "A", block: 0 },
        { panitera_id: 8, panitera_nama: "B", username: "b", fullname: "B", block: 0 },
      ],
    });
    expect((await layananUji(ganda).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, operator: "x" })).alasan).toBe("panitera_sidang_ganda");
    const blokir = tiruSipp({ pp: [{ panitera_id: 12, panitera_nama: "Nuniek", username: "nuniek", fullname: "Nuniek", block: 1 }] });
    const r = await layananUji(blokir).susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, operator: "x" });
    expect(r).toMatchObject({ ok: false, alasan: "akun_sipp_pp_diblokir" });
    expect(r.pesan).toContain("Tidak ada yang diubah di SIPP");
  });

  it("baca ulang di dalam transaksi: kehadiran berubah tepat sebelum ditulis = batal tanpa tulisan", async () => {
    const t = tiruSipp();
    const L = layananUji(t);
    const r = await L.susunRencanaKehadiran({ jadwalId: 17850, dihadiriOleh: 2, operator: "x" });
    t.baris.dihadiriOleh = 4; // petugas lain mengubah di SIPP
    const n = t.tercatat.length;
    const h = await L.jalankanRencanaKehadiran(r, { kering: false });
    expect(h).toMatchObject({ ok: false, alasan: "jadwal_berubah_sebelum_ditulis" });
    expect(t.tercatat.slice(n).some((k) => /UPDATE|INSERT/.test(k.sql))).toBe(false);
  });

  it("bot: rute kehadiran-sidang terdaftar bertoken dan memakai penjaga jam kerja", () => {
    const teks = readFileSync(path.join(AKAR, "aleta_bot/routes/jadwalSidangRoutes.js"), "utf8");
    expect(teks).toMatch(/router\.get\("\/kehadiran-sidang", wajibToken/);
    expect(teks).toMatch(/"\/kehadiran-sidang",\s*\n\s*wajibToken, manualJamKerja\("kehadiran-sidang"/);
  });
});

// ---------------------------------------------------------------------------
// Penekan = PP perkara
// ---------------------------------------------------------------------------
describe("penekan harus PP perkara", () => {
  const pp = { username: "qadariyah", namaLengkap: "Qadariyah, S.H." };
  it("akun SIPP tertaut sama = boleh; tertaut ke akun lain = tidak walau nama mirip; tanpa tautan = nama", () => {
    expect(penekanAdalahPp({ nama: "Siapa Saja", akunSippMilik: ["Qadariyah"] }, pp)).toMatchObject({ boleh: true, dasar: "akun-sipp" });
    expect(penekanAdalahPp({ nama: "Qadariyah", akunSippMilik: ["andini"] }, pp).boleh).toBe(false);
    expect(penekanAdalahPp({ nama: "QADARIYAH, S.H.", akunSippMilik: [] }, pp)).toMatchObject({ boleh: true, dasar: "nama" });
    // Keputusan pengguna 30 Okt malam: Super Admin boleh menekan (baris SIPP tetap atas akun PP perkara).
    expect(penekanAdalahPp({ nama: "Dian Saputra", akunSippMilik: [], superAdmin: true }, pp)).toMatchObject({ boleh: true, dasar: "super-admin" });
    expect(penekanAdalahPp({ nama: "Dian Saputra", akunSippMilik: [], superAdmin: false }, pp).boleh).toBe(false);
    // Tanpa PP berakun SIPP aktif: Super Admin pun tidak.
    expect(penekanAdalahPp({ nama: "Derry", akunSippMilik: [], superAdmin: true }, null).boleh).toBe(false);
    expect(penekanAdalahPp({ nama: "Qadariyah", akunSippMilik: [] }, null).boleh).toBe(false);
  });

  it("aksi sidang.kehadiran-sipp untuk golongan PP", () => {
    expect(AKSI["sidang.kehadiran-sipp"].golongan).toEqual(["pp"]);
  });
});

describe("rute portal kehadiran-sidang", () => {
  let db: AletaDatabase | null = null;
  let aktor: string | null = "usr-ppg";
  let kiriman: Array<{ url: string; badan: any }> = [];
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.doMock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
    vi.doMock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
    kiriman = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const badan = init?.body ? JSON.parse(String(init.body)) : null;
      kiriman.push({ url: String(url), badan });
      const jawab = badan && badan.kering === false
        ? { ok: true, kering: false, kalimat: "sidang ke-1 2025-11-06: kehadiran Semua Pihak menjadi Penggugat Saja" }
        : { ok: true, kering: true, atasNama: { username: "taufik.pp", namaLengkap: "Muhammad Taufik" } };
      return new Response(JSON.stringify(jawab), { status: 200, headers: { "content-type": "application/json" } });
    });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/server/db/client");
    vi.doUnmock("@/server/shared/auth");
    vi.resetModules();
    await db?.close();
    db = null;
  });
  const minta = (badan: unknown) =>
    new NextRequest("http://localhost/api/aleta-ecourt/kehadiran-sidang", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

  async function tautkan(userId: string, username: string) {
    const kini = new Date().toISOString();
    await db!.prepare("DELETE FROM external_app_credentials WHERE user_id = ? AND app_id = 'sipp'").run(userId);
    await db!
      .prepare("INSERT INTO external_app_credentials (id, user_id, app_id, external_username, is_enabled, last_verified_status, created_at, updated_at) VALUES (?, ?, 'sipp', ?, 1, 'success', ?, ?)")
      .run(`eac-k-${userId}`, userId, username, kini, kini);
  }

  it("Admin (bukan Super Admin) yang bukan PP perkara: 403 sesudah rencana kering, TIDAK ada permintaan tulis", async () => {
    aktor = "usr-admin";
    const r = (await import("@/app/api/aleta-ecourt/kehadiran-sidang/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    const j = await r.POST(minta({ jadwalId: "17850", dihadiriOleh: 2, sebelum: 1, sebab: "verstek" }));
    expect(j.status).toBe(403);
    expect(kiriman.map((k) => k.badan.kering)).toEqual([true]);
  });

  it("PP perkara (akun SIPP tertaut = akun PP): rencana kering lalu tulis", async () => {
    aktor = "usr-ppg";
    await tautkan("usr-ppg", "taufik.pp");
    const r = (await import("@/app/api/aleta-ecourt/kehadiran-sidang/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    const j = await r.POST(minta({ jadwalId: "17850", dihadiriOleh: 2, sebelum: 1, sebab: "verstek" }));
    expect(j.status).toBe(200);
    expect(kiriman.map((k) => k.badan.kering)).toEqual([true, false]);
    expect(kiriman[1].url).toContain("/jadwal-sidang/kehadiran-sidang");
    expect(kiriman[1].badan).toMatchObject({ jadwalId: "17850", dihadiriOleh: 2, sebelum: 1, sebab: "verstek", operator: "usr-ppg", operatorAkunSipp: "taufik.pp" });
  });

  it("Super Admin: boleh menekan; tulisan tetap atas akun PP perkara dari rencana bot, penekan = Super Admin di jejak", async () => {
    aktor = "usr-super";
    const r = (await import("@/app/api/aleta-ecourt/kehadiran-sidang/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    const j = await r.POST(minta({ jadwalId: "17850", dihadiriOleh: 2, sebelum: 1, sebab: "verstek" }));
    expect(j.status).toBe(200);
    expect(kiriman.map((k) => k.badan.kering)).toEqual([true, false]);
    // Portal tidak pernah mengirim akun SIPP untuk ditulis: akun PP diturunkan bot dari perkaranya; operator = penekan sebenarnya.
    expect(kiriman[1].badan).toMatchObject({ operator: "usr-super", jadwalId: "17850" });
    expect(kiriman[1].badan).not.toHaveProperty("atasNama");
    expect(kiriman[1].badan).not.toHaveProperty("username");
  });

  it("PP perkara tanpa akun SIPP aktif: ditolak dengan pesan jelas, juga bagi Super Admin, tanpa tulisan", async () => {
    aktor = "usr-super";
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const badan = init?.body ? JSON.parse(String(init.body)) : null;
      kiriman.push({ url: String(url), badan });
      return new Response(JSON.stringify({ ok: false, alasan: "akun_sipp_pp_diblokir", pesan: "Akun SIPP panitera pengganti perkara ini diblokir. Tidak ada yang diubah di SIPP." }), { status: 400, headers: { "content-type": "application/json" } });
    });
    const r = (await import("@/app/api/aleta-ecourt/kehadiran-sidang/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    const j = await r.POST(minta({ jadwalId: "17850", dihadiriOleh: 2 }));
    const isi = (await j.json()) as any;
    expect(isi.data).toMatchObject({ ok: false });
    expect(String(isi.data.alasan || isi.error?.message || "")).toContain("diblokir");
    expect(kiriman.map((k) => k.badan.kering)).toEqual([true]);
  });

  it("PP lain (akun SIPP tertaut ke akun lain): 403", async () => {
    aktor = "usr-ppg";
    await tautkan("usr-ppg", "andini");
    const r = (await import("@/app/api/aleta-ecourt/kehadiran-sidang/route")) as unknown as Record<string, (q: NextRequest) => Promise<Response>>;
    expect((await r.POST(minta({ jadwalId: "17850", dihadiriOleh: 2 }))).status).toBe(403);
    expect(kiriman).toHaveLength(1);
  });
});
