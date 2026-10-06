import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";
import type {
  DokumenRelaasCetakGateway,
  RelaasCetakGateway,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * TOMBOL CETAK RELAAS DI ANTRIAN SIDANG - DIJALANKAN, BUKAN DISISIR
 * ============================================================================
 *
 * Keputusan pengguna 25 September 2026: "jangan buat tab baru di aleta
 * e-court, cukup tambahkan tombol cetak relaas di antrian aleta sidang untuk
 * cetak relaas dan pemberitahuan putusan (disini otomatis juga mengambil hari
 * itu yang baru daftar), jadi hapus yang di tab aleta e-court cetak massal
 * relaas". "Tidak usah unggah ke SIPP dulu" - versi ini hanya mencetak.
 *
 * Seluruh pemeriksaan di sini MENJALANKAN kodenya:
 *
 *   - rute K2 benar-benar DIPANGGIL dengan kewenangan dipalsukan dan jembatan
 *     bot dipalsukan, lalu jawabannya DIURAI dari JSON;
 *   - dialognya DIGAMBAR, tombolnya DIKETUK, pihaknya DIPILIH, dan yang
 *     diperiksa pesan window.postMessage yang benar-benar terkirim (spy) -
 *     bukan keberadaan sebuah string di berkas sumber;
 *   - AletaEcourtSidang dan AletaEcourtPengguna ikut DIGAMBAR untuk membuktikan
 *     tombolnya muncul hanya bagi yang berhak dan tab lama sudah hilang.
 *
 * Penyisir teks di repositori ini sudah tiga kali hijau atas kode yang melempar
 * galat - karena itu tidak ada satu pun pemeriksaan penyisir di berkas ini.
 */

// ============================================================================
// PALSU: kewenangan, portal, jembatan bot
// ============================================================================
type HasilGateway = { ok: true; data: unknown } | { ok: false; error: string };

const keadaan = vi.hoisted(() => ({
  gateway: null as null | ((p: { tanggal?: string }) => Promise<unknown>),
  panggilanGateway: [] as Array<{ tanggal?: string }>,
  pakaiBotHidup: false,
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Andi Rahman, S.H.", roleId: "jurusita" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  // HANYA kewenangan yang dipalsukan - sisanya sungguhan.
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Galat yang ditelan menjadi 500 membuat uji gagal tanpa menyebut sebabnya.
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayRelaasCetak: async (p: { tanggal?: string }) => {
      keadaan.panggilanGateway.push(p);
      if (keadaan.pakaiBotHidup) return mod.getGatewayRelaasCetak(p);
      if (!keadaan.gateway) return { ok: false, error: "jembatan belum disiapkan uji ini" };
      return keadaan.gateway(p);
    },
  };
});

// ============================================================================
// BAHAN
// ============================================================================
// 6 Okt (butir 10): blangko PER PIHAK - P untuk pihak pertama, T untuk pihak kedua.
const berkasUntuk = (keadaan: string, pihak?: string) =>
  BLANGKO_RELAAS.find((x) => x.keadaan === keadaan && (!pihak || x.pihak === pihak))!.berkas;
const BERKAS = {
  pertamaP: berkasUntuk("sidang-pertama", "pertama"),
  pertamaT: berkasUntuk("sidang-pertama", "kedua"),
  gabungan: berkasUntuk("sidang-pertama", "keduanya"),
  ditundaP: berkasUntuk("sidang-ditunda", "pertama"),
  ditundaT: berkasUntuk("sidang-ditunda", "kedua"),
  pemberitahuanP: berkasUntuk("pemberitahuan-putusan", "pertama"),
  pemberitahuanT: berkasUntuk("pemberitahuan-putusan", "kedua"),
  ikrar: berkasUntuk("ikrar-talak"),
};

const JS_ANDI = { nama: "ANDI RAHMAN, S.H., M.H.", nip: "198001012005011001", dariPenunjukan: true };
const JS_BUDI = { nama: "Budi Santoso", nip: "197702022006041002", dariPenunjukan: true };
const JS_KOSONG = { nama: "tidak tercatat", nip: "", dariPenunjukan: false };

function dokumen(ubah: Partial<DokumenRelaasCetakGateway>): DokumenRelaasCetakGateway {
  const dasar: DokumenRelaasCetakGateway = {
    kunci: "",
    perkaraId: 100,
    nomorPerkara: "100/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 1,
    jenisPerkaraId: 347,
    golongan: "sidang-pertama",
    sebabMasuk: "didaftarkan",
    d: 1,
    sidangId: 5000,
    tanggalSidangTujuan: "2026-10-01",
    sidangAsalId: null,
    dihadiriOleh: null,
    pihakDipanggil: "keduanya",
    pihakKe: null,
    jurusita: JS_BUDI,
    sudahAdaRelaas: false,
    ...ubah,
  };
  dasar.kunci = ubah.kunci ?? `${dasar.golongan}:${dasar.perkaraId}:${dasar.d ?? 0}:${dasar.pihakKe ?? 0}`;
  return dasar;
}

/** Jawaban K1 palsu - lima dokumen, satu tidak perlu, satu tertunda. */
function jawabanBot(): RelaasCetakGateway {
  const dok = [
    // Pihak pertama saja: dokumen "keduanya" dipecah dialog (6 Okt, butir 10) - diuji tersendiri.
    dokumen({ perkaraId: 101, nomorPerkara: "101/Pdt.G/2026/PA.Dgl", pihakDipanggil: "pertama", jurusita: JS_BUDI }),
    dokumen({
      perkaraId: 102,
      nomorPerkara: "102/Pdt.G/2026/PA.Dgl",
      golongan: "sidang-ditunda",
      sebabMasuk: "ditunda",
      d: 3,
      sidangAsalId: 7102,
      dihadiriOleh: 2,
      pihakDipanggil: "kedua",
      jurusita: JS_ANDI,
    }),
    dokumen({
      perkaraId: 103,
      nomorPerkara: "103/Pdt.G/2026/PA.Dgl",
      golongan: "sidang-ditunda",
      sebabMasuk: "ditunda",
      d: 2,
      sidangAsalId: 7103,
      dihadiriOleh: 10,
      pihakDipanggil: "tidak-diketahui",
      jurusita: JS_ANDI,
    }),
    dokumen({
      perkaraId: 104,
      nomorPerkara: "104/Pdt.G/2026/PA.Dgl",
      golongan: "pemberitahuan-putusan",
      sebabMasuk: "diputus",
      d: null,
      sidangId: null,
      tanggalSidangTujuan: "",
      sidangAsalId: 7104,
      dihadiriOleh: 4,
      pihakDipanggil: "pertama",
      jurusita: JS_ANDI,
      sudahAdaRelaas: true,
    }),
    dokumen({
      perkaraId: 105,
      nomorPerkara: "105/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      golongan: "ikrar-talak",
      sebabMasuk: "jadwal-baru",
      d: 4,
      pihakDipanggil: "keduanya",
      jurusita: JS_KOSONG,
    }),
  ];
  return {
    ok: true,
    tanggal: "2026-09-25",
    dokumen: dok,
    tidakPerlu: [
      {
        perkaraId: 106,
        nomorPerkara: "106/Pdt.G/2026/PA.Dgl",
        golongan: "sidang-ditunda",
        sidangAsalId: 7106,
        sebab: "semua-pihak-hadir",
      },
    ],
    tertunda: [
      {
        perkaraId: 107,
        nomorPerkara: "107/Pdt.G/2026/PA.Dgl",
        sebab: "hasil-sidang-belum-dicatat",
        keterangan: "sidang 25 September belum punya sidang berikutnya maupun putusan",
      },
    ],
    ringkas: {
      dokumen: dok.length,
      perGolongan: { "sidang-pertama": 1, "sidang-ditunda": 2, "ikrar-talak": 1, "pemberitahuan-putusan": 1 },
      perJurusita: { [JS_ANDI.nama]: 3, [JS_BUDI.nama]: 1, [JS_KOSONG.nama]: 1 },
      tidakPerlu: 1,
      tertunda: 1,
      sudahAdaRelaas: 1,
    },
    catatan: [],
  };
}

async function jalankanRute(kueri = "") {
  const mod = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/route");
  const permintaan = { nextUrl: new URL(`http://uji.local/api/aleta-ecourt/relaas-massal/cetak${kueri}`) };
  return mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
}

type DokumenPortal = DokumenRelaasCetakGateway & {
  blangko: { berkas: string; label: string } | null;
  bisaDicetak: boolean;
  sebabTidakBisa: string;
};

beforeEach(() => {
  keadaan.gateway = null;
  keadaan.panggilanGateway = [];
  keadaan.pakaiBotHidup = false;
  keadaan.portal.currentUser = { id: "u1", name: "Andi Rahman, S.H.", roleId: "jurusita" };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.aletaRelaas;
  delete document.documentElement.dataset.aletaEkstensi;
});

// ============================================================================
// RUTE K2
// ============================================================================
describe("rute K2 - /api/aleta-ecourt/relaas-massal/cetak", () => {
  it("menambahkan blangko, bisaDicetak, dan sebabnya dari pohon-blangko.ts", async () => {
    keadaan.gateway = async () => ({ ok: true, data: jawabanBot() }) as HasilGateway;
    const jawaban = await jalankanRute("?tanggal=2026-09-25");
    expect(jawaban.status, await jawaban.clone().text()).toBe(200);
    const isi = (await jawaban.json()) as { ok: boolean; data: { dokumen: DokumenPortal[]; tidakPerlu: unknown[] } };
    const per = new Map(isi.data.dokumen.map((d) => [d.perkaraId, d]));

    expect(per.get(101)!.blangko?.berkas).toBe(BERKAS.pertamaP);
    expect(per.get(101)!.bisaDicetak).toBe(true);
    expect(per.get(101)!.sebabTidakBisa).toBe("");

    // Sidang ditunda, Pihak Kedua: blangko sidang lanjutan T - nama satker (tanpa spasi sebelum .rtf).
    expect(per.get(102)!.blangko?.berkas).toBe(BERKAS.ditundaT);
    expect(per.get(102)!.blangko!.berkas).toBe("[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf");
    expect(per.get(102)!.bisaDicetak).toBe(true);

    // Pihak belum diketahui: blangko bawaan tetap disebut, tetapi TIDAK dapat dicetak.
    expect(per.get(103)!.bisaDicetak).toBe(false);
    expect(per.get(103)!.sebabTidakBisa).toContain("pilih pihaknya dulu");

    expect(per.get(104)!.blangko?.berkas).toBe(BERKAS.pemberitahuanP);
    expect(per.get(104)!.bisaDicetak).toBe(true);
    expect(per.get(105)!.blangko?.berkas).toBe(BERKAS.ikrar);

    // Selebihnya diteruskan apa adanya.
    expect(isi.data.tidakPerlu).toHaveLength(1);
    expect(keadaan.panggilanGateway).toEqual([{ tanggal: "2026-09-25" }]);
  });

  it("panggilan tanpa d, perkara_id nol, dan golongan asing TIDAK dapat dicetak - beserta sebabnya", async () => {
    keadaan.gateway = async () =>
      ({
        ok: true,
        data: {
          ...jawabanBot(),
          dokumen: [
            dokumen({ perkaraId: 201, golongan: "sidang-ditunda", pihakDipanggil: "kedua", d: null }),
            dokumen({ perkaraId: 0 }),
            dokumen({ perkaraId: 203, golongan: "panggilan-saksi" }),
          ],
        },
      }) as HasilGateway;
    const isi = (await (await jalankanRute()).json()) as { data: { dokumen: DokumenPortal[] } };
    const [tanpaD, nol, asing] = isi.data.dokumen;
    expect(tanpaD.bisaDicetak).toBe(false);
    expect(tanpaD.sebabTidakBisa).toContain("(d)");
    expect(nol.bisaDicetak).toBe(false);
    expect(nol.sebabTidakBisa).toContain("perkara_id");
    expect(asing.bisaDicetak).toBe(false);
    expect(asing.blangko).toBeNull();
    expect(asing.sebabTidakBisa).toContain("panggilan-saksi");
    // Tanggal kosong diteruskan kosong - "hari ini" diputuskan bot.
    expect(keadaan.panggilanGateway).toEqual([{ tanggal: "" }]);
  });

  it("tanggal salah bentuk dijawab 400 dan jembatan TIDAK disentuh", async () => {
    keadaan.gateway = async () => ({ ok: true, data: jawabanBot() }) as HasilGateway;
    const jawaban = await jalankanRute("?tanggal=25-09-2026");
    expect(jawaban.status).toBe(400);
    const isi = (await jawaban.json()) as { ok: boolean; alasan: string };
    expect(isi.ok).toBe(false);
    expect(isi.alasan).toContain("25-09-2026");
    expect(keadaan.panggilanGateway).toHaveLength(0);
  });

  it("bot gagal: 502 dengan sebab bot apa adanya - bukan daftar kosong", async () => {
    keadaan.gateway = async () => ({ ok: false, error: "halaman 404" }) as HasilGateway;
    const jawaban = await jalankanRute("?tanggal=2026-09-25");
    expect(jawaban.status).toBe(502);
    expect(((await jawaban.json()) as { alasan: string }).alasan).toBe("halaman 404");
  });

  it("jawaban bot tanpa larik dokumen: 502, tidak dianggap kosong", async () => {
    keadaan.gateway = async () => ({ ok: true, data: { ok: true, tanggal: "2026-09-25" } }) as HasilGateway;
    const jawaban = await jalankanRute("?tanggal=2026-09-25");
    expect(jawaban.status).toBe(502);
    expect(((await jawaban.json()) as { alasan: string }).alasan).toContain("larik dokumen");
  });
});

// ============================================================================
// JEMBATAN - kirimKeEkstensi dijalankan sendiri
// ============================================================================
type Pesan = { sumber?: string; jenis?: string; idPesan?: string; muatan?: Record<string, unknown> };

/**
 * Ekstensi palsu: menangkap window.postMessage lewat spy, lalu membalas dengan
 * MessageEvent bersumber window dan berasal location.origin - bentuk yang sama
 * dengan balasan content script aleta.js. postMessage bawaan jsdom tidak
 * mengisi source maupun origin, jadi balasannya dikirim sendiri.
 */
function pasangEkstensiPalsu(jawab: (jenis: string, muatan: Record<string, unknown>) => unknown) {
  const terkirim: Array<{ pesan: Pesan; asal: unknown }> = [];
  const spy = vi.spyOn(window, "postMessage").mockImplementation(((pesan: unknown, asal: unknown) => {
    const p = pesan as Pesan;
    terkirim.push({ pesan: p, asal });
    if (!p || p.sumber !== "aleta-portal") return;
    const isi = jawab(String(p.jenis), (p.muatan ?? {}) as Record<string, unknown>);
    if (isi === undefined) return; // ekstensi yang diam
    setTimeout(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { sumber: "aleta-ekstensi", balasan: p.idPesan, jawaban: isi },
          origin: window.location.origin,
          source: window,
        })
      );
    }, 0);
  }) as typeof window.postMessage);
  return { terkirim, spy };
}

