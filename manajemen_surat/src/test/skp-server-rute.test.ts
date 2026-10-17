// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";
import { namaDariDisposition, susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import type { DataSkpJabatan, FaktaAkunSkp, KejadianSkp } from "@/lib/skp-jabatan-tipe";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanAksesEkstensi } from "@/server/modules/aleta-ecourt/akses";

import { bacaPdfUji, bacaZip } from "./eviden-skp-baca";

/**
 * ============================================================================
 * RUTE /api/skp/* - KEWENANGAN, ALAMAT, BERKAS, DAN RUTE EVIDEN LAMA
 * ============================================================================
 *
 * Handler sungguhan atas pg-mem berbenih dengan pemeriksa kewenangan dan
 * Identitas Instansi sungguhan. Yang ditiru hanya bot (fakta SKP jabatan dan
 * eviden hakim). Dikunci:
 *
 *   - sesi (401) lebih dahulu dari alamat; hak lihat (403) lebih dahulu dari bot
 *   - alamat salah 400 dengan kalimat yang menyebut ruasnya
 *   - PDF/ZIP jabatan perkara dan SKP Pimpinan; periode bulanan; audit
 *   - pemetaan, target, isian, penetapan lewat HTTP
 *   - rute eviden hakim LAMA: tanpa ?jenis= tetap menolak yang bukan hakim/bulanan
 *     dan hanya ?jenis= selain hakim yang diserahkan ke penangan SKP
 */

vi.mock("@/server/modules/aleta-ecourt/eviden-skp-data", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-ecourt/eviden-skp-data")>();
  return { ...modul, ambilDataSkpJabatan: vi.fn(), ambilDataEvidenSkpPeriode: vi.fn(), ambilDataEvidenSkp: vi.fn() };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-rina";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { ambilDataSkpJabatan, ambilDataEvidenSkpPeriode, ambilDataEvidenSkp } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
const bot = vi.mocked(ambilDataSkpJabatan);
const botHakim = vi.mocked(ambilDataEvidenSkpPeriode);
const botHakimLama = vi.mocked(ambilDataEvidenSkp);

const kej = (tanggal: string, nilai: number): KejadianSkp => ({
  perkaraId: null,
  nomorPerkara: null,
  tanggal,
  tanggalAcuan: null,
  nilai,
  keterangan: "Panjar",
});

function dataKasir(): DataSkpJabatan {
  const akun: FaktaAkunSkp = {
    username: "kasir1",
    userIdSipp: "22",
    nama: "Kasir Uji",
    grup: [702],
    jabatanDugaan: "kasir",
    aktif: true,
    fakta: [{ kunci: "ks-penerimaan-kuantitas", terbaca: true, kejadian: [kej("2026-08-10", 100_000), kej("2026-08-20", 250_000)], galat: null }],
  };
  return {
    ok: true,
    periode: susunPeriodeSkpJabatan("b08", 2026),
    jabatan: "kasir",
    akun: [akun],
    catatan: [],
    galat: [],
    dihitungPada: "2026-10-05T02:00:00.000Z",
  };
}

const dataKetua = (): DataSkpJabatan => ({
  ...dataKasir(),
  jabatan: "ketua",
  akun: [
    {
      username: "ketua",
      userIdSipp: "85",
      nama: "Ketua",
      grup: [10],
      jabatanDugaan: "ketua",
      aktif: true,
      fakta: [{ kunci: "pmh-kuantitas", terbaca: true, kejadian: [{ ...kej("2026-08-10", 0), nilai: null, tanggalAcuan: "2026-08-10" }], galat: null }],
    },
  ],
});

const dataHakim = (periode = "b08"): DataEvidenSkp => ({
  ok: true,
  peran: "hakim",
  periode: susunPeriodeSkpJabatan(periode as "b08", 2026),
  orang: { id: "85", nama: "Drs. H. Malik", nip: "197505052001121002", jabatan: "Hakim Madya Pratama", pangkatGolongan: "Pembina / IV.a" },
  ketua: { nama: "Drs. H. Malik", nip: "197505052001121002", jabatan: "Ketua Pengadilan Agama Donggala", sumber: "uji" },
  aturanPeriode: "Aturan periode uji.",
  baris: [],
  catatan: [],
  galat: [],
  dihitungPada: "2026-10-05T02:00:00.000Z",
});

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
}, 120_000);

