import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvidenSkpMenu } from "@/components/portal/eviden-skp-menu";
import { RekapPetugas } from "@/components/portal/rekap-petugas";
import { PILIHAN_PERIODE_EVIDEN_SKP, mulaiPeriodeEvidenSkp, triwulanSelesaiTerakhir } from "@/lib/eviden-skp-unduh";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * MENU UNDUH EVIDEN SKP - DAFTAR, TOMBOL NONAKTIF, ALAMAT UNDUHAN
 * ============================================================================
 *
 * Rute JSON daftar dokumen (buatan agen data) ditirukan menurut kontraknya:
 * { ok: true, data: { periode, orang, ketua, dokumen: [{ kunci, judul,
 * judulLengkap, tersedia, sebabTidakTersedia, jumlahBaris }], galat } }.
 * Yang diperiksa yang TERGAMBAR dan yang DIMINTA:
 *
 *   - bawaan: triwulan TERAKHIR YANG SUDAH SELESAI menurut WITA (Januari-Maret:
 *     Triwulan IV tahun lalu), tanggal tanda tangan hari ini; Tahunan dan
 *     triwulan berjalan tetap dapat dipilih;
 *   - catatan untuk petugas tampil di menu, terpisah dari yang tercetak;
 *   - tiap dokumen tersedia punya tautan PDF/Excel/Word ke alamat yang benar;
 *     yang tidak tersedia nonaktif beserta sebabnya;
 *   - "Unduh semua (ZIP)" per format;
 *   - unduhan lewat fetch: yang gagal menampilkan kalimat rutenya, yang
 *     berhasil memakai nama berkas dari Content-Disposition;
 *   - Escape menutup; tombol di halaman Rekap Hakim hanya untuk hakim.
 */

const hariIni = waktuPengadilan().tanggal;
const TAHUN_INI = Number(hariIni.slice(0, 4));
// Bawaan menu: triwulan terakhir yang SUDAH selesai - tahunnya dapat tahun lalu.
const { tahun: TAHUN, periode: TW } = triwulanSelesaiTerakhir(hariIni);

const DAFTAR = {
  periode: { kunci: TW, tahun: TAHUN, label: "Triwulan X", labelPanjang: `Triwulan X Tahun ${TAHUN}` },
  orang: { id: "26", nama: "Hakim Contoh Ma’ruf, S.H.I., M.H." },
  ketua: { nama: "Dr. Ketua Contoh, S.Ag., M.H." },
  dokumen: [
    { kunci: "rekap-perkara", judul: "REKAP PERKARA", judulLengkap: "Rekap Perkara Triwulan X", tersedia: true, sebabTidakTersedia: null, jumlahBaris: 18 },
    { kunci: "status-perkara", judul: "STATUS PERKARA", judulLengkap: "Status Perkara Triwulan X", tersedia: true, jumlahBaris: 1234 },
    {
      kunci: "posbakum",
      judul: "LAPORAN POSBAKUM",
      judulLengkap: "Laporan Posbakum Triwulan X",
      tersedia: false,
      sebabTidakTersedia: "Bukan data SIPP.",
      jumlahBaris: 0,
    },
  ],
  galat: ["Tanggal musyawarah majelis tidak tercatat di SIPP untuk 3 perkara."],
  catatanOperator: ["NIP Ketua di konfigurasi SIPP (KetuaPNNIP) hanya 17 angka; dilengkapi dari hakim_pn id 32."],
};

function jawabanJson(badan: unknown, status = 200): Response {
  return new Response(JSON.stringify(badan), { status, headers: { "Content-Type": "application/json" } });
}

function pasangFetch(jawab: (url: URL) => Response | Promise<Response>) {
  const ambil = vi.fn(async (alamat: string) => jawab(new URL(String(alamat), "http://portal.contoh")));
  vi.stubGlobal("fetch", ambil);
  return ambil;
}

const jalur = (alamat: unknown) => {
  const u = new URL(String(alamat), "http://portal.contoh");
  return { pathname: u.pathname, kueri: Object.fromEntries(u.searchParams) };
};

let klikTautan: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => "blob:uji");
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  klikTautan = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  klikTautan.mockRestore();
});

function bukaMenu(onTutup = vi.fn()) {
  render(<EvidenSkpMenu peran="hakim" id={26} onTutup={onTutup} />);
  return onTutup;
}