describe("jembatan halaman -> ekstensi", () => {
  it("balasan berpasangan idPesan diterima; bentuk pesannya kontrak K3", async () => {
    const { kirimKeEkstensi } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    const { terkirim } = pasangEkstensiPalsu(() => ({ ok: true, pekerjaan: null }));
    const jawab = await kirimKeEkstensi("relaas-keadaan", {}, 2000);
    expect(jawab.ok).toBe(true);
    expect(terkirim).toHaveLength(1);
    expect(terkirim[0].asal).toBe(window.location.origin);
    expect(terkirim[0].pesan.sumber).toBe("aleta-portal");
    expect(terkirim[0].pesan.jenis).toBe("relaas-keadaan");
    expect(typeof terkirim[0].pesan.idPesan).toBe("string");
    expect(terkirim[0].pesan.idPesan!.length).toBeGreaterThan(0);
    expect(terkirim[0].pesan.idPesan!.length).toBeLessThanOrEqual(64);
  });

  it("ekstensi yang diam dijawab batas waktu - halaman tidak menunggu selamanya", async () => {
    const { kirimKeEkstensi } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    pasangEkstensiPalsu(() => undefined);
    const jawab = await kirimKeEkstensi("relaas-keadaan", {}, 50);
    expect(jawab.ok).toBe(false);
    expect(jawab.batasWaktu).toBe(true);
    expect(jawab.sebab).toContain("tidak menjawab");
  });

  it("balasan dari asal lain atau idPesan lain DIABAIKAN", async () => {
    const { kirimKeEkstensi } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    vi.spyOn(window, "postMessage").mockImplementation(((pesan: unknown) => {
      const p = pesan as Pesan;
      setTimeout(() => {
        // Asal asing, idPesan benar.
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { sumber: "aleta-ekstensi", balasan: p.idPesan, jawaban: { ok: true } },
            origin: "http://jahat.local",
            source: window,
          })
        );
        // Asal benar, idPesan lain.
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { sumber: "aleta-ekstensi", balasan: "bukan-milikmu", jawaban: { ok: true } },
            origin: window.location.origin,
            source: window,
          })
        );
      }, 0);
    }) as typeof window.postMessage);
    const jawab = await kirimKeEkstensi("relaas-keadaan", {}, 120);
    expect(jawab.ok).toBe(false);
    expect(jawab.batasWaktu).toBe(true);
  });
});