afterAll(async () => {
  await db?.close();
  db = null;
});

async function profil(userId: string, idProfil: string, atasan: string | null) {
  const u = await db!.queryOne<{ name: string }>("SELECT name FROM users WHERE id = ?", [userId]);
  await db!.run(
    `INSERT INTO employee_profiles (id, user_id, nip, full_name, rank_grade, is_active, supervisor_employee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Penata / III.c', 1, ?, '2026-01-01', '2026-01-01')`,
    [idProfil, userId, `nip-${userId}`, u!.name, atasan]
  );
}

beforeEach(async () => {
  await db!.run("UPDATE employee_profiles SET supervisor_employee_id = NULL");
  for (const t of ["aleta_skp_akun_pegawai", "aleta_skp_target", "aleta_skp_isian", "aleta_skp_penetapan", "employee_profiles", "external_app_credentials"]) {
    await db!.run(`DELETE FROM ${t}`);
  }
  await db!.run("DELETE FROM audit_logs");
  await db!.run("DELETE FROM ecourt_extension_access");
  await db!.run("DELETE FROM ecourt_extension_access_user");
  aktor = "usr-rina";
  bot.mockReset();
  botHakim.mockReset();
  botHakimLama.mockReset();
  bot.mockResolvedValue({ ok: true, data: dataKasir() });
  botHakim.mockResolvedValue({ ok: true, data: dataHakim() });
  // Ketua <- Panitera <- Panmud Gugatan <- Rina; Ketua <- Hakim.
  await profil("usr-ketua", "pf-ketua", null);
  await profil("usr-panitera", "pf-panitera", "pf-ketua");
  await profil("usr-gugatan", "pf-gugatan", "pf-panitera");
  await profil("usr-rina", "pf-rina", "pf-gugatan");
  await profil("usr-hakim", "pf-hakim", "pf-ketua");
  await db!.run(
    `INSERT INTO aleta_skp_akun_pegawai (id, username_sipp, user_id_sipp, user_id, jabatan_utama, berlaku_dari, dibuat_pada, diperbarui_pada)
     VALUES ('pm1', 'kasir1', '22', 'usr-rina', 'kasir', '2026-01-01', '2026-01-01', '2026-01-01')`
  );
});

const URL_DASAR = "http://localhost/api/skp";

async function panggil(jalur: string, kueri = "", metode = "GET", isi?: unknown) {
  const modul = await import(`@/app/api/skp/${jalur}/route`);
  const request = new NextRequest(`${URL_DASAR}/${jalur}${kueri ? `?${kueri}` : ""}`, {
    method: metode,
    ...(isi === undefined ? {} : { body: typeof isi === "string" ? isi : JSON.stringify(isi), headers: { "content-type": "application/json" } }),
  });
  return (modul as Record<string, (r: NextRequest) => Promise<Response>>)[metode](request);
}

async function json(jawaban: Response) {
  const isi = (await jawaban.json()) as { ok: boolean; data?: Record<string, any>; error?: { message?: string } };
  return { status: jawaban.status, ok: isi.ok, data: isi.data ?? {}, pesan: isi.error?.message ?? "" };
}

const BERKAS = "pegawai=usr-rina&jenis=kasir&tahun=2026&periode=b08";