describe("bawaan periode: triwulan terakhir yang SUDAH selesai", () => {
  const kasus: Array<[string, number, string]> = [
    ["2026-09-27", 2026, "tw2"],
    ["2026-07-01", 2026, "tw2"],
    ["2026-06-30", 2026, "tw1"],
    ["2026-04-01", 2026, "tw1"],
    ["2026-03-31", 2025, "tw4"],
    ["2026-01-02", 2025, "tw4"],
    ["2026-12-31", 2026, "tw3"],
  ];
  for (const [tanggal, tahun, periode] of kasus) {
    it(`${tanggal} -> ${periode} ${tahun}`, () => {
      expect(triwulanSelesaiTerakhir(tanggal)).toEqual({ tahun, periode });
    });
  }
});

describe("daftar dokumen", () => {
  it("catatan untuk petugas tampil di menu, dengan keterangan tidak tercetak di dokumen", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    await screen.findByText("Rekap Perkara Triwulan X");
    const kotak = screen.getByText(/Catatan untuk petugas/).closest("div")!;
    expect(kotak.textContent).toMatch(/tidak tercetak di dokumen/);
    expect(within(kotak).getByText(/KetuaPNNIP/)).toBeTruthy();
  });

  it("meminta daftar dengan bawaan triwulan terakhir yang sudah selesai (WITA), lalu menggambarnya", async () => {
    const ambil = pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    expect(screen.getByRole("dialog", { name: "Unduh eviden SKP" })).toBeTruthy();
    await screen.findByText("Rekap Perkara Triwulan X");
    expect(jalur(ambil.mock.calls[0][0])).toEqual({
      pathname: "/api/aleta-ecourt/eviden-skp",
      kueri: { peran: "hakim", id: "26", tahun: String(TAHUN), periode: TW },
    });
    expect(screen.getByText("18 baris")).toBeTruthy();
    expect(screen.getByText("1.234 baris")).toBeTruthy();
    expect(screen.getByText("Mengetahui: Dr. Ketua Contoh, S.Ag., M.H.")).toBeTruthy();
    expect(screen.getByText("Tanggal musyawarah majelis tidak tercatat di SIPP untuk 3 perkara.")).toBeTruthy();
    expect((screen.getByLabelText("Tanggal tanda tangan") as HTMLInputElement).value).toBe(hariIni);
  });

  it("dokumen tersedia: tautan PDF, Excel, Word ke alamat unduhan yang benar", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    const baris = (await screen.findByText("Rekap Perkara Triwulan X")).closest("li")!;
    for (const [label, format] of [
      ["PDF", "pdf"],
      ["Excel", "xlsx"],
      ["Word", "docx"],
    ] as const) {
      const tautan = within(baris).getByRole("link", { name: `Unduh Rekap Perkara Triwulan X sebagai ${label}` });
      expect(jalur(tautan.getAttribute("href"))).toEqual({
        pathname: "/api/aleta-ecourt/eviden-skp/unduh",
        kueri: { peran: "hakim", id: "26", tahun: String(TAHUN), periode: TW, dokumen: "rekap-perkara", format, tanggal: hariIni },
      });
    }
  });

  it("dokumen TIDAK tersedia: tampil nonaktif beserta sebabnya, tanpa alamat unduhan", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    const baris = (await screen.findByText("Laporan Posbakum Triwulan X")).closest("li")!;
    expect(within(baris).getByText("Tidak tersedia - Bukan data SIPP.")).toBeTruthy();
    expect(within(baris).queryAllByRole("link")).toEqual([]);
    const tombol = within(baris).getAllByRole("button");
    expect(tombol.map((t) => t.textContent)).toEqual(["PDF", "Excel", "Word"]);
    for (const t of tombol) expect((t as HTMLButtonElement).disabled).toBe(true);
  });

  it("Unduh semua (ZIP) per format, dengan jumlah dokumen tersedia", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    await screen.findByText("Rekap Perkara Triwulan X");
    expect(screen.getByText("2 dokumen tersedia")).toBeTruthy();
    for (const [label, format] of [
      ["PDF", "pdf"],
      ["Excel", "xlsx"],
      ["Word", "docx"],
    ] as const) {
      const tautan = screen.getByRole("link", { name: `Unduh semua dokumen (ZIP) sebagai ${label}` });
      expect(jalur(tautan.getAttribute("href")).kueri).toMatchObject({ dokumen: "semua", format, periode: TW, tanggal: hariIni });
    }
  });

  it("tidak satu pun tersedia: tombol ZIP ikut nonaktif", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { ...DAFTAR, dokumen: [DAFTAR.dokumen[2]] } }));
    bukaMenu();
    await screen.findByText("tidak ada dokumen tersedia");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("ganti periode dan tahun meminta daftar baru; ganti tanggal mengubah alamat unduhan", async () => {
    const ambil = pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    await screen.findByText("Rekap Perkara Triwulan X");
    fireEvent.click(screen.getByLabelText("Tahunan"));
    await waitFor(() => expect(jalur(ambil.mock.calls.at(-1)![0]).kueri.periode).toBe("tahun"));
    fireEvent.change(screen.getByLabelText("Tahun SKP"), { target: { value: String(TAHUN_INI - 1) } });
    await waitFor(() => expect(jalur(ambil.mock.calls.at(-1)![0]).kueri).toMatchObject({ tahun: String(TAHUN_INI - 1), periode: "tahun" }));

    fireEvent.change(screen.getByLabelText("Tanggal tanda tangan"), { target: { value: "2026-06-30" } });
    const tautan = await screen.findByRole("link", { name: "Unduh Rekap Perkara Triwulan X sebagai PDF" });
    expect(jalur(tautan.getAttribute("href")).kueri).toMatchObject({ tanggal: "2026-06-30", periode: "tahun", tahun: String(TAHUN_INI - 1) });
    expect(screen.getByText('Tercetak "30 Juni 2026" di atas tanda tangan Ketua.')).toBeTruthy();

    // Tanggal kosong/tidak sah: tidak ada tautan unduhan yang dapat ditekan.
    fireEvent.change(screen.getByLabelText("Tanggal tanda tangan"), { target: { value: "" } });
    await screen.findByText("Tanggal belum sah - tombol unduh dinonaktifkan.");
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("periode yang belum dimulai tidak dapat dipilih; tahun lalu seluruhnya dapat", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    await screen.findByText("Rekap Perkara Triwulan X");
    const radio = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
    for (const p of PILIHAN_PERIODE_EVIDEN_SKP) {
      expect(radio(p.label).disabled, p.label).toBe(mulaiPeriodeEvidenSkp(p.kunci, TAHUN) > hariIni);
    }
    // Bawaan: triwulan terakhir yang sudah selesai - selalu dapat dipilih dan terpilih.
    expect(radio(PILIHAN_PERIODE_EVIDEN_SKP.find((p) => p.kunci === TW)!.label).checked).toBe(true);
    // Tahunan tahun ini tetap dapat dipilih (periode berjalan).
    fireEvent.change(screen.getByLabelText("Tahun SKP"), { target: { value: String(TAHUN_INI) } });
    expect(radio("Tahunan").disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Tahun SKP"), { target: { value: String(TAHUN_INI - 1) } });
    for (const p of PILIHAN_PERIODE_EVIDEN_SKP) expect(radio(p.label).disabled, p.label).toBe(false);
  });

  it("Ketua tidak terbaca: disebut terus terang", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: { ...DAFTAR, ketua: null } }));
    bukaMenu();
    await screen.findByText(/Nama Ketua tidak terbaca dari SIPP/);
  });
});

