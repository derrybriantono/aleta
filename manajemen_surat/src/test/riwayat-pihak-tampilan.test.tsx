import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PenandaRiwayatPihak,
  PenyediaRiwayatPihak,
  lupakanRiwayatPihak,
  type MuatanRiwayatPihak,
  type PerkaraRiwayat,
} from "@/components/portal/riwayat-pihak";
import { withBasePath } from "@/lib/base-path";

// Uji mutan menjalankan berkas ini atas SALINAN komponen/layarnya - bukan
// menyunting berkas aslinya - lewat dua variabel ini. Tanpa keduanya yang
// dipakai modul yang sesungguhnya.
vi.mock("@/components/portal/riwayat-pihak", async (asli) =>
  process.env.RIWAYAT_UI_BERKAS ? await import(/* @vite-ignore */ process.env.RIWAYAT_UI_BERKAS) : await asli()
);
vi.mock("@/components/portal/aleta-ecourt-status-perkara", async (asli) =>
  process.env.RIWAYAT_LAYAR_BERKAS ? await import(/* @vite-ignore */ process.env.RIWAYAT_LAYAR_BERKAS) : await asli()
);

// Layar Status Perkara memanggil usePortal untuk kop cetak dan hak akses.
vi.mock("@/lib/app-state", async (asli) => ({
  ...(await asli<typeof import("@/lib/app-state")>()),
  usePortal: () => ({
    institutionIdentity: { courtName: "Pengadilan Agama Contoh" },
    accessibleModules: [],
  }),
}));

import { AletaEcourtStatusPerkara, type Status } from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * ============================================================================
 * PENANDA "CERAI N×" DAN "N PERKARA TERKAIT" - YANG TERGAMBAR
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026. Yang diperiksa yang TERGAMBAR:
 *
 *   - penanda muncul HANYA pada ambangnya: cerai >= 2, terkait >= 1;
 *   - menekan angkanya memunculkan daftar - nomor perkara TERTAUT ke Status
 *     Perkara ALETA (/aleta-ecourt?perkara=<nomor>), jenis, kedudukan,
 *     keadaan, akta cerai, sebelum/sesudah, dan DASAR pencocokannya;
 *   - papan ketik: fokus pindah ke daftar, Escape menutup dan mengembalikan
 *     fokus ke tombolnya;
 *   - layar Status Perkara SUNGGUHAN: riwayat baru dibaca ketika bagian Para
 *     pihak dibuka, dan kuasa serta saksi TIDAK pernah diberi penanda.
 *
 * Nama orang dan nomor perkara di sini karangan.
 */

const NOMOR = "77/Pdt.G/2026/PA.Ctt";

function butir(ubah: Partial<PerkaraRiwayat>): PerkaraRiwayat {
  return {
    perkaraId: "70",
    nomorPerkara: "70/Pdt.G/2020/PA.Ctt",
    jenisPerkara: "Cerai Gugat",
    pihakKe: 1,
    kedudukan: "Penggugat",
    tanggalDaftar: "2020-01-15",
    tanggalPutusan: "2020-04-01",
    keadaan: "Dikabulkan",
    aktaCerai: { nomor: "50/AC/2020/PA.Ctt", tanggal: "2020-06-10" },
    arah: "sebelumnya",
    dasar: { tingkat: "nik", label: "NIK sama", catatan: "" },
    ...ubah,
  };
}

const CERAI_LALU = butir({});
const CERAI_INI = butir({
  perkaraId: "9001",
  nomorPerkara: NOMOR,
  tanggalDaftar: "2026-07-01",
  tanggalPutusan: "2026-08-01",
  aktaCerai: { nomor: "12/AC/2026/PA.Ctt", tanggal: "2026-08-20" },
  arah: "perkara ini",
  dasar: { tingkat: "perkara_ini", label: "perkara ini", catatan: "" },
});
const HARTA_SESUDAH = butir({
  perkaraId: "9100",
  nomorPerkara: "88/Pdt.G/2026/PA.Ctt",
  jenisPerkara: "Harta Bersama",
  tanggalDaftar: "2026-09-01",
  tanggalPutusan: "",
  keadaan: "Masih berjalan",
  aktaCerai: null,
  arah: "sesudahnya",
  dasar: {
    tingkat: "pasangan",
    label: "pasangan nama — bersama RAHMAT BIN LAMBOGO (berhadapan)",
    catatan: "tanggal lahir tercatat berbeda di SIPP — periksa sebelum dipakai",
  },
});

