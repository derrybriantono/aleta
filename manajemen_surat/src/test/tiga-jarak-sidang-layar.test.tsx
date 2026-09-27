import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * LAYAR JADWAL SIDANG DIGAMBAR UTUH - DETIK TIDAK MELUKIS ULANG TABELNYA
 * ============================================================================
 *
 * AletaEcourtSidang digambar sungguhan dengan jawaban rute jadwal sidang yang
 * membawa waktuAntrian. Yang dibuktikan:
 *
 *   - tiga jarak tampil di kolom Antrian, legenda di atas tabel;
 *   - angka yang berjalan BERDETAK, sementara badan tabel TIDAK dilukis
 *     ulang: sidangSelesaiHariIni dipanggil sekali per baris tiap tabel
 *     dilukis, dan hitungannya tidak bertambah selama detiknya berjalan;
 *   - tetangga yang tidak ada di daftar SIPP tetap menjadi pembanding dan
 *     disebut di title;
 *   - lencana "menunggu" ikut berdetak dari angka yang sama.
 *
 * Jam nyata dipakai (dua detik lebih sedikit), bukan jam palsu: yang diuji
 * justru pengatur waktu sungguhan dan pemuatan data yang sungguh asinkron.
 */

const keadaan = vi.hoisted(() => ({
  portal: {
    institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" },
    currentUser: { id: "u1", name: "Penguji", roleId: "admin" } as Record<string, unknown> | null,
    positions: [] as unknown[],
  },
  lukisBaris: 0,
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => keadaan.portal }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...sisa }: { href: string; children: unknown }) =>
    createElement("a", { href, ...sisa }, children as never),
}));
vi.mock("@/lib/keadaan-sidang", async (asli) => {
  const mod = await asli<typeof import("@/lib/keadaan-sidang")>();
  return {
    ...mod,
    // Dipanggil sekali per BARIS tiap badan tabel dilukis - penghitung lukisan.
    sidangSelesaiHariIni: (baris: Parameters<typeof mod.sidangSelesaiHariIni>[0]) => {
      keadaan.lukisBaris += 1;
      return mod.sidangSelesaiHariIni(baris);
    },
  };
});

function tanggalLokal(t: Date) {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

// "Hari ini" menurut komponen (jam peramban) dan menurut aplikasi antrian
// sengaja SAMA di sini; yang diuji detiknya, bukan pergantian hari.
const HARI = tanggalLokal(new Date());

function sidangBaris(perkaraId: string, nomorPerkara: string) {
  return {
    sidangId: `s${perkaraId}`,
    perkaraId,
    nomorPerkara,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 2,
    sudahPutus: false,
    tanggalPutusan: "",
    statusPutusan: "",
    tanggalMinutasi: "",
    tanggalBht: "",
    tanggalSidang: HARI,
    jamSidang: "09:00",
    agenda: "Pemeriksaan saksi",
    ruangan: "Ruang Sidang 1",
    ditunda: false,
    alasanDitunda: "",
    tanggalSidangBerikut: "",
    urutanSidang: 2,
    dihadiriOleh: null,
    adaBas: false,
    durasi: null,
    pihak: { penggugat: ["Penggugat"], tergugat: ["Tergugat"] },
    panggilan: { hadirSebelumnya: null, wajibDipanggil: [], belumDipanggil: 0, retur: 0, aman: true },
    putusanEcourt: null,
    majelisKode: "B",
    majelisNama: "",
    paniteraNama: "",
    jurusitaNama: "",
  };
}

function antrianBaris(nomor: number, keadaanAntrian: string, jamPanggil: string, waktuAmbil: string) {
  return {
    nomor,
    tanggalSidang: HARI,
    waktuAmbil,
    online: false,
    pihak1: waktuAmbil,
    pihak2: "",
    saksi: "",
    keadaan: keadaanAntrian,
    menitMenunggu: null,
    jamPanggil,
    noRuang: 1,
    ruanganId: 1,
    namaPetugas: "",
    majelisKode: "B",
  };
}

function waktuBaris(perkaraId: string, nomor: number, ambil: string, panggil: string) {
  return {
    tanggalSidang: HARI,
    perkaraId,
    nomorAntrian: nomor,
    noRuang: 1,
    ruanganId: 1,
    majelisKode: "B",
    ambilPihak1: `${HARI} ${ambil}`,
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: `${HARI} ${ambil}`,
    jamJadwal: "09:00:00",
    panggilPertama: panggil ? `${HARI} ${panggil}` : "",
    panggilTerakhir: panggil ? `${HARI} ${panggil}` : "",
    jumlahPanggil: panggil ? 1 : 0,
    online: null,
    namaPetugas: "",
    sumber: "gabungan",
  };
}

/** Rute jadwal sidang: dua perkara tampil; perkara 900 hanya ada di antrian. */
function jawabanJadwal() {
  return {
    available: true,
    dari: HARI,
    sampai: HARI,
    diperiksaPada: "",
    sidang: [sidangBaris("101", "101/Pdt.G/2026/PA.Dgl"), sidangBaris("102", "102/Pdt.G/2026/PA.Dgl")],
    kesiapan: {},
    rekamAntrian: { ditulis: 0, gagal: "" },
    antrian: {
      terbaca: true,
      alasan: "",
      tanggal: [HARI],
      peta: {
        101: antrianBaris(1, "dipanggil", "09:00", "08:10"),
        102: antrianBaris(3, "menunggu", "", "08:30"),
      },
    },
    waktuAntrian: {
      terbaca: true,
      alasan: "",
      // "Sekarang" menurut jam antrian: 09:20:00.
      sekarang: `${HARI} 09:20:00`,
      hariIni: HARI,
      langsungTerbaca: true,
      rekamanTerbaca: true,
      baris: [
        waktuBaris("101", 1, "08:10:00", "09:00:00"),
        // Hanya di aplikasi antrian - dipanggil sesudah 101 di ruang yang sama.
        waktuBaris("900", 2, "08:20:00", "09:12:30"),
        // Menunggu sejak 08:30:00 -> 50 menit pada 09:20:00.
        waktuBaris("102", 3, "08:30:00", ""),
      ],
    },
  };
}

function jawab(isi: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => isi } as unknown as Response);
}