describe("unduhan: sesi, alamat, dan hak lihat", () => {
  it("tanpa sesi: 401 - bentuk alamat tidak dibocorkan, bot tidak diminta", async () => {
    aktor = null;
    const r = await json(await panggil("unduh", "jenis=exe&tahun=abc"));
    expect(r.status).toBe(401);
    expect(bot).not.toHaveBeenCalled();
  });

  it("alamat salah: 400 dengan kalimat yang menyebut ruasnya, bot tidak diminta", async () => {
    const kasus: Array<[string, RegExp]> = [
      ["jenis=tukang&pegawai=usr-rina&tahun=2026&periode=b08&dokumen=semua&format=pdf", /Jenis SKP/],
      ["jenis=kasir&tahun=2026&periode=b08&dokumen=semua&format=pdf", /Pegawai/],
      [`${BERKAS}&dokumen=semua&format=exe`, /Format/],
      [`pegawai=usr-rina&jenis=kasir&tahun=26&periode=b08&dokumen=semua&format=pdf`, /Tahun/],
      [`pegawai=usr-rina&jenis=kasir&tahun=2026&periode=b13&dokumen=semua&format=pdf`, /Periode/],
      [`${BERKAS}&dokumen=../x&format=pdf`, /Dokumen/],
      [`${BERKAS}&dokumen=semua&format=pdf&tanggal=2026-02-30`, /Tanggal tanda tangan/],
    ];
    for (const [kueri, pesan] of kasus) {
      const r = await json(await panggil("unduh", kueri));
      expect(r.status, kueri).toBe(400);
      expect(r.pesan).toMatch(pesan);
    }
    expect(bot).not.toHaveBeenCalled();
  });

  it("bukan pemilik/atasan/pimpinan: 403 SEBELUM bot dibaca; atasan langsung, Ketua, Wakil, Panitera, Admin boleh", async () => {
    aktor = "usr-hakim";
    const ditolak = await json(await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf`));
    expect(ditolak.status).toBe(403);
    expect(ditolak.pesan).toMatch(/tidak berhak/);
    expect(bot).not.toHaveBeenCalled();
    for (const id of ["usr-gugatan", "usr-ketua", "usr-wakil", "usr-panitera", "usr-admin", "usr-super", "usr-rina"]) {
      aktor = id;
      const r = await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf`);
      expect(r.status, id).toBe(200);
    }
  });

  it("periode yang belum dimulai ditolak 400 dengan kalimat yang sama dengan rute lain", async () => {
    const tahunDepan = new Date().getUTCFullYear() + 1;
    const r = await json(await panggil("unduh", `pegawai=usr-rina&jenis=kasir&tahun=${tahunDepan}&periode=b01&dokumen=semua&format=pdf`));
    expect(r.status).toBe(400);
    expect(r.pesan).toMatch(/belum dimulai/);
  });

  it("bot gagal: status dan kalimatnya diteruskan (angka '—' tidak diunduh diam-diam)", async () => {
    bot.mockResolvedValue({ ok: false, status: 503, alasan: "ALETA Bot belum dapat dihubungi." });
    const r = await json(await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf`));
    expect(r).toMatchObject({ status: 503, ok: false, pesan: "ALETA Bot belum dapat dihubungi." });
  });
});

describe("unduhan SKP jabatan perkara", () => {
  it("PDF Lembar SKP: berkas sah, nama ber-filename*, isi memuat pejabat penilai dan realisasi dari SIPP; bot diminta dengan akun dan jabatan", async () => {
    const jawaban = await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf&tanggal=2026-09-30`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe("application/pdf");
    expect(jawaban.headers.get("content-disposition")).toMatch(/^attachment; filename="[^"]+"; filename\*=UTF-8''/);
    expect(jawaban.headers.get("x-content-type-options")).toBe("nosniff");
    expect(jawaban.headers.get("cache-control")).toContain("no-store");
    const isi = Buffer.from(await jawaban.arrayBuffer());
    expect(isi.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bot).toHaveBeenCalledWith({ tahun: 2026, periode: "b08", jabatan: "kasir", username: ["kasir1"] });
    const teks = (await bacaPdfUji(isi)).map((h) => h.teks).join("\n");
    expect(teks).toContain("Pejabat Penilai Kinerja");
    expect(teks).toContain("USULAN ALETA");
    expect(teks).toMatch(/350\.000/);
  }, 60_000);

  it("semua (Excel): ZIP berisi Lembar SKP dan satu bukti dukung per RHK; unduhan tercatat di audit", async () => {
    const jawaban = await panggil("unduh", `${BERKAS}&dokumen=semua&format=xlsx&tanggal=2026-09-30`);
    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-type")).toBe("application/zip");
    const nama = namaDariDisposition(jawaban.headers.get("content-disposition"));
    expect(nama).toMatch(/\.zip$/);
    const isi = bacaZip(Buffer.from(await jawaban.arrayBuffer()));
    const berkas = [...isi.keys()].filter((k) => k.endsWith(".xlsx"));
    // Lembar + 3 bukti dukung (kasir: penerimaan, biaya, pendaftaran).
    expect(berkas.length).toBe(4);

    const baris = await db!
      .prepare("SELECT actor_user_id, entity_type, entity_id, payload_json FROM audit_logs WHERE action = 'SKP_UNDUH'")
      .all<{ actor_user_id: string; entity_type: string; entity_id: string; payload_json: string }>();
    expect(baris.length).toBe(1);
    expect(baris[0]).toMatchObject({ actor_user_id: "usr-rina", entity_type: "skp", entity_id: "kasir:usr-rina" });
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({
      jenis: "kasir",
      pemilik: "usr-rina",
      alasanHak: "sendiri",
      tahun: 2026,
      periode: "b08",
      dokumen: "semua",
      format: "xlsx",
      tanggalTandaTangan: "2026-09-30",
    });
  }, 60_000);

  it("unduhan yang ditolak tidak tercatat sebagai unduhan", async () => {
    aktor = "usr-hakim";
    await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf`);
    const baris = await db!.prepare("SELECT id FROM audit_logs WHERE action = 'SKP_UNDUH'").all();
    expect(baris.length).toBe(0);
  });

  it("dokumen tak dikenal: 404", async () => {
    const r = await json(await panggil("unduh", `${BERKAS}&dokumen=tidak-ada&format=pdf`));
    expect(r.status).toBe(404);
  });
});

describe("SKP Pimpinan (Ketua/Wakil) dan SKP Hakim bulanan", () => {
  const PIMPINAN = "jenis=pimpinan&id=85&pegawai=usr-ketua&tahun=2026&periode=b08&dokumen=semua&format=docx";

  beforeEach(async () => {
    bot.mockResolvedValue({ ok: true, data: dataKetua() });
    await db!.run(
      `INSERT INTO aleta_skp_akun_pegawai (id, username_sipp, user_id_sipp, user_id, jabatan_utama, berlaku_dari, dibuat_pada, diperbarui_pada)
       VALUES ('pm2', 'ketua', '85', 'usr-ketua', 'ketua', '2026-01-01', '2026-01-01', '2026-01-01')`
    );
  });

  it("Ketua sendiri: ZIP memuat Lembar SKP Pimpinan, dokumen hakim, dan bukti RHK pimpinan; eviden hakim bulanan diminta", async () => {
    aktor = "usr-ketua";
    const jawaban = await panggil("unduh", PIMPINAN);
    expect(jawaban.status).toBe(200);
    const isi = bacaZip(Buffer.from(await jawaban.arrayBuffer()));
    const docx = [...isi.keys()].filter((k) => k.endsWith(".docx"));
    expect(docx.length).toBeGreaterThanOrEqual(3);
    expect(docx.some((n) => /Lembar SKP/i.test(n))).toBe(true);
    expect(botHakim).toHaveBeenCalledWith({ peran: "hakim", id: "85", tahun: 2026, periode: "b08" });
    expect(bot).toHaveBeenCalledWith(expect.objectContaining({ jabatan: "ketua", username: ["ketua"] }) as never);
  }, 90_000);

  it("tanpa ?pegawai= berarti dirinya; Wakil lihat Ketua; pegawai biasa 403; yang bukan Ketua/Wakil 400", async () => {
    aktor = "usr-ketua";
    const tanpa = await panggil("unduh", "jenis=pimpinan&id=85&tahun=2026&periode=b08&dokumen=lembar-skp&format=pdf");
    expect(tanpa.status).toBe(200);
    aktor = "usr-wakil";
    expect((await panggil("unduh", PIMPINAN.replace("docx", "pdf").replace("semua", "lembar-skp"))).status).toBe(200);
    aktor = "usr-rina";
    expect((await json(await panggil("unduh", PIMPINAN))).status).toBe(403);
    aktor = "usr-super";
    const bukanKetua = await json(await panggil("unduh", PIMPINAN.replace("usr-ketua", "usr-rina")));
    expect(bukanKetua).toMatchObject({ status: 400 });
    expect(bukanKetua.pesan).toMatch(/Ketua dan Wakil Ketua/);
  }, 90_000);

  it("kemampuan 'panel' dimatikan bagi peran Ketua: 403, data tidak diminta", async () => {
    await simpanAksesEkstensi(db!, { actorUserId: "usr-super", roleId: "ketua", kapabilitas: "panel", aktif: false });
    aktor = "usr-ketua";
    const r = await json(await panggil("unduh", PIMPINAN));
    expect(r.status).toBe(403);
    expect(r.pesan).toMatch(/tidak diberi akses/);
    expect(bot).not.toHaveBeenCalled();
    expect(botHakim).not.toHaveBeenCalled();
  });

  it("SKP Hakim bulanan lewat rute baru: kemampuan panel, audit EVIDEN_SKP_UNDUH", async () => {
    aktor = "usr-hakim";
    const jawaban = await panggil("unduh", "jenis=hakim&id=26&tahun=2026&periode=b08&dokumen=rekap-perkara&format=pdf");
    expect(jawaban.status).toBe(200);
    expect(botHakim).toHaveBeenCalledWith({ peran: "hakim", id: "26", tahun: 2026, periode: "b08" });
    const baris = await db!.prepare("SELECT entity_id, payload_json FROM audit_logs WHERE action = 'EVIDEN_SKP_UNDUH'").all<{ entity_id: string; payload_json: string }>();
    expect(baris.length).toBe(1);
    expect(baris[0].entity_id).toBe("hakim:26");
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ jenis: "hakim", periode: "b08" });
  }, 60_000);

  it("rute eviden hakim LAMA: ?jenis=pimpinan diserahkan ke penangan SKP, tanpa ?jenis= perilaku lama (bulanan ditolak)", async () => {
    aktor = "usr-ketua";
    const { GET } = await import("@/app/api/aleta-ecourt/eviden-skp/unduh/route");
    const pimpinan = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/eviden-skp/unduh?${PIMPINAN.replace("docx", "pdf").replace("semua", "lembar-skp")}`));
    expect(pimpinan.status).toBe(200);
    expect(pimpinan.headers.get("content-type")).toBe("application/pdf");

    const lama = await GET(new NextRequest("http://localhost/api/aleta-ecourt/eviden-skp/unduh?peran=hakim&id=26&tahun=2026&periode=b08&dokumen=semua&format=pdf"));
    expect(lama.status).toBe(400);
    expect(((await lama.json()) as { error: { message: string } }).error.message).toMatch(/Periode harus tw1/);
    expect(botHakimLama).not.toHaveBeenCalled();

    const { GET: DAFTAR } = await import("@/app/api/aleta-ecourt/eviden-skp/route");
    const daftar = await json(await DAFTAR(new NextRequest(`http://localhost/api/aleta-ecourt/eviden-skp?jenis=pimpinan&id=85&pegawai=usr-ketua&tahun=2026&periode=b08`)));
    expect(daftar.status).toBe(200);
    expect(daftar.data.jenis).toBe("pimpinan");
    expect(daftar.data.dokumen.map((d: { kunci: string }) => d.kunci)[0]).toBe("lembar-skp");
  }, 90_000);
});

