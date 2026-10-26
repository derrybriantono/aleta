import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";

/**
 * 26 Okt 2026 - kalender form Tunda/Putus di Jadwal Sidang terpotong karena
 * digambar "absolute" di dalam wadah overflow-x-auto. Kini kalender digambar di
 * document.body dengan posisi tetap, jadi wadah yang menggulung tidak lagi
 * memotongnya; klik di dalam kalender tidak menutupnya, klik di luar menutup.
 */

function Contoh({ catat }: { catat: (v: string) => void }) {
  const [nilai, setNilai] = useState("2026-11-09");
  return createElement(
    "div",
    { "data-wadah-gulung": "", className: "overflow-x-auto", style: { height: 60 } },
    createElement(PemilihTanggalSidang, {
      value: nilai,
      "aria-label": "Tanggal berikutnya",
      onChange: (v: string) => {
        catat(v);
        setNilai(v);
      },
    })
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("kalender pemilih tanggal tidak terpotong wadah", () => {
  it("kalender digambar di luar wadah yang menggulung, dapat dipilih, dan tertutup oleh klik di luar", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    const catat = vi.fn();
    const { container } = render(createElement(Contoh, { catat }));
    fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));

    const dialog = screen.getByRole("dialog", { name: /Kalender November 2026/ });
    const wadah = container.querySelector("[data-wadah-gulung]") as HTMLElement;
    expect(wadah.contains(dialog)).toBe(false);
    const pembungkus = dialog.closest("[data-kalender-mengambang]") as HTMLElement;
    expect(pembungkus).not.toBeNull();
    expect(pembungkus.parentElement).toBe(document.body);
    expect(pembungkus.className).toContain("fixed");
    expect(dialog.className).not.toContain("absolute");

    // Klik di dalam kalender tidak menutupnya; memilih tanggal kerja menulis nilai.
    fireEvent.mouseDown(dialog);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(dialog.querySelector('[data-tanggal="2026-11-10"]') as HTMLElement);
    expect(catat).toHaveBeenCalledWith("2026-11-10");
    expect(screen.queryByRole("dialog")).toBeNull();

    // Dibuka lagi lalu klik di luar: tertutup.
    fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