// ============================================================================
// DIALOG - digambar sungguhan
// ============================================================================
function jawabanFetch(isi: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => isi,
  } as unknown as Response);
}

const ambilan = vi.fn();

/** Rekap lama (tertanam) - bentuk Hasil yang sekadarnya. */
function rekapKosong(tanggal: string) {
  return {
    tanggal,
    diperiksaPada: "2026-09-25T01:00:00.000Z",
    ringkas: { relaas: 0, pemberitahuan: 0, perkara: 0, jurusita: 0, tanpaJurusita: 0, berselisih: 0 },
    jurusita: [],
    catatan: [],
  };
}

function pasangFetch(data: RelaasCetakGateway = jawabanBot()) {
  ambilan.mockReset();
  ambilan.mockImplementation(async (alamat: string) => {
    const url = String(alamat);
    if (url.includes("/api/aleta-ecourt/relaas-massal/cetak")) {
      // Jawaban rute yang SUNGGUHAN: data bot palsu dilewatkan handler K2 itu
      // sendiri, bukan disalin penilaiannya di sini.
      keadaan.gateway = async () => ({ ok: true, data });
      return jalankanRute(new URL(url, "http://uji.local").search);
    }
    if (url.includes("/api/aleta-ecourt/relaas-massal?")) {
      const tanggal = new URL(url, "http://uji.local").searchParams.get("tanggal") || "";
      return jawabanFetch({ ok: true, data: rekapKosong(tanggal) });
    }
    return jawabanFetch({ ok: true, data: { available: true, sidang: [] } });
  });
  vi.stubGlobal("fetch", ambilan);
}

async function gambarDialog(tanggalAwal = "2026-09-25", tunggu = "102/Pdt.G/2026/PA.Dgl") {
  const { DialogCetakRelaas } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
  const tutup = vi.fn();
  render(createElement(DialogCetakRelaas, { tanggalAwal, onTutup: tutup }));
  await waitFor(() => expect(screen.getByText(tunggu)).toBeTruthy());
  return { tutup };
}

function centangUntuk(nomor: string) {
  return screen.getByRole("checkbox", { name: new RegExp(`^Cetak ${nomor.replace(/[./]/g, "\\$&")}`) }) as HTMLInputElement;
}

describe("dialog Cetak relaas - pilihan", () => {
  beforeEach(() => pasangFetch());

  it("tidak ada yang tercentang sendiri, dan kelompok juru sita yang masuk paling atas", async () => {
    await gambarDialog();
    const kotak = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(kotak.length).toBe(5);
    expect(kotak.every((k) => !k.checked)).toBe(true);

    const kelompok = screen.getAllByRole("region", { name: /^Juru sita / });
    // "Andi Rahman, S.H." cocok dengan "ANDI RAHMAN, S.H., M.H." - gelar dinormalkan.
    expect(kelompok[0].getAttribute("aria-label")).toBe(`Juru sita ${JS_ANDI.nama}`);
    expect(within(kelompok[0]).getByText("Anda")).toBeTruthy();
    // Tanpa penunjukan: paling bawah, tidak dibuang.
    expect(kelompok[kelompok.length - 1].getAttribute("aria-label")).toBe("Juru sita tidak tercatat");
    // Tanggal dialog = tanggal Antrian.
    expect((screen.getByLabelText("Tanggal cetak relaas") as HTMLInputElement).value).toBe("2026-09-25");
    expect(ambilan.mock.calls.some(([u]) => String(u).includes("relaas-massal/cetak?tanggal=2026-09-25"))).toBe(true);
  });

  it("pihak tidak-diketahui dikunci sampai dipilih, lalu blangkonya dihitung ulang", async () => {
    await gambarDialog();
    const kotak = centangUntuk("103/Pdt.G/2026/PA.Dgl");
    expect(kotak.disabled).toBe(true);
    const baris = kotak.parentElement!;
    expect(within(baris).getByText(/Belum dapat dicetak/)).toBeTruthy();
    expect(within(baris).getByText(/bersandi "10"/)).toBeTruthy();
    // Blangko bawaan sebelum dipilih: sidang lanjutan (blangko pertama keadaan itu).
    expect(within(baris).getByText(BERKAS.ditundaP)).toBeTruthy();

    await userEvent.selectOptions(
      screen.getByLabelText("Pihak yang dipanggil untuk 103/Pdt.G/2026/PA.Dgl"),
      "pertama"
    );
    await waitFor(() => expect(centangUntuk("103/Pdt.G/2026/PA.Dgl").disabled).toBe(false));
    // Pihak Pertama dipanggil pada sidang yang ditunda -> blangko P (Sidang Lanjutan), bukan gabungan.
    expect(within(centangUntuk("103/Pdt.G/2026/PA.Dgl").parentElement!).getByText(BERKAS.ditundaP)).toBeTruthy();
    // Dipilih pihaknya BUKAN berarti dicentang.
    expect(centangUntuk("103/Pdt.G/2026/PA.Dgl").checked).toBe(false);
  });

  it("\"Pilih semua yang siap dicetak\" tidak mengambil yang belum dipilih pihaknya maupun yang sudah tercatat", async () => {
    await gambarDialog();
    await userEvent.click(screen.getByRole("button", { name: /^Pilih semua yang siap dicetak \(3\)$/ }));
    expect(centangUntuk("101/Pdt.G/2026/PA.Dgl").checked).toBe(true);
    expect(centangUntuk("102/Pdt.G/2026/PA.Dgl").checked).toBe(true);
    expect(centangUntuk("105/Pdt.G/2026/PA.Dgl").checked).toBe(true);
    expect(centangUntuk("103/Pdt.G/2026/PA.Dgl").checked).toBe(false);
    // Sudah tercatat di SIPP: dapat dicetak, tetapi tidak ikut terpilih bawaannya.
    expect(centangUntuk("104/Pdt.G/2026/PA.Dgl").checked).toBe(false);
    expect(centangUntuk("104/Pdt.G/2026/PA.Dgl").disabled).toBe(false);
    expect(screen.getByRole("button", { name: /^Cetak 3 dokumen$/ })).toBeTruthy();
  });

  it("tidakPerlu dan tertunda terlipat, dan berkata jujur saat dibuka", async () => {
    await gambarDialog();
    expect(screen.queryByText(/diperintahkan hadir di muka sidang/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Tidak perlu dipanggil atau diberi tahu/ }));
    expect(screen.getByText(/semua pihak hadir pada sidang asalnya - diperintahkan hadir di muka sidang/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Tertunda - panggilannya belum dapat dicetak/ }));
    expect(screen.getByText(/hasil sidang belum dicatat - panggilannya belum dapat dicetak/)).toBeTruthy();
  });

  it("rekap lama tertanam: tanggalnya dari dialog, pemilih tanggalnya sendiri disembunyikan", async () => {
    await gambarDialog();
    expect(ambilan.mock.calls.some(([u]) => String(u).includes("/relaas-massal?"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /Sudah tercatat di SIPP pada tanggal ini/ }));
    await waitFor(() =>
      expect(ambilan.mock.calls.some(([u]) => String(u).includes("/relaas-massal?tanggal=2026-09-25"))).toBe(true)
    );
    expect(screen.queryByLabelText("Tanggal relaas dan pemberitahuan")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sehari sebelum" })).toBeNull();

    // Tanggal dialog diganti -> rekap ikut.
    // fireEvent, bukan userEvent.type: <input type="date"> jsdom membuang nilai
    // parsial tiap ketikan, jadi mengetik aksara demi aksara tidak pernah
    // menghasilkan tanggal utuh. Peramban mengirim satu peristiwa change utuh.
    const masukan = screen.getByLabelText("Tanggal cetak relaas");
    act(() => {
      fireEvent.change(masukan, { target: { value: "2026-09-24" } });
    });
    expect((masukan as HTMLInputElement).value).toBe("2026-09-24");
    await waitFor(() =>
      expect(ambilan.mock.calls.some(([u]) => String(u).includes("/relaas-massal?tanggal=2026-09-24"))).toBe(true)
    );
  });
});