describe("daftar dokumen, lembar, dan daftar pegawai", () => {
  it("daftar: dokumen jabatan beserta ketersediaan; catatan petugas terpisah", async () => {
    const r = await json(await panggil("daftar", BERKAS));
    expect(r.status).toBe(200);
    expect(r.data.jenis).toBe("kasir");
    expect(r.data.dokumen[0]).toMatchObject({ kunci: "lembar-skp", tersedia: true });
    expect(r.data.dokumen.length).toBe(4);
    expect(Array.isArray(r.data.catatanOperator)).toBe(true);
    expect(r.data.dariPenetapan).toBe(false);
    aktor = "usr-hakim";
    expect((await json(await panggil("daftar", BERKAS))).status).toBe(403);
  }, 60_000);

  it("lembar: realisasi dari SIPP dan hak; bot mati tidak menggagalkan layar", async () => {
    const r = await json(await panggil("lembar", BERKAS));
    expect(r.status).toBe(200);
    expect(r.data.hak).toMatchObject({ alasan: "sendiri", bolehUbahIsian: true, bolehUbahTarget: false, bolehTinjau: false });
    expect(r.data.sippTerjangkau).toBe(true);
    const ind = r.data.lembar.rhk.flatMap((x: { indikator: Array<{ kunci: string; realisasi: number | null }> }) => x.indikator).find((i: { kunci: string }) => i.kunci === "ks-penerimaan-kuantitas");
    expect(ind.realisasi).toBe(350_000);
    expect(r.data.akun).toEqual([{ username: "kasir1", tersirat: false, jendela: [{ dari: "2026-01-01", sampai: null }] }]);

    bot.mockResolvedValue({ ok: false, status: 503, alasan: "ALETA Bot belum dapat dihubungi." });
    const mati = await json(await panggil("lembar", BERKAS));
    expect(mati.status).toBe(200);
    expect(mati.data.sippTerjangkau).toBe(false);
    expect(mati.data.catatanOperator).toContain("ALETA Bot belum dapat dihubungi.");

    aktor = "usr-gugatan";
    expect((await json(await panggil("lembar", BERKAS))).data.hak).toMatchObject({ alasan: "atasan-langsung", bolehTinjau: true });
    aktor = "usr-hakim";
    expect((await json(await panggil("lembar", BERKAS))).status).toBe(403);
    aktor = "usr-rina";
    expect((await json(await panggil("lembar", "jenis=hakim&tahun=2026&periode=b08"))).status).toBe(400);
  }, 60_000);

  it("pegawai: saya, bawahan, semua (hanya pimpinan/Panitera/Admin)", async () => {
    const saya = await json(await panggil("pegawai"));
    expect(saya.data.pegawai.map((p: { userId: string }) => p.userId)).toEqual(["usr-rina"]);
    expect(saya.data.pegawai[0]).toMatchObject({ jabatanUtama: "kasir", alasanHak: "sendiri", bolehUbahIsian: true });

    aktor = "usr-gugatan";
    const bawahan = await json(await panggil("pegawai", "lingkup=bawahan"));
    expect(bawahan.data.pegawai.map((p: { userId: string }) => p.userId)).toEqual(["usr-rina"]);
    expect((await json(await panggil("pegawai", "lingkup=semua"))).status).toBe(403);

    for (const id of ["usr-ketua", "usr-wakil", "usr-panitera", "usr-admin", "usr-super"]) {
      aktor = id;
      const semua = await json(await panggil("pegawai", "lingkup=semua"));
      expect(semua.status, id).toBe(200);
      expect(semua.data.pegawai.length).toBeGreaterThan(5);
    }
    aktor = "usr-wakil";
    expect((await json(await panggil("pegawai", "lingkup=semua"))).data.aktor).toMatchObject({ peran: "wakil-ketua", bolehUbahTarget: false });
  });
});

