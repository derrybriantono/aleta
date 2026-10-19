/**
 * ============================================================================
 * PERBAIKAN 2 OKTOBER 2026 MALAM - JADWAL SIDANG & HASIL SIDANG (agen J)
 * ============================================================================
 *
 *   1   "sidang berikutnya" di borang tunda - SATU fungsi bersama untuk Jadwal
 *       Sidang (CatatHasilRingkas) dan Hasil Sidang (HasilSidang):
 *         a  tanggal: tundaan mediasi 3 minggu > Court Calendar (kedua pihak
 *            pernah hadir) > dua pekan
 *         b  jam: jawab-menjawab dan kesimpulan 15:00; selebihnya 09:00;
 *            tundaan mediasi SELALU 09:00
 *         c  keduanya layar memberi jawaban yang sama (dirender sungguhan)
 *   2   skors: yang diskors tidak hijau, tombol tunda|putus tetap, ringkasan
 *       ruang menyebut yang diskors, skors tersedia di halaman pemanggil
 *   3   sedang berjalan: tiga sumber (manual, proses mesin antrian, panggilan),
 *       tombol Tandai/Batalkan, sinkron ke mesin HANYA bila nilainya disetel
 *   4   urutan kolom kanan: Rincian, Status, Selesai paling bawah
 *
 * Bot diuji dengan basis data TIRUAN - tidak ada yang ditulis ke SIPP, ABT,
 * e-Court, maupun aplikasi antrian sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HARI_TUNDA_DUA_PEKAN,
  HARI_TUNDA_MEDIASI,
  HARI_TUNDA_SATU_PEKAN,
  bawaanTunda,
  dasarTanggalKosong,
  jamSidangBerikut,
  tanggalJamUntuk,
  tanggalSidangBerikut,
  tundaKarenaMediasi,
  usulanTundaSidang,
  type KontakPihak,
  type RencanaKalender,
  type SidangRiwayat,
} from "@/lib/bawaan-tunda";
import { bacaBentukKontak, kalimatKontak } from "@/lib/jadwal-sidang-kontak";
import {
  aksiRuangSidang,
  daftarDiskors,
  kalimatSumberBerjalan,
  petaSidangBerjalan,
  skorsBerlaku,
  skorsUntuk,
  type DataBerjalan,
  type PetaSkors,
} from "@/lib/jadwal-sidang-2okt";
import type { BarisWaktuAntrian } from "@/lib/tiga-jarak-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const SIDANG = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const HASIL = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
const KOMPONEN = baca("manajemen_surat/src/components/portal/jadwal-sidang-2okt.tsx");
const LIB_TUNDA = baca("manajemen_surat/src/lib/bawaan-tunda.ts");
const RUTE_BERJALAN = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/berjalan/route.ts");
const RUTE_KALENDER = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/kalender/route.ts");
const RUTE_BOT = baca("aleta_bot/routes/jadwalSidangRoutes.js");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ============================================================================
// BUTIR 1 - ATURAN BERSAMA TANGGAL DAN JAM SIDANG BERIKUTNYA
// ============================================================================

const rencana = (tanggal: string, agenda = ""): RencanaKalender => ({ tanggal, jam: "09:00", agenda, keterangan: "" });

describe("butir 1b - jam sidang berikutnya", () => {
  it("jawab-menjawab dan kesimpulan 15:00; pembuktian, musyawarah, putusan, mediasi, panggilan 09:00", () => {
    const sore = ["Jawaban Termohon", "Jawaban Termohon / Gugatan Rekonvensi", "Replik Pemohon", "Duplik Termohon", "Duplik Rekonvensi Pemohon", "Kesimpulan", "jawab menjawab"];
    const pagi = [
      "Pembuktian Pemohon",
      "Pembuktian Lanjutan Termohon",
      "Musyawarah Majelis",
      "Musyawarah Majelis dan Pembacaan Penetapan",
      "Pembacaan Putusan",
      "Mendengarkan Laporan Hasil Mediasi",
      "Panggil Termohon",
      "SIDANG IKRAR TALAK",
      "Pemeriksaan Pokok Perkara",
      "",
    ];
    for (const a of sore) expect(jamSidangBerikut(a), a).toBe("15:00");
    for (const a of pagi) expect(jamSidangBerikut(a), a).toBe("09:00");
  });

  it("tundaan MEDIASI selalu 09:00 - mendahului aturan sore", () => {
    expect(jamSidangBerikut("Jawaban Termohon", "Proses Mediasi")).toBe("09:00");
    expect(jamSidangBerikut("Kesimpulan", "Memberi kesempatan mediasi")).toBe("09:00");
    expect(jamSidangBerikut("Replik Pemohon", "Para pihak tidak hadir")).toBe("15:00");
  });
});

describe("butir 1d - deteksi tundaan karena mediasi", () => {
  it("mengenali alasan yang menyebut mediasi, termasuk salah ketik; bukan agenda laporan mediasi", () => {
    for (const a of ["Proses Mediasi", "proses mediasi", "peroses mediasi", "Memberi kesempatan mediasi", "Mediasi para pihak", "Proses Mediasin", "Perdamaian/Mediasi"]) {
      expect(tundaKarenaMediasi(a), a).toBe(true);
    }
    for (const a of ["", "Para pihak tidak hadir", "Panggil Tergugat", "Replik Pemohon", null, undefined]) {
      expect(tundaKarenaMediasi(a), String(a)).toBe(false);
    }
  });
});

describe("butir 1a/1d - tanggal sidang berikutnya", () => {
  const kal = [rencana("2026-06-10"), rencana("2026-06-24"), rencana("2026-07-01"), rencana("2026-07-08"), rencana("2026-07-15")];

  it("PRIORITAS: (1) tundaan mediasi 21 hari, (2) Court Calendar, (3) dua pekan - mediasi MENANG atas kalender", () => {
    const dasar = { tanggalSidang: "2026-07-01", keduanyaPernahHadir: true, kalender: kal, sudahTerjadwal: [] as string[] };
    const mediasi = tanggalSidangBerikut({ ...dasar, alasan: "Proses Mediasi" });
    expect(mediasi).toMatchObject({ tanggal: "2026-07-22", sumber: "mediasi", rencanaKe: null });
    expect(mediasi.penjelasan).toBe("tundaan mediasi: 3 minggu (21 hari) sesudah sidang ini.");
    expect(HARI_TUNDA_MEDIASI).toBe(21);

    const kalender = tanggalSidangBerikut({ ...dasar, alasan: "Replik Pemohon" });
    expect(kalender).toMatchObject({ tanggal: "2026-07-08", sumber: "court-calendar", rencanaKe: 4 });
    expect(kalender.penjelasan).toBe("mengikuti Court Calendar: 2026-07-08 (sidang ke-4).");

    const dua = tanggalSidangBerikut({ ...dasar, keduanyaPernahHadir: false, alasan: "Panggil Termohon" });
    expect(dua).toMatchObject({ tanggal: "2026-07-15", sumber: "dua-pekan" });
  });

  it("mediasi berlaku walau kalender kosong / tak terbaca / kehadiran bukan keduanya", () => {
    for (const kalender of [null, undefined, [] as RencanaKalender[]]) {
      const t = tanggalSidangBerikut({ tanggalSidang: "2026-09-02", keduanyaPernahHadir: false, kalender, alasan: "Proses Mediasi" });
      expect(t).toMatchObject({ tanggal: "2026-09-23", sumber: "mediasi" });
    }
  });

  it("Court Calendar: rencana PERTAMA sesudah sidang ini, melewati yang sudah terjadwal; sidang ke-n = urutan rencana", () => {
    const t = tanggalSidangBerikut({
      tanggalSidang: "2026-06-24",
      keduanyaPernahHadir: true,
      kalender: kal,
      sudahTerjadwal: ["2026-07-01"],
    });
    expect(t).toMatchObject({ tanggal: "2026-07-08", rencanaKe: 4, sumber: "court-calendar" });
    // Rencana kembar pada satu tanggal dihitung sekali.
    const kembar = tanggalSidangBerikut({
      tanggalSidang: "2026-06-10",
      keduanyaPernahHadir: true,
      kalender: [rencana("2026-06-10"), rencana("2026-06-24", "a"), rencana("2026-06-24", "b"), rencana("2026-07-01")],
    });
    expect(kembar).toMatchObject({ tanggal: "2026-06-24", rencanaKe: 2 });
    // Tanggal rencana yang SAMA dengan sidang ini bukan "sesudah".
    expect(tanggalSidangBerikut({ tanggalSidang: "2026-07-15", keduanyaPernahHadir: true, kalender: kal }).sumber).toBe("dua-pekan");
  });

  it("tanpa rencana yang cocok -> perilaku sekarang (dua pekan), dengan sebab yang disebut", () => {
    const dasar = { tanggalSidang: "2026-07-15", keduanyaPernahHadir: true };
    expect(tanggalSidangBerikut({ ...dasar, kalender: kal })).toMatchObject({ tanggal: "2026-07-29", sumber: "dua-pekan" });
    expect(tanggalSidangBerikut({ ...dasar, kalender: kal }).penjelasan).toContain("tidak ada rencana Court Calendar sesudah sidang ini");
    expect(tanggalSidangBerikut({ ...dasar, kalender: [] }).penjelasan).toContain("belum ada rencana Court Calendar");
    expect(tanggalSidangBerikut({ ...dasar, kalender: null }).penjelasan).toContain("Court Calendar tidak terbaca");
    expect(tanggalSidangBerikut({ tanggalSidang: "2026-07-15", keduanyaPernahHadir: false, kalender: kal }).penjelasan).toBe(
      "dua pekan sesudah sidang ini."
    );
  });

  it("tanggalJamUntuk: tanggal DAN jam dari pasangan alasan + agenda - satu pintu", () => {
    const dasar = { tanggalSidang: "2026-07-01", pernahKeduanyaSebelumnya: true, kalender: kal };
    expect(tanggalJamUntuk(dasar, "Replik Pemohon", "Replik Pemohon", 1)).toMatchObject({ tanggal: "2026-07-08", jam: "15:00", sumber: "court-calendar" });
    expect(tanggalJamUntuk(dasar, "Proses Mediasi", "Replik Pemohon", 1)).toMatchObject({ tanggal: "2026-07-22", jam: "09:00", sumber: "mediasi" });
    expect(tanggalJamUntuk(dasarTanggalKosong("2026-07-01"), "", "")).toMatchObject({ tanggal: "2026-07-15", jam: "09:00" });
  });
});

// Perkara cerai talak 314/Pdt.G/2026/PA.Dgl (kedua pihak hadir; mediasi diputus 24 Jun) - bentuk data sungguhan.
const r = (jadwalId: number, tanggal: string, dihadiriOleh: number | null, ditunda: boolean, agenda: string, alasan: string): SidangRiwayat => ({
  jadwalId,
  tanggal,
  dihadiriOleh,
  ditunda,
  agenda,
  alasan,
  ikrar: false,
});
const RIWAYAT_314 = [
  r(19227, "2026-06-10", 1, true, "Sidang Pertama", "mediasi/perdamaian"),
  r(19434, "2026-06-24", 1, true, "Perdamaian/Mediasi", "jawaban Termohon"),
  r(19435, "2026-07-01", 1, false, "Jawaban Termohon", ""),
];
const KEADAAN_314 = {
  jadwalId: 19435,
  perkaraId: 9314,
  nomorPerkara: "314/Pdt.G/2026/PA.Dgl",
  tanggalSidang: "2026-07-01",
  jamSidang: "09:00:00",
  agenda: "Jawaban Termohon",
  ditunda: "T",
  alasanDitunda: "0",
  urutan: 3,
  ruanganId: 1,
  dihadiriOleh: 1,
  alurPerkaraId: 15,
  jenisPerkaraId: 346,
  jenisPerkara: "Cerai Talak",
  ikrarTalak: "T",
};
const KALENDER_314: RencanaKalender[] = [
  rencana("2026-06-10", "Sidang Pertama"),
  rencana("2026-07-01", "Jawaban Termohon"),
  rencana("2026-07-08", "Replik Pemohon"),
  rencana("2026-07-15", "Duplik Termohon"),
];

describe("butir 1 - bawaanTunda memakai aturan bersama atas data perkara", () => {
  const riwayat = { sidang: RIWAYAT_314, mediasi: { ada: true, selesai: true, berhasil: false }, kalender: KALENDER_314 };

  it("kedua pihak hadir + mediasi selesai: Court Calendar (sidang ke-3), agenda Replik -> 15:00", () => {
    const usul = usulanTundaSidang(KEADAAN_314, riwayat);
    expect(usul).toMatchObject({
      alasan: "Replik Pemohon",
      agenda: "Replik Pemohon",
      tanggal: "2026-07-08",
      jam: "15:00",
      sumberTanggal: "court-calendar",
      rencanaKe: 3,
    });
    expect(usul?.penjelasanTanggal).toBe("mengikuti Court Calendar: 2026-07-08 (sidang ke-3).");
  });

  it("tanpa kalender (bot lama / tak terbaca) -> dua pekan; jam tetap menurut agenda", () => {
    const usul = usulanTundaSidang(KEADAAN_314, { ...riwayat, kalender: undefined });
    expect(usul).toMatchObject({ tanggal: "2026-07-15", jam: "15:00", sumberTanggal: "dua-pekan" });
  });

  it("kedua pihak hadir tetapi mediasi BELUM ada -> alasan Proses Mediasi = tundaan mediasi 21 hari, 09:00 (menang atas kalender)", () => {
    const usul = usulanTundaSidang(
      { ...KEADAAN_314, agenda: "Sidang Pertama", tanggalSidang: "2026-06-10", jadwalId: 19227 },
      { sidang: [r(19227, "2026-06-10", 1, false, "Sidang Pertama", "")], mediasi: null, kalender: KALENDER_314 }
    );
    expect(usul).toMatchObject({
      alasan: "Proses Mediasi",
      agenda: "Mendengarkan Laporan Hasil Mediasi",
      tanggal: "2026-07-01",
      jam: "09:00",
      sumberTanggal: "mediasi",
    });
    expect(usul?.penjelasanTanggal).toContain("tundaan mediasi: 3 minggu");
  });

  it("pihak kedua tidak hadir (kontak tak terbaca) -> kalender TIDAK diikuti: 2 minggu, sebabnya disebut", () => {
    const usul = usulanTundaSidang(
      { ...KEADAAN_314, dihadiriOleh: 2, jadwalId: 18602, tanggalSidang: "2026-03-09", agenda: "Panggil Tergugat", nomorPerkara: "104/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347 },
      { sidang: [r(18602, "2026-03-09", 2, false, "Panggil Tergugat", "")], mediasi: null, kalender: [rencana("2026-03-16"), rencana("2026-03-23")] }
    );
    // 23 Maret 2026 cuti bersama Idul Fitri (SKB 2026): usulan dua pekan bergeser ke Rabu 25 Maret (18 Okt 2026).
    expect(usul).toMatchObject({ tanggal: "2026-03-25", sumberTanggal: "tidak-hadir" });
    expect(usul?.penjelasanTanggal).toContain("data e-Court belum dibaca");
  });

  it("bawaanTunda menyimpan dasar tanggal supaya layar dapat menyusun ulang saat alasan diganti", () => {
    const usul = bawaanTunda({
      jadwalId: 19435,
      tanggalSidang: "2026-07-01",
      agenda: "Jawaban Termohon",
      dihadiriOlehSekarang: 1,
      riwayat: RIWAYAT_314,
      mediasi: { ada: true, selesai: true, berhasil: false },
      kalender: KALENDER_314,
      sebutan: { alurPerkaraId: 15, jenisPerkaraId: 346, nomorPerkara: "314/Pdt.G/2026/PA.Dgl" },
    });
    expect(usul.dasar.pernahKeduanyaSebelumnya).toBe(true);
    expect(tanggalJamUntuk(usul.dasar, "Proses Mediasi", usul.agenda, usul.kehadiran)).toMatchObject({ tanggal: "2026-07-22", jam: "09:00", sumber: "mediasi" });
  });
});

const kontak = (
  tergugat: Partial<KontakPihak["tergugat"]> = {},
  lain: Partial<KontakPihak> = {}
): KontakPihak => ({
  ecourtTerbaca: true,
  sebab: "",
  penggugat: { adaEmail: true, sumber: "sipp" },
  tergugat: { adaEmail: true, persetujuan: "setuju", ...tergugat },
  terakhirTerlihat: "2026-10-01",
  ...lain,
});
const KONTAK_TANPA_EMAIL = kontak({ adaEmail: false, persetujuan: "belum" });

describe("butir 1c - SATU fungsi bersama: kedua layar tidak memegang aturan sendiri", () => {
  it("hasil-sidang.tsx tidak punya salinan aturan jam/tanggal; keduanya memakai usulanTunda + tanggalJamUntuk", () => {
    expect(HASIL).not.toContain("AGENDA_SORE");
    expect(HASIL).not.toContain("function jamMenurutAgenda");
    expect(HASIL).not.toContain("function tambahHari");
    expect(HASIL).not.toMatch(/setDate\(/);
    expect(HASIL).not.toContain("includes(k)");
    const penuh = HASIL.slice(0, HASIL.indexOf("export function CatatHasilRingkas("));
    const ringkas = HASIL.slice(HASIL.indexOf("export function CatatHasilRingkas("));
    for (const bagian of [penuh, ringkas]) {
      expect(bagian).toContain("usulanTunda(");
      expect(bagian).toContain("tanggalJamUntuk(");
      expect(bagian).toContain("jamSidangBerikut(");
      expect(bagian).toContain("bacaKalender(");
      expect(bagian).toContain("tundaKarenaMediasi(");
    }
    // Aturannya hidup di SATU berkas.
    expect(LIB_TUNDA).toContain("export function jamSidangBerikut(");
    expect(LIB_TUNDA).toContain("export function tanggalSidangBerikut(");
    expect(LIB_TUNDA).toContain("export function tanggalJamUntuk(");
  });

  /** Rute fetch yang SAMA untuk kedua layar. */
  function pasangFetch(
    opsi: {
      kalender?: RencanaKalender[] | null;
      riwayat?: boolean;
      keadaan?: Record<string, unknown>;
      sidang?: SidangRiwayat[];
      mediasi?: unknown;
      /** undefined = rute kontak tidak terbaca; objek = jawaban rute. */
      kontak?: Record<string, unknown> | null;
    } = {}
  ) {
    const ambil = vi.fn(async (alamat: string) => {
      const a = String(alamat);
      const bungkus = (data: unknown) => new Response(JSON.stringify({ data }));
      if (a.includes("/api/aleta-ecourt/sidang-tunda?")) {
        return bungkus({
          ok: true,
          keadaan: opsi.keadaan ?? KEADAAN_314,
          riwayat:
            opsi.riwayat === false
              ? undefined
              : { sidang: opsi.sidang ?? RIWAYAT_314, mediasi: opsi.mediasi ?? { ada: true, selesai: true, berhasil: false } },
        });
      }
      if (a.includes("/api/aleta-ecourt/sidang/pihak-elektronik")) {
        return bungkus(opsi.kontak ? { available: true, ok: true, kontak: opsi.kontak } : { available: false, ok: false, kontak: null });
      }
      if (a.includes("/api/aleta-ecourt/sidang/kalender")) {
        return bungkus(opsi.kalender === null ? { available: false, ok: false, kalender: null } : { available: true, ok: true, kalender: opsi.kalender ?? KALENDER_314 });
      }
      if (a.includes("/api/aleta-ecourt/sidang-putus")) return bungkus({ ok: true, daftar: [{ id: 62, nama: "Dikabulkan", dipakai: 1 }] });
      return bungkus({ available: false, message: "tidak dibaca di uji ini" });
    });
    vi.stubGlobal("fetch", ambil);
    return ambil;
  }

  const tanggalDari = (c: HTMLElement) => (c.querySelector('input[type="date"]') as HTMLInputElement | null)?.value ?? "";
  const jamDari = (c: HTMLElement) => (c.querySelector('input[type="time"]') as HTMLInputElement | null)?.value ?? "";

  async function renderKeduanya() {
    const { CatatHasilRingkas, HasilSidang } = await import("@/components/portal/hasil-sidang");
    const ringkas = render(
      createElement(CatatHasilRingkas, { jadwalId: "19435", nomorPerkara: "314/Pdt.G/2026/PA.Dgl", jalan: "tunda", onTutup: () => undefined, onSelesai: () => undefined })
    );
    const cRingkas = ringkas.container;
    const penuh = render(createElement(HasilSidang, { jadwalId: "19435" }));
    const cPenuh = penuh.container;
    await screen.findAllByText(/314\/Pdt\.G\/2026\/PA\.Dgl/);
    fireEvent.click(await screen.findByRole("button", { name: /Ditunda/ }));
    return { cRingkas, cPenuh };
  }

  it("DIRENDER SUNGGUHAN: kedua layar memberi tanggal + jam + sumber yang SAMA (Court Calendar, 15:00)", async () => {
    pasangFetch();
    const { cRingkas, cPenuh } = await renderKeduanya();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-07-08"));
    await waitFor(() => expect(tanggalDari(cPenuh)).toBe("2026-07-08"));
    expect(jamDari(cRingkas)).toBe("15:00");
    expect(jamDari(cPenuh)).toBe("15:00");
    // Sumbernya disebut di layar.
    for (const c of [cRingkas, cPenuh]) {
      const sumber = c.querySelector("[data-sumber-tanggal]");
      expect(sumber?.getAttribute("data-sumber-tanggal")).toBe("court-calendar");
      expect(sumber?.textContent).toContain("mengikuti Court Calendar: 2026-07-08 (sidang ke-3)");
    }
  });

  it("Court Calendar tak terbaca: kedua layar jatuh ke dua pekan, dengan sebab yang sama", async () => {
    pasangFetch({ kalender: null });
    const { cRingkas, cPenuh } = await renderKeduanya();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-07-15"));
    await waitFor(() => expect(tanggalDari(cPenuh)).toBe("2026-07-15"));
    for (const c of [cRingkas, cPenuh]) {
      expect(c.querySelector("[data-sumber-tanggal]")?.getAttribute("data-sumber-tanggal")).toBe("dua-pekan");
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("Court Calendar tidak terbaca");
    }
  });

  it("alasan diganti ke MEDIASI: kedua layar -> 3 minggu, 09:00, 'tundaan mediasi' - mengalahkan Court Calendar", async () => {
    pasangFetch();
    const { cRingkas, cPenuh } = await renderKeduanya();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-07-08"));
    await waitFor(() => expect(tanggalDari(cPenuh)).toBe("2026-07-08"));

    fireEvent.change(cRingkas.querySelector('select[aria-label="Alasan penundaan"]') as HTMLSelectElement, { target: { value: "Proses Mediasi" } });
    fireEvent.change(cPenuh.querySelector('input[list="alasan-lazim"]') as HTMLInputElement, { target: { value: "Proses Mediasi" } });

    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-07-22"));
      expect(jamDari(c)).toBe("09:00");
      expect(c.querySelector("[data-sumber-tanggal]")?.getAttribute("data-sumber-tanggal")).toBe("mediasi");
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("tundaan mediasi: 3 minggu");
    }
  });

  it("tanggal yang diganti TANGAN tidak ditimpa ketika alasan diganti; sumbernya jadi 'manual'", async () => {
    pasangFetch();
    const { cRingkas, cPenuh } = await renderKeduanya();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-07-08"));
    await waitFor(() => expect(tanggalDari(cPenuh)).toBe("2026-07-08"));

    for (const c of [cRingkas, cPenuh]) {
      fireEvent.change(c.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-08-05" } });
    }
    fireEvent.change(cRingkas.querySelector('select[aria-label="Alasan penundaan"]') as HTMLSelectElement, { target: { value: "Proses Mediasi" } });
    fireEvent.change(cPenuh.querySelector('input[list="alasan-lazim"]') as HTMLInputElement, { target: { value: "Proses Mediasi" } });
    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(c.querySelector("[data-sumber-tanggal]")?.getAttribute("data-sumber-tanggal")).toBe("manual"));
      expect(tanggalDari(c)).toBe("2026-08-05");
    }
  });

  it("kehadiran diganti ke 'pihak pertama saja' (tergugat tidak hadir): tanggal ikut - kedua pihak pernah hadir + TIDAK punya email = 2 minggu, bukan kalender", async () => {
    pasangFetch({ kontak: KONTAK_TANPA_EMAIL });
    const { cRingkas, cPenuh } = await renderKeduanya();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-07-08"));
    await waitFor(() => expect(tanggalDari(cPenuh)).toBe("2026-07-08"));
    for (const c of [cRingkas, cPenuh]) {
      const pilih = Array.from(c.querySelectorAll("select")).find((x) => /Semua hadir/.test(x.textContent ?? "")) as HTMLSelectElement;
      fireEvent.change(pilih, { target: { value: "2" } });
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-07-15"));
      expect(c.querySelector("[data-sumber-tanggal]")?.getAttribute("data-sumber-tanggal")).toBe("tidak-hadir");
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("2 minggu");
    }
  });

  // Perkara 104/Pdt.G/2026/PA.Dgl - sidang pertama 9 Mar 2026, hanya penggugat yang hadir (kehadiran 2).
  const KEADAAN_104 = {
    ...KEADAAN_314,
    jadwalId: 18602,
    perkaraId: 9104,
    nomorPerkara: "104/Pdt.G/2026/PA.Dgl",
    tanggalSidang: "2026-03-09",
    agenda: "Pemeriksaan Pokok Perkara",
    dihadiriOleh: 2,
    jenisPerkaraId: 347,
    jenisPerkara: "Cerai Gugat",
  };
  const SIDANG_104 = [r(18602, "2026-03-09", 2, false, "Pemeriksaan Pokok Perkara", "")];

  async function renderKeduanya104() {
    const { CatatHasilRingkas, HasilSidang } = await import("@/components/portal/hasil-sidang");
    const ringkas = render(
      createElement(CatatHasilRingkas, { jadwalId: "18602", nomorPerkara: "104/Pdt.G/2026/PA.Dgl", jalan: "tunda", onTutup: () => undefined, onSelesai: () => undefined })
    );
    const penuh = render(createElement(HasilSidang, { jadwalId: "18602" }));
    await screen.findAllByText(/104\/Pdt\.G\/2026\/PA\.Dgl/);
    fireEvent.click(await screen.findByRole("button", { name: /Ditunda/ }));
    return { cRingkas: ringkas.container, cPenuh: penuh.container };
  }

  it("tergugat TIDAK hadir, punya email + setuju e-Court: KEDUA layar -> 1 minggu, dengan sebab dan keterangan email/persetujuan", async () => {
    pasangFetch({ keadaan: KEADAAN_104, sidang: SIDANG_104, mediasi: null, kontak: kontak(), kalender: [] });
    const { cRingkas, cPenuh } = await renderKeduanya104();
    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-03-16"));
      const sumber = c.querySelector("[data-sumber-tanggal]");
      expect(sumber?.getAttribute("data-sumber-tanggal")).toBe("tidak-hadir");
      expect(sumber?.textContent).toContain("tergugat tidak hadir, tergugat punya email dan setuju e-Court: 1 minggu");
      expect(c.querySelector("[data-kontak-pihak]")?.textContent).toContain("Email tergugat: ada · persetujuan e-Court: setuju");
    }
  });

  it("persetujuan e-Court TIDAK setuju (merah): kedua layar -> 2 minggu dan menyebut sebabnya", async () => {
    pasangFetch({ keadaan: KEADAAN_104, sidang: SIDANG_104, mediasi: null, kontak: kontak({ persetujuan: "tidak_setuju" }), kalender: [] });
    const { cRingkas, cPenuh } = await renderKeduanya104();
    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-03-25"));
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("tergugat tidak setuju e-Court: 2 minggu");
      expect(c.querySelector("[data-kontak-pihak]")?.textContent).toContain("persetujuan e-Court: tidak setuju");
    }
  });

  it("data e-Court TAK TERBACA (bot mati / rute gagal): kedua layar jatuh ke 2 minggu, menyebut 'belum dapat dibaca' - tidak menebak", async () => {
    pasangFetch({ keadaan: KEADAAN_104, sidang: SIDANG_104, mediasi: null, kalender: [] });
    const { cRingkas, cPenuh } = await renderKeduanya104();
    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-03-25"));
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("data e-Court belum dibaca");
      expect(c.querySelector("[data-kontak-pihak]")?.textContent).toContain("belum dapat dibaca");
    }
  });

  it("penggugat TIDAK hadir (kehadiran diganti): kedua layar -> 1 minggu tanpa syarat, walau kontak tak terbaca", async () => {
    pasangFetch({ keadaan: KEADAAN_104, sidang: SIDANG_104, mediasi: null, kalender: [] });
    const { cRingkas, cPenuh } = await renderKeduanya104();
    for (const c of [cRingkas, cPenuh]) {
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-03-25"));
      const pilih = Array.from(c.querySelectorAll("select")).find((x) => /Pihak pertama saja/.test(x.textContent ?? "")) as HTMLSelectElement;
      fireEvent.change(pilih, { target: { value: "3" } });
      await waitFor(() => expect(tanggalDari(c)).toBe("2026-03-16"));
      expect(c.querySelector("[data-sumber-tanggal]")?.textContent).toContain("penggugat tidak hadir, tergugat hadir: 1 minggu");
    }
  });

  it("kontak dibaca lewat rute pihak-elektronik, dengan perkaraId - tanpa alamat email di jawaban yang dipakai layar", async () => {
    const ambil = pasangFetch({ keadaan: KEADAAN_104, sidang: SIDANG_104, mediasi: null, kontak: kontak(), kalender: [] });
    const { cRingkas } = await renderKeduanya104();
    await waitFor(() => expect(tanggalDari(cRingkas)).toBe("2026-03-16"));
    const panggilan = ambil.mock.calls.map((c) => String(c[0])).filter((a) => a.includes("/sidang/pihak-elektronik"));
    expect(panggilan.length).toBeGreaterThanOrEqual(2);
    expect(panggilan[0]).toContain("perkaraId=9104");
    expect(cRingkas.textContent).not.toContain("@");
  });
});