function muatan(ubah: Partial<MuatanRiwayatPihak> = {}): MuatanRiwayatPihak {
  return {
    ok: true,
    aktaTerbaca: true,
    pihak: [
      {
        pihakId: 11,
        pihakKe: 1,
        nama: "Sitti Aminah binti Lahamu",
        kedudukan: "Penggugat",
        ceraiBerakta: 2,
        cerai: [CERAI_LALU, CERAI_INI],
        jumlahTerkait: 2,
        terkait: [CERAI_LALU, HARTA_SESUDAH],
      },
      {
        pihakId: 12,
        pihakKe: 2,
        nama: "Rahmat bin Lambogo",
        kedudukan: "Tergugat",
        ceraiBerakta: 1,
        cerai: [CERAI_INI],
        jumlahTerkait: 0,
        terkait: [],
      },
      // Dua entri yang TIDAK boleh pernah tergambar sebagai penanda: nama
      // kuasa dan nama saksi. Bila penyaring kuasa/saksi hilang, penandanya
      // muncul - dan uji di bawah menangkapnya.
      {
        pihakId: 13,
        pihakKe: 1,
        nama: "Andi Kuasa, S.H.",
        kedudukan: "Penggugat",
        ceraiBerakta: 3,
        cerai: [CERAI_LALU, CERAI_INI, CERAI_LALU],
        jumlahTerkait: 5,
        terkait: [CERAI_LALU],
      },
      {
        pihakId: 14,
        pihakKe: 5,
        nama: "Saksi Satu binti Dua",
        kedudukan: "Saksi",
        ceraiBerakta: 4,
        cerai: [CERAI_LALU, CERAI_INI, CERAI_LALU, CERAI_INI],
        jumlahTerkait: 7,
        terkait: [CERAI_LALU],
      },
    ],
    ...ubah,
  };
}

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

/** fetch tiruan: riwayat pihak dijawab, sisanya dibiarkan menunggu. */
function pasangFetch(jawabRiwayat: () => Response, status?: Status) {
  const panggilan: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string) => {
      const url = String(alamat);
      panggilan.push(url);
      if (url.includes("/api/aleta-ecourt/riwayat-pihak?")) return jawabRiwayat();
      if (status && url.includes("/api/aleta-ecourt/status-perkara?nomor=")) {
        return jawabanJson({ ok: true, data: { available: true, status } });
      }
      return new Promise<Response>(() => {});
    })
  );
  return panggilan;
}

beforeEach(() => {
  lupakanRiwayatPihak();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // tidak apa-apa
  }
});

function Daftar() {
  return (
    <PenyediaRiwayatPihak perkaraId="9001" nomorPerkara={NOMOR}>
      <ul>
        <li data-uji="istri">
          <span>Sitti Aminah binti Lahamu</span>
          <PenandaRiwayatPihak nama="Sitti Aminah binti Lahamu" pihakKe={1} />
        </li>
        <li data-uji="suami">
          <span>Rahmat bin Lambogo</span>
          <PenandaRiwayatPihak nama="Rahmat bin Lambogo" pihakKe={2} />
        </li>
      </ul>
    </PenyediaRiwayatPihak>
  );
}