describe("pemetaan, target, isian, dan penetapan lewat HTTP", () => {
  it("pemetaan: GET hanya pimpinan/Panitera/Admin; PUT hanya yang berwenang; JSON rusak 400", async () => {
    aktor = "usr-hakim";
    expect((await json(await panggil("pemetaan"))).status).toBe(403);
    aktor = "usr-wakil";
    const lihat = await json(await panggil("pemetaan"));
    expect(lihat.status).toBe(200);
    expect(lihat.data.bolehUbah).toBe(false);
    expect(lihat.data.pemetaan.length).toBe(1);
    const tolak = await json(await panggil("pemetaan", "", "PUT", { usernameSipp: "meja3", userId: "usr-rina", jabatanUtama: "petugas-meja", berlakuDari: "2026-01-01" }));
    expect(tolak.status).toBe(403);

    aktor = "usr-panitera";
    const simpan = await json(await panggil("pemetaan", "", "PUT", { usernameSipp: "meja3", userId: "usr-hakim", jabatanUtama: "petugas-meja", jabatanTambahan: ["operator"], berlakuDari: "2026-01-01" }));
    expect(simpan.status).toBe(200);
    expect(simpan.data.pemetaan).toMatchObject({ usernameSipp: "meja3", jabatanUtama: "petugas-meja", jabatanTambahan: ["operator"] });
    expect((await json(await panggil("pemetaan", "", "PUT", "{rusak"))).status).toBe(400);
    expect((await json(await panggil("pemetaan", "", "PUT", []))).status).toBe(400);
  });

  it("target: GET semua peran masuk; PUT Panitera/Ketua/Admin; Wakil 403", async () => {
    const { SKP_JABATAN_2026 } = await import("@/lib/skp-jabatan-katalog");
    const rhk = SKP_JABATAN_2026.kasir[0];
    const butir = [{ jabatan: "kasir", tahun: 2026, kunciRhk: rhk.kunci, kunciIndikator: rhk.indikator[1].kunci, targetNilai: 95, targetTeks: "95%", status: "disahkan" }];
    aktor = "usr-wakil";
    expect((await json(await panggil("target", "", "PUT", { butir }))).status).toBe(403);
    aktor = "usr-ketua";
    const simpan = await json(await panggil("target", "", "PUT", { butir }));
    expect(simpan.status).toBe(200);
    aktor = "usr-rina";
    const baca = await json(await panggil("target", "tahun=2026&jabatan=kasir"));
    expect(baca.data.bolehUbah).toBe(false);
    expect(baca.data.target[0]).toMatchObject({ targetNilai: 95, status: "disahkan" });
    expect((await json(await panggil("target", "tahun=2026&jabatan=tukang"))).status).toBe(400);
    expect((await json(await panggil("target", "tahun=abc"))).status).toBe(400);
    aktor = "usr-super";
    expect((await json(await panggil("target", "", "PUT", {}))).status).toBe(400);
  });

  it("isian: Rina menyimpan dan mengajukan, atasan menyetujui, rekan tidak melihat", async () => {
    const { SKP_JABATAN_2026 } = await import("@/lib/skp-jabatan-katalog");
    const rhk = SKP_JABATAN_2026.kasir.find((r) => r.indikator.some((i) => i.aturan.jenis === "isian"))!;
    const ind = rhk.indikator.find((i) => i.aturan.jenis === "isian")!;
    const isi = {
      periode: "b08",
      tahun: 2026,
      kunciRhk: rhk.kunci,
      kunciIndikator: ind.kunci,
      nilai: 88,
      bukti: [{ judul: "Laporan Agustus", rujukan: "berkas-1", tanggal: "2026-09-02" }],
    };
    const simpan = await json(await panggil("isian", "", "PUT", isi));
    expect(simpan.status).toBe(200);
    const id = simpan.data.isian.id as string;
    expect((await json(await panggil("isian", "", "POST", { aksi: "ajukan", id }))).data.isian.status).toBe("diajukan");

    aktor = "usr-hakim";
    expect((await json(await panggil("isian", "pegawai=usr-rina&tahun=2026"))).status).toBe(403);
    expect((await json(await panggil("isian", "", "POST", { aksi: "setujui", id }))).status).toBe(403);
    aktor = "usr-gugatan";
    const lihat = await json(await panggil("isian", "pegawai=usr-rina&tahun=2026&periode=b08"));
    expect(lihat.data).toMatchObject({ bolehUbahIsian: false, bolehTinjau: true });
    expect(lihat.data.isian.length).toBe(1);
    expect((await json(await panggil("isian", "", "POST", { aksi: "setujui", id }))).data.isian).toMatchObject({ status: "disetujui", ditinjauOlehId: "usr-gugatan" });
    expect((await json(await panggil("isian", "", "POST", { aksi: "ngawur", id }))).status).toBe(400);
    expect((await json(await panggil("isian", "", "POST", { aksi: "setujui" }))).status).toBe(400);
    // Atasan tidak mengisi atas nama pegawainya.
    expect((await json(await panggil("isian", "", "PUT", { ...isi, pegawai: "usr-rina" }))).status).toBe(403);
  });

  it("penetapan: atasan mengunci, lembar terkunci dipakai walau bot mati, tidak dapat dikunci dua kali", async () => {
    const isi = { pegawai: "usr-rina", jenis: "kasir", tahun: 2026, periode: "b08" };
    aktor = "usr-rina";
    expect((await json(await panggil("penetapan", "", "POST", isi))).status).toBe(403);
    aktor = "usr-wakil";
    expect((await json(await panggil("penetapan", "", "POST", { ...isi, kunci: true }))).status).toBe(403);

    aktor = "usr-gugatan";
    const draf = await json(await panggil("penetapan", "", "POST", isi));
    expect(draf.status).toBe(200);
    expect(draf.data.penetapan.status).toBe("draf");
    const kunci = await json(await panggil("penetapan", "", "POST", { ...isi, kunci: true }));
    expect(kunci.data.penetapan).toMatchObject({ status: "terkunci", dikunciOlehId: "usr-gugatan" });
    expect(kunci.data.lembar.jenis).toBe("kasir");
    expect((await json(await panggil("penetapan", "", "POST", { ...isi, kunci: true }))).status).toBe(409);

    bot.mockReset();
    bot.mockResolvedValue({ ok: false, status: 503, alasan: "mati" });
    aktor = "usr-rina";
    const lembar = await json(await panggil("lembar", BERKAS));
    expect(lembar.data).toMatchObject({ dariPenetapan: true, sippTerjangkau: true });
    expect(lembar.data.penetapan.status).toBe("terkunci");
    const unduh = await panggil("unduh", `${BERKAS}&dokumen=lembar-skp&format=pdf`);
    expect(unduh.status).toBe(200);
    expect(bot).not.toHaveBeenCalled();

    const baca = await json(await panggil("penetapan", BERKAS));
    expect(baca.data.penetapan.status).toBe("terkunci");
    expect(baca.data.lembar.jenis).toBe("kasir");
    aktor = "usr-hakim";
    expect((await json(await panggil("penetapan", BERKAS))).status).toBe(403);
  }, 90_000);

  it("penetapan: bot gagal menggagalkan penetapan (angka '—' tidak boleh terkunci)", async () => {
    bot.mockResolvedValue({ ok: false, status: 502, alasan: "SIPP tidak dapat dibaca." });
    aktor = "usr-gugatan";
    const r = await json(await panggil("penetapan", "", "POST", { pegawai: "usr-rina", jenis: "kasir", tahun: 2026, periode: "b08", kunci: true }));
    expect(r).toMatchObject({ status: 502, pesan: "SIPP tidak dapat dibaca." });
    const baris = await db!.prepare("SELECT id FROM aleta_skp_penetapan").all();
    expect(baris.length).toBe(0);
  });
});
