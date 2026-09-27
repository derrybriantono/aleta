// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataEvidenSkp } from "@/lib/eviden-skp-tipe";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanAksesEkstensi } from "@/server/modules/aleta-ecourt/akses";

/**
 * ============================================================================
 * GET /api/aleta-ecourt/eviden-skp - KEWENANGAN, ALAMAT, DAN BENTUK JAWABAN
 * ============================================================================
 *
 * Handler sungguhan atas pg-mem berbenih, dengan pemeriksa kewenangan yang
 * SUNGGUHAN (kemampuan panel, sama dengan rekap-petugas). Yang ditiru hanya
 * gerbang bot. Yang dijaga:
 *
 *   - tanpa sesi 401, panel mati 403 - bot tidak dipanggil, dan kewenangan
 *     diperiksa sebelum alamat;
 *   - alamat yang salah 400 beserta kalimatnya, bot tidak dipanggil;
 *   - jawaban berbentuk { periode, orang, ketua, dokumen[kunci, judul,
 *     judulLengkap, tersedia, sebabTidakTersedia, jumlahBaris], galat } -
 *     kontrak menu unduhan;
 *   - kegagalan bot diteruskan dengan KODE dan kalimatnya: kalimat bot yang
 *     SESUNGGUHNYA (dibaca dari evidenSkpService) dipetakan ke kodenya.
 */

vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return { ...modul, getGatewayEvidenSkp: vi.fn() };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { getGatewayEvidenSkp } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
const gerbang = vi.mocked(getGatewayEvidenSkp);

function dataBot(over: Partial<DataEvidenSkp> = {}): DataEvidenSkp {
  return {
    ok: true,
    peran: "hakim",
    periode: {
      kunci: "tw2",
      tahun: 2026,
      label: "Triwulan II",
      labelPanjang: "Triwulan II Tahun 2026",
      mulai: "2026-04-01",
      selesai: "2026-06-30",
      bulan: 3,
    },
    orang: { id: "31", nama: "Hakim Contoh, S.H.", nip: "199401022017121003", jabatan: "Hakim", pangkatGolongan: null },
    ketua: { nama: "Ketua Contoh", nip: "198208312007041001", jabatan: "Ketua Pengadilan Agama Contoh", sumber: "uji" },
    aturanPeriode: "Aturan uji.",
    baris: [
      {
        perkaraId: "1",
        nomorPerkara: "1/Pdt.G/2026/PA.Ctt",
        jenisPerkara: "Cerai Gugat",
        jenisPerkaraId: 347,
        alurPerkaraId: 15,
        tanggalDaftar: "2026-04-02",
        hubungan: ["hakim-anggota"],
        pihak: { satu: { sebutan: "Penggugat", nama: ["A"] }, dua: { sebutan: "Tergugat", nama: ["B"] }, turut: null },
        majelis: [{ kedudukan: "Hakim Anggota 1", nama: "Hakim Contoh", hakimId: "31" }],
        majelisIkrar: [],
        panitera: [],
        jurusita: [],
        musyawarah: null,
        tanggalPutusan: "2026-05-02",
        statusPutusan: "Dikabulkan",
        verstek: false,
        tanggalMinutasi: "2026-05-02",
        tanggalBht: null,
        mediasi: null,
        ikrar: null,
        banding: null,
        kasasi: null,
        pk: null,
        sidangKeliling: false,
        itsbatTerpadu: false,
        ghaib: false,
        prodeo: true,
        ecourt: true,
        unggahPutusan: { ada: true, tanggal: "2026-05-02" },
        anonimisasi: { ada: true, tanggal: "2026-05-02" },
        direktori: { url: null, tanggal: null },
      },
    ],
    catatan: [],
    catatanOperator: ["NIP Ketua di konfigurasi SIPP (KetuaPNNIP) hanya 17 angka - uji."],
    galat: ["Relaas elektronik (e-Summons)"],
    dihitungPada: "2026-09-27T02:00:00.000Z",
    ...over,
  };
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
  gerbang.mockReset();
  gerbang.mockImplementation(async () => ({ ok: true, data: dataBot() }));
});