describe("penanda dan ambangnya", () => {
  it("cerai 2× dan 2 perkara terkait pada istri; suami yang cerai sekali tanpa penanda", async () => {
    const panggilan = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    render(<Daftar />);
    const istri = await waitFor(() => {
      const li = document.querySelector('[data-uji="istri"]') as HTMLElement;
      within(li).getByRole("button", { name: /Pernah bercerai dengan akta 2 kali/ });
      return li;
    });
    expect(within(istri).getByRole("button", { name: /2 perkara lain/ }).textContent).toBe("2 perkara terkait");
    expect(within(istri).getByRole("button", { name: /Pernah bercerai/ }).textContent).toBe("cerai 2×");

    // Cerai SEKALI (perkara ini) bukan yang ditanyakan - tidak ada penanda;
    // tanpa perkara lain - tidak ada penanda terkait.
    const suami = document.querySelector('[data-uji="suami"]') as HTMLElement;
    expect(within(suami).queryAllByRole("button")).toHaveLength(0);

    // Satu pembacaan untuk seluruh pihak, lewat perkaraId.
    const riwayat = panggilan.filter((u) => u.includes("riwayat-pihak"));
    expect(riwayat).toHaveLength(1);
    expect(new URL(riwayat[0], "http://portal.contoh").searchParams.get("perkaraId")).toBe("9001");
  });

  it("tabel akta tidak terbaca: penanda cerai tidak digambar, dan sebabnya disebut", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan({ aktaTerbaca: false }) } }));
    render(<Daftar />);
    await screen.findByText(/Tabel akta cerai tidak terbaca/);
    expect(screen.queryByRole("button", { name: /Pernah bercerai/ })).toBeNull();
    // Perkara terkait tetap - ia tidak bergantung pada tabel akta.
    expect(screen.getByRole("button", { name: /2 perkara lain/ })).toBeTruthy();
  });

  it("ditolak server (403): pesannya terbaca, tanpa penanda, dan dapat dicoba lagi", async () => {
    let kali = 0;
    pasangFetch(() => {
      kali += 1;
      return kali === 1
        ? jawabanJson({ ok: false, error: { message: "Peran Anda tidak diberi akses panel." } }, 403)
        : jawabanJson({ ok: true, data: { available: true, ...muatan() } });
    });
    render(<Daftar />);
    await screen.findByText(/Peran Anda tidak diberi akses panel/);
    expect(screen.queryByRole("button", { name: /Pernah bercerai/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await screen.findByRole("button", { name: /Pernah bercerai dengan akta 2 kali/ });
    expect(kali).toBe(2);
  });

  it("dibaca SEKALI per perkara - menutup lalu membuka bagiannya tidak membaca SIPP lagi", async () => {
    const panggilan = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    const { unmount } = render(<Daftar />);
    await screen.findByRole("button", { name: /Pernah bercerai/ });
    unmount();
    render(<Daftar />);
    // Langsung tergambar dari simpanan - tanpa menunggu.
    expect(screen.getByRole("button", { name: /Pernah bercerai/ })).toBeTruthy();
    expect(panggilan.filter((u) => u.includes("riwayat-pihak"))).toHaveLength(1);
  });
});

// ===========================================================================
// TELAAH GABUNGAN 2.40.0 - UMUR SIMPANAN DAN PENOLAKAN YANG DIBEDAKAN
// ===========================================================================

describe("simpanan di peramban berumur lima menit", () => {
  it("dalam lima menit dibuka lagi: tidak membaca ulang; sesudahnya: membaca ulang", async () => {
    // Hanya jam yang ditiru - pewaktu tetap sungguhan supaya waitFor bekerja.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const t0 = new Date("2026-09-27T09:00:00+08:00").getTime();
      vi.setSystemTime(t0);
      const panggilan = pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
      const riwayat = () => panggilan.filter((u) => u.includes("riwayat-pihak")).length;

      const pertama = render(<Daftar />);
      await screen.findByRole("button", { name: /Pernah bercerai/ });
      pertama.unmount();

      vi.setSystemTime(t0 + 4 * 60_000);
      const kedua = render(<Daftar />);
      expect(screen.getByRole("button", { name: /Pernah bercerai/ })).toBeTruthy();
      kedua.unmount();
      expect(riwayat()).toBe(1);

      // Perkara bisa berubah selama sesi - akta terbit, perkara baru
      // didaftarkan. Sesudah lima menit, membuka bagiannya lagi membaca ulang.
      vi.setSystemTime(t0 + 5 * 60_000 + 1_000);
      render(<Daftar />);
      await waitFor(() => expect(riwayat()).toBe(2));
      await screen.findByRole("button", { name: /Pernah bercerai/ });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("penolakan dibedakan di layar - tindakannya berbeda", () => {
  it("perkara tidak ada: disebut apa adanya, tanpa tombol coba lagi dan tanpa menyalahkan bot", async () => {
    pasangFetch(() =>
      jawabanJson({ ok: true, data: { available: true, ok: false, kode: "perkara_tidak_ada", alasan: "Perkara tidak ditemukan di SIPP." } })
    );
    render(<Daftar />);
    await screen.findByText(/Perkara ini tidak ditemukan di SIPP/);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(screen.queryByText(/tidak dapat dihubungi/)).toBeNull();
  });

  it("bot tak terjangkau: disebut botnya, dengan tombol coba lagi", async () => {
    pasangFetch(() =>
      jawabanJson({
        ok: true,
        data: { available: false, ok: false, kode: "bot_tak_terjangkau", alasan: "aleta_bot tidak dapat dihubungi (koneksi ditolak)." },
      })
    );
    render(<Daftar />);
    await screen.findByText(/ALETA Bot tidak dapat dihubungi/);
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("SIPP galat: disebut SIPP-nya, dengan tombol coba lagi", async () => {
    pasangFetch(() =>
      jawabanJson({ ok: true, data: { available: true, ok: false, kode: "gagal_membaca_sipp", alasan: "Table 'perkara' doesn't exist" } })
    );
    render(<Daftar />);
    await screen.findByText(/SIPP tidak dapat dibaca/);
    expect(screen.getByText(/doesn't exist/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });
});

describe("menekan angkanya memunculkan daftar perkaranya", () => {
  it("nomor perkara tertaut ke Status Perkara ALETA di tab baru; akta, arah, dan dasar tertulis", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    render(<Daftar />);
    const tombol = await screen.findByRole("button", { name: /Pernah bercerai dengan akta 2 kali/ });
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(tombol);
    const daftar = screen.getByRole("dialog", { name: /Cerai berakta/ });
    expect(tombol.getAttribute("aria-expanded")).toBe("true");
    expect(tombol.getAttribute("aria-controls")).toBe(daftar.id);

    // Perkara lain: tautan. Perkara ini: bukan tautan.
    const tautan = within(daftar).getAllByRole("link");
    expect(tautan).toHaveLength(1);
    expect(tautan[0].getAttribute("href")).toBe(
      withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent("70/Pdt.G/2020/PA.Ctt")}`)
    );
    expect(tautan[0].getAttribute("target")).toBe("_blank");
    expect(tautan[0].getAttribute("rel")?.split(/\s+/)).toContain("noopener");
    expect(within(daftar).getByText(NOMOR).closest("a")).toBeNull();

    const teks = daftar.textContent || "";
    expect(teks).toContain("Akta cerai 50/AC/2020/PA.Ctt");
    expect(teks).toContain("Akta cerai 12/AC/2026/PA.Ctt");
    expect(teks).toContain("sebelumnya");
    expect(teks).toContain("perkara ini");
    expect(teks).toContain("Dasar: NIK sama");
    expect(teks).toContain("Cerai Gugat · Penggugat");
  });

  it("daftar perkara terkait: sesudahnya, keadaan, dasar pasangan beserta catatannya", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    render(<Daftar />);
    fireEvent.click(await screen.findByRole("button", { name: /2 perkara lain/ }));
    const daftar = screen.getByRole("dialog", { name: /Perkara terkait/ });
    const hrefs = within(daftar).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent("70/Pdt.G/2020/PA.Ctt")}`),
      withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent("88/Pdt.G/2026/PA.Ctt")}`),
    ]);
    const teks = daftar.textContent || "";
    expect(teks).toContain("Harta Bersama");
    expect(teks).toContain("sesudahnya");
    expect(teks).toContain("Masih berjalan");
    expect(teks).toContain("pasangan nama — bersama RAHMAT BIN LAMBOGO (berhadapan)");
    expect(teks).toContain("tanggal lahir tercatat berbeda di SIPP");
  });

  it("papan ketik: fokus pindah ke daftar; Escape menutup dan mengembalikan fokus ke tombolnya", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    render(<Daftar />);
    const tombol = await screen.findByRole("button", { name: /Pernah bercerai/ });
    tombol.focus();
    fireEvent.click(tombol);
    const daftar = screen.getByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(daftar));
    fireEvent.keyDown(daftar, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(tombol);
    expect(tombol.getAttribute("aria-expanded")).toBe("false");

    // Menekan lagi membuka; menekan tombolnya sekali lagi menutup.
    fireEvent.click(tombol);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(tombol);
    expect(screen.queryByRole("dialog")).toBeNull();

    // Tombol tutup di dalam daftar juga mengembalikan fokus.
    fireEvent.click(tombol);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tutup daftar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(tombol);
  });

  it("latarnya bg-card, bukan bg-popover yang tembus pandang; tema gelap punya warnanya sendiri", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { available: true, ...muatan() } }));
    render(<Daftar />);
    const tombol = await screen.findByRole("button", { name: /Pernah bercerai/ });
    expect(tombol.className).toMatch(/dark:/);
    fireEvent.click(tombol);
    const kelas = screen.getByRole("dialog").className;
    expect(kelas).toContain("bg-card");
    expect(kelas).not.toContain("bg-popover");
    // Lebar mengikuti wadahnya - tidak melampaui layar sempit.
    expect(kelas).toContain("w-full");
  });
});

// ===========================================================================
// LAYAR STATUS PERKARA SUNGGUHAN
// ===========================================================================

function statusUji(): Status {
  return {
    identitas: {
      perkaraId: "9001",
      nomorPerkara: NOMOR,
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      tanggalDaftar: "2026-07-01",
    },
    umur: {
      hariBersih: 40,
      hariMediasi: 10,
      hariBerjalan: 49,
      bulanBerjalan: 1.3,
      sudahPutus: false,
      sebabSelesai: "",
      hariMinutasi: null,
    },
    majelis: [{ id: 26, kode: "C1", nama: "Hakim Satu, S.H.", jabatan: "Hakim Ketua" }],
    panitera: [{ id: 28, kode: "", nama: "Panitera Satu, S.H." }],
    jurusita: [{ id: 30, kode: "", nama: "Jurusita Satu" }],
    saksi: { ada: true, jumlahSaksi: 1, jumlahKeterangan: 0 },
    pihak: [
      { nama: "Sitti Aminah binti Lahamu", pihakKe: 1, jenis: "pihak", adaNomor: false, nomorSamar: "" },
      { nama: "Rahmat bin Lambogo", pihakKe: 2, jenis: "pihak", adaNomor: false, nomorSamar: "" },
      { nama: "Andi Kuasa, S.H.", pihakKe: 1, jenis: "kuasa", adaNomor: false, nomorSamar: "" },
      { nama: "Saksi Satu binti Dua", pihakKe: 5, jenis: "pihak", adaNomor: false, nomorSamar: "" },
    ],
    identitasPihak: null,
    jadwal: [],
    penundaan: [],
    putusan: null,
    biaya: { panjar: 0, terpakai: 0, sisa: 0, rincian: [] },
    dokumenEcourt: [],
    petitum: { ada: false },
    relaas: [],
    dokumenSipp: [],
    lewatEcourt: false,
    penilaian: { skor: 0, keadaan: "baik", totalBobot: 0, rinci: [], catatan: "" },
    penanda: {
      ghaib: null,
      sumberGhaib: [],
      instansi: [],
      perluIzinAtasan: false,
      mafqud: null,
      tundaanPanjang: [],
      ambangMafqud: { hari: 0, kali: 0 },
    },
    penetapanKembali: { terbaca: false, adaPenggantian: false, baris: [] },
    durasiMediasi: { terbaca: false, hari: 0, alasan: "" },
    nilaiRelaas: { terbaca: false, alasan: "", sumber: "" },
    saksiRinci: { terbaca: true, alasan: "", baris: [] },
    ikrarTalak: { terbaca: false, alasan: "", ada: false },
    putusanLengkap: { terbaca: false, ada: false },
    arsipKeterangan: { terbaca: false, alasan: "", sudahDiarsipkan: false, baris: [] },
    putusanEcourt: null,
    konseptor: { terbaca: false, alasan: "", baris: [] },
    delegasiMasuk: { terbaca: false, alasan: "", baris: [] },
    delegasiKeluar: { terbaca: false, alasan: "", baris: [] },
    mediasi: { terbaca: true, alasan: "", baris: [] },
    tahapan: { terbaca: false, alasan: "", tahap: [] },
    upayaHukum: [],
    penilaianSk: { rinci: [], unsurBelumTersambung: [], dasar: "", catatan: "" },
  };
}

describe("layar Status Perkara: dibaca saat Para pihak dibuka; kuasa dan saksi tanpa penanda", () => {
  it("tidak membaca riwayat sebelum bagiannya dibuka; sesudahnya penanda hanya pada pihak", async () => {
    const panggilan = pasangFetch(
      () => jawabanJson({ ok: true, data: { available: true, ...muatan() } }),
      statusUji()
    );
    render(<AletaEcourtStatusPerkara nomorAwal={NOMOR} />);

    const bagian = await waitFor(() => {
      const el = document.getElementById("bagian-pihak");
      if (!el) throw new Error("bagian para pihak belum tergambar");
      return el;
    });
    // Terciut sebagai bawaan: nama pihak belum tergambar, riwayat belum dibaca.
    expect(within(bagian).queryByText("Sitti Aminah binti Lahamu")).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(panggilan.filter((u) => u.includes("riwayat-pihak"))).toHaveLength(0);

    fireEvent.click(within(bagian).getByRole("button", { name: /Para pihak/ }));
    const cerai = await within(bagian).findByRole("button", { name: /Pernah bercerai dengan akta 2 kali/ });
    const riwayat = panggilan.filter((u) => u.includes("riwayat-pihak"));
    expect(riwayat).toHaveLength(1);
    expect(new URL(riwayat[0], "http://portal.contoh").searchParams.get("perkaraId")).toBe("9001");

    // Penandanya di samping nama penggugat - satu baris daftar yang sama.
    const baris = within(bagian).getByRole("button", { name: "Sitti Aminah binti Lahamu" }).closest("li")!;
    expect(baris.contains(cerai)).toBe(true);

    // Kuasa dan saksi: tidak ada penanda walau riwayatnya (sengaja) memuat
    // nama mereka dengan cerai 3 dan 4 kali.
    expect(within(bagian).queryByRole("button", { name: /3 kali/ })).toBeNull();
    expect(within(bagian).queryByRole("button", { name: /4 kali/ })).toBeNull();
    expect(within(bagian).queryByRole("button", { name: /5 perkara lain|7 perkara lain/ })).toBeNull();
    const barisKuasa = within(bagian).getByRole("button", { name: "Andi Kuasa, S.H." }).closest("li")!;
    expect(within(barisKuasa).getAllByRole("button")).toHaveLength(1);

    // Mengetuk nama untuk membuka identitas tidak menutup daftar yang sedang
    // dibaca - keadaannya milik penyedia, bukan penanda yang disusun ulang.
    fireEvent.click(cerai);
    expect(within(bagian).getByRole("dialog", { name: /Cerai berakta/ })).toBeTruthy();
    fireEvent.click(within(bagian).getByRole("button", { name: "Rahmat bin Lambogo" }));
    expect(within(bagian).getByRole("dialog", { name: /Cerai berakta/ })).toBeTruthy();
  });
});
