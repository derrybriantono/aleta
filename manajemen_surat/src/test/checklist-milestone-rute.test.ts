// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";

/**
 * ============================================================================
 * GET /api/aleta-ecourt/checklist - KONTRAK YANG DIBACA WIDGET
 * ============================================================================
 *
 * Handler GET sungguhan atas pg-mem berbenih; jembatan SIPP (pemetaan
 * jabatan) dan gerbang bot (fakta checklist) ditiru. Yang dijaga:
 *
 *   - tanpa sesi: 401, seperti rute ekstensi lain
 *   - bentuk jawabannya PERSIS kontrak (kunci atas, ringkas, butir)
 *   - peran ganda: ketua yang juga hakim SIPP mendapat keduanya
 *   - ?peran= memilih; peran yang tidak dimiliki TIDAK dibuka
 *   - singgahan 60 detik per pengguna dan per peran
 *   - id pejabat yang dikirim ke bot berasal dari pemetaan jabatan (akun
 *     berkredensial milik pengguna, bukan yang diblokir), tidak dari nama
 *   - antrean penetapan dan konseptor sementara ikut dibaca dari ALETA
 */

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: vi.fn() }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return { ...modul, getGatewayChecklistMilestone: vi.fn() };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-ketua";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { callAletaBotSippBridge } = await import("@/server/modules/aleta-sipp/aleta-sipp-datasource");
const { getGatewayChecklistMilestone } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
const { kosongkanSinggahChecklist } = await import("@/server/modules/aleta-ecourt/checklist-milestone");
const jembatan = vi.mocked(callAletaBotSippBridge);
const gerbang = vi.mocked(getGatewayChecklistMilestone);

const akun = (username: string, pejabatId: string, ubah: Partial<{ diblokir: boolean }> = {}) => ({
  username,
  namaLengkap: username,
  grup: "",
  pejabatId,
  kode: "",
  nama: username,
  nip: "",
  diblokir: ubah.diblokir ?? false,
  kedaluwarsa: false,
  aktif: !(ubah.diblokir ?? false),
  terakhirMasuk: "2026-09-01T00:00:00.000Z",
});

const PEMETAAN = {
  hakim: [akun("ketuasipp", "26"), akun("hakimlama", "29", { diblokir: true })],
  panitera: [akun("ppsipp", "28")],
  jurusita: [akun("jssipp", "22")],
};

// Kamis 10 September 2026, 10:00 WITA.
const KINI = new Date("2026-09-10T02:00:00.000Z");

