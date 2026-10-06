import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Butir 3 (6 Okt 2026) - tautan Court Calendar di kolom Agenda Jadwal Sidang,
 * DIJALANKAN di jsdom: rekomendasi ALETA yang agendanya disunting, baris
 * manual, baris LAMA yang disunting - semuanya harus sampai ke badan POST apa
 * adanya; pratinjau (kering) lebih dulu, simpan sungguhan hanya sesudah dua
 * tekanan; tanpa akun SIPP tidak ada yang dapat dikirim; hakim tidak melihat
 * tautannya.
 */

const keadaan = vi.hoisted(() => ({
  pengguna: { roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti", additionalRoleIds: [] as string[] } as Record<string, unknown>,
  akun: { ok: true, username: "derry", milik: ["derry"] } as Record<string, unknown>,
  kiriman: [] as Array<Record<string, any>>,
}));

vi.mock("@/lib/app-state", () => ({ usePortal: () => ({ currentUser: keadaan.pengguna }) }));

const LAMA = {
  id: 8717,
  tanggal: "2026-09-08",
  jam: "09:00",
  agenda: "Sidang Pertama",
  keterangan: "",
  diinputOleh: "andini",
  diinputTanggal: "2026-09-01 11:43:47",
  diperbaharuiOleh: "",
  diperbaharuiTanggal: "",
};

function jawab(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  keadaan.pengguna = { roleId: "panitera-pengganti", positionId: "pos-panitera-pengganti", additionalRoleIds: [] };
  keadaan.akun = { ok: true, username: "derry", milik: ["derry"] };
  keadaan.kiriman = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (alamat: string, opsi?: RequestInit) => {
      const url = String(alamat);
      if (opsi?.method === "POST") {
        const badan = JSON.parse(String(opsi.body));
        keadaan.kiriman.push(badan);
        if (badan.kering !== false) {
          return jawab({
            available: true,
            ok: true,
            kering: true,
            akunSipp: { username: "derry" },
            ditolak: [],
            dilewati: [],
            rencana: [
              ...badan.ubah.map((_: unknown, ke: number) => ({ jenis: "ubah", ke, keterangan: "sunting", sql: "UPDATE perkara_court_calendar ...", nilai: [] })),
              ...badan.tambah.map((_: unknown, ke: number) => ({ jenis: "tambah", ke, keterangan: "tambah", sql: "INSERT INTO perkara_court_calendar ...", nilai: [] })),
            ],
          });
        }
        return jawab({
          available: true,
          ok: true,
          kering: false,
          ditolak: [],
          dilewati: [],
          hasil: [
            ...badan.ubah.map((_: unknown, ke: number) => ({ jenis: "ubah", ke, id: 8717, keadaan: "tersimpan", pesan: "tersimpan dan terbaca ulang di SIPP" })),
            ...badan.tambah.map((_: unknown, ke: number) => ({ jenis: "tambah", ke, id: 9001 + ke, keadaan: "tersimpan", pesan: "tersimpan dan terbaca ulang di SIPP" })),
          ],
          daftarSesudah: [{ ...LAMA, agenda: badan.ubah[0]?.agenda ?? LAMA.agenda, diperbaharuiOleh: "derry" }],
          ringkas: { tersimpan: badan.ubah.length + badan.tambah.length },
        });
      }
      if (url.includes("jumlah=")) return jawab({ ok: true, jumlah: { "10049": 1 } });
      return jawab({
        available: true,
        ok: true,
        perkara: { perkaraId: 10049, nomorPerkara: "123/Pdt.G/2026/PA.Dgl", tanggalDaftar: "2026-09-01", jenisPerkara: "Cerai Gugat" },
        baris: [LAMA],
        status: {
          tahapan: { tahap: [{ kunci: "pendaftaran", tanggal: "2026-09-01" }], sidangPertama: "2026-09-08" },
          identitasPihak: { jenisPerkara: "Cerai Gugat" },
          jadwal: [{ tanggalSidang: "2026-09-08", jamSidang: "09:00", agenda: "Sidang Pertama", dihadiriOleh: 2 }],
          mediasi: null,
          lewatEcourt: false,
          putusan: { sudahPutus: false },
          ikrarTalak: { ada: false },
        },
        statusAlasan: "",
        akun: keadaan.akun,
      });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

import { CourtCalendarSidang } from "@/components/portal/court-calendar-sidang";

async function bukaDialog() {
  render(<CourtCalendarSidang perkaraId="10049" nomorPerkara="123/Pdt.G/2026/PA.Dgl" jenisPerkara="Cerai Gugat" />);
  const tautan = await screen.findByRole("button", { name: /Court Calendar/ });
  await waitFor(() => expect(tautan.textContent).toMatch(/\(1\)/));
  fireEvent.click(tautan);
  return screen.findByRole("dialog");
}

describe("Court Calendar di kolom Agenda", () => {
  it("rekomendasi disunting + baris manual + baris lama disunting sampai ke POST; pratinjau kering, simpan dua tekanan", async () => {
    const dialog = await bukaDialog();
    const rekomendasi = (await within(dialog).findByText("Rekomendasi ALETA")).closest("section")!;
    // Verstek: ALETA mengusulkan pembacaan gugatan + putusan verstek.
    const usulan = await waitFor(() => {
      const t = within(rekomendasi)
        .getAllByRole("textbox", { name: "Jadwal/Agenda Sidang" })
        .find((x) => /Musyawarah Majelis/.test((x as HTMLTextAreaElement).value));
      expect(t).toBeTruthy();
      return t as HTMLTextAreaElement;
    });
    fireEvent.change(usulan, { target: { value: "Pembuktian Penggugat dan Putusan Verstek" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /Tambah baris manual/ }));
    const agendaSemua = within(rekomendasi).getAllByRole("textbox", { name: "Jadwal/Agenda Sidang" }) as HTMLTextAreaElement[];
    const manual = agendaSemua[agendaSemua.length - 1];
    expect(manual.value).toBe("");
    fireEvent.change(manual, { target: { value: "Sidang Tambahan Saksi" } });
    const tanggalSemua = rekomendasi.querySelectorAll('input[type="date"]');
    fireEvent.change(tanggalSemua[tanggalSemua.length - 1], { target: { value: "2026-11-04" } });

    const lama = within(dialog).getByText("Sudah di Court Calendar SIPP (1)").closest("section")!;
    fireEvent.click(within(lama).getByRole("button", { name: /Sunting/ }));
    fireEvent.change(within(lama).getByRole("textbox", { name: "Jadwal/Agenda Sidang" }), {
      target: { value: "Sidang Pertama Tergugat Tidak Hadir" },
    });
    fireEvent.change(within(lama).getByRole("textbox", { name: "Keterangan" }), { target: { value: "Panggil Tergugat" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /Pratinjau/ }));
    await waitFor(() => expect(keadaan.kiriman).toHaveLength(1));
    const pratinjau = keadaan.kiriman[0];
    expect(pratinjau.kering).toBe(true);
    expect(pratinjau.akunSipp).toBe("derry");
    expect(pratinjau.perkaraId).toBe("10049");
    expect(pratinjau.ubah).toEqual([
      { id: 8717, tanggal: "2026-09-08", jam: "09:00", agenda: "Sidang Pertama Tergugat Tidak Hadir", keterangan: "Panggil Tergugat" },
    ]);
    const agenda = pratinjau.tambah.map((x: { agenda: string }) => x.agenda);
    expect(agenda).toContain("Pembuktian Penggugat dan Putusan Verstek");
    expect(agenda).toContain("Sidang Tambahan Saksi");
    expect(agenda.some((x: string) => /Musyawarah Majelis/.test(x))).toBe(false);
    expect(pratinjau.tambah.find((x: { agenda: string }) => x.agenda === "Sidang Tambahan Saksi")).toMatchObject({ tanggal: "2026-11-04", jam: "09:00" });
    await within(dialog).findByText(/Pratinjau pernyataan ke SIPP/);

    const simpan = within(dialog).getByRole("button", { name: /Simpan ke SIPP/ });
    fireEvent.click(simpan);
    // Tekanan pertama hanya meminta keyakinan.
    expect(keadaan.kiriman).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /Tekan sekali lagi/ }));
    await waitFor(() => expect(keadaan.kiriman).toHaveLength(2));
    expect(keadaan.kiriman[1].kering).toBe(false);
    expect(keadaan.kiriman[1].tambah).toEqual(pratinjau.tambah);
    await within(dialog).findByText(/tersimpan dan terbaca ulang di SIPP/, { selector: "p.rounded-md" });
    expect(within(dialog).getAllByText("tersimpan di SIPP").length).toBeGreaterThanOrEqual(3);
  });

  it("tanpa akun SIPP tertaut: pesan disebut, pratinjau dan simpan mati", async () => {
    keadaan.akun = { ok: false, alasan: "akun_sipp_belum_tertaut", pesan: "Akun ALETA Anda belum tertaut ke akun SIPP.", milik: [] };
    const dialog = await bukaDialog();
    await within(dialog).findByText(/belum tertaut ke akun SIPP/);
    await within(dialog).findByText("Rekomendasi ALETA");
    expect((within(dialog).getByRole("button", { name: /Pratinjau/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: /Simpan ke SIPP/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(keadaan.kiriman).toEqual([]);
  });

  it("hakim tidak melihat tautannya, dan tidak ada permintaan apa pun", async () => {
    keadaan.pengguna = { roleId: "hakim", positionId: "pos-hakim", additionalRoleIds: [] };
    const { container } = render(<CourtCalendarSidang perkaraId="10049" nomorPerkara="123/Pdt.G/2026/PA.Dgl" />);
    await new Promise((r) => setTimeout(r, 120));
    expect(container.textContent).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });
});