// ============================================================================
// BUTIR 1e - TUNDA KARENA KETIDAKHADIRAN
// ============================================================================

describe("butir 1e - aturan ketidakhadiran (fungsi bersama)", () => {
  const T = "2026-07-01";
  const kal = [rencana("2026-07-08"), rencana("2026-07-15")];
  const hari = (n: number) => {
    const d = new Date(`${T}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const dasar = (lain: Record<string, unknown> = {}) => ({ tanggalSidang: T, pernahKeduanyaSebelumnya: false, kalender: kal, ...lain });
  const hitung = (kehadiran: number, k: KontakPihak | null | undefined, lain: Record<string, unknown> = {}, alasan = "Panggil Tergugat") =>
    tanggalJamUntuk({ ...dasar(lain), kontak: k }, alasan, "Pembuktian Penggugat", kehadiran);

  it("penggugat/pemohon TIDAK hadir, tergugat hadir -> 1 minggu, TANPA syarat (kontak apa pun, bahkan tak terbaca)", () => {
    for (const k of [null, undefined, KONTAK_TANPA_EMAIL, kontak(), kontak({ persetujuan: "tidak_setuju" })]) {
      const h = hitung(3, k);
      expect(h).toMatchObject({ tanggal: hari(7), sumber: "tidak-hadir" });
      expect(h.penjelasan).toBe("penggugat tidak hadir, tergugat hadir: 1 minggu (7 hari) sesudah sidang ini.");
    }
    expect(HARI_TUNDA_SATU_PEKAN).toBe(7);
    expect(HARI_TUNDA_DUA_PEKAN).toBe(14);
  });

  it("sebutan mengikuti perkara: permohonan menyebut pemohon/termohon", () => {
    const h = tanggalJamUntuk({ ...dasar(), sebutan: { satu: "Pemohon", dua: "Termohon" } }, "", "", 3);
    expect(h.penjelasan).toContain("pemohon tidak hadir, termohon hadir");
  });

  it("sudah pernah hadir semua + SALAH SATUNYA tidak hadir: 1 minggu DENGAN SYARAT tergugat punya email (persetujuan e-Court tidak ditanya)", () => {
    for (const persetujuan of ["setuju", "tidak_setuju", "belum", "tidak-diketahui"] as const) {
      const h = hitung(2, kontak({ persetujuan }), { pernahKeduanyaSebelumnya: true });
      expect(h, persetujuan).toMatchObject({ tanggal: hari(7), sumber: "tidak-hadir" });
      expect(h.penjelasan).toContain("kedua pihak pernah hadir");
      expect(h.penjelasan).toContain("tergugat punya email");
    }
    const tanpa = hitung(2, KONTAK_TANPA_EMAIL, { pernahKeduanyaSebelumnya: true });
    expect(tanpa).toMatchObject({ tanggal: hari(14), sumber: "tidak-hadir" });
    expect(tanpa.penjelasan).toContain("tergugat tidak punya email");
  });

  it("tergugat TIDAK hadir (belum pernah hadir semua): 1 minggu bila punya email DAN setuju (hijau)", () => {
    const h = hitung(2, kontak({ adaEmail: true, persetujuan: "setuju" }));
    expect(h).toMatchObject({ tanggal: hari(7), sumber: "tidak-hadir" });
    expect(h.penjelasan).toBe("tergugat tidak hadir, tergugat punya email dan setuju e-Court: 1 minggu (7 hari) sesudah sidang ini.");
  });

  it("tergugat tidak hadir -> 2 MINGGU: tidak punya email / tidak setuju (merah) / belum membuat persetujuan (toska) - sebab disebut", () => {
    const kasus: Array<[KontakPihak, string]> = [
      [kontak({ adaEmail: false, persetujuan: "setuju" }), "tergugat tidak punya email"],
      [kontak({ adaEmail: true, persetujuan: "tidak_setuju" }), "tergugat tidak setuju e-Court"],
      [kontak({ adaEmail: true, persetujuan: "belum" }), "tergugat belum membuat persetujuan e-Court"],
      [kontak({ adaEmail: true, persetujuan: "tidak-diketahui" }), "persetujuan e-Court tergugat tidak diketahui"],
    ];
    for (const [k, sebab] of kasus) {
      const h = hitung(2, k);
      expect(h, sebab).toMatchObject({ tanggal: hari(14), sumber: "tidak-hadir" });
      expect(h.penjelasan).toContain(sebab);
      expect(h.penjelasan).toContain("2 minggu (14 hari)");
    }
  });

  it("DATA TAK TERBACA tidak ditebak: jatuh ke tanpa email (2 minggu) dan sebabnya disebut - termasuk saat 'pernah hadir semua'", () => {
    const belumDibaca = hitung(2, undefined);
    expect(belumDibaca).toMatchObject({ tanggal: hari(14) });
    expect(belumDibaca.penjelasan).toContain("data e-Court belum dibaca");
    const takTerbaca = hitung(2, kontak({ adaEmail: true, persetujuan: "setuju" }, { ecourtTerbaca: false, sebab: "data e-Court tidak terjangkau" }));
    // Email "ada" pada kontak yang tidak terbaca TIDAK dipercaya sendirian: ecourtTerbaca=false -> sebab tak terbaca.
    expect(takTerbaca).toMatchObject({ tanggal: hari(14), sumber: "tidak-hadir" });
    expect(takTerbaca.penjelasan).toContain("data e-Court tidak terbaca");
    const tanpaData = hitung(2, kontak({ adaEmail: false, persetujuan: "tidak-diketahui" }, { ecourtTerbaca: false, sebab: "data e-Court tidak terjangkau" }));
    expect(tanpaData).toMatchObject({ tanggal: hari(14) });
    expect(tanpaData.penjelasan).toContain("data e-Court tidak terbaca (data e-Court tidak terjangkau)");
    const pernah = hitung(2, null, { pernahKeduanyaSebelumnya: true });
    expect(pernah).toMatchObject({ tanggal: hari(14) });
    expect(pernah.penjelasan).toContain("data e-Court belum dibaca");
  });

  it("kedua pihak tidak hadir diperlakukan sebagai tergugat tidak hadir", () => {
    expect(hitung(4, kontak())).toMatchObject({ tanggal: hari(7) });
    expect(hitung(4, KONTAK_TANPA_EMAIL)).toMatchObject({ tanggal: hari(14) });
    expect(hitung(4, kontak()).penjelasan).toContain("penggugat dan tergugat tidak hadir");
  });

  it("semua hadir / kehadiran tak diketahui / permohonan tanpa pihak kedua / sidang ikrar: aturan ketidakhadiran TIDAK berlaku", () => {
    expect(tanggalJamUntuk({ ...dasar(), kontak: kontak() }, "Para pihak tidak hadir", "", 1).sumber).not.toBe("tidak-hadir");
    expect(tanggalJamUntuk({ ...dasar(), kontak: kontak() }, "", "", undefined).sumber).not.toBe("tidak-hadir");
    expect(hitung(3, kontak(), { voluntair: true }).sumber).not.toBe("tidak-hadir");
    expect(hitung(2, kontak(), { ikrar: true }).sumber).not.toBe("tidak-hadir");
  });

  it("PRIORITAS TANGGAL: ketidakhadiran > tundaan mediasi > Court Calendar > dua pekan - dan jam tetap ikut 1b/1d", () => {
    const k = kontak();
    // ketidakhadiran menang atas mediasi dan kalender
    const a = tanggalJamUntuk({ ...dasar({ pernahKeduanyaSebelumnya: true }), kontak: k }, "Proses Mediasi", "Replik Pemohon", 3);
    expect(a).toMatchObject({ tanggal: hari(7), sumber: "tidak-hadir" });
    // mediasi menang atas kalender (semua hadir)
    const b = tanggalJamUntuk({ ...dasar({ pernahKeduanyaSebelumnya: true }), kontak: k }, "Proses Mediasi", "Replik Pemohon", 1);
    expect(b).toMatchObject({ tanggal: hari(21), sumber: "mediasi" });
    // kalender (semua hadir, bukan mediasi)
    const c = tanggalJamUntuk({ ...dasar({ pernahKeduanyaSebelumnya: true }), kontak: k }, "Replik Pemohon", "Replik Pemohon", 1);
    expect(c).toMatchObject({ tanggal: "2026-07-08", sumber: "court-calendar" });
    // dua pekan
    const d = tanggalJamUntuk({ ...dasar(), kontak: k }, "", "", undefined);
    expect(d).toMatchObject({ tanggal: hari(14), sumber: "dua-pekan" });
    // Jam: sepekan karena penggugat tidak hadir, agenda Replik -> 15:00; alasan mediasi -> 09:00.
    expect(tanggalJamUntuk({ ...dasar(), kontak: k }, "Replik Pemohon", "Replik Pemohon", 3).jam).toBe("15:00");
    expect(a.jam).toBe("09:00");
    expect(tanggalJamUntuk({ ...dasar(), kontak: k }, "Panggil Tergugat", "Pembuktian Penggugat", 3).jam).toBe("09:00");
  });

  it("bawaanTunda atas data perkara: sidang pertama, tergugat tidak hadir, tergugat setuju e-Court = 1 minggu; tanpa data = 2 minggu", () => {
    const masukan = {
      jadwalId: 18602,
      tanggalSidang: "2026-03-09",
      agenda: "Pemeriksaan Pokok Perkara",
      dihadiriOlehSekarang: 2,
      riwayat: [r(18602, "2026-03-09", 2, false, "Pemeriksaan Pokok Perkara", "")],
      mediasi: null,
      sebutan: { alurPerkaraId: 15, jenisPerkaraId: 347, nomorPerkara: "104/Pdt.G/2026/PA.Dgl" },
    };
    expect(bawaanTunda({ ...masukan, kontak: kontak() })).toMatchObject({ tanggal: "2026-03-16", sumberTanggal: "tidak-hadir", kehadiran: 2 });
    expect(bawaanTunda({ ...masukan, kontak: kontak({ persetujuan: "tidak_setuju" }) })).toMatchObject({ tanggal: "2026-03-25", sumberTanggal: "tidak-hadir" });
    expect(bawaanTunda({ ...masukan })).toMatchObject({ tanggal: "2026-03-25", sumberTanggal: "tidak-hadir" });
    // Kehadiran diganti ke pihak kedua saja (penggugat tidak hadir): sepekan.
    expect(bawaanTunda({ ...masukan }, 3)).toMatchObject({ tanggal: "2026-03-16", sumberTanggal: "tidak-hadir" });
  });
});

describe("butir 1f - bentuk dan kalimat kontak pihak", () => {
  it("bacaBentukKontak menolak bentuk yang tidak dikenali (bot lama) dan tidak membawa alamat apa pun", () => {
    expect(bacaBentukKontak(null)).toBeNull();
    expect(bacaBentukKontak({})).toBeNull();
    const k = bacaBentukKontak({
      ecourtTerbaca: true,
      sebab: "",
      penggugat: { adaEmail: true, sumber: "sipp", email: "rahasia@contoh.id" },
      tergugat: { adaEmail: true, persetujuan: "setuju", email: "rahasia@contoh.id" },
      terakhirTerlihat: "2026-10-01",
    });
    expect(k).toMatchObject({ ecourtTerbaca: true, penggugat: { adaEmail: true, sumber: "sipp" }, tergugat: { persetujuan: "setuju" } });
    expect(JSON.stringify(k)).not.toContain("@");
    expect(bacaBentukKontak({ ecourtTerbaca: true, tergugat: { persetujuan: "ngawur" } })?.tergugat.persetujuan).toBe("tidak-diketahui");
  });

  it("kalimatKontak: ada/tidak, setuju/tidak setuju/belum, sumber email penggugat, tak terbaca disebut", () => {
    expect(kalimatKontak(kontak())).toBe("Email tergugat: ada · persetujuan e-Court: setuju · email penggugat: ada (SIPP) · e-Court terbaca 2026-10-01.");
    expect(kalimatKontak(kontak({ adaEmail: false, persetujuan: "tidak_setuju" }, { penggugat: { adaEmail: true, sumber: "ecourt" } }), "Termohon", "Pemohon")).toContain(
      "Email termohon: tidak ada · persetujuan e-Court: tidak setuju · email pemohon: ada (e-Court)"
    );
    expect(kalimatKontak(kontak({ persetujuan: "belum" }))).toContain("persetujuan e-Court: belum membuat persetujuan");
    expect(kalimatKontak(null)).toContain("belum dapat dibaca");
    expect(kalimatKontak(kontak({}, { ecourtTerbaca: false, sebab: "perkara ini belum tercatat di data e-Court" }))).toContain(
      "persetujuan e-Court: tidak terbaca (perkara ini belum tercatat di data e-Court) - tanggal tunda memakai aturan tanpa email."
    );
  });
});

// ============================================================================
// BUTIR 1 - BOT: COURT CALENDAR HANYA DIBACA
// ============================================================================

describe("butir 1 - bot kalenderPerkara (basis data tiruan, hanya SELECT)", () => {
  type Kueri = { sql: string; nilai: unknown[] };

  function muatHasil(jawab: (sql: string) => unknown) {
    const catatan: Kueri[] = [];
    for (const kunci of Object.keys(require_.cache)) {
      if (kunci.startsWith(path.join(AKAR, "aleta_bot")) && !kunci.includes("node_modules")) delete require_.cache[kunci];
    }
    const dbPalsu = {
      query(sql: string, nilai: unknown, cb?: (e: unknown, r: unknown) => void) {
        const selesai = typeof nilai === "function" ? (nilai as (e: unknown, r: unknown) => void) : cb;
        catatan.push({ sql: String(sql), nilai: Array.isArray(nilai) ? nilai : [] });
        try {
          selesai?.(null, jawab(String(sql)));
        } catch (galat) {
          selesai?.(galat, undefined);
        }
      },
    };
    const botDbPalsu = { query: async () => [], fromMysqlDate: () => null, toMysqlDate: () => null };
    for (const [relatif, isi] of [
      ["./db_config", dbPalsu],
      ["./services/botDbService", botDbPalsu],
    ] as const) {
      const berkas = require_.resolve(relatif);
      require_.cache[berkas] = { id: berkas, filename: berkas, loaded: true, exports: isi } as unknown as NodeJS.Module;
    }
    const layanan = require_("./services/sidangHasilService.js") as { kalenderPerkara: (id: unknown) => Promise<unknown> };
    return { layanan, catatan };
  }

  it("satu SELECT atas perkara_court_calendar; bentuk {tanggal, jam, agenda, keterangan}", async () => {
    const { layanan, catatan } = muatHasil(() => [
      { tanggal: "2026-07-08", jam: "15:00", agenda: "Replik Pemohon", keterangan: "" },
      { tanggal: "2026-07-15", jam: "15:00", agenda: "Duplik Termohon", keterangan: "x" },
    ]);
    const hasil = (await layanan.kalenderPerkara(9314)) as RencanaKalender[];
    expect(hasil).toEqual([
      { tanggal: "2026-07-08", jam: "15:00", agenda: "Replik Pemohon", keterangan: "" },
      { tanggal: "2026-07-15", jam: "15:00", agenda: "Duplik Termohon", keterangan: "x" },
    ]);
    expect(catatan).toHaveLength(1);
    expect(catatan[0].sql.replace(/\s+/g, " ")).toMatch(/^SELECT .* FROM perkara_court_calendar WHERE perkara_id = \? /);
    expect(catatan[0].nilai).toEqual([9314]);
  });

  it("gagal membaca = null (layar jatuh ke dua pekan); perkara tidak sah = null tanpa kueri; kosong = []", async () => {
    const mati = muatHasil(() => {
      throw new Error("mati");
    });
    expect(await mati.layanan.kalenderPerkara(9314)).toBeNull();
    const kosong = muatHasil(() => []);
    expect(await kosong.layanan.kalenderPerkara(9314)).toEqual([]);
    expect(await kosong.layanan.kalenderPerkara("abc")).toBeNull();
    expect(kosong.catatan).toHaveLength(1);
  });

  it("rute: bot bertoken & hanya GET; portal memeriksa kewenangan panel", () => {
    expect(RUTE_BOT).toContain('router.get("/kalender", wajibToken,');
    expect(RUTE_BOT).toContain("sidangHasilService.kalenderPerkara(req.query.perkaraId)");
    expect(RUTE_KALENDER).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(RUTE_KALENDER).toContain("export async function GET(");
    expect(RUTE_KALENDER).not.toContain("export async function POST(");
    expect(RUTE_KALENDER).toContain("kalender: null");
  });
});

// ============================================================================
// BUTIR 1f - BOT: EMAIL DAN PERSETUJUAN (HANYA MEMBACA, TANPA ALAMAT KE PORTAL)
// ============================================================================

const kontakMod = require_(path.join(AKAR, "aleta_bot/services/sidangKontakService.js")) as {
  susunKontak: (b: Record<string, unknown>) => KontakPihak & { terakhirTerlihat?: string };
  buatLayanan: (deps: Record<string, unknown>) => { kontakPerkara: (id: unknown) => Promise<Record<string, unknown>> };
  emailSah: (x: string) => boolean;
  sisiPeran: (x: string) => number;
  gabungPersetujuan: (x: string[]) => string;
};
const SERVICE_KONTAK = baca("aleta_bot/services/sidangKontakService.js");

describe("butir 1f - sidangKontakService (basis data tiruan)", () => {
  const EMAIL_P = "penggugat.rahasia@contoh.id";
  const EMAIL_T = "tergugat.rahasia@contoh.id";
  const ec = (peran: string, email: string, persetujuan: string, terakhir = new Date(2026, 9, 1, 10, 0, 0)) => ({
    nama: "Nama Pihak",
    peran,
    email,
    persetujuan,
    terakhirTerlihat: terakhir,
  });

  it("peran e-Court dipetakan ke sisi; persetujuan digabung (satu yang menolak = tidak setuju)", () => {
    expect(kontakMod.sisiPeran("Penggugat")).toBe(1);
    expect(kontakMod.sisiPeran("Pemohon")).toBe(1);
    expect(kontakMod.sisiPeran("Tergugat")).toBe(2);
    expect(kontakMod.sisiPeran("Turut Termohon")).toBe(2);
    expect(kontakMod.sisiPeran("Kuasa")).toBe(0);
    expect(kontakMod.gabungPersetujuan(["setuju", "setuju"])).toBe("setuju");
    expect(kontakMod.gabungPersetujuan(["setuju", "tidak_setuju"])).toBe("tidak_setuju");
    expect(kontakMod.gabungPersetujuan(["setuju", "belum"])).toBe("belum");
    expect(kontakMod.gabungPersetujuan([])).toBe("tidak-diketahui");
    expect(kontakMod.emailSah("a@b.id")).toBe(true);
    for (const x of ["", "-", "tidak ada", "a@b"]) expect(kontakMod.emailSah(x)).toBe(false);
  });

  it("email PENGGUGAT dari SIPP bila ada; kalau tidak, dari e-Court; email/persetujuan TERGUGAT hanya dari e-Court", () => {
    const k = kontakMod.susunKontak({
      sipp: { terbaca: true, pihak: [{ sisi: 1, email: EMAIL_P }, { sisi: 2, email: EMAIL_T }] },
      ecourt: { terbaca: true, pihak: [ec("Penggugat", "", "setuju"), ec("Tergugat", "", "setuju")] },
    });
    expect(k.penggugat).toEqual({ adaEmail: true, sumber: "sipp" });
    // Email tergugat di SIPP TIDAK dipakai: e-Court-lah sumbernya.
    expect(k.tergugat).toEqual({ adaEmail: false, persetujuan: "setuju" });

    const dariEcourt = kontakMod.susunKontak({
      sipp: { terbaca: true, pihak: [{ sisi: 1, email: "" }] },
      ecourt: { terbaca: true, pihak: [ec("Penggugat", EMAIL_P, "setuju"), ec("Tergugat", EMAIL_T, "tidak_setuju")] },
    });
    expect(dariEcourt.penggugat).toEqual({ adaEmail: true, sumber: "ecourt" });
    expect(dariEcourt.tergugat).toEqual({ adaEmail: true, persetujuan: "tidak_setuju" });
    expect(dariEcourt).toMatchObject({ ecourtTerbaca: true, sebab: "", terakhirTerlihat: "2026-10-01" });
  });

  it("beberapa tergugat: SEMUA harus punya email; persetujuan gabungan", () => {
    const k = kontakMod.susunKontak({
      sipp: { terbaca: true, pihak: [] },
      ecourt: { terbaca: true, pihak: [ec("Penggugat", EMAIL_P, "setuju"), ec("Tergugat I", EMAIL_T, "setuju"), ec("Tergugat II", "", "setuju")] },
    });
    expect(k.tergugat.adaEmail).toBe(false);
  });

  it("e-Court TAK TERBACA / perkara belum ada di data e-Court: tidak ditebak - sebab disebut, persetujuan tidak diketahui", () => {
    const mati = kontakMod.susunKontak({ sipp: { terbaca: true, pihak: [] }, ecourt: { terbaca: false, pihak: [] } });
    expect(mati).toMatchObject({ ecourtTerbaca: false, tergugat: { adaEmail: false, persetujuan: "tidak-diketahui" } });
    expect(mati.sebab).toContain("data e-Court tidak terjangkau");
    const kosong = kontakMod.susunKontak({ sipp: { terbaca: true, pihak: [] }, ecourt: { terbaca: true, pihak: [] } });
    expect(kosong.ecourtTerbaca).toBe(false);
    expect(kosong.sebab).toContain("belum tercatat di data e-Court");
    const tanpaSipp = kontakMod.susunKontak({ sipp: { terbaca: false, pihak: [] }, ecourt: { terbaca: true, pihak: [ec("Penggugat", EMAIL_P, "setuju"), ec("Tergugat", EMAIL_T, "setuju")] } });
    expect(tanpaSipp.sebab).toContain("SIPP tidak terbaca");
    expect(tanpaSipp.penggugat).toEqual({ adaEmail: true, sumber: "ecourt" });
  });

  it("kontakPerkara: HANYA SELECT ke SIPP, membaca tabel bot lewat bacaEcourt - dan jawabannya TIDAK memuat satu alamat email pun", async () => {
    const sipp = tiruan((sql) => {
      if (sql.startsWith("SELECT nomor_perkara")) return [{ nomorPerkara: "459/Pdt.G/2026/PA.Dgl" }];
      return [{ sisi: 1, email: EMAIL_P }, { sisi: 2, email: "" }];
    });
    const bacaEcourt = vi.fn(async () => ({ pihak: [ec("Penggugat", EMAIL_P, "setuju"), ec("Tergugat", EMAIL_T, "setuju")], panggilan: [] }));
    const L = kontakMod.buatLayanan({ kueriSipp: sipp.kueri, bacaEcourt });
    const hasil = await L.kontakPerkara(9459);
    expect(hasil.ok).toBe(true);
    expect(bacaEcourt).toHaveBeenCalledWith("459/Pdt.G/2026/PA.Dgl");
    expect(sipp.catatan.every((c) => c.sql.startsWith("SELECT"))).toBe(true);
    expect(sipp.catatan[1].sql).toContain("FROM perkara_pihak1 pp JOIN pihak p ON p.id = pp.pihak_id");
    expect(sipp.catatan[1].sql).toContain("FROM perkara_pihak2 pp JOIN pihak p ON p.id = pp.pihak_id");
    expect(sipp.catatan[1].params).toEqual([9459, 9459]);
    expect(hasil.kontak).toMatchObject({ ecourtTerbaca: true, penggugat: { adaEmail: true, sumber: "sipp" }, tergugat: { adaEmail: true, persetujuan: "setuju" } });
    expect(JSON.stringify(hasil)).not.toMatch(/@|rahasia/);
  });

  it("kegagalan membaca tidak membocorkan nilai kueri (pesan galat tidak diteruskan) dan tidak menjatuhkan jawaban", async () => {
    const sipp = tiruan(() => {
      throw new Error(`Table x doesn't exist WHERE email='${EMAIL_P}'`);
    });
    const bacaEcourt = vi.fn(async () => {
      throw new Error(`gagal untuk ${EMAIL_T}`);
    });
    const hasil = (await kontakMod.buatLayanan({ kueriSipp: sipp.kueri, bacaEcourt }).kontakPerkara(9459)) as { ok: boolean; kontak: KontakPihak };
    expect(hasil.ok).toBe(true);
    expect(hasil.kontak).toMatchObject({ ecourtTerbaca: false, tergugat: { adaEmail: false, persetujuan: "tidak-diketahui" } });
    expect(JSON.stringify(hasil)).not.toMatch(/@|rahasia|Table x/);
    // Perkara tidak sah: ditolak tanpa kueri.
    const ditolak = await kontakMod.buatLayanan({ kueriSipp: sipp.kueri, bacaEcourt }).kontakPerkara("abc");
    expect(ditolak).toMatchObject({ ok: false, alasan: "perkara_tidak_sah" });
  });

  it("bot memakai ulang pembaca e-Court yang SUDAH ada (tabel aleta_bot_ecourt_pihak), tidak membuat pembaca baru ke e-Court", () => {
    expect(SERVICE_KONTAK).toContain('require("./ecourtStoreService").bacaPanggilanPerkara(nomorPerkara)');
    // Tidak ada akses jaringan/peramban ke e-Court dari berkas ini.
    const kode = SERVICE_KONTAK.split("\n").filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b)).join("\n");
    expect(kode).not.toMatch(/puppeteer|playwright|https?:\/\/|fetch\(|axios|console\./);
    expect(kode).not.toMatch(/INSERT|UPDATE|DELETE|REPLACE/);
    // Pembaca yang dipakai ulang memang ada dan menulis persetujuan dari ikon e-Court.
    const scraper = baca("aleta_bot/tools/ecourt-bridge/scraper.js");
    expect(scraper).toContain("function extractPersetujuanPihak(html)");
    expect(scraper).toContain('/fa-check-circle/i.test(selPersetujuan)');
    expect(baca("aleta_bot/services/ecourtStoreService.js")).toContain("INSERT INTO aleta_bot_ecourt_pihak");
  });

  it("pembaca halaman e-Court yang dipakai ulang mengenali ikon hijau / merah / toska pada tangkapan 146 (HTML tiruan)", () => {
    const scraper = require_(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/scraper.js")) as { extractPersetujuanPihak: (h: string) => Array<Record<string, string>> };
    const baris = (no: number, nama: string, ikon: string) =>
      `<tr><td>${no}</td><td>${nama}</td><td>Alamat</td><td>Telp : 085825431894<br>Email : ${no}@contoh.id</td><td>${ikon}</td><td>Aksi</td></tr>`;
    const html = `<h3>Persetujuan Pihak Menggunakan Saluran Elektronik</h3><table><tr><th>No.</th></tr>${baris(1, "Andi Asriani binti Hi. Andi Nasir. P (Penggugat)", '<i class="fa fa-check-circle"></i>')}${baris(2, "Firmansyah bin Ridwan (Tergugat)", '<i class="fa fa-times-circle"></i>')}${baris(3, "Ibu Tiga (Tergugat)", '<span class="kotak"></span>')}</table>`;
    const hasil = scraper.extractPersetujuanPihak(html);
    expect(hasil.map((h) => [h.peran, h.persetujuan, h.email])).toEqual([
      ["Penggugat", "setuju", "1@contoh.id"],
      ["Tergugat", "tidak_setuju", "2@contoh.id"],
      ["Tergugat", "belum", "3@contoh.id"],
    ]);
  });

  it("rute bot dan portal pihak-elektronik: bertoken, hanya GET, kewenangan panel, galat tidak diteruskan", () => {
    const rutePortal = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/pihak-elektronik/route.ts");
    expect(RUTE_BOT).toContain('router.get("/pihak-elektronik", wajibToken,');
    const potongan = RUTE_BOT.slice(RUTE_BOT.indexOf('router.get("/pihak-elektronik"'), RUTE_BOT.indexOf('router.get("/mediasi"'));
    expect(potongan).toContain('error: "kontak_pihak_tidak_terbaca"');
    expect(potongan).not.toContain("galat.message");
    expect(rutePortal).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(rutePortal).toContain("export async function GET(");
    expect(rutePortal).not.toContain("export async function POST(");
    expect(rutePortal).toContain('alasan: "ALETA Bot belum dapat dihubungi."');
    expect(rutePortal).not.toContain("hasil.error");
    // Layar tidak mencatat email ke konsol.
    expect(baca("manajemen_surat/src/lib/jadwal-sidang-kontak.ts")).not.toMatch(/console\./);
  });
});