beforeEach(() => {
  keadaan.lukisBaris = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      if (url.includes("/api/aleta-ecourt/sidang?")) return jawab({ ok: true, data: jawabanJadwal() });
      return jawab({ ok: true, data: {} });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("layar jadwal sidang - tiga jarak waktu", () => {
  it("tampil, berdetak, dan badan tabelnya tidak dilukis ulang tiap detik", async () => {
    const { AletaEcourtSidang } = await import("@/components/portal/aleta-ecourt-sidang");
    const { container } = render(createElement(AletaEcourtSidang));

    // Perkara 900 dipanggil sesudah 101 -> 101 punya "Lama sidang" selesai.
    await waitFor(() => expect(container.querySelector('[data-tiga-jarak$="|101"] [data-jarak="sidang"]')).toBeTruthy(), {
      timeout: 15_000,
    });
    expect(container.querySelector("[data-legenda-tiga-jarak]")).toBeTruthy();

    const sidang101 = container.querySelector('[data-tiga-jarak$="|101"] [data-jarak="sidang"]')!;
    expect(sidang101.getAttribute("data-keadaan")).toBe("selesai");
    expect(sidang101.textContent).toContain("12 menit");
    // Pembandingnya perkara yang TIDAK tampil - disebut, bukan didiamkan.
    expect(sidang101.querySelector("[title]")!.getAttribute("title")).toContain(
      "antrian 2 (perkara yang tidak tampil pada daftar ini)"
    );

    // 102 masih menunggu: Tunggu berjalan dan lencana menunggu lama menyala.
    const tunggu102 = () => container.querySelector('[data-tiga-jarak$="|102"] [data-jarak="tunggu"]')!;
    expect(tunggu102().getAttribute("data-keadaan")).toBe("berjalan");
    const awal = tunggu102().textContent || "";
    expect(awal).toMatch(/50:0\d/);
    expect(screen.getByText(/^menunggu 50:0\d$/)).toBeTruthy();

    // Biarkan pemuatan pertama benar-benar tenang dulu.
    await tunggu(300);
    const lukisSebelum = keadaan.lukisBaris;
    expect(lukisSebelum).toBeGreaterThan(0);

    await tunggu(2300);

    const kemudian = tunggu102().textContent || "";
    expect(kemudian).not.toBe(awal);
    const detik = (teks: string) => {
      const m = /(\d{2}):(\d{2})/.exec(teks);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    expect(detik(kemudian) - detik(awal)).toBeGreaterThanOrEqual(2);
    // Lencana dan Tunggu menyebut angka yang SAMA.
    expect(screen.getByText(`menunggu ${/(\d{2}:\d{2})/.exec(kemudian)![1]}`)).toBeTruthy();
    // Dan badan tabel tidak dilukis ulang sekali pun selama itu.
    expect(keadaan.lukisBaris).toBe(lukisSebelum);
  }, 40_000);
});