describe("keadaan memuat dan error yang jujur", () => {
  it("daftar gagal: kalimat rute ditampilkan, lalu Coba lagi meminta ulang", async () => {
    let gagal = true;
    const ambil = pasangFetch(() =>
      gagal
        ? jawabanJson({ ok: false, error: { message: "ALETA Bot belum dapat dihubungi." } }, 503)
        : jawabanJson({ ok: true, data: DAFTAR })
    );
    bukaMenu();
    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toContain("ALETA Bot belum dapat dihubungi.");
    gagal = false;
    fireEvent.click(within(peringatan).getByRole("button", { name: /Coba lagi/ }));
    await screen.findByText("Rekap Perkara Triwulan X");
    expect(ambil).toHaveBeenCalledTimes(2);
  });

  it("selama memuat: kalimat memuat, belum ada tombol", async () => {
    pasangFetch(() => new Promise<Response>(() => {}));
    bukaMenu();
    expect(await screen.findByText(/Menyusun daftar dokumen dari SIPP/)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});

describe("mengunduh", () => {
  it("berhasil: fetch ke alamat tautannya, nama berkas dari filename*", async () => {
    const nama = "Eviden SKP 2026 - Triwulan II - Rekap Perkara - Ma'ruf.pdf";
    const ambil = pasangFetch((url) =>
      url.pathname.endsWith("/unduh")
        ? new Response(new Uint8Array([37, 80, 68, 70]), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="x.pdf"; filename*=UTF-8''${encodeURIComponent(nama).replace(/'/g, "%27")}`,
            },
          })
        : jawabanJson({ ok: true, data: DAFTAR })
    );
    bukaMenu();
    const tautan = await screen.findByRole("link", { name: "Unduh Rekap Perkara Triwulan X sebagai PDF" });
    fireEvent.click(tautan);
    await screen.findByText(`${nama} diunduh.`);
    expect(ambil.mock.calls.at(-1)![0]).toBe(tautan.getAttribute("href"));
    expect(klikTautan).toHaveBeenCalledTimes(1);
    const a = klikTautan.mock.contexts[0] as HTMLAnchorElement;
    expect(a.download).toBe(nama);
    expect(a.href).toBe("blob:uji");
  });

  it("gagal: kalimat rute tampil di pop up, tidak ada berkas yang diunduh", async () => {
    pasangFetch((url) =>
      url.pathname.endsWith("/unduh")
        ? jawabanJson({ ok: false, error: { message: "Dokumen eviden SKP tidak dapat disusun dari data SIPP." } }, 500)
        : jawabanJson({ ok: true, data: DAFTAR })
    );
    bukaMenu();
    fireEvent.click(await screen.findByRole("link", { name: "Unduh semua dokumen (ZIP) sebagai Word" }));
    const peringatan = await screen.findByRole("alert");
    expect(peringatan.textContent).toBe("Dokumen eviden SKP tidak dapat disusun dari data SIPP.");
    expect(klikTautan).not.toHaveBeenCalled();
  });
});

describe("papan ketik", () => {
  it("fokus masuk ke pop up; Escape menutup", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    const onTutup = bukaMenu();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Tutup pop up unduh eviden SKP");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onTutup).toHaveBeenCalledTimes(1);
  });

  it("Tab dari unsur terakhir kembali ke yang pertama, Shift+Tab sebaliknya", async () => {
    pasangFetch(() => jawabanJson({ ok: true, data: DAFTAR }));
    bukaMenu();
    await screen.findByText("Rekap Perkara Triwulan X");
    const dialog = screen.getByRole("dialog");
    const tutupAtas = screen.getByRole("button", { name: "Tutup pop up unduh eviden SKP" });
    const tutupBawah = within(dialog).getAllByRole("button", { name: "Tutup" }).at(-1)!;
    tutupBawah.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(tutupAtas);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(tutupBawah);
  });
});

describe("tombol di halaman Rekap Hakim", () => {
  const fetchRekap = () =>
    pasangFetch((url) =>
      url.pathname.endsWith("/eviden-skp")
        ? jawabanJson({ ok: true, data: DAFTAR })
        : jawabanJson({ ok: true, data: { available: false, rekap: null, pesan: "Bot mati (uji)." } })
    );

  it("hakim: tombol membuka pop up; Escape menutup dan fokus kembali ke tombolnya", async () => {
    fetchRekap();
    render(<RekapPetugas peran="hakim" id="26" />);
    const tombol = screen.getByRole("button", { name: "Unduh eviden SKP" });
    expect(tombol.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(tombol);
    const dialog = await screen.findByRole("dialog", { name: "Unduh eviden SKP" });
    await within(dialog).findByText("Rekap Perkara Triwulan X");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(tombol));
  });

  it("panitera, juru sita, mediator: belum ada tombolnya", () => {
    fetchRekap();
    for (const peran of ["panitera", "jurusita", "mediator"]) {
      const { unmount } = render(<RekapPetugas peran={peran} id="26" />);
      expect(screen.queryByRole("button", { name: "Unduh eviden SKP" })).toBeNull();
      unmount();
    }
  });
});