afterEach(async () => {
  await db?.close();
  db = null;
  vi.unstubAllGlobals();
});

async function panggil(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/eviden-skp/route");
  const jawaban = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/eviden-skp${kueri}`));
  return {
    status: jawaban.status,
    isi: (await jawaban.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message?: string } },
  };
}

const SAH = "?peran=hakim&id=31&tahun=2026&periode=tw2";

describe("kewenangan - kemampuan panel", () => {
  it("tanpa sesi: 401, bot tidak dipanggil", async () => {
    aktor = null;
    const r = await panggil(SAH);
    expect(r.status).toBe(401);
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("panel dimatikan untuk perannya: 403, bot tidak dipanggil", async () => {
    await simpanAksesEkstensi(db!, { actorUserId: "usr-super", roleId: "hakim", kapabilitas: "panel", aktif: false });
    const r = await panggil(SAH);
    expect(r.status).toBe(403);
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("kewenangan lebih dahulu: tanpa sesi dan alamat salah tetap 401", async () => {
    aktor = null;
    expect((await panggil("?peran=ketua&id=abc")).status).toBe(401);
  });
});

describe("alamat yang salah ditolak 400 tanpa memanggil bot", () => {
  const kasus: Array<[string, RegExp]> = [
    ["", /Peran/],
    ["?peran=panitera&id=31&tahun=2026&periode=tw2", /hanya hakim/],
    ["?peran=hakim&tahun=2026&periode=tw2", /ID SIPP/],
    ["?peran=hakim&id=31abc&tahun=2026&periode=tw2", /ID SIPP/],
    ["?peran=hakim&id=0&tahun=2026&periode=tw2", /ID SIPP/],
    ["?peran=hakim&id=31&periode=tw2", /Tahun/],
    ["?peran=hakim&id=31&tahun=20266&periode=tw2", /Tahun/],
    ["?peran=hakim&id=31&tahun=2026", /Periode/],
    ["?peran=hakim&id=31&tahun=2026&periode=semester1", /Periode/],
    ["?peran=hakim&id=31&tahun=2099&periode=tw1", /belum dimulai/],
  ];
  for (const [kueri, pesan] of kasus) {
    it(`"${kueri || "(kosong)"}" -> 400`, async () => {
      const r = await panggil(kueri);
      expect(r.status).toBe(400);
      expect(r.isi.error?.message).toMatch(pesan);
      expect(gerbang).not.toHaveBeenCalled();
    });
  }
});

describe("alamat yang sah", () => {
  it("diteruskan ke bot sebagai ID BILANGAN dalam teks, tahun bilangan", async () => {
    const r = await panggil("?peran=Hakim&id=31&tahun=2026&periode=TW2");
    expect(r.status).toBe(200);
    expect(gerbang).toHaveBeenCalledTimes(1);
    expect(gerbang.mock.calls[0][0]).toEqual({ peran: "hakim", id: "31", tahun: 2026, periode: "tw2" });
  });

  it("bentuk jawaban = kontrak menu unduhan", async () => {
    const r = await panggil(SAH);
    const data = r.isi.data as {
      periode: { labelPanjang: string };
      orang: { nama: string };
      ketua: { nama: string };
      dokumen: Array<Record<string, unknown>>;
      galat: string[];
    };
    expect(Object.keys(data).sort()).toEqual(["catatanOperator", "dokumen", "galat", "ketua", "orang", "periode"]);
    expect(data.periode.labelPanjang).toBe("Triwulan II Tahun 2026");
    expect(data.orang.nama).toBe("Hakim Contoh, S.H.");
    expect(data.ketua.nama).toBe("Ketua Contoh");
    expect(data.galat).toEqual(["Relaas elektronik (e-Summons)"]);
    // Catatan petugas untuk MENU - tidak ikut dokumen yang ditandatangani.
    expect((data as unknown as { catatanOperator: string[] }).catatanOperator).toEqual([
      "NIP Ketua di konfigurasi SIPP (KetuaPNNIP) hanya 17 angka - uji.",
    ]);
    expect(data.dokumen).toHaveLength(17);
    for (const d of data.dokumen) {
      expect(Object.keys(d).sort()).toEqual(["judul", "judulLengkap", "jumlahBaris", "kunci", "sebabTidakTersedia", "tersedia"]);
    }
    const perKunci = Object.fromEntries(data.dokumen.map((d) => [d.kunci as string, d]));
    expect(perKunci["status-perkara"]).toEqual({
      kunci: "status-perkara",
      judul: "STATUS PERKARA",
      judulLengkap: "Status Perkara Triwulan II Tahun 2026",
      tersedia: true,
      sebabTidakTersedia: null,
      jumlahBaris: 1,
    });
    expect(perKunci["rekap-prodeo"].jumlahBaris).toBe(1);
    expect(perKunci["rekap-mediasi"].jumlahBaris).toBe(0);
    expect(perKunci["laporan-posbakum"]).toMatchObject({ tersedia: false, jumlahBaris: 0 });
    expect(String(perKunci["laporan-posbakum"].sebabTidakTersedia)).toMatch(/Pos Bantuan Hukum/);
  });
});

// ---- kalimat bot yang SESUNGGUHNYA ------------------------------------------------
//
// Kode kegagalan dibaca dari kalimat bot (gatewayFetch tidak membawa kode
// HTTP). Kalimat itu diambil dari evidenSkpService sendiri, bukan disalin ke
// sini - bila bot mengubah kalimatnya, uji ini patah bersama pemetaannya.
const requireBot = createRequire(path.resolve(__dirname, "../../../aleta_bot/services/evidenSkpService.js"));
const layananBot = requireBot("./evidenSkpService.js") as {
  periksaMasukan: (m: Record<string, string>, hariIni: string) => { ok: boolean; status?: number; error?: string };
  kalimatGagalInti: (bagian: string[]) => string;
};

describe("kegagalan bot diteruskan dengan kode dan kalimatnya", () => {
  const kalimatBot = (m: Record<string, string>) => {
    const hasil = layananBot.periksaMasukan({ peran: "hakim", id: "31", tahun: "2026", periode: "tw2", ...m }, "2026-09-27");
    expect(hasil.ok).toBe(false);
    return String(hasil.error);
  };

  it("kalimat bot untuk SIPP yang tidak terbaca tidak membawa galat MySQL mentah", () => {
    const pesan = layananBot.kalimatGagalInti(["penunjukan majelis hakim", "putusan"]);
    expect(pesan).toMatch(/penunjukan majelis hakim, putusan/);
    expect(pesan).toMatch(/log ALETA Bot/);
    expect(pesan).not.toMatch(/ER_|errno|SELECT|FROM /);
  });

  const kasus: Array<[string, string, number]> = [
    ["hakim tidak dikenal", "Tidak ada hakim dengan ID SIPP 999.", 404],
    ["SIPP tidak terbaca (kalimat bot sungguhan)", layananBot.kalimatGagalInti(["penunjukan majelis hakim"]), 502],
    ["bot mati", "aleta_bot tidak dapat dihubungi (koneksi ditolak). Pastikan layanan aleta_bot berjalan.", 503],
    ["bot lambat", "aleta_bot tidak merespons dalam 60000ms. Periksa status layanan.", 504],
    ["rute belum ada di bot lama", "aleta_bot menjawab dengan halaman 404, bukan data pada /internal/aleta-bot/sipp/eviden-skp.", 502],
  ];
  for (const [nama, pesan, kode] of kasus) {
    it(`${nama}: ${kode}`, async () => {
      gerbang.mockResolvedValueOnce({ ok: false, error: pesan });
      const r = await panggil(SAH);
      expect(r.status).toBe(kode);
      expect(r.isi.error?.message).toContain(pesan.slice(0, 30));
    });
  }

  it("penolakan masukan oleh bot (kalimat bot sungguhan): 400", async () => {
    const ubahan: Array<Record<string, string>> = [
      { peran: "panitera" },
      { id: "31abc" },
      { tahun: "20266" },
      { periode: "tw9" },
      { periode: "tw4" },
    ];
    for (const m of ubahan) {
      const pesan = kalimatBot(m);
      gerbang.mockResolvedValueOnce({ ok: false, error: pesan });
      const r = await panggil(SAH);
      expect(r.status, pesan).toBe(400);
    }
  });

  it("bot versi lama yang menjawab bentuk lain: 502, bukan dokumen kosong", async () => {
    gerbang.mockResolvedValueOnce({ ok: true, data: { ok: true, rekap: {} } as unknown as DataEvidenSkp });
    const r = await panggil(SAH);
    expect(r.status).toBe(502);
    expect(r.isi.error?.message).toMatch(/bukan data eviden SKP/);
  });
});

describe("ambilDataEvidenSkp - pintu kedua", () => {
  it("masukan yang salah tidak diteruskan ke bot", async () => {
    const { ambilDataEvidenSkp } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
    for (const p of [
      { peran: "panitera", id: "31", tahun: 2026, periode: "tw2" },
      { peran: "hakim", id: "abc", tahun: 2026, periode: "tw2" },
      { peran: "hakim", id: "31", tahun: 26, periode: "tw2" },
      { peran: "hakim", id: "31", tahun: 2026, periode: "q2" },
    ]) {
      const hasil = await ambilDataEvidenSkp(p as never);
      expect(hasil.ok).toBe(false);
      if (!hasil.ok) expect(hasil.status).toBe(400);
    }
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("jawaban bot yang sah diteruskan utuh", async () => {
    const { ambilDataEvidenSkp } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
    const hasil = await ambilDataEvidenSkp({ peran: "hakim", id: "31", tahun: 2026, periode: "tw2" });
    expect(hasil).toEqual({ ok: true, data: dataBot() });
  });
});

describe("gerbang ke bot", () => {
  it("memanggil /internal/aleta-bot/sipp/eviden-skp dengan token, TIDAK pernah bot sungguhan", async () => {
    const asli = await vi.importActual<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>(
      "@/server/modules/aleta-bot/whatsapp-gateway-client"
    );
    const lama = { url: process.env.ALETA_BOT_BASE_URL, token: process.env.ALETA_BOT_INTERNAL_API_TOKEN };
    process.env.ALETA_BOT_BASE_URL = "http://bot-tiruan.invalid:9";
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-tiruan";
    const tangkap: Array<{ url: string; token: string | null }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        tangkap.push({ url, token: new Headers(init.headers).get("x-aleta-internal-token") });
        return new Response(JSON.stringify(dataBot()), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
    try {
      const hasil = await asli.getGatewayEvidenSkp({ peran: "hakim", id: "31", tahun: 2026, periode: "tahun" });
      expect(hasil.ok).toBe(true);
      expect(tangkap).toEqual([
        { url: "http://bot-tiruan.invalid:9/internal/aleta-bot/sipp/eviden-skp?peran=hakim&id=31&tahun=2026&periode=tahun", token: "token-tiruan" },
      ]);
    } finally {
      process.env.ALETA_BOT_BASE_URL = lama.url;
      process.env.ALETA_BOT_INTERNAL_API_TOKEN = lama.token;
      if (lama.url === undefined) delete process.env.ALETA_BOT_BASE_URL;
      if (lama.token === undefined) delete process.env.ALETA_BOT_INTERNAL_API_TOKEN;
    }
  });
});