describe("butir 1f - keterangan di Rincian Jadwal Sidang", () => {
  it("KontakPihakRincian membaca kontak sekali saat Rincian dibuka dan menyebut ada/tidak + persetujuan", async () => {
    const { KontakPihakRincian } = await import("@/components/portal/jadwal-sidang-2okt");
    const ambil = vi.fn(async () => new Response(JSON.stringify({ data: { available: true, ok: true, kontak: kontak({ persetujuan: "belum" }) } })));
    vi.stubGlobal("fetch", ambil);
    const { container } = render(createElement(KontakPihakRincian, { perkaraId: "9459", nomorPerkara: "459/Pdt.G/2026/PA.Dgl" }));
    // JADWAL-3 butir 5 (19 Okt 2026): tanpa tulisan memuat selama kontak dibaca.
    expect(container.textContent).not.toContain("Membaca");
    expect(container.querySelector("[data-kontak-pihak-rincian]")).not.toBeNull();
    await waitFor(() => expect(container.textContent).toContain("Email tergugat: ada · persetujuan e-Court: belum membuat persetujuan"));
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(String((ambil.mock.calls as unknown[][])[0][0])).toContain("/api/aleta-ecourt/sidang/pihak-elektronik?perkaraId=9459");
    expect(container.querySelector("[data-kontak-pihak-rincian]")).not.toBeNull();
    expect(container.textContent).not.toContain("@");
  });

  it("permohonan memakai sebutan Termohon; data tak terbaca disebut apa adanya", async () => {
    const { KontakPihakRincian } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { available: false, ok: false, kontak: null } }))));
    const { container } = render(createElement(KontakPihakRincian, { perkaraId: "9460", nomorPerkara: "460/Pdt.G/2026/PA.Dgl" }));
    await waitFor(() => expect(container.textContent).toContain("belum dapat dibaca"));
  });

  it("Rincian di Jadwal Sidang memasang KontakPihakRincian dengan perkaraId", () => {
    expect(SIDANG).toContain("<KontakPihakRincian perkaraId={perkaraId} nomorPerkara={nomorPerkara} />");
    expect(SIDANG).toContain("  KontakPihakRincian,");
  });
});

