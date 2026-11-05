// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * RUTE ALUR KERJA PER PERAN (TAHAP 6) DAN BERDAMPINGAN (TAHAP 7): HANYA SUPER ADMIN, DIJAGA DI SERVER (5 Nov 2026)
 * ============================================================================
 * Super Admin melewati banyak pemeriksaan hak, jadi yang diuji di sini adalah AKUN TIAP PERAN: semuanya selain Super Admin harus 403 di
 * SETIAP rute dan tindakan, dan layanan di baliknya tidak boleh tersentuh. "Lihat sebagai peran" hanyalah pilihan peran yang diperiksa;
 * tidak ada akun lain yang mendapat hak karenanya. Super Admin: tiap tindakan tercatat di audit TANPA isi naskah dan nama pihak.
 * Pemicu berdampingan dari jalur cetak-terakhir tidak ditunggu dan tidak pernah membuat cetak petugas gagal. Data rekaan.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as unknown,
  panggil: [] as string[],
  audit: [] as Array<{ action: string; entityId: string; entityType: string; payload: Record<string, unknown> }>,
  picu: [] as Array<Record<string, unknown>>,
  picuTahan: false,
  simpanCetak: 0,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ marker: "db" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401, name: "ApiError" });
    return keadaan.aktor;
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, e: { action: string; entityId: string; entityType: string; payload: Record<string, unknown> }) => {
    keadaan.audit.push({ action: e.action, entityId: e.entityId, entityType: e.entityType, payload: e.payload });
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));

