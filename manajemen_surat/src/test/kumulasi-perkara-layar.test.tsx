// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JenisDenganKumulasi, RincianKumulasi, useSaklarKumulasi } from "@/components/portal/kumulasi-perkara";
import type { KumulasiPerkara } from "@/lib/kumulasi-perkara";
import { KUNCI_SIMPANAN_TAMPILAN } from "@/lib/tampilan-antrian-sidang";

/**
 * Tampilan kumulasi perkara (antrian sidang butir 1, 12 Okt 2026). Aturannya
 * dijaga kumulasi-perkara.test.ts; di sini yang tergambar: nama jenis dengan
 * kumulasinya, tanda "dari petitum", dan saklar yang dibaca layar lain.
 */

const dariPetitum: KumulasiPerkara = {
  sumber: "petitum",
  daftar: [
    {
      kode: "hak-asuh-anak",
      nama: "Hak Asuh Anak",
      sumber: "petitum",
      kutipan: "menetapkan penggugat sebagai pemegang hak asuh atas anak",
    },
  ],
};

const dariSipp: KumulasiPerkara = {
  sumber: "sipp",
  daftar: [{ kode: "itsbat-nikah", nama: "Itsbat Nikah", sumber: "sipp" }],
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("JenisDenganKumulasi", () => {
  it("menulis 'Cerai Gugat Kumulasi Hak Asuh Anak' dan menandai yang dari petitum", () => {
    render(<JenisDenganKumulasi jenis="Cerai Gugat" kumulasi={dariPetitum} />);
    expect(screen.getByText("Cerai Gugat Kumulasi Hak Asuh Anak")).toBeTruthy();
    expect(screen.getByText("Dari petitum")).toBeTruthy();
  });

  it("kumulasi dari SIPP tanpa tanda petitum; tanpa kumulasi hanya jenisnya", () => {
    const { container } = render(<JenisDenganKumulasi jenis="Cerai Talak" kumulasi={dariSipp} />);
    expect(screen.getByText("Cerai Talak Kumulasi Itsbat Nikah")).toBeTruthy();
    expect(container.querySelector("[data-kumulasi-petitum]")).toBeNull();
    cleanup();
    const kedua = render(<JenisDenganKumulasi jenis="Cerai Talak" kumulasi={null} />);
    expect(screen.getByText("Cerai Talak")).toBeTruthy();
    expect(kedua.container.querySelector("[data-kumulasi-perkara]")).toBeNull();
  });
});

describe("RincianKumulasi", () => {
  it("menyebut asal tiap jenis dan kutipan petitumnya", () => {
    render(
      <RincianKumulasi
        kumulasi={{ sumber: "campuran", daftar: [...dariSipp.daftar, ...dariPetitum.daftar] }}
      />
    );
    expect(screen.getByText("Kumulasi perkara")).toBeTruthy();
    expect(screen.getByText("SIPP")).toBeTruthy();
    expect(screen.getByText(/pemegang hak asuh atas anak/)).toBeTruthy();
    expect(screen.getByText(/lengkapi data kumulasi di SIPP/)).toBeTruthy();
  });

  it("tidak digambar bila tidak ada kumulasi", () => {
    const { container } = render(<RincianKumulasi kumulasi={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("useSaklarKumulasi - saklar panel Tampilan Jadwal Sidang", () => {
  it("bawaan menyala; mengikuti pilihan tersimpan", () => {
    const pertama = renderHook(() => useSaklarKumulasi());
    expect(pertama.result.current).toBe(true);
    pertama.unmount();

    window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify({ "kumulasi-perkara": false }));
    const kedua = renderHook(() => useSaklarKumulasi());
    expect(kedua.result.current).toBe(false);

    act(() => {
      window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN, JSON.stringify({ "kumulasi-perkara": true }));
      window.dispatchEvent(new StorageEvent("storage", { key: KUNCI_SIMPANAN_TAMPILAN }));
    });
    expect(kedua.result.current).toBe(true);
  });
});