// ============================================================================
// BUTIR 2/3 - FUNGSI MURNI: PENANDA MULAI, SUMBER BERJALAN, SKORS
// ============================================================================

const HARI = "2026-10-02";

function bw(perkaraId: string, panggil: string, noRuang: number | null, nomor: number | null): BarisWaktuAntrian {
  return {
    tanggalSidang: HARI,
    perkaraId,
    nomorAntrian: nomor,
    noRuang,
    ruanganId: null,
    ambilPihak1: `${HARI} 08:00:00`,
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: `${HARI} 08:00:00`,
    jamJadwal: "09:00:00",
    panggilPertama: panggil,
    panggilTerakhir: panggil,
    jumlahPanggil: panggil ? 1 : 0,
    online: null,
    namaPetugas: "",
    sumber: "langsung",
  };
}

// Ruang 1: 11 (09:10), 12 (09:40, terakhir dipanggil); 13 belum dipanggil. Ruang 2: 21 (09:20).
const WAKTU: BarisWaktuAntrian[] = [
  bw("11", `${HARI} 09:10:00`, 1, 1),
  bw("12", `${HARI} 09:40:00`, 1, 2),
  bw("13", "", 1, 3),
  bw("21", `${HARI} 09:20:00`, 2, 4),
];

const BERJALAN_KOSONG: DataBerjalan = { manual: {}, proses: [] };