const { catat } = vi.hoisted(() => ({
  catat: (nama: string, hasil: unknown) => async () => {
    keadaan.panggil.push(nama);
    return hasil;
  },
}));
vi.mock("@/server/modules/aleta-abt-siap/service", () => ({
  bacaDaftarSiap: async (_db: unknown, p: { peran: string; tanggal?: string }) => {
    keadaan.panggil.push(`siap:${p.peran}`);
    return { peran: p.peran, tanggal: p.tanggal ?? "2026-11-05", tersedia: true, keterangan: "", butir: [], jumlahBaris: 0, hakFolder: { berlaku: false, disetujui: false } };
  },
  periksaNaskahSiap: catat("periksa", { nama: "x.rtf", jumlahTerisi: 3, jumlahKosong: 1, periksaKembali: 2, pasti: 1, lolosCetak: false, mesinGalat: "", dapatDicetak: false }),
}));
vi.mock("@/server/modules/aleta-abt-alur/hak-folder", () => ({
  bacaSinkronTerakhir: async () => null,
  bacaKeadaanHakFolder: catat("hak-baca", { saklar: { ppPutusan: "mati", hakimBas: "mati" }, matriks: { jumlahFolder: 107, jumlahRagu: 23, sidik: "abc12345", baris: [], golongan: [], tanpaPadananAbt: [] }, persetujuan: { disetujui: false, sidik: "", oleh: "", pada: "" }, berlaku: false }),
  simpanPersetujuan: async (_db: unknown, _a: unknown, m: { setuju: boolean; sidik: string }) => {
    keadaan.panggil.push("hak-setuju");
    return { disetujui: m.setuju, sidik: m.setuju ? m.sidik : "", oleh: "Derry", pada: "2026-11-05T10:00:00.000Z" };
  },
}));
vi.mock("@/server/modules/aleta-abt-pustaka/service", () => ({
  mulaiSinkron: async () => {
    keadaan.panggil.push("hak-cocokkan");
    return { id: "s1", mulai: true };
  },
}));
vi.mock("@/server/modules/aleta-abt-selesai/service", () => ({
  daftarSelesaiPerkara: async (_db: unknown, perkaraId: string) => {
    keadaan.panggil.push(`selesai-daftar:${perkaraId}`);
    return [{ berkasNama: "[02] Kabul", jenis: "putusan", status: "sebagian", diubahAt: "2026-11-05T10:00:00.000Z", langkah: [] }];
  },
  bacaSaklarTulis: async () => ({ "edoc-sipp": false, ecourt: false, diubahOleh: "", diubahPada: "" }),
  bacaKeadaanSelesai: catat("selesai-baca", { keadaan: { langkah: {}, status: "menunggu" }, ada: false, jenis: "", diubahAt: "" }),
  simpanSaklarTulis: async (_db: unknown, _a: unknown, b: Record<string, unknown>) => {
    keadaan.panggil.push("selesai-saklar");
    return { "edoc-sipp": b["edoc-sipp"] === true, ecourt: b.ecourt === true, diubahOleh: "Derry", diubahPada: "t" };
  },
  jalankanSelesaikanBerkas: async (_db: unknown, _r: unknown, p: { ulangi: string[] }) => {
    keadaan.panggil.push(p.ulangi.length ? `selesai-ulangi:${p.ulangi.join(",")}` : "selesai-jalan");
    return { keadaan: { status: "sebagian", langkah: { "pdf-salinan": { status: "selesai" }, "garis-z-nomor": { status: "tidak-berlaku" }, "edoc-sipp": { status: "dimatikan" }, ecourt: { status: "dimatikan" }, "status-perkara": { status: "menunggu" } } }, saklar: { "edoc-sipp": false, ecourt: false } };
  },
}));
vi.mock("@/server/modules/aleta-abt-berdampingan/service", () => ({
  bacaRingkasanBerdampingan: catat("bd-baca", { ringkasan: { perJenis: [], mingguan: [], merahBelumDijawab: 0, total: 0, syaratCetak: 30, syaratHari: 14 }, beda: [], setelan: { aktif: false, diubahOleh: "", diubahPada: "" } }),
  simpanSetelanBerdampingan: async (_db: unknown, _a: unknown, aktif: boolean) => {
    keadaan.panggil.push(`bd-setelan:${aktif}`);
    return { aktif, diubahOleh: "Derry", diubahPada: "t" };
  },
  jawabBeda: async (_db: unknown, _a: unknown, id: string, jawaban: string) => {
    keadaan.panggil.push(`bd-jawab:${jawaban}`);
    return { id, jawaban };
  },
  picuBerdampingan: async (_db: unknown, m: Record<string, unknown>) => {
    keadaan.picu.push(m);
    if (keadaan.picuTahan) await new Promise(() => undefined);
    return "antre";
  },
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/cetak-terakhir", async () => {
  const asli = await vi.importActual<typeof import("@/server/modules/aleta-ecourt/cetak-terakhir")>("@/server/modules/aleta-ecourt/cetak-terakhir");
  return {
    ...asli,
    simpanCetakTerakhir: async () => {
      keadaan.simpanCetak += 1;
      return { disimpan: true, jumlah: 2, dicetakPada: "2026-11-05T10:00:00.000Z" };
    },
  };
});

import { GET as GET_BD, POST as POST_BD } from "@/app/api/aleta-abt/berdampingan/route";
import { GET as GET_HAK, POST as POST_HAK } from "@/app/api/aleta-abt/hak-folder/route";
import { GET as GET_SELESAI, POST as POST_SELESAI } from "@/app/api/aleta-abt/selesai/route";
import { GET as GET_SIAP, POST as POST_SIAP } from "@/app/api/aleta-abt/siap/route";
import { POST as POST_CETAK_TERAKHIR } from "@/app/api/aleta-ecourt/cetak-terakhir/route";
import type { UserPersona } from "@/lib/types";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return { id: "usr_uji", username: roleId, password: "", name: `Uji ${roleId}`, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
}

const SUPER = akun("super-admin");
const BUKAN_SUPER_ADMIN: Record<string, UserPersona> = {
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  wakil: akun("wakil-ketua", "pos-wakil"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  jurusita: akun("jurusita", "pos-jurusita"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  pranata: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("staf", "pos-staf-umum"),
  operator: akun("operator", "pos-ptsp"),
};

const b = (jalur: string, cari = "") => `http://localhost/api/aleta-abt/${jalur}${cari}`;
const get = (jalur: string, cari = "") => new NextRequest(b(jalur, cari));
const post = (jalur: string, badan: unknown) => new NextRequest(b(jalur), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

/** Semua permintaan yang harus ditolak untuk selain Super Admin, per rute dan tindakan. */
const PERMINTAAN: Array<[string, () => Promise<Response>]> = [
  ["siap GET hakim", () => GET_SIAP(get("siap", "?peran=hakim"))],
  ["siap GET panitera", () => GET_SIAP(get("siap", "?peran=panitera"))],
  ["siap POST periksa", () => POST_SIAP(post("siap", { tindakan: "periksa", berkasId: "b1", perkaraId: "1" }))],
  ["hak-folder GET", () => GET_HAK(get("hak-folder"))],
  ["hak-folder POST setuju", () => POST_HAK(post("hak-folder", { tindakan: "setuju", setuju: true, sidik: "abc12345" }))],
  ["hak-folder POST cabut", () => POST_HAK(post("hak-folder", { tindakan: "setuju", setuju: false, sidik: "" }))],
  ["hak-folder POST cocokkan", () => POST_HAK(post("hak-folder", { tindakan: "cocokkan" }))],
  ["selesai GET daftar perkara", () => GET_SELESAI(get("selesai", "?perkaraId=123&daftar=1"))],
  ["selesai GET", () => GET_SELESAI(get("selesai"))],
  ["selesai GET keadaan", () => GET_SELESAI(get("selesai", "?perkaraId=1&berkasId=b1"))],
  ["selesai POST jalankan", () => POST_SELESAI(post("selesai", { tindakan: "jalankan", perkaraId: "1", berkasId: "b1", jenis: "putusan" }))],
  ["selesai POST ulangi", () => POST_SELESAI(post("selesai", { tindakan: "ulangi", perkaraId: "1", berkasId: "b1", jenis: "putusan", langkah: ["edoc-sipp"] }))],
  ["selesai POST saklar", () => POST_SELESAI(post("selesai", { tindakan: "saklar", "edoc-sipp": true, ecourt: true }))],
  ["berdampingan GET", () => GET_BD(get("berdampingan"))],
  ["berdampingan POST setelan", () => POST_BD(post("berdampingan", { tindakan: "setelan", aktif: true }))],
  ["berdampingan POST jawab", () => POST_BD(post("berdampingan", { tindakan: "jawab", id: "bdp-1", jawaban: "dijelaskan" }))],
];

beforeEach(() => {
  keadaan.aktor = SUPER;
  keadaan.panggil = [];
  keadaan.audit = [];
  keadaan.picu = [];
  keadaan.picuTahan = false;
  keadaan.simpanCetak = 0;
});

describe("akun tiap peran selain Super Admin ditolak 403 di server, layanan tidak tersentuh", () => {
  for (const [nama, a] of Object.entries(BUKAN_SUPER_ADMIN)) {
    it(`${nama}: ${PERMINTAAN.length} permintaan semuanya 403`, async () => {
      keadaan.aktor = a;
      for (const [label, minta] of PERMINTAAN) {
        const r = await minta();
        expect(r.status, `${nama} -> ${label}`).toBe(403);
      }
      expect(keadaan.panggil, nama).toEqual([]);
      expect(keadaan.audit, nama).toEqual([]);
    });
  }
  it("tanpa akun masuk: 401, layanan tidak tersentuh", async () => {
    keadaan.aktor = null;
    for (const [label, minta] of PERMINTAAN) expect((await minta()).status, label).toBe(401);
    expect(keadaan.panggil).toEqual([]);
  });
  it("Super Admin yang dilihat lewat tampilan peran lain tetap diputuskan dari peran akunnya, bukan dari pilihan peran di layar", async () => {
    keadaan.aktor = BUKAN_SUPER_ADMIN.hakim;
    const r = await GET_SIAP(get("siap", "?peran=hakim&sebagai=super-admin"));
    expect(r.status).toBe(403);
    expect(keadaan.panggil).toEqual([]);
  });
});

describe("Super Admin: siap diperiksa", () => {
  it("peran dipilih di layar; peran tak dikenal 400; tercatat tanpa isi", async () => {
    for (const peran of ["hakim", "pp", "panitera", "jurusita"]) {
      const r = await GET_SIAP(get("siap", `?peran=${peran}&tanggal=2026-11-05`));
      expect(r.status, peran).toBe(200);
    }
    expect(keadaan.panggil).toEqual(["siap:hakim", "siap:pp", "siap:panitera", "siap:jurusita"]);
    expect((await GET_SIAP(get("siap", "?peran=admin"))).status).toBe(400);
    expect((await GET_SIAP(get("siap"))).status).toBe(400);
    expect(keadaan.audit.filter((a) => a.action === "ALETA_ABT_SIAP_BUKA")).toHaveLength(4);
    expect(keadaan.audit.every((a) => a.entityType === "aleta_abt_alur")).toBe(true);
  });
  it("periksa naskah: tercatat dengan angka saja", async () => {
    const r = await POST_SIAP(post("siap", { tindakan: "periksa", berkasId: "b1", perkaraId: "123" }));
    expect(r.status).toBe(200);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_SIAP_PERIKSA", entityId: "b1", payload: { perkaraId: "123", terisi: 3, kosong: 1, periksaKembali: 2, dapatDicetak: false } });
    expect((await POST_SIAP(post("siap", { tindakan: "lain" }))).status).toBe(400);
  });
});

describe("Super Admin: hak folder", () => {
  it("membaca matriks dan menyetujui; sidik disampaikan; tindakan dan jenis masukan diperiksa", async () => {
    expect((await GET_HAK(get("hak-folder"))).status).toBe(200);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_HAK_FOLDER_BUKA", payload: { folder: 107, ragu: 23, sidik: "abc12345", berlaku: false } });
    expect((await POST_HAK(post("hak-folder", { tindakan: "setuju", setuju: true, sidik: "abc12345" }))).status).toBe(200);
    expect(keadaan.audit.map((a) => a.action)).toContain("ALETA_ABT_HAK_FOLDER_SETUJU");
    expect((await POST_HAK(post("hak-folder", { tindakan: "setuju", setuju: false, sidik: "" }))).status).toBe(200);
    expect(keadaan.audit.map((a) => a.action)).toContain("ALETA_ABT_HAK_FOLDER_CABUT");
    expect((await POST_HAK(post("hak-folder", { tindakan: "setuju", setuju: "ya" }))).status).toBe(400);
    expect((await POST_HAK(post("hak-folder", { tindakan: "lain" }))).status).toBe(400);
  });
});

describe("Super Admin: mencocokkan ulang acuan dan daftar catatan per perkara", () => {
  it("cocokkan memakai sinkron pustaka yang sudah ada dan tercatat; daftar per perkara hanya menerima nomor perkara berupa angka", async () => {
    expect((await POST_HAK(post("hak-folder", { tindakan: "cocokkan" }))).status).toBe(200);
    expect(keadaan.panggil).toEqual(["hak-cocokkan"]);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_HAK_FOLDER_COCOKKAN", payload: { mulai: true } });
    keadaan.panggil = [];
    const r = await GET_SELESAI(get("selesai", "?perkaraId=123&daftar=1"));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { daftar: unknown[] } }).data.daftar).toHaveLength(1);
    expect(keadaan.panggil).toEqual(["selesai-daftar:123"]);
    expect((await GET_SELESAI(get("selesai", "?perkaraId=abc&daftar=1"))).status).toBe(400);
  });
});

describe("Super Admin: selesaikan berkas", () => {
  it("jalankan dan ulangi satu langkah; hasil dicatat per status langkah saja", async () => {
    const dasar = { perkaraId: "123", berkasId: "b1", jenis: "putusan", nomorPerkara: "1/Pdt.G/2026/PA.Uji" };
    expect((await POST_SELESAI(post("selesai", { tindakan: "jalankan", ...dasar }))).status).toBe(200);
    expect((await POST_SELESAI(post("selesai", { tindakan: "ulangi", ...dasar, langkah: ["ecourt"] }))).status).toBe(200);
    expect(keadaan.panggil).toEqual(["selesai-jalan", "selesai-ulangi:ecourt"]);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_SELESAI_JALANKAN", payload: { perkaraId: "123", status: "sebagian", langkah: { "edoc-sipp": "dimatikan", ecourt: "dimatikan" } } });
    expect(JSON.stringify(keadaan.audit)).not.toContain("1/Pdt.G/2026/PA.Uji");
  });
  it("masukan tak sah ditolak sebelum layanan: perkara, blangko, jenis, langkah", async () => {
    const ok = { perkaraId: "123", berkasId: "b1", jenis: "putusan" };
    for (const salah of [{ ...ok, perkaraId: "x" }, { ...ok, berkasId: "../b" }, { ...ok, jenis: "lain" }]) {
      expect((await POST_SELESAI(post("selesai", { tindakan: "jalankan", ...salah }))).status).toBe(400);
    }
    expect((await POST_SELESAI(post("selesai", { tindakan: "ulangi", ...ok, langkah: ["ngawur"] }))).status).toBe(400);
    expect((await POST_SELESAI(post("selesai", { tindakan: "ulangi", ...ok, langkah: [] }))).status).toBe(400);
    expect((await POST_SELESAI(post("selesai", { tindakan: "lain" }))).status).toBe(400);
    expect(keadaan.panggil).toEqual([]);
  });
  it("keadaan dibaca: saklar tulis ke luar mati bawaan; saklar hanya berubah oleh permintaan eksplisit dan tercatat", async () => {
    const r = await GET_SELESAI(get("selesai", "?perkaraId=123&berkasId=b1"));
    const j = (await r.json()) as { data: { saklar: Record<string, unknown>; langkah: Array<{ id: string; keLuar: boolean }> } };
    expect(j.data.saklar).toMatchObject({ "edoc-sipp": false, ecourt: false });
    expect(j.data.langkah.filter((l) => l.keLuar).map((l) => l.id)).toEqual(["edoc-sipp", "ecourt"]);
    expect(keadaan.panggil).toEqual(["selesai-baca"]);
    await POST_SELESAI(post("selesai", { tindakan: "saklar", "edoc-sipp": true }));
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_SELESAI_SAKLAR", payload: { edocSipp: true, ecourt: false } });
  });
  it("tidak ada rute yang menyalakan saklar tulis tanpa diminta: jalankan tidak mengubahnya", async () => {
    await POST_SELESAI(post("selesai", { tindakan: "jalankan", perkaraId: "1", berkasId: "b1", jenis: "putusan" }));
    expect(keadaan.panggil).not.toContain("selesai-saklar");
  });
});

describe("Super Admin: berdampingan", () => {
  it("ringkasan, saklar, dan jawaban beda merah; masukan diperiksa; semua tercatat", async () => {
    expect((await GET_BD(get("berdampingan"))).status).toBe(200);
    expect((await POST_BD(post("berdampingan", { tindakan: "setelan", aktif: true }))).status).toBe(200);
    expect((await POST_BD(post("berdampingan", { tindakan: "jawab", id: "bdp-1", jawaban: "sudah-dibetulkan" }))).status).toBe(200);
    expect(keadaan.panggil).toEqual(["bd-baca", "bd-setelan:true", "bd-jawab:sudah-dibetulkan"]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_BERDAMPINGAN_SETELAN", "ALETA_ABT_BERDAMPINGAN_JAWAB"]);
    expect((await POST_BD(post("berdampingan", { tindakan: "setelan", aktif: "ya" }))).status).toBe(400);
    expect((await POST_BD(post("berdampingan", { tindakan: "jawab", jawaban: "dijelaskan" }))).status).toBe(400);
    expect((await POST_BD(post("berdampingan", { tindakan: "lain" }))).status).toBe(400);
  });
});

describe("pemicu dari cetak ABT (jalur cetak-terakhir)", () => {
  const badan = { perkaraId: "123", nomorPerkara: "1/Pdt.G/2026/PA.Uji", berkas: "[02] Kabul.rtf", bagian: [{ h: "aabbccdd", t: "Bahwa sidang." }, { h: "11223344", t: "Mengadili:" }], sidangKe: 2 };
  const kirim = (b: unknown) => POST_CETAK_TERAKHIR(new NextRequest("http://localhost/api/aleta-ecourt/cetak-terakhir", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));

  it("petugas biasa mencetak: jawaban cetak tetap sama dan pemicu menerima ringkasan yang sudah dibersihkan", async () => {
    keadaan.aktor = BUKAN_SUPER_ADMIN.panitera; // kewenangan "blangko-abt" sudah dijaga pastikanKapabilitas; bukan Super Admin
    const r = await kirim(badan);
    const j = (await r.json()) as { data: { disimpan: boolean } };
    expect(r.status).toBe(200);
    expect(j.data.disimpan).toBe(true);
    await vi.waitFor(() => expect(keadaan.picu).toHaveLength(1));
    expect(keadaan.picu[0]).toMatchObject({ perkaraId: "123", berkas: "[02] Kabul.rtf", sidangKe: 2, bagian: [{ h: "aabbccdd" }, { h: "11223344" }] });
  });
  it("nomor sidang dibatasi 0-99 dan yang bukan angka menjadi 0", async () => {
    await kirim({ ...badan, sidangKe: 999 });
    await kirim({ ...badan, sidangKe: "abc" });
    await kirim({ ...badan, sidangKe: -4 });
    await vi.waitFor(() => expect(keadaan.picu).toHaveLength(3));
    expect(keadaan.picu.map((p) => p.sidangKe)).toEqual([99, 0, 0]);
  });
  it("TIDAK MEMPERLAMBAT: pemicu yang tidak pernah selesai tidak menahan jawaban cetak", async () => {
    keadaan.picuTahan = true;
    const r = await Promise.race([kirim(badan), new Promise<"lambat">((s) => setTimeout(() => s("lambat"), 1500))]);
    expect(r).not.toBe("lambat");
    expect((r as Response).status).toBe(200);
  });
  it("ringkasan kosong atau rusak: cetak tetap ditolak seperti semula oleh jalur lama, dan pemicu tidak dipanggil", async () => {
    const r = await kirim({ ...badan, bagian: [] });
    expect(r.status).toBe(200); // simpanCetakTerakhir (tiruan) menjawab; yang diuji: pemicu tidak dipanggil
    await new Promise((s) => setTimeout(s, 30));
    expect(keadaan.picu).toEqual([]);
  });
});