function faktaUntuk(peran: string): Record<string, unknown> {
  if (peran === "ketua") {
    return {
      pmh: [{ perkaraId: "561", nomorPerkara: "561/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-09-10", tanggalPmh: "", diinputPmh: "" }],
      berjalan: [],
      sidang: [],
      sidangPanggilan: [],
      ikrar: [],
      aktaHariIni: [],
      "penjaga:akta-cerai-gugat": [],
      "penjaga:akta-cerai-talak": [],
    };
  }
  if (peran === "hakim") {
    return {
      sidang: [],
      putusan: [],
      berjalan: [],
      mediasi: [],
      ikrar: [],
      perkaraTertentu: [
        { perkaraId: "700", nomorPerkara: "700/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalPutusan: "", diinputPutusan: "", sidangMendatang: [{ tanggal: "2026-09-14", agenda: "Musyawarah Majelis" }], jabatanSaya: 2 },
        { perkaraId: "701", nomorPerkara: "701/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalPutusan: "", diinputPutusan: "", sidangMendatang: [], jabatanSaya: 1 },
      ],
      ecourtDokumen: { segar: { terakhirBerhasil: "", terakhirDicoba: "", jadwalAktif: false, jarakJam: 2, jamMulai: 7, jamSelesai: 17 }, dokumen: [] },
    };
  }
  return {};
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-ketua";
  kosongkanSinggahChecklist();
  jembatan.mockReset();
  jembatan.mockResolvedValue({ ok: true, data: PEMETAAN, bridge: {} } as never);
  gerbang.mockReset();
  gerbang.mockImplementation(async (m) => ({
    ok: true,
    data: { acuan: m.acuan, peran: m.peran, fakta: faktaUntuk(m.peran), gagal: {} },
  }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(KINI);
});

afterEach(async () => {
  vi.useRealTimers();
  await db?.close();
  db = null;
});

const d = () => db as AletaDatabase;

async function kredensial(userId: string, username: string, keadaan: string = KEADAAN_KREDENSIAL.SAH, aktif = 1) {
  const waktu = new Date().toISOString();
  await d()
    .prepare(
      `INSERT INTO external_app_credentials (
        id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
        is_enabled, last_verified_status, created_at, updated_at
      ) VALUES (?, ?, 'sipp', ?, 'enc:v1:x:y:z', '', ?, ?, ?, ?)`
    )
    .run(`eac-${userId}-${username}`, userId, username, aktif, keadaan, waktu, waktu);
}

const kunciPeran = (data: Record<string, unknown>) => (data.peranTersedia as Array<{ kunci: string }>).map((p) => p.kunci);
const galatTeks = (data: Record<string, unknown>) => (data.galat as string[]).join(" ");

async function panggil(peran = "") {
  const { GET } = await import("@/app/api/aleta-ecourt/checklist/route");
  const url = `http://localhost/api/aleta-ecourt/checklist${peran ? `?peran=${encodeURIComponent(peran)}` : ""}`;
  const jawaban = await GET(new NextRequest(url));
  return { status: jawaban.status, isi: (await jawaban.json()) as { ok: boolean; data: Record<string, unknown>; error?: unknown } };
}

describe("GET /api/aleta-ecourt/checklist", () => {
  it("tanpa sesi: 401 dan tidak menyentuh SIPP", async () => {
    aktor = null;
    const r = await panggil();
    expect(r.status).toBe(401);
    expect(r.isi.ok).toBe(false);
    expect(jembatan).not.toHaveBeenCalled();
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("bentuk jawaban persis kontrak", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    const r = await panggil();
    expect(r.status).toBe(200);
    expect(r.isi.ok).toBe(true);
    const data = r.isi.data;
    expect(Object.keys(data).sort()).toEqual(
      ["butir", "dibuat", "galat", "jenisTidakTersedia", "pengguna", "peranAktif", "peranTersedia", "ringkas"].sort()
    );
    expect(Object.keys(data.pengguna as object).sort()).toEqual(["nama", "peran"]);
    expect(Object.keys(data.ringkas as object).sort()).toEqual(["hariIni", "lewat", "mingguIni", "selesaiHariIni", "totalHariIni"].sort());
    expect(new Date(String(data.dibuat)).toISOString()).toBe(data.dibuat);
    for (const p of data.peranTersedia as Array<Record<string, unknown>>) expect(Object.keys(p).sort()).toEqual(["kunci", "label"]);
    const butir = data.butir as Array<Record<string, unknown>>;
    expect(butir.length).toBeGreaterThan(0);
    for (const b of butir) {
      expect(Object.keys(b).sort()).toEqual(["id", "jenis", "judul", "kelompok", "kerjakan", "keterangan", "perkara", "tenggat"]);
      expect(["lewat", "hari-ini", "minggu-ini"]).toContain(b.kelompok);
      expect(["abt", "sipp", "aleta", "ecourt"]).toContain((b.kerjakan as { tujuan: string }).tujuan);
    }
    for (const t of data.jenisTidakTersedia as Array<Record<string, unknown>>) expect(Object.keys(t).sort()).toEqual(["jenis", "sebab"]);
    expect(Array.isArray(data.galat)).toBe(true);

    const pmh = butir.find((b) => b.jenis === "ketua.pmh-hari-ini");
    expect(pmh).toMatchObject({
      judul: "Tetapkan majelis (PMH) perkara yang baru masuk",
      perkara: { id: "561", nomor: "561/Pdt.G/2026/PA.Dgl" },
      kelompok: "hari-ini",
      tenggat: "2026-09-10T15:59:59.000Z",
      kerjakan: { tujuan: "sipp", halaman: "perkara" },
    });
  });

  it("peran ganda: ketua yang juga hakim SIPP; bawaannya jabatan utama, ?peran= memilih yang lain", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    const r = await panggil();
    const data = r.isi.data;
    expect((data.peranTersedia as Array<{ kunci: string }>).map((p) => p.kunci)).toEqual(["hakim", "ketua"]);
    expect((data.pengguna as { peran: string[] }).peran).toEqual(["hakim", "ketua"]);
    expect(data.peranAktif).toBe("ketua");
    expect(gerbang.mock.calls[0][0]).toMatchObject({ peran: "ketua", acuan: "2026-09-10", hakim: [] });

    const h = await panggil("hakim");
    expect(h.isi.data.peranAktif).toBe("hakim");
    const ke = gerbang.mock.calls[1][0];
    // Id pejabat dari pemetaan - akun hakim yang diblokir (29) tidak ikut.
    expect(ke).toMatchObject({ peran: "hakim", hakim: ["26"], panitera: [], jurusita: [] });
  });

  it("peran yang tidak dimiliki tidak dibuka: jatuh ke bawaan dan disebut di galat", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    const r = await panggil("jurusita");
    expect(r.status).toBe(200);
    expect(r.isi.data.peranAktif).toBe("ketua");
    expect((r.isi.data.galat as string[])[0]).toMatch(/"jurusita" tidak tersedia/);
    expect(gerbang.mock.calls.every(([m]) => m.peran !== "jurusita")).toBe(true);
  });

  it("singgahan 60 detik per pengguna dan per peran", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    await panggil();
    await panggil();
    expect(gerbang).toHaveBeenCalledTimes(1);
    expect(jembatan).toHaveBeenCalledTimes(1);

    await panggil("hakim");
    expect(gerbang).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(KINI.getTime() + 59_000));
    await panggil();
    expect(gerbang).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(KINI.getTime() + 61_000));
    await panggil();
    expect(gerbang).toHaveBeenCalledTimes(3);
    expect(jembatan).toHaveBeenCalledTimes(2);
  });

  it("kredensial yang menunjuk akun SIPP DIBLOKIR tidak menautkan pengguna ke perkara pejabat lama", async () => {
    // Satu pengguna hanya menyimpan satu kredensial SIPP (kunci user_id+app_id).
    // Bila itu akun lama yang sudah diblokir (hakim_id 29), perkara hakim 29
    // tidak boleh jatuh ke pengguna ini - uji mutan S05 lolos sebelum uji ini ada.
    aktor = "usr-hakim";
    await kredensial("usr-hakim", "hakimlama");
    const r = await panggil();
    expect(r.isi.data.peranAktif).toBe("hakim");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "hakim", hakim: [] });
    expect((r.isi.data.galat as string[]).join(" ")).toMatch(/belum tertaut ke akun SIPP hakim/);
  });

  it("kredensial NONAKTIF tidak menautkan (bukti pemeriksa T1); password terbukti salah tanpa pesaing tetap menautkan, dengan peringatan", async () => {
    aktor = "usr-jurusita";
    await kredensial("usr-jurusita", "ketuasipp", KEADAAN_KREDENSIAL.SANDI_SALAH, 0);
    const r = await panggil("hakim");
    expect(kunciPeran(r.isi.data)).not.toContain("hakim");
    expect(r.isi.data.peranAktif).toBe("jurusita");
    expect(gerbang.mock.calls.every(([m]) => (m.hakim ?? []).length === 0)).toBe(true);
    expect(galatTeks(r.isi.data)).toMatch(/"ketuasipp" dinonaktifkan di Manajemen Akun/);

    // Keputusan yang dicatat di laporan: "utamakan yang teruji", bukan "hanya
    // yang teruji" - password yang kini salah tetap menautkan bila tidak ada
    // akun lain yang mengaku username itu, dan pengguna diminta memperbaruinya.
    kosongkanSinggahChecklist();
    await d().prepare(`UPDATE external_app_credentials SET is_enabled = 1 WHERE user_id = 'usr-jurusita'`).run();
    const salah = await panggil("hakim");
    expect(salah.isi.data.peranAktif).toBe("hakim");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "hakim", hakim: ["26"] });
    expect(galatTeks(salah.isi.data)).toMatch(/"ketuasipp" tidak cocok lagi/);
  });

  it("username SIPP ganda: yang teruji menang dan keduanya diberi tahu; seri tidak menautkan siapa pun (bukti pemeriksa T2)", async () => {
    await kredensial("usr-ketua", "ketuasipp", KEADAAN_KREDENSIAL.SAH);
    await kredensial("usr-jurusita", "ketuasipp", KEADAAN_KREDENSIAL.BELUM_DIUJI);

    aktor = "usr-ketua";
    const k = await panggil("hakim");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "hakim", hakim: ["26"] });
    expect(galatTeks(k.isi.data)).toMatch(/"ketuasipp" juga tersimpan di 1 akun ALETA lain/);

    // Sebelumnya yang TERAKHIR menyimpan (dan belum teruji) mendapat perkara hakim 26.
    aktor = "usr-jurusita";
    const j = await panggil("hakim");
    expect(kunciPeran(j.isi.data)).not.toContain("hakim");
    expect(gerbang.mock.calls.filter(([m]) => m.peran === "hakim")).toHaveLength(1);
    expect(galatTeks(j.isi.data)).toMatch(/hasil uji password yang lebih kuat/);

    kosongkanSinggahChecklist();
    await d()
      .prepare(`UPDATE external_app_credentials SET last_verified_status = ? WHERE user_id = 'usr-ketua'`)
      .run(KEADAAN_KREDENSIAL.BELUM_DIUJI);
    aktor = "usr-ketua";
    const seri = await panggil("hakim");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "hakim", hakim: [] });
    expect(galatTeks(seri.isi.data)).toMatch(/tidak ditautkan ke siapa pun/);
  });

  it("beban: permintaan serentak yang sama dihitung SEKALI; fakta satker dibagi antarpengguna, jawabannya tetap per pengguna", async () => {
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((r) => (lepas = r));
    gerbang.mockImplementation(async (m) => {
      await tahan;
      return { ok: true, data: { acuan: m.acuan, peran: m.peran, fakta: faktaUntuk(m.peran), gagal: {} } };
    });
    const serentak = [panggil(), panggil(), panggil()];
    for (let i = 0; i < 200 && gerbang.mock.calls.length === 0; i += 1) await new Promise((r) => setTimeout(r, 10));
    // Beri waktu kedua permintaan lain sampai ke titik yang sama.
    await new Promise((r) => setTimeout(r, 100));
    lepas();
    const hasil = await Promise.all(serentak);
    expect(gerbang).toHaveBeenCalledTimes(1);
    expect(hasil.map((x) => x.isi.data.peranAktif)).toEqual(["ketua", "ketua", "ketua"]);

    // Wakil ketua membuka checklist ketua: faktanya sama persis -> tanpa pembacaan SIPP baru.
    aktor = "usr-wakil";
    const w = await panggil();
    expect(w.isi.data.peranAktif).toBe("ketua");
    expect(gerbang).toHaveBeenCalledTimes(1);
    expect((w.isi.data.pengguna as { nama: string }).nama).not.toBe((hasil[0].isi.data.pengguna as { nama: string }).nama);
  });

  it("titipan yang dikerjakan 00.00-08.00 WITA terhitung selesai HARI INI (awal hari WITA, bukan tengah malam UTC)", async () => {
    aktor = "usr-panitera";
    const tulis = (id: string, dikerjakan: string) =>
      d()
        .prepare(
          `INSERT INTO aleta_sipp_penunjukan_antrean
             (id, perkara_id, nomor_perkara, jenis, usulan, ringkasan, untuk_peran, keadaan, disiapkan_oleh, disiapkan_at, dikerjakan_at, catatan)
           VALUES (?, ?, ?, 'ppp', '{}', '', 'panitera', 'dikerjakan', 'usr-admin', '2026-09-09T01:00:00.000Z', ?, '')`
        )
        .run(`ant-${id}`, id, `${id}/Pdt.G/2026/PA.Dgl`, dikerjakan);
    await tulis("801", "2026-09-09T23:30:00.000Z"); // 10 Sep 07.30 WITA - hari ini
    await tulis("802", "2026-09-09T15:30:00.000Z"); // 9 Sep 23.30 WITA - kemarin
    const r = await panggil();
    expect(r.isi.data.peranAktif).toBe("panitera");
    expect((r.isi.data.ringkas as { selesaiHariIni: number }).selesaiHariIni).toBe(1);
  });

  it("hakim tanpa akun SIPP tertaut: jenis perkara-milik-sendiri tidak tersedia beserta sebabnya", async () => {
    aktor = "usr-hakim";
    const r = await panggil();
    const data = r.isi.data;
    expect(data.peranAktif).toBe("hakim");
    const tak = Object.fromEntries((data.jenisTidakTersedia as Array<{ jenis: string; sebab: string }>).map((x) => [x.jenis, x.sebab]));
    expect(tak["hakim.hasil-sidang-belum-dicatat"]).toMatch(/belum tertaut ke akun SIPP hakim/);
    expect((data.galat as string[]).join(" ")).toMatch(/Manajemen Akun/);
  });

  it("panitera pengganti dan juru sita dikenali dari jabatan ALETA dan pemetaan SIPP", async () => {
    aktor = "usr-ppg";
    await kredensial("usr-ppg", "ppsipp");
    const pp = await panggil();
    expect(pp.isi.data.peranAktif).toBe("panitera-pengganti");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "panitera-pengganti", panitera: ["28"] });

    aktor = "usr-jurusita";
    await kredensial("usr-jurusita", "jssipp");
    const js = await panggil();
    expect(js.isi.data.peranAktif).toBe("jurusita");
    expect(gerbang.mock.calls.at(-1)?.[0]).toMatchObject({ peran: "jurusita", jurusita: ["22"] });
  });

  it("jabatan persidangan dari pemetaan SIPP: Panitera yang juga duduk sebagai panitera pengganti mendapat keduanya", async () => {
    aktor = "usr-panitera";
    const tanpa = await panggil();
    expect((tanpa.isi.data.peranTersedia as Array<{ kunci: string }>).map((p) => p.kunci)).toEqual(["panitera"]);

    kosongkanSinggahChecklist();
    await kredensial("usr-panitera", "ppsipp");
    const dengan = await panggil();
    expect((dengan.isi.data.peranTersedia as Array<{ kunci: string }>).map((p) => p.kunci)).toEqual([
      "panitera-pengganti",
      "panitera",
    ]);
    expect(dengan.isi.data.peranAktif).toBe("panitera");
  });

  it("antrean PHS dan konseptor sementara dibaca dari ALETA dan diteruskan ke bot sebagai perkara tambahan", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    const waktu = "2026-09-10T01:00:00.000Z";
    await d()
      .prepare(
        `INSERT INTO aleta_sipp_penunjukan_antrean
           (id, perkara_id, nomor_perkara, jenis, usulan, ringkasan, untuk_peran, keadaan, disiapkan_oleh, disiapkan_at, catatan)
         VALUES ('ant-1', '701', '701/Pdt.G/2026/PA.Dgl', 'phs', '{}', '', 'hakim', 'menunggu', 'usr-admin', ?, '')`
      )
      .run(waktu);
    await d()
      .prepare(
        `INSERT INTO aleta_konseptor_sementara (perkara_id, nomor_perkara, nama, pengguna, catatan, ditetapkan_oleh, ditetapkan_at)
         VALUES ('700', '700/Pdt.G/2026/PA.Dgl', 'Drs. H. Malik', 'KETUASIPP', '', 'Panitera', ?)`
      )
      .run(waktu);
    await d()
      .prepare(
        `INSERT INTO aleta_konseptor_sementara (perkara_id, nomor_perkara, nama, pengguna, catatan, ditetapkan_oleh, ditetapkan_at)
         VALUES ('702', '702/Pdt.G/2026/PA.Dgl', 'Orang Lain', 'oranglain', '', 'Panitera', ?)`
      )
      .run(waktu);

    const r = await panggil("hakim");
    const ke = gerbang.mock.calls.at(-1)?.[0];
    expect([...(ke?.perkara ?? [])].sort()).toEqual(["700", "701"]);
    const butir = r.isi.data.butir as Array<{ jenis: string; perkara: { id: string } | null; kerjakan: unknown }>;
    expect(butir.filter((b) => b.jenis === "hakim.konsep-putusan").map((b) => b.perkara?.id)).toEqual(["700"]);
    expect(butir.filter((b) => b.jenis === "hakim.phs-menunggu").map((b) => b.perkara?.id)).toEqual(["701"]);
    expect(butir.find((b) => b.jenis === "hakim.konsep-putusan")?.kerjakan).toEqual({ tujuan: "abt", halaman: "blangko-putusan" });
  });

  it("bot mati: jawaban tetap 200, galat menyebut sebabnya, jenis SIPP tidak tersedia", async () => {
    await kredensial("usr-ketua", "ketuasipp");
    gerbang.mockResolvedValue({ ok: false, error: "aleta_bot tidak merespons dalam 60000ms" });
    const r = await panggil();
    expect(r.status).toBe(200);
    expect((r.isi.data.galat as string[]).join(" ")).toMatch(/tidak merespons/);
    const tak = (r.isi.data.jenisTidakTersedia as Array<{ jenis: string }>).map((x) => x.jenis);
    expect(tak).toContain("ketua.pmh-hari-ini");
    expect(r.isi.data.butir).toEqual([]);
  });
});