describe("butir 3 - sumber 'sedang berjalan' dan satu-ruang-satu-sidang", () => {
  it("tanpa data baru perilaku SEMULA persis: panggilan terakhir per ruang", () => {
    const a = petaSidangBerjalan(WAKTU, { hariIni: HARI });
    const b = petaSidangBerjalan(WAKTU, { hariIni: HARI, berjalan: BERJALAN_KOSONG });
    expect(Object.keys(a.berjalan).sort()).toEqual([`${HARI}|12`, `${HARI}|21`]);
    expect(a.berjalan).toEqual(b.berjalan);
    expect(a.perRuang["Ruang 1"]).toMatchObject({ perkaraId: "12", sumber: "panggilan", sejak: `${HARI} 09:40:00` });
  });

  it("PROSES SIDANG di mesin antrian mengalahkan panggilan terakhir di ruang yang sama", () => {
    const r = petaSidangBerjalan(WAKTU, {
      hariIni: HARI,
      berjalan: { manual: {}, proses: [{ perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` }] },
    });
    expect(r.perRuang["Ruang 1"]).toMatchObject({ perkaraId: "13", sumber: "antrian-proses", sejak: `${HARI} 10:05:00`, nomorAntrian: 3 });
    expect(r.berjalan[`${HARI}|12`]).toBeUndefined();
    // Ruang lain tidak tersentuh.
    expect(r.perRuang["Ruang 2"].perkaraId).toBe("21");
  });

  it("TANDA MANUAL mengalahkan proses mesin dan panggilan; yang manual lebih baru menang atas yang manual lama", () => {
    const manual = (perkaraId: string, pada: string) => ({
      [`${perkaraId}|${HARI}`]: { perkaraId, tanggalSidang: HARI, ruang: "Ruang 1", oleh: "Ani", ditandaiPada: `${HARI} ${pada}` },
    });
    const r = petaSidangBerjalan(WAKTU, {
      hariIni: HARI,
      berjalan: { manual: manual("11", "10:30:00"), proses: [{ perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` }] },
    });
    expect(r.perRuang["Ruang 1"]).toMatchObject({ perkaraId: "11", sumber: "manual", oleh: "Ani" });
    expect(Object.keys(r.berjalan).filter((k) => r.berjalan[k].ruang === "Ruang 1")).toEqual([`${HARI}|11`]);

    const dua = petaSidangBerjalan(WAKTU, { hariIni: HARI, berjalan: { manual: { ...manual("11", "10:30:00"), ...manual("12", "10:45:00") }, proses: [] } });
    expect(dua.perRuang["Ruang 1"].perkaraId).toBe("12");
  });

  it("perkara tanpa baris antrian pun dapat ditandai manual (ruangnya dari tandanya / SIPP)", () => {
    const r = petaSidangBerjalan([], {
      hariIni: HARI,
      ruangSipp: { [`${HARI}|99`]: "Ruang Sidang 3" },
      berjalan: { manual: { [`99|${HARI}`]: { perkaraId: "99", tanggalSidang: HARI, ditandaiPada: `${HARI} 09:00:00` } }, proses: [] },
    });
    expect(r.berjalan[`${HARI}|99`]).toMatchObject({ sumber: "manual", ruang: "Ruang Sidang 3" });
  });

  it("hanya HARI INI; yang SELESAI tidak berjalan walau ditandai atau berproses di mesin", () => {
    const manualLain = { "5|2026-10-03": { perkaraId: "5", tanggalSidang: "2026-10-03", ditandaiPada: "2026-10-03 09:00:00" } };
    expect(petaSidangBerjalan([], { hariIni: HARI, berjalan: { manual: manualLain, proses: [] } }).berjalan).toEqual({});
    const r = petaSidangBerjalan(WAKTU, {
      hariIni: HARI,
      selesai: { [`${HARI}|13`]: true },
      berjalan: { manual: {}, proses: [{ perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` }] },
    });
    expect(r.berjalan[`${HARI}|13`]).toBeUndefined();
  });
});

describe("butir 2/3 - skors dengan PENANDA MULAI", () => {
  const skors = (saat: string): PetaSkors => ({ [`13|${HARI}`]: { perkaraId: "13", tanggalSidang: HARI, panggilSaatSkors: saat, diskorsPada: `${HARI} 10:20:00`, oleh: "Ani" } });

  it("skors berlaku selama TIDAK ADA penanda lebih baru; perilaku satu-jam-panggil semula tetap", () => {
    const c = { perkaraId: "1", tanggalSidang: HARI, panggilSaatSkors: `${HARI} 09:40:00` };
    expect(skorsBerlaku(c, `${HARI} 09:40:00`)).toBe(true);
    expect(skorsBerlaku(c, [`${HARI} 09:10:00`, `${HARI} 09:40:00`])).toBe(true);
    expect(skorsBerlaku(c, [`${HARI} 09:40:00`, `${HARI} 10:30:00`])).toBe(false);
    expect(skorsBerlaku({ ...c, panggilSaatSkors: "x" }, "y")).toBe(false);
    expect(skorsBerlaku({ ...c, panggilSaatSkors: "" }, undefined)).toBe(true);
    expect(skorsBerlaku({ ...c, panggilSaatSkors: "" }, `${HARI} 09:00:00`)).toBe(false);
    expect(skorsBerlaku(undefined, [])).toBe(false);
  });

  it("proses di mesin -> diskors: perkara tidak berjalan; sesudah mesin dikembalikan ke menunggu skors TETAP terlihat", () => {
    const proses = { perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` };
    const sKors = skors(`${HARI} 10:05:00`);
    const masihProses = petaSidangBerjalan(WAKTU, { hariIni: HARI, skors: sKors, berjalan: { manual: {}, proses: [proses] } });
    expect(masihProses.berjalan[`${HARI}|13`]).toBeUndefined();
    expect(skorsUntuk(sKors, { perkaraId: "13", tanggalSidang: HARI }, masihProses.penandaPerKunci[`${HARI}|13`])).not.toBeNull();

    // Skors menulis NULL ke mesin -> proses hilang dari bacaan; skors tidak ikut hilang.
    const sesudahRevert = petaSidangBerjalan(WAKTU, { hariIni: HARI, skors: sKors, berjalan: BERJALAN_KOSONG });
    expect(sesudahRevert.berjalan[`${HARI}|13`]).toBeUndefined();
    expect(skorsUntuk(sKors, { perkaraId: "13", tanggalSidang: HARI }, sesudahRevert.penandaPerKunci[`${HARI}|13`])).not.toBeNull();

    // PROSES lagi di mesin (jam baru) -> berjalan lagi, skors tidak berlaku.
    const lagi = petaSidangBerjalan(WAKTU, {
      hariIni: HARI,
      skors: sKors,
      berjalan: { manual: {}, proses: [{ ...proses, sejak: `${HARI} 11:00:00` }] },
    });
    expect(lagi.perRuang["Ruang 1"]).toMatchObject({ perkaraId: "13", sumber: "antrian-proses" });
    expect(skorsUntuk(sKors, { perkaraId: "13", tanggalSidang: HARI }, lagi.penandaPerKunci[`${HARI}|13`])).toBeNull();
  });

  it("'sejak' sebuah sidang berjalan = penanda terbaru, sehingga skors yang dibuat darinya langsung berlaku", () => {
    const r = petaSidangBerjalan(WAKTU, {
      hariIni: HARI,
      berjalan: { manual: {}, proses: [{ perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` }] },
    });
    const b = r.berjalan[`${HARI}|13`];
    const sKors = skors(b.sejak);
    expect(skorsBerlaku(sKors[`13|${HARI}`], r.penandaPerKunci[`${HARI}|13`])).toBe(true);
  });

  it("daftarDiskors: hanya yang masih diskors dan belum selesai, urut jam", () => {
    const sKors: PetaSkors = {
      ...skors(`${HARI} 10:05:00`),
      [`21|${HARI}`]: { perkaraId: "21", tanggalSidang: HARI, panggilSaatSkors: `${HARI} 09:20:00`, diskorsPada: `${HARI} 09:55:00` },
      [`11|${HARI}`]: { perkaraId: "11", tanggalSidang: HARI, panggilSaatSkors: `${HARI} 09:10:00`, diskorsPada: `${HARI} 09:30:00` },
    };
    const ruang = petaSidangBerjalan(WAKTU, { hariIni: HARI, skors: sKors });
    const sidang = WAKTU.map((b) => ({ perkaraId: b.perkaraId, tanggalSidang: b.tanggalSidang }));
    const hasil = daftarDiskors(sidang, sKors, ruang, { [`${HARI}|11`]: true });
    expect(hasil.map((d) => d.perkaraId)).toEqual(["21", "13"]);
    expect(hasil[0]).toMatchObject({ ruang: "Ruang 2", jam: "09:55" });
  });

  it("kalimat sumber menyebut manual / proses antrian / panggilan", () => {
    const dasar = { ruang: "Ruang 1", sejak: `${HARI} 09:40:00` };
    expect(kalimatSumberBerjalan({ ...dasar, sumber: "manual", oleh: "Ani" })).toContain("Ditandai sedang berjalan oleh Ani");
    expect(kalimatSumberBerjalan({ ...dasar, sumber: "antrian-proses" })).toContain("proses sidang di aplikasi antrian");
    expect(kalimatSumberBerjalan({ ...dasar })).toContain("terakhir yang dipanggil");
  });
});

describe("butir 3 - aksi Tandai / Batalkan tanda", () => {
  const manual = { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: "s", nomorAntrian: 2, sumber: "manual" as const };
  const panggilan = { ...manual, sumber: "panggilan" as const };

  it("baris biasa hari ini: Tandai; yang berjalan manual: Skors + Batalkan tanda; berjalan dari antrian: Skors saja", () => {
    expect(aksiRuangSidang({ hijau: false, berjalan: null, skors: null, berjalanDiRuang: null, bisaDipanggil: false, bisaTandai: true })).toMatchObject({ tandai: true, skors: false, batalTanda: false });
    expect(aksiRuangSidang({ hijau: false, berjalan: manual, skors: null, berjalanDiRuang: manual, bisaDipanggil: true })).toMatchObject({ skors: true, batalTanda: true, tandai: false });
    expect(aksiRuangSidang({ hijau: false, berjalan: panggilan, skors: null, berjalanDiRuang: panggilan, bisaDipanggil: true })).toMatchObject({ skors: true, batalTanda: false });
  });

  it("yang DISKORS dilanjutkan, tidak ditandai ulang; yang SELESAI tidak mendapat aksi apa pun", () => {
    const diskors = aksiRuangSidang({ hijau: false, berjalan: null, skors: { perkaraId: "1", tanggalSidang: HARI }, berjalanDiRuang: panggilan, bisaDipanggil: true, bisaTandai: true });
    expect(diskors).toMatchObject({ lanjut: true, tandai: false });
    const hijau = aksiRuangSidang({ hijau: true, berjalan: manual, skors: null, berjalanDiRuang: manual, bisaDipanggil: true, bisaTandai: true });
    expect(hijau).toMatchObject({ skors: false, lompat: false, lanjut: false, tandai: false, batalTanda: false });
  });

  it("Lompat dan Tandai dapat bersamaan pada baris yang bukan berjalan", () => {
    expect(aksiRuangSidang({ hijau: false, berjalan: null, skors: null, berjalanDiRuang: panggilan, bisaDipanggil: true, bisaTandai: true })).toMatchObject({ lompat: true, tandai: true });
  });
});

// ============================================================================
// BUTIR 3 - BOT (BASIS DATA TIRUAN)
// ============================================================================

type Layanan = Record<string, (x: unknown) => Promise<Record<string, unknown>>>;
const selesaiMod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  nilaiDisidangProses: (x?: string) => unknown;
  waktuDariJamSidang: (jam: string, tanggal: string) => string;
  TABEL_BERJALAN: string;
  TABEL_SKORS: string;
  ANTRIAN_SELESAI: number;
};

function tiruan(jawab: (sql: string, params: unknown[]) => unknown) {
  const catatan: Array<{ sql: string; params: unknown[] }> = [];
  const kueri = async (sql: string, params: unknown[] = []) => {
    const rapi = sql.replace(/\s+/g, " ").trim();
    catatan.push({ sql: rapi, params });
    return jawab(rapi, params);
  };
  return { kueri, catatan };
}

const tulis = <T extends { sql: string }>(c: T[]): T[] => c.filter((x) => /^(INSERT|UPDATE|REPLACE|DELETE)/.test(x.sql));

describe("butir 3 - nilai 'proses sidang' mesin antrian HANYA dari lingkungan", () => {
  it("kosong / ngawur / 10 = BAWAAN 'ruang' (5 Okt 2026); 'mati' mematikan; 'ruang' dan angka lain dikenali", () => {
    for (const x of [undefined, "", "abc", "10", "-1", "12345"]) expect(selesaiMod.nilaiDisidangProses(x), String(x)).toEqual({ mode: "ruang" });
    for (const x of ["mati", "OFF", "0"]) expect(selesaiMod.nilaiDisidangProses(x), x).toBeNull();
    expect(selesaiMod.nilaiDisidangProses("ruang")).toEqual({ mode: "ruang" });
    expect(selesaiMod.nilaiDisidangProses("RUANG ")).toEqual({ mode: "ruang" });
    expect(selesaiMod.nilaiDisidangProses("3")).toEqual({ mode: "nilai", nilai: 3 });
  });

  it("jam_sidang TIME maupun DATETIME diubah ke 'YYYY-MM-DD HH:MM:SS'", () => {
    expect(selesaiMod.waktuDariJamSidang("10:05:07", HARI)).toBe(`${HARI} 10:05:07`);
    expect(selesaiMod.waktuDariJamSidang("9:05", HARI)).toBe(`${HARI} 09:05:00`);
    expect(selesaiMod.waktuDariJamSidang("2026-10-02 10:05:07", HARI)).toBe("2026-10-02 10:05:07");
    expect(selesaiMod.waktuDariJamSidang("", HARI)).toBe("");
  });
});

describe("butir 3 - bot setelBerjalan (basis data tiruan)", () => {
  function layanan(opsi: {
    proses?: unknown;
    tandaSelesai?: boolean;
    diskors?: boolean;
    statusSipp?: readonly number[];
    adaTanda?: boolean;
    mesinDitulis?: boolean;
    lainBerproses?: boolean;
    affected?: number;
  } = {}) {
    const bot = tiruan((sql) => {
      if (sql.startsWith("SELECT perkara_id FROM aleta_bot_sidang_selesai")) return opsi.tandaSelesai ? [{ perkara_id: "5" }] : [];
      if (sql.startsWith(`SELECT id FROM ${selesaiMod.TABEL_SKORS}`)) return opsi.diskors ? [{ id: 1 }] : [];
      if (sql.startsWith(`SELECT id FROM ${selesaiMod.TABEL_BERJALAN}`)) return opsi.adaTanda ? [{ id: 9 }] : [];
      if (sql.startsWith(`SELECT id, mesin_ditulis AS mesinDitulis FROM ${selesaiMod.TABEL_BERJALAN}`)) {
        return opsi.adaTanda ? [{ id: 9, mesinDitulis: opsi.mesinDitulis ? 1 : 0 }] : [];
      }
      return { affectedRows: 1 };
    });
    const sipp = tiruan((sql) => (sql.startsWith("SELECT status FROM antrian") ? (opsi.statusSipp ?? [0]).map((status) => ({ status })) : { affectedRows: 1 }));
    const ruang = tiruan((sql) => {
      if (sql.startsWith("SELECT b.perkara_id")) return opsi.lainBerproses ? [{ perkaraId: "12" }] : [];
      return { affectedRows: opsi.affected ?? 1 };
    });
    const L = selesaiMod.buatLayanan({
      kueriBot: bot.kueri,
      kueriSipp: sipp.kueri,
      kueriRuangTunggu: ruang.kueri,
      disidangSelesai: null,
      disidangProses: opsi.proses === undefined ? null : opsi.proses,
      setelAntrian: vi.fn(async () => ({ ok: true })),
    });
    return { L, bot, sipp, ruang };
  }
  const minta = { perkaraId: "5", tanggalSidang: HARI, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", ruang: "Ruang 1", oleh: "Ani Panitera", ip: "192.168.10.21" };

  it("KERING sebagai bawaan: tidak satu tulisan pun, ke mana pun", async () => {
    const { L, bot, sipp, ruang } = layanan({ proses: { mode: "ruang" } });
    const hasil = await L.setelBerjalan({ ...minta });
    expect(hasil.kering).toBe(true);
    expect(tulis(bot.catatan)).toHaveLength(0);
    expect(tulis(sipp.catatan)).toHaveLength(0);
    expect(ruang.catatan).toHaveLength(0);
  });

  it("menandai TANPA nilai proses: catatan ALETA jujur saja - aplikasi antrian dan SIPP TIDAK disentuh", async () => {
    const { L, bot, sipp, ruang } = layanan();
    const hasil = await L.setelBerjalan({ ...minta, kering: false });
    expect(hasil).toMatchObject({ ok: true, berjalan: true });
    const sisip = bot.catatan.find((c) => c.sql.startsWith(`INSERT INTO ${selesaiMod.TABEL_BERJALAN}`));
    expect(sisip?.sql).toContain("'ALETA', UTC_TIMESTAMP()");
    expect(sisip?.params).toEqual(["5", HARI, "5/Pdt.G/2026/PA.Dgl", "Ruang 1", "Ani Panitera", "192.168.10.21"]);
    expect(tulis(sipp.catatan)).toHaveLength(0);
    expect(ruang.catatan).toHaveLength(0);
    expect(hasil.antrianRuangTunggu).toMatchObject({ dilewati: true, alasan: "nilai_proses_belum_disetel" });
  });

  it("DENGAN nilai proses 'ruang': UPDATE nilai asli aplikasi antrian (disidang = ruangan_id, hanya yang menunggu), tanpa penanda ALETA", async () => {
    const { L, ruang, bot } = layanan({ proses: { mode: "ruang" } });
    const hasil = await L.setelBerjalan({ ...minta, kering: false });
    expect(hasil.antrianRuangTunggu).toMatchObject({ ok: true, baris: 1 });
    // 5 Okt 2026: sesudah menulis, layar aplikasi antrian disegarkan (sys_data_refresh) seperti sesudah PROSES di sana.
    expect(tulis(ruang.catatan).filter((c) => c.sql.includes("sys_data_refresh"))).toHaveLength(1);
    const ubah = tulis(ruang.catatan).filter((c) => c.sql.includes("antrian_sidang"));
    expect(ubah).toHaveLength(1);
    expect(ubah[0].sql).toBe(
      "UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = ruangan_id, jam_sidang = NOW() WHERE perkara_id = ? AND tanggal_sidang = ? AND tanggal_sidang = CURDATE() AND disidang IS NULL AND ruangan_id BETWEEN 1 AND 9"
    );
    expect(ubah[0].params).toEqual(["5", HARI]);
    expect(JSON.stringify(ruang.catatan)).not.toMatch(/ALETA|Ani Panitera|192\.168/);
    // ALETA mencatat bahwa DIA yang menulis mesin - dasar pembatalan kelak.
    expect(bot.catatan.some((c) => c.sql.startsWith(`UPDATE ${selesaiMod.TABEL_BERJALAN} SET mesin_ditulis = 1`))).toBe(true);
  });

  it("kode tetap: disidang = nilai itu, bukan menebak lain", async () => {
    const { L, ruang } = layanan({ proses: { mode: "nilai", nilai: 3 } });
    await L.setelBerjalan({ ...minta, kering: false });
    const ubah = tulis(ruang.catatan);
    expect(ubah[0].sql).toContain("SET disidang = ?, jam_sidang = NOW()");
    expect(ubah[0].params).toEqual([3, "5", HARI]);
  });

  it("ruang sudah ada sidang yang berproses: mesin TIDAK ditulis (jangan menumpuk dua), ALETA tetap mencatat", async () => {
    const { L, ruang, bot } = layanan({ proses: { mode: "ruang" }, lainBerproses: true });
    const hasil = await L.setelBerjalan({ ...minta, kering: false });
    expect(hasil.antrianRuangTunggu).toMatchObject({ dilewati: true, alasan: "ruang_masih_ada_sidang_berproses", perkaraId: "12" });
    expect(tulis(ruang.catatan)).toHaveLength(0);
    expect(bot.catatan.some((c) => c.sql.startsWith(`INSERT INTO ${selesaiMod.TABEL_BERJALAN}`))).toBe(true);
  });

  it("SELESAI YANG SAH dan SKORS ditolak tanpa satu tulisan: hasil sidang / ditandai Selesai / antrian SIPP 2 / sedang diskors", async () => {
    for (const [opsi, tambahan, alasan] of [
      [{}, { hasilSidangSelesai: true }, "sudah_selesai_hasil_sidang"],
      [{ tandaSelesai: true }, {}, "sudah_ditandai_selesai"],
      [{ statusSipp: [2] }, {}, "antrian_sipp_selesai"],
      [{ diskors: true }, {}, "sedang_diskors"],
    ] as const) {
      const { L, bot, sipp, ruang } = layanan({ ...opsi, proses: { mode: "ruang" } });
      const hasil = await L.setelBerjalan({ ...minta, ...tambahan, kering: false });
      expect(hasil, alasan).toMatchObject({ ok: false, alasan });
      expect(tulis(bot.catatan)).toHaveLength(0);
      expect(tulis(sipp.catatan)).toHaveLength(0);
      expect(ruang.catatan).toHaveLength(0);
    }
  });

  it("tanda yang berlaku tidak digandakan", async () => {
    const { L, bot } = layanan({ adaTanda: true });
    await L.setelBerjalan({ ...minta, kering: false });
    expect(bot.catatan.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
  });

  it("membatalkan: riwayat TIDAK dihapus (UPDATE dibatalkan_pada); mesin dikembalikan NULL hanya bila ALETA yang menulisnya", async () => {
    const aleta = layanan({ proses: { mode: "ruang" }, adaTanda: true, mesinDitulis: true });
    const hasil = await aleta.L.setelBerjalan({ ...minta, berjalan: false, kering: false });
    expect(hasil).toMatchObject({ ok: true, berjalan: false });
    expect(aleta.bot.catatan.some((c) => c.sql.startsWith("DELETE"))).toBe(false);
    expect(aleta.bot.catatan.some((c) => c.sql.startsWith(`UPDATE ${selesaiMod.TABEL_BERJALAN} SET dibatalkan_pada = UTC_TIMESTAMP()`))).toBe(true);
    const ubah = tulis(aleta.ruang.catatan).filter((c) => c.sql.includes("antrian_sidang"));
    expect(ubah).toHaveLength(1);
    expect(ubah[0].sql).toBe("UPDATE sipp_turunan_antrian.antrian_sidang SET disidang = NULL WHERE perkara_id = ? AND tanggal_sidang = ? AND disidang = ruangan_id AND disidang BETWEEN 1 AND 9");

    // Yang berproses karena petugas menekan PROSES di aplikasi antrian sendiri tidak dikembalikan ALETA.
    const orang = layanan({ proses: { mode: "ruang" }, adaTanda: true, mesinDitulis: false });
    const h2 = await orang.L.setelBerjalan({ ...minta, berjalan: false, kering: false });
    expect(tulis(orang.ruang.catatan)).toHaveLength(0);
    expect(h2.antrianRuangTunggu).toMatchObject({ dilewati: true, alasan: "mesin_tidak_ditulis_aleta" });
  });
});

describe("butir 3 - bot: peta, skors, selesai, diagnosa dengan nilai proses", () => {
  const dasarDeps = (opsi: { proses?: unknown; barisProses?: unknown[]; ruang?: ReturnType<typeof tiruan>; bot?: ReturnType<typeof tiruan> } = {}) => {
    const bot =
      opsi.bot ??
      tiruan((sql) => {
        if (sql.includes(`FROM ${selesaiMod.TABEL_BERJALAN}`)) {
          return [{ perkaraId: "7", tanggalSidang: HARI, nomorPerkara: "7/x", ruang: "Ruang 2", oleh: "Ani", ditandaiPada: `${HARI} 10:30:00` }];
        }
        return [];
      });
    const ruang = opsi.ruang ?? tiruan(() => opsi.barisProses ?? []);
    return {
      bot,
      ruang,
      deps: <Record<string, unknown>>{
        kueriBot: bot.kueri,
        kueriSipp: async () => [],
        kueriRuangTunggu: ruang.kueri,
        disidangSelesai: null,
        disidangProses: opsi.proses === undefined ? null : opsi.proses,
        setelAntrian: async () => ({ ok: true }),
      },
    };
  };

  it("peta ikut memulangkan tanda manual yang berlaku; mesin TIDAK dibaca bila nilai proses tidak disetel", async () => {
    const { deps, ruang, bot } = dasarDeps();
    const hasil = (await selesaiMod.buatLayanan(deps).petaSelesai({ dari: HARI, sampai: HARI })) as {
      berjalan: { manual: Record<string, { ruang: string; oleh: string }>; proses: unknown[] };
      sumber: { antrianProses: { disetel: boolean; alasan: string }; berjalan: { terbaca: boolean } };
    };
    expect(hasil.berjalan.manual[`7|${HARI}`]).toMatchObject({ ruang: "Ruang 2", oleh: "Ani" });
    expect(hasil.berjalan.proses).toEqual([]);
    expect(hasil.sumber.antrianProses).toMatchObject({ disetel: false, alasan: "nilai_proses_belum_disetel" });
    expect(hasil.sumber.berjalan.terbaca).toBe(true);
    expect(ruang.catatan).toHaveLength(0);
    expect(bot.catatan.find((c) => c.sql.includes(`FROM ${selesaiMod.TABEL_BERJALAN}`))?.sql).toContain("AND dibatalkan_pada IS NULL");
  });

  it("nilai proses 'ruang' disetel: baris yang SEDANG berproses dibaca (SELECT), jam diubah ke bentuk waktu", async () => {
    const { deps, ruang } = dasarDeps({
      proses: { mode: "ruang" },
      barisProses: [{ perkaraId: "13", tanggalSidang: HARI, ruanganId: 1, noRuang: 1, jamSidang: "10:05:00" }],
    });
    const hasil = (await selesaiMod.buatLayanan(deps).petaSelesai({ dari: HARI, sampai: HARI })) as {
      berjalan: { proses: Array<{ perkaraId: string; noRuang: number; sejak: string }> };
    };
    expect(hasil.berjalan.proses).toEqual([{ perkaraId: "13", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:05:00` }]);
    expect(ruang.catatan).toHaveLength(1);
    expect(ruang.catatan[0].sql).toContain("disidang = ruangan_id AND disidang BETWEEN 1 AND 9");
    expect(ruang.catatan[0].sql.startsWith("SELECT")).toBe(true);
  });

  it("skors dengan nilai proses: mesin kembali NULL (= BATAL / SKORS aplikasi antrian) hanya baris yang berproses; tanpa nilai: tidak disentuh", async () => {
    const pakai = dasarDeps({ proses: { mode: "ruang" } });
    pakai.deps.kueriSipp = async () => [{ status: 0 }];
    const hasil = await selesaiMod.buatLayanan(pakai.deps).setelSkors({ perkaraId: "13", tanggalSidang: HARI, oleh: "Ani", kering: false });
    expect(hasil.ok).toBe(true);
    expect(tulis(pakai.ruang.catatan)).toHaveLength(1);
    expect(tulis(pakai.ruang.catatan)[0].sql).toContain("SET disidang = NULL WHERE perkara_id = ? AND tanggal_sidang = ? AND disidang = ruangan_id");

    const tanpa = dasarDeps();
    tanpa.deps.kueriSipp = async () => [{ status: 0 }];
    await selesaiMod.buatLayanan(tanpa.deps).setelSkors({ perkaraId: "13", tanggalSidang: HARI, oleh: "Ani", kering: false });
    expect(tanpa.ruang.catatan).toHaveLength(0);

    // Kering: tidak menulis, tetapi rencananya menyebut mesin.
    const kering = dasarDeps({ proses: { mode: "ruang" } });
    const rencana = (await selesaiMod.buatLayanan(kering.deps).setelSkors({ perkaraId: "13", tanggalSidang: HARI })) as { rencana: { antrianRuangTunggu: string } };
    expect(rencana.rencana.antrianRuangTunggu).toContain("BATAL / SKORS SIDANG");
    expect(kering.ruang.catatan).toHaveLength(0);
  });

  it("Selesai membatalkan tanda manual (riwayat tetap) - tidak hidup lagi bila Selesai dibatalkan kelak", async () => {
    const bot = tiruan((sql) => (sql.startsWith("SELECT id, mesin_ditulis") ? [{ id: 4, mesinDitulis: 0 }] : { affectedRows: 1 }));
    const L = selesaiMod.buatLayanan({
      kueriBot: bot.kueri,
      kueriSipp: async () => [],
      kueriRuangTunggu: async () => [],
      disidangSelesai: null,
      disidangProses: null,
      setelAntrian: async () => ({ ok: true }),
    });
    await L.setelSelesai({ perkaraId: "5", tanggalSidang: HARI, oleh: "Ani", kering: false });
    expect(bot.catatan.some((c) => c.sql.startsWith(`UPDATE ${selesaiMod.TABEL_BERJALAN} SET dibatalkan_pada = UTC_TIMESTAMP()`))).toBe(true);
    expect(bot.catatan.some((c) => c.sql.startsWith("DELETE FROM aleta_bot_sidang_berjalan"))).toBe(false);
  });

  it("diagnosa: menyebut sebaran per ruang + petunjuk; 'ruang' DIUSULKAN bila datanya cocok, TIDAK dinyalakan", async () => {
    const ruang = tiruan((sql) => {
      if (sql.includes("GROUP BY disidang, ruangan_id")) {
        return [
          { disidang: null, ruanganId: 1, jumlah: 4 },
          { disidang: 1, ruanganId: 1, jumlah: 1 },
          { disidang: 10, ruanganId: 2, jumlah: 3 },
        ];
      }
      return [{ disidang: null, jumlah: 4 }, { disidang: 1, jumlah: 1 }, { disidang: 10, jumlah: 3 }];
    });
    const { deps } = dasarDeps({ ruang });
    const hasil = (await selesaiMod.buatLayanan(deps).diagnosaRuangTunggu({})) as {
      nilai: unknown[];
      sebaranRuang: unknown[];
      prosesDisetel: unknown;
      petunjuk: { usulanProses: string | null; prosesSamaDenganRuangTerlihat: boolean; salinanAplikasiAntrian: string };
    };
    expect(hasil.nilai).toEqual([{ disidang: null, jumlah: 4 }, { disidang: 1, jumlah: 1 }, { disidang: 10, jumlah: 3 }]);
    expect(hasil.sebaranRuang).toHaveLength(3);
    expect(hasil.prosesDisetel).toBeNull();
    expect(hasil.petunjuk).toMatchObject({ usulanProses: "ruang", prosesSamaDenganRuangTerlihat: true });
    expect(hasil.petunjuk.salinanAplikasiAntrian).toContain("10 = selesai");
    expect(tulis(ruang.catatan)).toHaveLength(0);
  });

  it("rute bot dan portal berjalan: bertoken, kering bawaan, kewenangan panel, IP peramban, operator wajib", () => {
    expect(RUTE_BOT).toContain('router.post("/berjalan", wajibToken,');
    expect(RUTE_BOT.slice(RUTE_BOT.indexOf('router.post("/berjalan"'), RUTE_BOT.indexOf('router.get("/kalender"'))).toContain("kering: badan.kering !== false,");
    expect(RUTE_BOT.slice(RUTE_BOT.indexOf('router.post("/berjalan"'), RUTE_BOT.indexOf('router.get("/kalender"'))).toContain('alasan: "operator_tidak_disebut"');
    expect(RUTE_BERJALAN).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(RUTE_BERJALAN).toContain("ip: alamatIpPeramban(request),");
    expect(RUTE_BERJALAN).toContain("kering: badan.kering !== false,");
    expect(RUTE_BERJALAN).toContain('panggilBotJadwalSidang("/berjalan"');
  });
});

// ============================================================================
// BUTIR 2/3/4 - LAYAR
// ============================================================================

describe("butir 4 - urutan kolom kanan Jadwal Sidang", () => {
  it("Rincian, Status, tombol ruang sidang, lalu Selesai PALING BAWAH - tidak ada yang hilang", () => {
    const i0 = SIDANG.indexOf("TOMBOL RINCIAN DI UJUNG KANAN");
    expect(i0).toBeGreaterThan(-1);
    const sel = SIDANG.slice(i0, SIDANG.indexOf("Borang catat hasil", i0));
    const iRincian = sel.indexOf("void buka(baris)");
    const iStatus = sel.indexOf("onBukaStatus(baris.nomorPerkara)");
    const iRuang = sel.indexOf("<TombolRuangSidang");
    const iSelesai = sel.indexOf("<TombolSelesaiSidang");
    for (const [nama, i] of Object.entries({ iRincian, iStatus, iRuang, iSelesai })) expect(i, nama).toBeGreaterThan(-1);
    expect(iRincian).toBeLessThan(iStatus);
    expect(iStatus).toBeLessThan(iRuang);
    expect(iRuang).toBeLessThan(iSelesai);
    // Selesai benar-benar yang TERAKHIR di kolom itu.
    expect(sel.indexOf("<TombolSelesaiSidang", iSelesai + 1)).toBe(-1);
    expect(sel.slice(iSelesai)).not.toMatch(/<(TombolRuangSidang|button)\b/);
  });

  it("tombol tunda|putus tetap hanya disembunyikan hasil sidang - perkara diskors/berjalan TIDAK pernah menyembunyikannya", () => {
    expect(SIDANG).toContain("{sidangSelesai ? null : (");
    // Skors/berjalan tidak ikut dalam keputusan hijau.
    expect(SIDANG).toContain("hijau: selesaiTanda.hijau,");
    expect(SIDANG).toContain("const selesaiTanda = keadaanSelesai(baris, sidangSelesai, tandaSelesai.peta);");
    // sidangSelesai (yang menyembunyikan tunda|putus) tetap hanya dari hasil sidang.
    expect(SIDANG).toContain("const sidangSelesai = sidangSelesaiHariIni(baris);");
  });

  it("layar membaca data berjalan dan memberi tahu tombol: ruang, hari ini, penanda skors", () => {
    // 6 Okt 2026: lewat saringProsesLangsung (keadaan disidang terbaru) - lihat @/lib/disidang-langsung.
    expect(SIDANG).toContain("saringProsesLangsung(tandaSelesai.berjalan, disidangLangsung)");
    expect(SIDANG).toContain("berjalan: berjalanHidup,");
    expect(SIDANG).toContain("ruangSidang.penandaPerKunci[kunciTiga]");
    expect(SIDANG).toContain("bisaTandai: Boolean(waktuAntrian.hariIni) && baris.tanggalSidang === waktuAntrian.hariIni,");
    expect(SIDANG).toContain("ruang={ruangIni}");
    expect(SIDANG).toContain("diskors={diskorsHariIni}");
  });
});

describe("butir 2/3 - komponen", () => {
  it("TombolRuangSidang: 'Tandai berjalan' -> POST sidang/berjalan (kering:false, ruang, berjalan:true); 'Batalkan tanda' -> berjalan:false", async () => {
    const { TombolRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    const ambil = vi.fn(async (_a: string, _i?: RequestInit) => new Response(JSON.stringify({ data: { available: true, ok: true } })));
    vi.stubGlobal("fetch", ambil);
    const berubah = vi.fn();
    const tampil = (aksi: Record<string, unknown>, berjalan = null as unknown) =>
      render(
        createElement(TombolRuangSidang, {
          baris: { perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI },
          aksi: { skors: false, lompat: false, lanjut: false, asal: null, ...aksi },
          berjalan: berjalan as never,
          skors: null,
          bisaDipanggil: true,
          info: () => ({ nomorPerkara: "12/Pdt.G/2026/PA.Dgl", nomorAntrian: 2, noRuang: 1 }),
          onBerubah: berubah,
          ruang: "Ruang 1",
        })
      );
    tampil({ tandai: true });
    fireEvent.click(screen.getByRole("button", { name: /Tandai berjalan/ }));
    await waitFor(() => expect(berubah).toHaveBeenCalledTimes(1));
    expect(String(ambil.mock.calls[0][0])).toContain("/api/aleta-ecourt/sidang/berjalan");
    expect(JSON.parse(String(ambil.mock.calls[0][1]?.body))).toMatchObject({ perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", berjalan: true, kering: false });
    cleanup();

    tampil({ skors: true, batalTanda: true }, { kunci: "k", perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: "s", nomorAntrian: 2, sumber: "manual" });
    expect(screen.getByRole("button", { name: /Skors/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Batalkan tanda/ }));
    await waitFor(() => expect(berubah).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(ambil.mock.calls[1][1]?.body))).toMatchObject({ berjalan: false, kering: false });
  });

  it("penolakan bot (mis. sedang diskors) tampil sebagai kalimat; pesan 'ruang masih berproses' disebut", async () => {
    const { setelTandaBerjalan } = await import("@/components/portal/jadwal-sidang-2okt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { available: true, ok: false, alasan: "sedang_diskors" } })))
    );
    const ditolak = await setelTandaBerjalan({ perkaraId: "1", nomorPerkara: "1/x", tanggalSidang: HARI, berjalan: true });
    expect(ditolak).toMatchObject({ ok: false });
    expect(ditolak.pesan).toContain("sedang diskors");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: { available: true, ok: true, antrianRuangTunggu: { ok: true, dilewati: true, alasan: "ruang_masih_ada_sidang_berproses" } } })))
    );
    const ok = await setelTandaBerjalan({ perkaraId: "1", nomorPerkara: "1/x", tanggalSidang: HARI, berjalan: true });
    expect(ok.ok).toBe(true);
    expect(ok.pesan).toContain("skors dulu");
  });

  it("RingkasRuangSidang menyebut tiap perkara yang DISKORS (bukan hanya jumlahnya), dapat ditekan; sumber manual disebut", async () => {
    const { RingkasRuangSidang } = await import("@/components/portal/jadwal-sidang-2okt");
    const lihat = vi.fn();
    render(
      createElement(RingkasRuangSidang, {
        perRuang: { "Ruang 1": { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: `${HARI} 09:40:00`, nomorAntrian: 2, sumber: "manual" } },
        nomorPerkara: (k: string) => (k === `${HARI}|13` ? "13/Pdt.G/2026/PA.Dgl" : "12/Pdt.G/2026/PA.Dgl"),
        diskors: [{ kunci: `${HARI}|13`, perkaraId: "13", tanggalSidang: HARI, ruang: "Ruang 1", jam: "10:20", oleh: "Ani" }],
        onLihat: lihat,
      })
    );
    expect(screen.getByText(/ditandai manual/)).toBeTruthy();
    expect(screen.getByText(/1 diskors · belum selesai:/)).toBeTruthy();
    fireEvent.click(screen.getByText("13/Pdt.G/2026/PA.Dgl"));
    expect(lihat).toHaveBeenCalledWith(`${HARI}|13`);
  });

  it("LencanaSedangBerjalan membawa sumbernya (atribut dan kalimat)", async () => {
    const { LencanaSedangBerjalan } = await import("@/components/portal/jadwal-sidang-2okt");
    const { container } = render(
      createElement(LencanaSedangBerjalan, {
        berjalan: { kunci: `${HARI}|12`, perkaraId: "12", tanggalSidang: HARI, ruang: "Ruang 1", sejak: `${HARI} 09:40:00`, nomorAntrian: 2, sumber: "antrian-proses" },
      })
    );
    expect(container.querySelector('[data-sumber-berjalan="antrian-proses"]')).not.toBeNull();
    expect(screen.getByText(/proses \(antrian\)/)).toBeTruthy();
  });

  it("PanelRuangPapanPanggil (halaman tempat nomor dipanggil): menyebut yang berjalan dan yang diskors, dengan Skors / Lanjutkan", async () => {
    const { PanelRuangPapanPanggil } = await import("@/components/portal/jadwal-sidang-2okt");
    const sidang = ["12", "13"].map((id) => ({ sidangId: `s${id}`, perkaraId: id, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, tanggalSidang: HARI, ruangan: "Ruang Sidang 1" }));
    const jadwal = {
      available: true,
      sidang,
      antrian: { peta: { "12": { nomor: 2, tanggalSidang: HARI, noRuang: 1 }, "13": { nomor: 3, tanggalSidang: HARI, noRuang: 1 } } },
      waktuAntrian: { terbaca: true, alasan: "", sekarang: `${HARI} 10:30:00`, hariIni: HARI, langsungTerbaca: true, rekamanTerbaca: true, baris: [bw("12", `${HARI} 09:40:00`, 1, 2), bw("13", "", 1, 3)] },
    };
    const selesai = {
      available: true,
      peta: {},
      skors: { [`13|${HARI}`]: { perkaraId: "13", tanggalSidang: HARI, panggilSaatSkors: "", diskorsPada: `${HARI} 10:20:00`, oleh: "Ani" } },
      berjalan: { manual: {}, proses: [] },
    };
    const ambil = vi.fn(async (alamat: string, _init?: RequestInit) => {
      const a = String(alamat);
      if (a.includes("/api/aleta-ecourt/sidang/selesai")) return new Response(JSON.stringify({ data: selesai }));
      if (a.includes("/api/aleta-ecourt/sidang/skors")) return new Response(JSON.stringify({ data: { available: true, ok: true } }));
      if (a.includes("/api/aleta-ecourt/antrian/panggil")) return new Response(JSON.stringify({ data: { ok: true } }));
      return new Response(JSON.stringify({ data: jadwal }));
    });
    vi.stubGlobal("fetch", ambil);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(createElement(PanelRuangPapanPanggil, { tanggal: HARI }));

    await waitFor(() => expect(container.querySelector("[data-panel-berjalan]")).not.toBeNull());
    expect(container.querySelector("[data-panel-berjalan]")?.textContent).toContain("12/Pdt.G/2026/PA.Dgl");
    expect(container.querySelector("[data-panel-diskors]")?.textContent).toContain("13/Pdt.G/2026/PA.Dgl");
    // Yang diskors tidak "selesai": tidak ada kata Selesai di panel, dan ada Lanjutkan.
    expect(screen.getByRole("button", { name: /Lanjutkan/ })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Selesai\b(?! perkara)/);

    fireEvent.click(screen.getByRole("button", { name: /Skors/ }));
    // F3.1: jendela alasan + perkiraan; "Skors sekarang" mengirimnya.
    fireEvent.click(screen.getByRole("button", { name: /Skors sekarang/ }));
    await waitFor(() => expect(ambil.mock.calls.some((c) => String(c[0]).includes("/sidang/skors"))).toBe(true));
    const kiriman = ambil.mock.calls.find((c) => String(c[0]).includes("/sidang/skors"))!;
    expect(JSON.parse(String(kiriman[1]?.body))).toMatchObject({ perkaraId: "12", skors: true, kering: false, panggilSaatSkors: `${HARI} 09:40:00` });
  });

  it("Hasil Sidang memakai penanda skors terbaru dan memberi ruang ke tombol; PapanRuangSidang tetap menu lompat", () => {
    expect(KOMPONEN).toContain("susun.ruang.penandaPerKunci[kunci]");
    expect(KOMPONEN).toContain("bisaTandai: true,");
    expect(KOMPONEN).toContain("ruang={ruangIni}");
    expect(KOMPONEN).toContain("export function PanelRuangPapanPanggil(");
    expect(KOMPONEN).toContain("window.location.assign(withBasePath(`/sidang-tunda/${encodeURIComponent(tujuan.sidangId)}`));");
  });
});

// ============================================================================
// TIDAK ADA PENANDA ALETA KE SISTEM LUAR (butir 14, 2 Okt)
// ============================================================================

describe("tidak ada penanda ALETA di tulisan ke sistem luar", () => {
  const service = baca("aleta_bot/services/sidangSelesaiService.js");

  it("SQL ke aplikasi antrian / SIPP dari berkas ini tidak membawa nama, IP, atau kata ALETA", () => {
    const sql = [...service.matchAll(/UPDATE (?:sipp_turunan_antrian\.antrian_sidang|antrian)[\s\S]*?`/g)].map((m) => m[0]);
    expect(sql.length).toBeGreaterThanOrEqual(4);
    for (const s of sql) expect(s).not.toMatch(/ALETA|oleh|operator|\bip\b/i);
  });

  it("jejak jujur hanya di tabel aleta_bot_*", () => {
    expect(service).toContain('const TABEL_BERJALAN = "aleta_bot_sidang_berjalan";');
    expect(service).toContain("lewat VARCHAR(32) NOT NULL DEFAULT 'ALETA'");
    const kode = service
      .split("\n")
      .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
      .join("\n");
    expect(kode).not.toMatch(/drizzle/i);
  });
});
