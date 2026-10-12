/**
 * ============================================================================
 * PANGGIL SAKSI DARI JADWAL SIDANG (12 Okt 2026, butir 4)
 * ============================================================================
 *
 * "Tambahkan panggilan saksi persidangan di jadwal sidang (dengan cara di klik
 * nama saksinya, bisa dipilih saksi yang mana)."
 *
 * Yang dijaga, dan DIJALANKAN:
 *   - lib: pilihan awal = saksi yang diklik; pilih semua satu pihak bolak-balik;
 *   - bot: saksi dibaca dari perkara_pihak5 sebagai golongan saksi1/saksi2 (SELECT saja);
 *   - portal: saksi dipanggil lewat mekanisme yang SAMA dengan pihak (nomor sah, verifikasi,
 *     bot nonaktif), disebut "Saksi Pemohon/Penggugat" menurut sisi pengajunya;
 *   - rute sasaran: pop-up pihak biasa TIDAK memuat saksi, pop-up saksi hanya saksi;
 *   - layar: nama saksi menjadi tombol hanya bila saklar menyala; pop-up melayang, saksi yang
 *     diklik terpilih, "Pilih semua", dan memanggil terpilih satu per satu lewat rute panggil;
 *   - hak: saklar panggil-saksi mengikuti hak sidang.antrian (matriks peran).
 *
 * Nama dan nomor di sini karangan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saringSaklarSidang } from "@/lib/matriks-peran";
import { PERISTIWA_SAKLAR_PANGGIL, KUNCI_SIMPANAN_PANGGIL, namaDapatDiklik, panggilBawaan } from "@/lib/panggil-petugas";
import {
  pilihSemuaSatuPihak,
  pilihanAwal,
  ringkasHasilPanggil,
  saksiDariSasaran,
  semuaTerpilih,
  ubahPilihan,
  urutanPanggil,
} from "@/lib/panggil-saksi";
import { SAKLAR_TAMPILAN, tampil, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const tiruan = vi.hoisted(() => ({
  setelan: { botEnabled: true, notificationsEnabled: true, dryRunEnabled: false, exposesToken: false },
  bot: [] as Array<{ jalur: string; body?: unknown }>,
  sasaran: null as unknown,
  kirim: vi.fn(),
}));

vi.mock("@/server/modules/panggil-petugas/gateway", () => ({
  panggilBotPanggil: async (jalur: string, pilihan: { body?: unknown } = {}) => {
    tiruan.bot.push({ jalur, body: pilihan.body });
    if (jalur.startsWith("/sasaran")) return { ok: true, data: tiruan.sasaran };
    if (jalur.startsWith("/catat")) return { ok: true, data: { ok: true, id: 51 } };
    if (jalur.startsWith("/riwayat")) return { ok: true, data: { ok: true, daftar: [] } };
    return { ok: true, data: { ok: true } };
  },
}));
vi.mock("@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader", () => ({
  getAletaBotSettingsSummary: async () => tiruan.setelan,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>()),
  getWhatsappRuntimeMode: () => "aleta_bot",
  getGatewayWhatsappStatus: async () => ({ ok: true, data: { status: "connected" } }),
}));
vi.mock("@/server/modules/whatsapp/portal-whatsapp-sender", () => ({
  sendPortalWhatsappMessage: (...a: unknown[]) => tiruan.kirim(...a),
}));
vi.mock("@/server/modules/aleta-ecourt/pemetaan-jabatan", () => ({
  bacaPemetaanJabatan: async () => ({ ok: true, galat: "", akun: [] }),
}));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async () => undefined }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({ prepare: () => ({ all: async () => [] }) }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Petugas Uji" }) }));
vi.mock("@/server/modules/akses/hak-peran", () => ({ pastikanAksi: async () => undefined }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: Error) =>
    new Response(JSON.stringify({ ok: false, error: galat.message }), { status: 403 }),
}));

import { DaftarNamaSaksi } from "@/components/portal/panggil-saksi";
import { lakukanPanggilan } from "@/server/modules/panggil-petugas/service";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Layanan = Record<string, (x?: unknown) => Promise<Record<string, unknown>>>;
const botPanggil = require_(path.join(AKAR, "aleta_bot/services/panggilPetugasService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
};
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const KONTEKS = {
  perkaraId: "77",
  tanggal: "2026-10-12",
  nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
  ruang: "Ruang Sidang Utama",
  agenda: "Pembuktian",
};

const SAKSI_SASARAN = [
  { kunci: "saksi1:301", golongan: "saksi1", nama: "Saksi Satu", peran: "Saksi Pemohon", jenis: "pihak", nomorTersamar: "6281****890", statusNomor: "terverifikasi", keteranganNomor: "dijawab YA" },
  { kunci: "saksi1:302", golongan: "saksi1", nama: "Saksi Dua, S.H.I.", peran: "Saksi Pemohon", jenis: "pihak", nomorTersamar: "", statusNomor: "tidak-ada", keteranganNomor: "telepon tidak diisi di SIPP" },
  { kunci: "saksi2:303", golongan: "saksi2", nama: "Saksi Tiga", peran: "Saksi Termohon", jenis: "pihak", nomorTersamar: "6281****000", statusNomor: "belum-terverifikasi", keteranganNomor: "belum dijawab" },
];

beforeEach(() => {
  tiruan.bot = [];
  tiruan.kirim.mockReset();
  tiruan.setelan = { botEnabled: true, notificationsEnabled: true, dryRunEnabled: false, exposesToken: false };
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ============================================================================
// ATURAN MURNI
// ============================================================================

describe("lib: memilih saksi", () => {
  const saksi = saksiDariSasaran([
    { kunci: "hakim:3", golongan: "majelis", nama: "Ahmad" },
    ...SAKSI_SASARAN,
    { kunci: "pihak1:1", golongan: "pihak1", nama: "Andi" },
  ]);

  it("hanya saksi1/saksi2 yang lolos, urutan dipertahankan", () => {
    expect(saksi.map((s) => s.kunci)).toEqual(["saksi1:301", "saksi1:302", "saksi2:303"]);
  });

  it("saksi yang diklik terpilih lebih dulu (nama tanpa beda spasi/huruf, pada sisi yang diklik)", () => {
    expect([...pilihanAwal(saksi, "  saksi   SATU", "saksi1")]).toEqual(["saksi1:301"]);
    expect([...pilihanAwal(saksi, "Saksi Satu", "saksi2")]).toEqual([]);
    expect([...pilihanAwal(saksi, "", "saksi1")]).toEqual([]);
  });

  it("satu, beberapa, atau semua satu pihak - tombol Pilih semua bolak-balik, pihak lain tak tersentuh", () => {
    let p = pilihanAwal(saksi, "Saksi Satu", "saksi1");
    p = ubahPilihan(p, "saksi2:303");
    expect([...p].sort()).toEqual(["saksi1:301", "saksi2:303"]);
    p = pilihSemuaSatuPihak(saksi, p, "saksi1");
    expect(semuaTerpilih(saksi, p, "saksi1")).toBe(true);
    expect(p.has("saksi2:303")).toBe(true);
    p = pilihSemuaSatuPihak(saksi, p, "saksi1");
    expect(semuaTerpilih(saksi, p, "saksi1")).toBe(false);
    expect([...p]).toEqual(["saksi2:303"]);
    expect(urutanPanggil(saksi, new Set(["saksi2:303", "saksi1:302"])).map((s) => s.kunci)).toEqual(["saksi1:302", "saksi2:303"]);
  });

  it("ringkasan hasil", () => {
    expect(
      ringkasHasilPanggil([
        { ok: true, hasil: "diantre" },
        { ok: false, hasil: "perlu_persetujuan" },
        { ok: false, hasil: "nomor_tidak_ada" },
      ])
    ).toBe("1 berhasil, 1 menunggu persetujuan, 1 tidak terkirim");
  });

  it("saklar panggil pihak menentukan; saksi bukan petugas", () => {
    expect(namaDapatDiklik(panggilBawaan(), "saksi1")).toBe(true);
    expect(namaDapatDiklik({ ...panggilBawaan(), "panggil-pihak-chat": false }, "saksi2")).toBe(false);
  });
});

// ============================================================================
// BOT: SASARAN
// ============================================================================

describe("bot: saksi menjadi sasaran bergolongan saksi1/saksi2", () => {
  it("dari perkara_pihak5 (SELECT), dipisah menurut saksi_pihak_ke, nomor sah diambil", async () => {
    const catatan: string[] = [];
    const L = botPanggil.buatLayanan({
      kueriSipp: async (sql: string) => {
        const rapi = sql.replace(/\s+/g, " ").trim();
        catatan.push(rapi);
        if (rapi.includes("FROM perkara_pihak5")) {
          return [
            { id: 301, nama: "Saksi Satu", urutan: 1, sisi: 1, telepon: "0812-3456-7890" },
            { id: 302, nama: "Saksi Dua", urutan: 2, sisi: 1, telepon: "" },
            { id: 303, nama: "Saksi Tiga", urutan: 1, sisi: 2, telepon: "00000" },
          ];
        }
        if (rapi.includes("FROM perkara WHERE")) return [{ nomorPerkara: "77/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15 }];
        return [];
      },
      kueriBot: async () => [],
      statusNomor: async () => ({ status: "terverifikasi" }),
    });
    const hasil = (await L.sasaran({ perkaraId: "77", tanggal: "2026-10-12" })) as Record<string, any>;
    const saksi = (hasil.pihak as Array<Record<string, string>>).filter((p) => p.golongan.startsWith("saksi"));
    expect(saksi.map((s) => `${s.golongan}|${s.kunci}`)).toEqual(["saksi1|saksi1:301", "saksi1|saksi1:302", "saksi2|saksi2:303"]);
    expect(saksi[0]).toMatchObject({ nomor: "6281234567890", statusNomor: "terverifikasi", jenis: "pihak" });
    expect(saksi[1]).toMatchObject({ nomor: "", statusNomor: "tidak-ada" });
    expect(saksi[2]).toMatchObject({ nomor: "", statusNomor: "bermasalah" });
    const kuerisaksi = catatan.filter((c) => c.includes("perkara_pihak5"));
    expect(kuerisaksi).toHaveLength(1);
    expect(kuerisaksi[0]).toMatch(/^SELECT /);
    // Pihak biasa tak bercampur dengan saksi.
    expect((hasil.pihak as Array<Record<string, string>>).some((p) => p.golongan === "pihak1" && p.kunci.startsWith("saksi"))).toBe(false);
  });
});

// ============================================================================
// PORTAL: PANGGILAN
// ============================================================================

function sasaranBot() {
  return {
    ok: true,
    perkara: { perkaraId: "77", nomorPerkara: "77/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 346, jenisPerkaraNama: "Cerai Talak", ruang: "Ruang Sidang Utama", agenda: "Pembuktian" },
    petugas: { majelis: [{ kunci: "hakim:3", golongan: "majelis", pejabatId: "3", nama: "Ahmad Ketua", peran: "Hakim Ketua" }], pp: [], js: [], mediator: [] },
    pihak: [
      { kunci: "pihak1:101", golongan: "pihak1", jenis: "pihak", nama: "Andi", nomor: "6281234567890", statusNomor: "terverifikasi", keteranganNomor: "" },
      { kunci: "saksi1:301", golongan: "saksi1", jenis: "pihak", nama: "Saksi Satu", nomor: "6281234500001", statusNomor: "terverifikasi", keteranganNomor: "dijawab YA" },
      { kunci: "saksi1:302", golongan: "saksi1", jenis: "pihak", nama: "Saksi Dua", nomor: "", statusNomor: "tidak-ada", keteranganNomor: "telepon tidak diisi di SIPP" },
      { kunci: "saksi2:303", golongan: "saksi2", jenis: "pihak", nama: "Saksi Tiga", nomor: "6281234500003", statusNomor: "belum-terverifikasi", keteranganNomor: "belum dijawab" },
    ],
    tidakTerbaca: [],
  };
}

const PELAKU = { id: "usr_uji", nama: "Petugas Uji", ip: "10.0.0.5" };
const db = { prepare: () => ({ all: async () => [] }) } as never;

describe("portal: memanggil saksi memakai mekanisme panggil yang ada", () => {
  beforeEach(() => {
    tiruan.sasaran = sasaranBot();
  });

  it("chat WhatsApp: pesan pihak (party) menyebut sisi pengaju - Pemohon pada cerai talak", async () => {
    tiruan.kirim.mockResolvedValue({ ok: true, status: "enqueued", queueId: 7, message: "ok" });
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "saksi1:301", saluran: "whatsapp" });
    expect(hasil).toMatchObject({ ok: true, hasil: "diantre" });
    expect(tiruan.kirim).toHaveBeenCalledWith(
      expect.objectContaining({ category: "party", recipientNumber: "6281234500001", recipientName: "Saksi Satu" })
    );
    const pesan = String(tiruan.kirim.mock.calls[0][0].message);
    expect(pesan).toContain("Saksi Pemohon");
    expect(pesan).toContain("77/Pdt.G/2026/PA.Dgl");
    expect(tiruan.bot.find((x) => x.jalur === "/catat")?.body).toMatchObject({ sasaranKunci: "saksi1:301", sasaranPeran: "Saksi Pemohon", sasaranJenis: "pihak" });
  });

  it("tanpa nomor: tidak terkirim dan dicatat; belum terverifikasi: menuntut persetujuan", async () => {
    const tanpa = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "saksi1:302", saluran: "whatsapp" });
    expect(tanpa.hasil).toBe("nomor_tidak_ada");
    const belum = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "saksi2:303", saluran: "whatsapp" });
    expect(belum.hasil).toBe("perlu_persetujuan");
    expect(tiruan.kirim).not.toHaveBeenCalled();
  });

  it("pengeras suara: pengumuman menyebut saksi dan sisinya", async () => {
    const hasil = await lakukanPanggilan(db, PELAKU, { perkaraId: "77", konteks: "sidang", kunci: "saksi2:303", saluran: "audio" });
    expect(hasil).toMatchObject({ ok: true, hasil: "diumumkan" });
    expect(String(hasil.teks)).toMatch(/^Panggilan untuk Saksi Termohon atas nama Saksi Tiga, perkara nomor 77\/Pdt\.G\/2026\/PA\.Dgl, dipersilakan masuk ke Ruang Sidang Utama/);
  });
});

describe("rute sasaran: golongan menyaring, saksi tak bocor ke pop-up lain", () => {
  async function ambil(golongan: string) {
    tiruan.sasaran = sasaranBot();
    const mod = await import("@/app/api/aleta-ecourt/panggil/sasaran/route");
    const r = await mod.GET(
      new Request(`http://uji.local/api/aleta-ecourt/panggil/sasaran?perkaraId=77&tanggal=2026-10-12&golongan=${golongan}`) as never
    );
    const isi = (await r.json()) as { data?: { orang: Array<{ kunci: string; nomor?: string }> }; orang?: Array<{ kunci: string }> };
    return (isi.data ?? isi) as { orang: Array<{ kunci: string; nomor?: string }> };
  }

  it("saksi1,saksi2 hanya saksi; pihak1 tanpa saksi; pihak4 (turut tergugat) pun tanpa saksi; nomor utuh tak keluar", async () => {
    const saksi = await ambil("saksi1,saksi2");
    expect(saksi.orang.map((o) => o.kunci)).toEqual(["saksi1:301", "saksi1:302", "saksi2:303"]);
    expect(saksi.orang.every((o) => o.nomor === undefined)).toBe(true);
    expect((await ambil("pihak1")).orang.map((o) => o.kunci)).toEqual(["pihak1:101"]);
    expect((await ambil("pihak4")).orang).toEqual([]);
  });
});

// ============================================================================
// HAK DAN SAKLAR
// ============================================================================

describe("saklar panggil-saksi dan hak", () => {
  it("ada di kelompok alat, menyala sejak awal, dapat dimatikan", () => {
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "panggil-saksi");
    expect(s?.kelompok).toBe("alat");
    expect(s?.wajib).toBeFalsy();
    expect(tampil(tampilanBawaan(), "panggil-saksi")).toBe(true);
  });

  it("peran tanpa hak sidang.antrian (kasir) dimatikan apa pun pilihannya; PP tetap", () => {
    const akun = (roleId: string, positionId: string, tambahan: string[] = []) =>
      ({ id: `u-${roleId}`, roleId, positionId, additionalRoleIds: tambahan }) as never;
    const pilihan = { "panggil-saksi": true, retur: true };
    expect(saringSaklarSidang(pilihan, akun("pelaksana", "pos-staf-umum", ["kasir"]))["panggil-saksi"]).toBe(false);
    expect(saringSaklarSidang(pilihan, akun("panitera-pengganti", "pos-panitera-pengganti"))["panggil-saksi"]).toBe(true);
  });

  it("rute panggil menuntut hak yang sama dengan memanggil pihak (sidang.antrian)", () => {
    expect(baca("manajemen_surat/src/app/api/aleta-ecourt/panggil/route.ts")).toContain('pastikanAksi(db, actorUserId, "sidang.antrian")');
  });

  it("layar membaca saklarnya dan meneruskannya ke kedua daftar saksi", () => {
    const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(layar).toContain('tampil(tampilan, "panggil-saksi")');
    expect(layar).toContain('<DaftarNamaSaksi aktif={aktifPanggilSaksi} golongan="saksi1"');
    expect(layar).toContain('<DaftarNamaSaksi aktif={aktifPanggilSaksi} golongan="saksi2"');
  });
});

// ============================================================================
// LAYAR: POP-UP
// ============================================================================

function pasangFetch(opsi: { hasilPanggil?: (badan: Record<string, unknown>) => Record<string, unknown> } = {}) {
  const sasaran: string[] = [];
  const posting: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        const badan = JSON.parse(String(init.body)) as Record<string, unknown>;
        posting.push(badan);
        const isi = opsi.hasilPanggil?.(badan) ?? { ok: true, hasil: "diantre", pesan: `Pesan untuk ${String(badan.kunci)} masuk antrean.` };
        return { ok: true, status: 200, json: async () => ({ data: isi }) } as unknown as Response;
      }
      sasaran.push(String(alamat));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            available: true,
            orang: SAKSI_SASARAN,
            whatsapp: { dapatKirim: true, alasan: "" },
            riwayat: [],
            tidakTerbaca: [],
          },
        }),
      } as unknown as Response;
    })
  );
  return { sasaran, posting };
}

function gambar(aktif: boolean, nama = ["Saksi Satu", "Saksi Dua, S.H.I."]) {
  return render(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(
          "tr",
          null,
          createElement("td", null, createElement(DaftarNamaSaksi, { aktif, golongan: "saksi1", nama, konteks: KONTEKS }))
        )
      )
    )
  );
}

describe("layar: klik nama saksi", () => {
  it("saklar mati: nama apa adanya (tanpa tombol); tanpa nama: tulisan 'nama belum tercatat'", () => {
    const { container } = gambar(false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("td")!.textContent).toBe("Saksi Satu, Saksi Dua, S.H.I.");
    cleanup();
    const kosong = gambar(true, []);
    expect(kosong.container.querySelector("td")!.textContent).toBe("nama belum tercatat");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("saklar panggil pihak dimatikan di peramban: nama tidak dapat diklik", () => {
    window.localStorage.setItem(KUNCI_SIMPANAN_PANGGIL, JSON.stringify({ "panggil-pihak-chat": false }));
    gambar(true);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("klik nama: pop-up MELAYANG di luar tabel, saksi diklik sudah tercentang, kedua pihak terdaftar", async () => {
    const { sasaran } = pasangFetch();
    const { container } = gambar(true);
    fireEvent.click(screen.getByRole("button", { name: "Saksi Satu" }));
    const dialog = await screen.findByRole("dialog");
    expect(container.querySelector("table")!.contains(dialog)).toBe(false);
    expect(dialog.style.position).toBe("fixed");
    await waitFor(() => expect(dialog.querySelectorAll("[data-saksi]").length).toBe(3));
    expect(sasaran[0]).toContain("golongan=saksi1%2Csaksi2");
    const kotak = (kunci: string) => dialog.querySelector(`[data-saksi="${kunci}"] input`) as HTMLInputElement;
    expect(kotak("saksi1:301").checked).toBe(true);
    expect(kotak("saksi1:302").checked).toBe(false);
    expect(kotak("saksi2:303").checked).toBe(false);
    expect(dialog.textContent).toContain("Saksi penggugat / pemohon (2)");
    expect(dialog.textContent).toContain("Saksi tergugat / termohon (1)");
    // Bawaan: chat saja, tanpa audio.
    expect(screen.getByRole("button", { name: /Panggil terpilih \(chat WhatsApp\)/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /audio speaker/ })).toBeNull();
  });

  it("pilih semua satu pihak lalu panggil: satu POST per saksi terpilih, berurutan, lewat rute panggil", async () => {
    const { posting } = pasangFetch({
      hasilPanggil: (badan) =>
        badan.kunci === "saksi1:302"
          ? { ok: false, hasil: "nomor_tidak_ada", pesan: "Tidak terkirim: telepon tidak diisi di SIPP." }
          : { ok: true, hasil: "diantre", pesan: `Pesan untuk ${String(badan.kunci)} masuk antrean.` },
    });
    gambar(true);
    fireEvent.click(screen.getByRole("button", { name: "Saksi Satu" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelectorAll("[data-saksi]").length).toBe(3));
    fireEvent.click(dialog.querySelector('[data-pilih-semua="saksi1"]')!);
    expect(screen.getByRole("button", { name: /Panggil terpilih \(chat WhatsApp\) · 2/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Panggil terpilih \(chat WhatsApp\)/ }));
    await waitFor(() => expect(dialog.querySelector("[data-ringkas-panggil]")).not.toBeNull());
    expect(posting.map((p) => p.kunci)).toEqual(["saksi1:301", "saksi1:302"]);
    expect(posting[0]).toMatchObject({
      perkaraId: "77",
      tanggal: "2026-10-12",
      konteks: "sidang",
      saluran: "whatsapp",
      nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
      ruang: "Ruang Sidang Utama",
      setujuBelumTerverifikasi: false,
    });
    expect(dialog.querySelector("[data-ringkas-panggil]")!.textContent).toBe("1 berhasil, 1 tidak terkirim");
  });

  it("saksi yang belum terverifikasi minta 'Kirim tetap' - baru sesudah itu dikirim dengan persetujuan", async () => {
    const { posting } = pasangFetch({
      hasilPanggil: (badan) =>
        badan.setujuBelumTerverifikasi === true || badan.kunci === "saksi1:301"
          ? { ok: true, hasil: "diantre", pesan: "Pesan masuk antrean." }
          : { ok: false, hasil: "perlu_persetujuan", pesan: "Nomor belum terverifikasi. Tekan \"Kirim tetap\" bila yakin." },
    });
    gambar(true, ["Saksi Satu"]);
    // Klik nama sisi 1, lalu centang saksi sisi 2 secara manual.
    fireEvent.click(screen.getByRole("button", { name: "Saksi Satu" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelectorAll("[data-saksi]").length).toBe(3));
    fireEvent.click(dialog.querySelector('[data-saksi="saksi2:303"] input')!);
    fireEvent.click(screen.getByRole("button", { name: /Panggil terpilih \(chat WhatsApp\)/ }));
    const kirimTetap = await screen.findByRole("button", { name: "Kirim tetap" });
    expect(posting.map((p) => p.kunci)).toEqual(["saksi1:301", "saksi2:303"]);
    fireEvent.click(kirimTetap);
    await waitFor(() => expect(posting.length).toBe(3));
    expect(posting[2]).toMatchObject({ kunci: "saksi2:303", setujuBelumTerverifikasi: true });
  });

  it("menyalakan saklar audio menambah tombol audio tanpa memuat ulang halaman", async () => {
    pasangFetch();
    gambar(true);
    fireEvent.click(screen.getByRole("button", { name: "Saksi Satu" }));
    await screen.findByRole("button", { name: /Panggil terpilih \(chat WhatsApp\)/ });
    act(() => {
      window.localStorage.setItem(KUNCI_SIMPANAN_PANGGIL, JSON.stringify({ "panggil-pihak-audio": true }));
      window.dispatchEvent(new Event(PERISTIWA_SAKLAR_PANGGIL));
    });
    expect(screen.getByRole("button", { name: /Panggil terpilih \(audio speaker\)/ })).toBeTruthy();
  });
});