describe("dialog Cetak relaas - mengirim ke ekstensi", () => {
  beforeEach(() => pasangFetch());

  it("tanpa ekstensi: kalimat pemasangan, dan TIDAK ada relaas-mulai terkirim", async () => {
    const { KALIMAT_EKSTENSI_TIDAK_ADA } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    const { terkirim } = pasangEkstensiPalsu(() => ({ ok: true }));
    await gambarDialog();
    await userEvent.click(centangUntuk("101/Pdt.G/2026/PA.Dgl"));
    await userEvent.click(screen.getByRole("button", { name: /^Cetak 1 dokumen$/ }));
    await waitFor(() => expect(screen.getByText(new RegExp(KALIMAT_EKSTENSI_TIDAK_ADA.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")))).toBeTruthy());
    expect(terkirim.some((t) => t.pesan.jenis === "relaas-mulai")).toBe(false);
  });

  it("mengirim muatan kontrak K3, lalu kemajuan dari ekstensi tergambar", async () => {
    document.documentElement.dataset.aletaRelaas = "1";
    document.documentElement.dataset.aletaEkstensi = "1.999.0";

    let tanya = 0;
    let dikirim: Array<Record<string, unknown>> = [];
    const pekerjaan = (keadaanButir: string[]) => ({
      id: "relaas-1",
      tanggal: "2026-09-25",
      folder: "ALETA relaas 2026-09-25",
      selesai: false,
      tertahan: null,
      waktuBerikut: 0,
      dilewati: [],
      butir: dikirim.map((d, i) => ({
        kunci: String(d.kunci),
        nomorPerkara: String(d.nomorPerkara),
        label: String(d.label),
        keadaan: keadaanButir[i] ?? "menunggu",
        sebab: keadaanButir[i] === "gagal" ? "ABT menjawab 500 untuk pratinjau blangko" : "",
      })),
    });
    const { terkirim } = pasangEkstensiPalsu((jenis, muatan) => {
      if (jenis === "relaas-keadaan") {
        tanya += 1;
        if (dikirim.length === 0) return { ok: true, pekerjaan: null };
        return {
          ok: true,
          pekerjaan: pekerjaan(["selesai", "gagal", "menunggu"]),
          ringkas: { menunggu: 1, sedang: 0, selesai: 1, gagal: 1, dilewati: 0 },
          perkiraanSisa: { rata: 90_000, rendah: 60_000, tinggi: 180_000 },
          sekarang: Date.now(),
        };
      }
      if (jenis === "relaas-mulai") {
        dikirim = ((muatan.pekerjaan as { dokumen: Array<Record<string, unknown>> }).dokumen ?? []).slice();
        return {
          ok: true,
          pekerjaan: pekerjaan(["menunggu", "menunggu", "menunggu"]),
          ringkas: { menunggu: 3, sedang: 0, selesai: 0, gagal: 0, dilewati: 0 },
          perkiraan: { rata: 150_000, rendah: 120_000, tinggi: 200_000 },
        };
      }
      return { ok: false, sebab: `tak terduga: ${jenis}` };
    });

    await gambarDialog();
    await waitFor(() => expect(tanya).toBeGreaterThan(0)); // keadaan ditanya saat dibuka
    await userEvent.click(screen.getAllByRole("button", { name: /^Pilih semua yang siap dicetak \(3\)$/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: /^Cetak 3 dokumen$/ }));

    await waitFor(() => expect(terkirim.some((t) => t.pesan.jenis === "relaas-mulai")).toBe(true));
    const mulai = terkirim.find((t) => t.pesan.jenis === "relaas-mulai")!;
    expect(mulai.asal).toBe(window.location.origin);
    expect(mulai.pesan.sumber).toBe("aleta-portal");
    expect(mulai.pesan.idPesan!.length).toBeLessThanOrEqual(64);

    const muatan = mulai.pesan.muatan as { pekerjaan: Record<string, unknown> };
    expect(Object.keys(muatan)).toEqual(["pekerjaan"]);
    // asalAbt dan asal DIHITUNG jembatan, bukan dikirim halaman.
    expect(Object.keys(muatan.pekerjaan).sort()).toEqual(["dilewati", "dokumen", "tanggal"]);
    expect(muatan.pekerjaan.tanggal).toBe("2026-09-25");
    expect(muatan.pekerjaan.dilewati).toEqual([]);

    const dok = muatan.pekerjaan.dokumen as Array<Record<string, unknown>>;
    expect(dok).toHaveLength(3);
    for (const d of dok) {
      expect(Object.keys(d).sort()).toEqual(
        ["berkas", "d", "golongan", "jurusita", "kunci", "label", "nama", "nomorPerkara", "perkaraId"].sort()
      );
      // Nama berkas unduhan tanpa garis miring - garis miring berarti folder.
      expect(String(d.nama)).not.toMatch(/[\\/]/);
    }
    const per = new Map(dok.map((d) => [String(d.perkaraId), d]));
    expect(per.get("101")!.berkas).toBe(BERKAS.pertamaP);
    expect(per.get("101")!.d).toBe(1);
    // Nama blangko APA ADANYA - nama di folder ABT satker.
    expect(per.get("102")!.berkas).toBe(BERKAS.ditundaT);
    expect(per.get("102")!.d).toBe(3);
    expect(per.get("102")!.jurusita).toBe(JS_ANDI.nama);
    expect(per.get("102")!.kunci).toBe("sidang-ditunda:102:3:0");
    expect(per.get("105")!.berkas).toBe(BERKAS.ikrar);
    expect(per.get("105")!.golongan).toBe("ikrar-talak");
    expect(per.get("105")!.jurusita).toBe("tidak tercatat");

    // Kemajuan: tanya berikutnya (±2 detik) membawa neraca dan sebab gagalnya.
    await waitFor(() => expect(screen.getByText(/1 tersimpan \(RTF\)/)).toBeTruthy(), { timeout: 6000 });
    const panel = screen.getByRole("region", { name: "Kemajuan cetak relaas" });
    expect(within(panel).getByText(/1 gagal/)).toBeTruthy();
    expect(within(panel).getByText(/ABT menjawab 500 untuk pratinjau blangko/)).toBeTruthy();
    expect(within(panel).getByText(/Perkiraan sisa waktu: 1 menit sampai 3 menit/)).toBeTruthy();
    expect(within(panel).getByText(/2 dari 3 dokumen/)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Hentikan" })).toBeTruthy();
    // Tombol cetak terkunci selama putaran belum selesai.
    expect((screen.getByRole("button", { name: /^Cetak 0 dokumen$/ }) as HTMLButtonElement).disabled).toBe(true);
  }, 20_000);

  it("perluMasuk: kalimat dan tautan \"Masuk ke ABT dulu\"", async () => {
    document.documentElement.dataset.aletaRelaas = "1";
    pasangEkstensiPalsu((jenis) =>
      jenis === "relaas-mulai"
        ? { ok: false, perluMasuk: true, sebab: "Masuk ke ABT lebih dahulu." }
        : { ok: true, pekerjaan: null }
    );
    await gambarDialog();
    await userEvent.click(centangUntuk("101/Pdt.G/2026/PA.Dgl"));
    await userEvent.click(screen.getByRole("button", { name: /^Cetak 1 dokumen$/ }));
    const tautan = await screen.findByRole("link", { name: "Masuk ke ABT dulu" });
    expect(tautan.getAttribute("href")).toBe("/aps_badilag/");
    expect(screen.getByText(/Masuk ke ABT lebih dahulu\./)).toBeTruthy();
  });

  it("membuka dialog lagi menampilkan putaran yang berjalan; Hentikan mengirim relaas-henti", async () => {
    document.documentElement.dataset.aletaRelaas = "1";
    let dihentikan = false;
    const kerja = () => ({
      id: "relaas-lama",
      tanggal: "2026-09-25",
      folder: "ALETA relaas 2026-09-25",
      selesai: dihentikan,
      dihentikan,
      tertahan: null,
      butir: [
        { kunci: "a", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", keadaan: "selesai" },
        {
          kunci: "b",
          nomorPerkara: "10/Pdt.G/2026/PA.Dgl",
          keadaan: dihentikan ? "dilewati" : "menunggu",
          sebab: dihentikan ? "dihentikan petugas sebelum dikerjakan" : "",
        },
      ],
      dilewati: [],
    });
    const { terkirim } = pasangEkstensiPalsu((jenis) => {
      if (jenis === "relaas-henti") {
        dihentikan = true;
        return { ok: true, pekerjaan: kerja() };
      }
      return { ok: true, pekerjaan: kerja(), sekarang: Date.now() };
    });
    await gambarDialog();
    const panel = await screen.findByRole("region", { name: "Kemajuan cetak relaas" });
    expect(within(panel).getByText("Berjalan")).toBeTruthy();
    await userEvent.click(within(panel).getByRole("button", { name: "Hentikan" }));
    await waitFor(() => expect(terkirim.some((t) => t.pesan.jenis === "relaas-henti")).toBe(true));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Kemajuan cetak relaas" })).getByText("Dihentikan")).toBeTruthy());
    expect(screen.getByText(/dihentikan petugas sebelum dikerjakan/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bersihkan" })).toBeTruthy();
  });
});

// ============================================================================
// TOMBOL DI ANTRIAN SIDANG, DAN TAB LAMA YANG HILANG
// ============================================================================
describe("tombol Cetak relaas di Antrian Sidang", () => {
  beforeEach(() => pasangFetch());

  it("tidak tampil tanpa bolehCetakRelaas - layar lain tidak berubah", async () => {
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    render(createElement(AletaEcourtSidang));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Cetak$/ })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Cetak relaas/ })).toBeNull();
  }, 30_000);

  it("tampil dengan bolehCetakRelaas, dan membuka DIALOG - bukan tab", async () => {
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    render(<AletaEcourtSidang bolehCetakRelaas />);
    const tombol = await screen.findByRole("button", { name: /Cetak relaas/ });
    await userEvent.click(tombol);
    const dialog = await screen.findByRole("dialog", { name: "Cetak relaas" }, { timeout: 10_000 });
    await waitFor(() => expect(within(dialog).getByText("102/Pdt.G/2026/PA.Dgl")).toBeTruthy());
    // Tutup menutup dialognya saja.
    await userEvent.click(within(dialog).getByRole("button", { name: "Tutup dialog cetak relaas" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cetak relaas" })).toBeNull());
  }, 30_000);
});

describe("halaman ALETA e-Court - tab Cetak Relaas Massal sudah hilang", () => {
  beforeEach(() => pasangFetch());

  it("juru sita: tidak ada menu Cetak Relaas Massal, dan Jadwal Sidang membawa tombol Cetak relaas", async () => {
    keadaan.portal.currentUser = { id: "u1", name: "Andi Rahman, S.H.", roleId: "jurusita" };
    const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");
    render(createElement(AletaEcourtPengguna));
    const menu = screen.getByRole("navigation", { name: "Menu ALETA e-Court" });
    expect(within(menu).queryByText("Cetak Relaas Massal")).toBeNull();
    expect(within(menu).queryByText(/Relaas/i)).toBeNull();
    await userEvent.click(within(menu).getByRole("button", { name: /Jadwal Sidang/ }));
    expect(await screen.findByRole("button", { name: /Cetak relaas/ }, { timeout: 15_000 })).toBeTruthy();
  }, 30_000);

  it("peran lain (hakim): Jadwal Sidang TANPA tombol Cetak relaas", async () => {
    keadaan.portal.currentUser = { id: "u2", name: "Hakim Uji", roleId: "hakim" };
    const { AletaEcourtPengguna } = await import("@/components/portal/aleta-ecourt-pengguna");
    render(createElement(AletaEcourtPengguna));
    const menu = screen.getByRole("navigation", { name: "Menu ALETA e-Court" });
    await userEvent.click(within(menu).getByRole("button", { name: /Jadwal Sidang/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Cetak$/ })).toBeTruthy(), { timeout: 15_000 });
    expect(screen.queryByRole("button", { name: /Cetak relaas/ })).toBeNull();
  }, 30_000);
});

// ============================================================================
// SEKALI ATAS BOT HIDUP
// ============================================================================
//
// Dijalankan HANYA bila ALETA_UJI_BOT_HIDUP=1: rangkaian uji penuh tidak boleh
// bergantung pada bot yang menyala di mesin pengujinya. Rute portalnya tetap
// SUNGGUHAN (hanya kewenangan yang dipalsukan); jembatannya gatewayFetch asli
// dengan token dari .env.local.
const BOT_HIDUP = process.env.ALETA_UJI_BOT_HIDUP === "1";

describe.skipIf(!BOT_HIDUP)("rute K2 atas bot hidup (ALETA_UJI_BOT_HIDUP=1)", () => {
  it("tanggal sibuk: dokumen terbaca, dinilai, dan kuncinya unik", async () => {
    const env = path.resolve(process.cwd(), ".env.local");
    if (existsSync(env)) {
      for (const baris of readFileSync(env, "utf8").split(/\r?\n/)) {
        const cocok = /^(ALETA_BOT_[A-Z_]+)=(.*)$/.exec(baris.trim());
        if (cocok) process.env[cocok[1]] = cocok[2].replace(/^["']|["']$/g, "");
      }
    }
    keadaan.pakaiBotHidup = true;
    const tanggal = process.env.ALETA_UJI_TANGGAL || "2026-04-29";
    const jawaban = await jalankanRute(`?tanggal=${tanggal}`);
    const teks = await jawaban.clone().text();
    expect(jawaban.status, teks).toBe(200);
    const isi = (await jawaban.json()) as { data: { tanggal: string; dokumen: DokumenPortal[]; ringkas: RelaasCetakGateway["ringkas"] } };
    const { dokumen: dok, ringkas } = isi.data;
    console.log(
      `[bot hidup] ${tanggal}: ${dok.length} dokumen, dapat dicetak ${dok.filter((d) => d.bisaDicetak).length}, ` +
        `per golongan ${JSON.stringify(ringkas.perGolongan)}, tidak perlu ${ringkas.tidakPerlu}, tertunda ${ringkas.tertunda}`
    );
    expect(new Set(dok.map((d) => d.kunci)).size).toBe(dok.length);
    for (const d of dok) {
      expect(typeof d.bisaDicetak).toBe("boolean");
      if (!d.bisaDicetak) expect(d.sebabTidakBisa.length).toBeGreaterThan(0);
      if (d.blangko) expect(BLANGKO_RELAAS.map((b) => b.berkas)).toContain(d.blangko.berkas);
    }
    for (const g of ["sidang-pertama", "sidang-ditunda", "ikrar-talak", "pemberitahuan-putusan"]) {
      expect(ringkas.perGolongan).toHaveProperty(g);
    }

    // Jawaban rute yang SUNGGUHAN itu digambar dialognya - tiap nomor perkara
    // muncul, dan tidak ada yang tercentang sendiri.
    ambilan.mockReset();
    ambilan.mockImplementation(async (alamat: string) =>
      String(alamat).includes("/relaas-massal/cetak") ? jawabanFetch(isi) : jawabanFetch({ ok: true, data: rekapKosong(tanggal) })
    );
    vi.stubGlobal("fetch", ambilan);
    const { DialogCetakRelaas } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    render(createElement(DialogCetakRelaas, { tanggalAwal: tanggal, onTutup: () => undefined }));
    await waitFor(() => expect(screen.getAllByText("dokumen lahir").length).toBe(1));
    for (const d of dok) expect(screen.getAllByText(d.nomorPerkara).length).toBeGreaterThan(0);
    expect((screen.queryAllByRole("checkbox") as HTMLInputElement[]).every((k) => !k.checked)).toBe(true);
  }, 120_000);
});

// ============================================================================
// TELAAH 25 SEPTEMBER 2026 - DIJALANKAN
// ============================================================================

/** Jawaban K1 palsu untuk telaah: proses di luar menu ABT, putusan dicabut, pihak banyak, kelompok kemarin. */
function jawabanTelaah(): RelaasCetakGateway {
  const dok = [
    dokumen({
      perkaraId: 301,
      nomorPerkara: "301/Pdt.G/2026/PA.Dgl",
      alurPerkaraId: 15,
      prosesTerakhirId: 80,
      prosesTerakhirNama: "Penetapan Hari Sidang Pertama",
      jumlahPihak: { pertama: 1, kedua: 6, lain: 0 },
      jumlahPihakSasaran: 7,
      sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" },
      // Pihak kedua saja (dokumen "keduanya" dipecah dialog - 6 Okt, butir 10).
      pihakDipanggil: "kedua",
    }),
    dokumen({
      perkaraId: 302,
      nomorPerkara: "302/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      golongan: "ikrar-talak",
      sebabMasuk: "jadwal-baru",
      d: 9,
      prosesTerakhirId: 250,
      prosesTerakhirNama: "Minutasi",
    }),
    dokumen({
      perkaraId: 303,
      nomorPerkara: "303/Pdt.G/2026/PA.Dgl",
      golongan: "pemberitahuan-putusan",
      sebabMasuk: "diputus",
      d: null,
      sidangId: null,
      tanggalSidangTujuan: "",
      sidangAsalId: 7303,
      dihadiriOleh: 2,
      pihakDipanggil: "kedua",
      pihakKe: 2,
      prosesTerakhirId: 210,
      statusPutusanId: 67,
      statusPutusanNama: "Dicabut",
    }),
    dokumen({
      perkaraId: 304,
      nomorPerkara: "304/Pdt.G/2026/PA.Dgl",
      golongan: "pemberitahuan-putusan",
      sebabMasuk: "diputus",
      d: null,
      sidangId: null,
      tanggalSidangTujuan: "",
      sidangAsalId: 7304,
      dihadiriOleh: 2,
      pihakDipanggil: "kedua",
      pihakKe: 2,
      prosesTerakhirId: 210,
      statusPutusanId: 62,
      statusPutusanNama: "Dikabulkan",
    }),
  ];
  const kemarin = [
    dokumen({
      perkaraId: 401,
      nomorPerkara: "401/Pdt.G/2026/PA.Dgl",
      golongan: "sidang-ditunda",
      sebabMasuk: "ditunda",
      d: 3,
      sidangAsalId: 7401,
      dihadiriOleh: 2,
      pihakDipanggil: "kedua",
      jurusita: JS_ANDI,
      sudahAdaRelaas: true,
      keterangan: ["Dari sidang ke-2 tanggal 2026-09-24; jadwal sidang ke-3 dicatat 2026-09-24 pukul 10.12."],
    }),
    dokumen({
      perkaraId: 402,
      nomorPerkara: "402/Pdt.G/2026/PA.Dgl",
      golongan: "sidang-ditunda",
      sebabMasuk: "ditunda",
      d: 3,
      sidangAsalId: 7402,
      dihadiriOleh: 2,
      pihakDipanggil: "kedua",
      jurusita: JS_ANDI,
      sudahAdaRelaas: false,
      keterangan: ["Dari sidang ke-2 tanggal 2026-09-24; jadwal sidang ke-3 dicatat 2026-09-24 pukul 16.55."],
    }),
  ];
  return {
    ...jawabanBot(),
    dokumen: dok,
    tidakPerlu: [
      {
        perkaraId: 311,
        nomorPerkara: "311/Pdt.G/2026/PA.Dgl",
        golongan: "sidang-ditunda",
        sidangAsalId: 7311,
        sebab: "semua-pihak-hadir",
        keterangan: 'alasan penundaan "Pembuktian"',
      },
      {
        perkaraId: 312,
        nomorPerkara: "312/Pdt.G/2022/PA.Dgl",
        golongan: "ikrar-talak",
        sidangAsalId: 7312,
        sebab: "sidang-tujuan-tidak-sesudah-hari-cetak",
      },
      {
        perkaraId: 313,
        nomorPerkara: "313/Pdt.P/2026/PA.Dgl",
        golongan: "pemberitahuan-putusan",
        sidangAsalId: 7313,
        sebab: "semua-pihak-hadir",
        keterangan: 'status putusan "Dikabulkan"',
      },
      { perkaraId: 314, nomorPerkara: "314/Pdt.G/2026/PA.Dgl", golongan: "sidang-ditunda", sidangAsalId: 7314, sebab: "sebab-baru-bot" },
    ],
    tertunda: [],
    hariKerjaSebelumnya: { tanggal: "2026-09-24", dokumen: kemarin },
  };
}

describe("telaah 25 September 2026 - penilaian K2 dan dialog", () => {
  it("proses di luar rentang menu ABT (80-220): TIDAK dapat dicetak, sebabnya menyebut rentang dan tempat mengubahnya", async () => {
    keadaan.gateway = async () => ({ ok: true, data: jawabanTelaah() });
    const res = await jalankanRute("?tanggal=2026-09-25");
    expect(res.status).toBe(200);
    const isi = (await res.json()) as { data: { dokumen: DokumenPortal[]; hariKerjaSebelumnya: { dokumen: DokumenPortal[] } } };
    const per = new Map(isi.data.dokumen.map((d) => [d.perkaraId, d]));
    const ikrar = per.get(302)!;
    expect(ikrar.bisaDicetak).toBe(false);
    expect(ikrar.sebabTidakBisa).toContain("250 (Minutasi)");
    // Ikrar dinilai dengan rentang menu ABT 25 "Relaas Ikrar Talak", bukan 80-220.
    expect(ikrar.sebabTidakBisa).toContain("Relaas Ikrar Talak");
    expect(ikrar.sebabTidakBisa).toContain("290-600");
    expect(ikrar.sebabTidakBisa).toContain("grup 1");
    // Blangkonya tetap disebut - yang tidak ada izinnya, bukan blangkonya.
    expect(ikrar.blangko?.berkas).toBe(BERKAS.ikrar);
    // Batas bawah 80 masih di dalam rentang.
    expect(per.get(301)!.bisaDicetak).toBe(true);
    // Kelompok hari kerja sebelumnya ikut dinilai rute.
    expect(isi.data.hariKerjaSebelumnya.dokumen.map((d) => d.bisaDicetak)).toEqual([true, true]);

    const { nilaiCetakDokumen } = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak");
    // Dokumen sidang pertama (menu Relaas 80-220); ikrar dinilai terpisah di bawah.
    const dasar = jawabanTelaah().dokumen[0];
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: null }).bisaDicetak).toBe(true); // bot lama
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: 220 }).bisaDicetak).toBe(true);
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: 221 }).bisaDicetak).toBe(false);
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: 79 }).bisaDicetak).toBe(false);
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: 250 }).sebabTidakBisa).toContain("250");

    // Sejak 26 Sep 2026 blangko ikrar di menu 25 (proses 290-600): perkara yang
    // sudah sampai tahap ikrar DAPAT dicetak, dan yang belum - atau lewat - tidak.
    const ikrarDasar = jawabanTelaah().dokumen.find((d) => d.golongan === "ikrar-talak")!;
    expect(nilaiCetakDokumen({ ...ikrarDasar, prosesTerakhirId: 293 }).bisaDicetak).toBe(true);
    expect(nilaiCetakDokumen({ ...ikrarDasar, prosesTerakhirId: 290 }).bisaDicetak).toBe(true);
    expect(nilaiCetakDokumen({ ...ikrarDasar, prosesTerakhirId: 600 }).bisaDicetak).toBe(true);
    expect(nilaiCetakDokumen({ ...ikrarDasar, prosesTerakhirId: 289 }).bisaDicetak).toBe(false);
    expect(nilaiCetakDokumen({ ...ikrarDasar, prosesTerakhirId: 601 }).bisaDicetak).toBe(false);
    // Rentang ikrar tidak bocor ke golongan lain: sidang pertama berproses 293 tetap ditolak.
    expect(nilaiCetakDokumen({ ...dasar, prosesTerakhirId: 293 }).bisaDicetak).toBe(false);
  });

  it("putusan dicabut/gugur: dapat dicetak tetapi PERLU KONFIRMASI dan tidak ikut Pilih semua; ikrar di luar rentang terkunci", async () => {
    const { nilaiCetakDokumen } = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak");
    const pbt = jawabanTelaah().dokumen[2];
    for (const nama of ["Dicabut", "Gugur", "Dinyatakan Gugur", "Digugurkan"]) {
      const n = nilaiCetakDokumen({ ...pbt, statusPutusanNama: nama });
      expect(n.bisaDicetak, nama).toBe(true);
      expect(n.ikutPilihSemua, nama).toBe(false);
      expect(n.peringatan.map((p) => p.jenis), nama).toContain("status-putusan");
    }
    expect(nilaiCetakDokumen({ ...pbt, statusPutusanNama: "Dikabulkan" }).ikutPilihSemua).toBe(true);

    pasangFetch(jawabanTelaah());
    await gambarDialog("2026-09-25", "303/Pdt.G/2026/PA.Dgl");
    await userEvent.click(screen.getAllByRole("button", { name: /^Pilih semua yang siap dicetak \(2\)$/ })[0]);
    expect(centangUntuk("301/Pdt.G/2026/PA.Dgl").checked).toBe(true);
    expect(centangUntuk("304/Pdt.G/2026/PA.Dgl").checked).toBe(true);
    const dicabut = centangUntuk("303/Pdt.G/2026/PA.Dgl");
    expect(dicabut.checked).toBe(false);
    expect(dicabut.disabled).toBe(false);
    expect(within(dicabut.parentElement!).getByText(/Perlu konfirmasi/)).toBeTruthy();
    expect(within(dicabut.parentElement!).getByText(/"Dicabut"/)).toBeTruthy();
    const ikrar = centangUntuk("302/Pdt.G/2026/PA.Dgl");
    expect(ikrar.disabled).toBe(true);
    expect(within(ikrar.parentElement!).getByText(/Belum dapat dicetak: ABT akan menolaknya/)).toBeTruthy();
  });

  it("pihak lebih banyak daripada yang dimuat blangko: peringatan di baris dialog, tanpa menahan Pilih semua", async () => {
    pasangFetch(jawabanTelaah());
    await gambarDialog("2026-09-25", "301/Pdt.G/2026/PA.Dgl");
    const baris = centangUntuk("301/Pdt.G/2026/PA.Dgl").parentElement!;
    expect(
      within(baris).getByText(/Tergugat ada 6 orang; blangko ABT hanya memuat yang pertama - 5 lainnya harus dibuatkan relaas sendiri/)
    ).toBeTruthy();

    const { nilaiCetakDokumen } = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak");
    const n = nilaiCetakDokumen(
      dokumen({
        alurPerkaraId: 16,
        pihakDipanggil: "keduanya",
        jumlahPihak: { pertama: 3, kedua: 0, lain: 0 },
        sebutanPihak: { pertama: "Pemohon", kedua: "Termohon" },
      })
    );
    expect(n.peringatan.map((p) => p.teks).join(" ")).toContain(
      "Pemohon ada 3 orang; blangko ABT hanya memuat Pemohon I dan II - 1 lainnya"
    );
    expect(n.ikutPilihSemua).toBe(true);
  });

  it("tidakPerlu: kalimat menurut SEBAB dan GOLONGAN, alasan yang tercatat ikut tampil, sebab asing ditulis apa adanya", async () => {
    pasangFetch(jawabanTelaah());
    await gambarDialog("2026-09-25", "301/Pdt.G/2026/PA.Dgl");
    await userEvent.click(screen.getByRole("button", { name: /Tidak perlu dipanggil atau diberi tahu/ }));
    const baris = (nomor: string) => String(screen.getByText(nomor).closest("li")?.textContent);
    expect(baris("311/Pdt.G/2026/PA.Dgl")).toContain("semua pihak hadir pada sidang asalnya");
    expect(baris("311/Pdt.G/2026/PA.Dgl")).toContain('alasan penundaan "Pembuktian"');
    expect(baris("312/Pdt.G/2022/PA.Dgl")).toContain("sidang berikutnya jatuh pada hari yang sama");
    expect(baris("312/Pdt.G/2022/PA.Dgl")).not.toContain("semua pihak hadir");
    expect(baris("313/Pdt.P/2026/PA.Dgl")).toContain("putusan dibacakan di hadapan semua pihak");
    expect(baris("313/Pdt.P/2026/PA.Dgl")).not.toContain("diperintahkan hadir");
    expect(baris("314/Pdt.G/2026/PA.Dgl")).toContain("tidak dicetak, sebab: sebab-baru-bot");
    expect(baris("314/Pdt.G/2026/PA.Dgl")).not.toContain("semua pihak hadir");
  });

  it("dari hari kerja sebelumnya: kelompok terpisah, TIDAK ikut Pilih semua, dapat dicentang sendiri dan ikut terkirim", async () => {
    document.documentElement.dataset.aletaRelaas = "1";
    const { terkirim } = pasangEkstensiPalsu((jenis) =>
      jenis === "relaas-mulai"
        ? {
            ok: true,
            pekerjaan: { id: "r-kemarin", tanggal: "2026-09-25", folder: "ALETA relaas 2026-09-25", selesai: false, tertahan: null, butir: [], dilewati: [] },
          }
        : { ok: true, pekerjaan: null }
    );
    pasangFetch(jawabanTelaah());
    await gambarDialog("2026-09-25", "301/Pdt.G/2026/PA.Dgl");
    // Terlipat: barisnya belum tergambar, dan "Pilih semua" tidak menyentuhnya.
    expect(screen.queryByText("402/Pdt.G/2026/PA.Dgl")).toBeNull();
    await userEvent.click(screen.getAllByRole("button", { name: /^Pilih semua yang siap dicetak \(2\)$/ })[0]);
    const kepala = screen.getByRole("button", { name: /Dari hari kerja sebelumnya/ });
    expect(kepala.textContent).toContain("(2)");
    await userEvent.click(kepala);
    const b401 = centangUntuk("401/Pdt.G/2026/PA.Dgl");
    const b402 = centangUntuk("402/Pdt.G/2026/PA.Dgl");
    expect(b401.checked).toBe(false);
    expect(b402.checked).toBe(false);
    expect(within(b401.parentElement!).getByText("sudah tercatat di SIPP")).toBeTruthy();
    expect(within(b402.parentElement!).getByText(/pukul 16\.55/)).toBeTruthy();
    // Sebab masuknya menyebut sidang kemarin, bukan "sidang pada tanggal ini".
    expect(within(b402.parentElement!).queryByText(/sidang pada tanggal ini ditunda/)).toBeNull();
    expect(within(b402.parentElement!).getByText(/^sidang \S+ 24-09-2026 ditunda/)).toBeTruthy();
    // Kelompok ini tanpa tombol "Pilih semua" sendiri.
    const lipatan = kepala.closest("section")!;
    expect(within(lipatan).queryByRole("button", { name: /Pilih semua/ })).toBeNull();

    await userEvent.click(b402);
    await userEvent.click(screen.getByRole("button", { name: /^Cetak 3 dokumen$/ }));
    await waitFor(() => expect(terkirim.some((t) => t.pesan.jenis === "relaas-mulai")).toBe(true));
    const muatan = terkirim.find((t) => t.pesan.jenis === "relaas-mulai")!.pesan.muatan as {
      pekerjaan: { dokumen: Array<{ kunci: string }> };
    };
    expect(muatan.pekerjaan.dokumen.map((d) => d.kunci).sort()).toEqual(
      ["pemberitahuan-putusan:304:0:2", "sidang-ditunda:402:3:0", "sidang-pertama:301:1:0"].sort()
    );
  });

  it("relaas RTF saja (6 Okt 2026) di latar.js SUNGGUHAN: dialog menyebut 'tersimpan (RTF)', tanpa kata PDF, walau rute PDF mati", async () => {
    const d = await import("./dunia-latar");
    const dunia = new d.Dunia(d.abtPalsu({ pdf: () => d.jawaban(503, "Service Unavailable", `${d.ASAL}/aleta/api/aleta-bot/abt/pdf`) }));
    const pekerja = d.nyalakan(dunia);
    expect((await d.minta(dunia, pekerja, d.pesanMulai(d.ENAM.slice(0, 2)))).ok).toBe(true);
    await d.jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const keadaanLatar = await d.minta(dunia, pekerja, { jenis: "relaas-keadaan" });
    expect(keadaanLatar.pekerjaan.butir.map((b: { keadaan: string }) => b.keadaan)).toEqual(["selesai", "selesai"]);
    expect(dunia.permintaan.filter((p) => p.alamat.includes("/abt/pdf"))).toEqual([]);
    expect(dunia.unduhan.map((u) => u.filename).every((n) => /\.rtf$/.test(n))).toBe(true);

    document.documentElement.dataset.aletaRelaas = "1";
    pasangEkstensiPalsu(() => keadaanLatar);
    pasangFetch();
    await gambarDialog();
    const panel = await screen.findByRole("region", { name: "Kemajuan cetak relaas" });
    expect(within(panel).getByText("Selesai")).toBeTruthy();
    expect(within(panel).getByText(/2 tersimpan \(RTF\)/)).toBeTruthy();
    expect(panel.textContent ?? "").not.toMatch(/PDF/);
  });

  it("ABT menolak akunnya untuk SELURUH blangko (latar.js SUNGGUHAN): putaran tertahan, dialog menulis yang harus diatur di ABT", async () => {
    const d = await import("./dunia-latar");
    const dunia = new d.Dunia(d.abtPalsu({ tolakSemua: () => "JURUSITA" }));
    const pekerja = d.nyalakan(dunia);
    expect((await d.minta(dunia, pekerja, d.pesanMulai(d.ENAM.slice(0, 3)))).ok).toBe(true);
    await d.jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));
    const keadaanLatar = await d.minta(dunia, pekerja, { jenis: "relaas-keadaan" });
    expect(keadaanLatar.pekerjaan.tertahan.perluMasuk).toBe("abt-akses");

    document.documentElement.dataset.aletaRelaas = "1";
    pasangEkstensiPalsu(() => keadaanLatar);
    pasangFetch();
    await gambarDialog();
    const panel = await screen.findByRole("region", { name: "Kemajuan cetak relaas" });
    expect(within(panel).getByText("Tertahan")).toBeTruthy();
    const teks = String(panel.textContent);
    expect(teks).toContain("USER JURUSITA - TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI");
    expect(teks).toContain('"Blangko Derry" (abt_menu 900)');
    expect(teks).toContain("Juru Sita (600)");
    expect(teks).toContain("Koordinator Delegasi (650)");
    expect(within(panel).getByRole("button", { name: "Lanjutkan" })).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Buka ABT" }).getAttribute("href")).toBe("/aps_badilag/");
  });

  it("tanggal dari Antrian: bawaan Antrian (jam peramban) diabaikan - dialog memakai jam pengadilan", async () => {
    const { tanggalAwalDariAntrian, DialogCetakRelaas } = await import("@/components/portal/aleta-ecourt-cetak-relaas");
    expect(tanggalAwalDariAntrian("2026-09-24", "2026-09-24", "2026-09-24")).toBe("");
    expect(tanggalAwalDariAntrian("2026-09-20", "2026-09-20", "2026-09-24")).toBe("2026-09-20");
    expect(tanggalAwalDariAntrian("2026-09-20", "2026-09-22", "2026-09-24")).toBe("");
    expect(tanggalAwalDariAntrian("kemarin", "kemarin", "2026-09-24")).toBe("");

    // Peramban berzona lain: "hari ini" Antrian masih 1 Sep - dialog tetap
    // membuka hari ini menurut jam pengadilan (WITA).
    const { waktuPengadilan } = await import("@/lib/waktu-pengadilan");
    const hariIniWita = waktuPengadilan().tanggal;
    expect(hariIniWita).not.toBe("2026-09-01");
    pasangFetch();
    render(createElement(DialogCetakRelaas, { tanggalAwal: "2026-09-01", hariIniAntrian: "2026-09-01", onTutup: vi.fn() }));
    await waitFor(() =>
      expect(ambilan.mock.calls.some(([u]) => String(u).includes(`relaas-massal/cetak?tanggal=${hariIniWita}`))).toBe(true)
    );
    expect(ambilan.mock.calls.some(([u]) => String(u).includes("tanggal=2026-09-01"))).toBe(false);
    expect((screen.getByLabelText("Tanggal cetak relaas") as HTMLInputElement).value).toBe(hariIniWita);
  });
});
