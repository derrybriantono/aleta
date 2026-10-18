import { writeFileSync } from "node:fs";

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, vi } from "vitest";

import { PanduanPemeriksaanSaksi, type PemuatPanduan } from "@/components/portal/panduan-pemeriksaan-saksi";
import { susunPanduan } from "@/server/shared/pandu-saksi";

const KELUAR = "D:/aleta-dev/kerja/saksi/layar/";
const muat: PemuatPanduan = async (kueri) =>
  susunPanduan({
    jenisPerkaraId: kueri.get("jenisPerkaraId"),
    alurPerkaraId: kueri.get("alurPerkaraId"),
    jenisPerkara: kueri.get("jenisPerkara"),
    keadaan: JSON.parse(kueri.get("keadaan") || "{}"),
    butirSensitif: kueri.get("sensitif") === "1",
  });

function lebar(w: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
  window.dispatchEvent(new Event("resize"));
}

function simpan(nama: string, w: number) {
  document.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((i) => {
    if (i.checked) i.setAttribute("checked", "");
    else i.removeAttribute("checked");
  });
  document.querySelectorAll<HTMLSelectElement>("select").forEach((s) => {
    const o = s.options[s.selectedIndex];
    if (o) o.setAttribute("selected", "");
  });
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="_pandu.css"></head><body class="bg-background text-foreground" style="margin:0;padding:${w < 700 ? 12 : 24}px"><div style="max-width:${w < 700 ? "100%" : "1400px"};margin:0 auto"><div class="rounded-xl border bg-card p-4"><h4 class="text-lg font-extrabold tracking-tight mb-1">901/Pdt.G/2026/PA.Uji</h4><p class="mb-3 text-sm text-muted-foreground">Rincian sidang · Pembuktian</p>${document.body.innerHTML}</div></div></body></html>`;
  writeFileSync(KELUAR + nama + ".html", html, "utf8");
}

const perkara = { nomorPerkara: "901/Pdt.G/2026/PA.Uji", jenisPerkaraId: 347, alurPerkaraId: 15, jenisPerkara: "Cerai Gugat" };

async function siap() {
  await waitFor(() => {
    if (!document.querySelector("[data-pandu-saksi]")) throw new Error("belum");
  });
}

describe("tangkapan", () => {
  it("laptop 1366 dan HP 390 dan TV 1920", async () => {
    for (const [nama, w] of [["laptop1366", 1366], ["hp390", 390], ["tv1920", 1920]] as const) {
      window.localStorage.clear();
      lebar(w);
      render(
        createElement(PanduanPemeriksaanSaksi, {
          perkara,
          sidangId: "7001",
          kunciBagian: "pandu-tangkap",
          muat,
          menonjol: true,
          agenda: "Pembuktian",
          keadaanAwal: { kehadiran: "kontradiktoir" },
          namaSaksi: { P: ["Fulanah binti Rekaan", "Fulan bin Rekaan"], T: [] },
        })
      );
      await siap();
      // centang beberapa butir untuk Saksi 1 dan satu untuk Saksi 2
      const kotak = Array.from(document.querySelectorAll<HTMLInputElement>("[data-pokok] input[type=checkbox]"));
      kotak.slice(0, 12).forEach((k, i) => {
        if (i % 2 === 0) fireEvent.click(k);
      });
      simpan("pandu-" + nama, w);
      if (nama === "laptop1366") {
        const ket = document.querySelector("[data-pandu-keadaan]") as HTMLDetailsElement;
        ket.setAttribute("open", "");
        simpan("pandu-" + nama + "-keadaan", w);
      }
      fireEvent.click(screen.getByRole("button", { name: /Layar sidang/ }));
      await screen.findByRole("dialog");
      document.querySelector("[data-pandu-layar-sidang]")!.parentElement;
      // simpan hanya dialog
      const dialog = document.querySelector("[data-pandu-layar-sidang]") as HTMLElement;
      fireEvent.click(screen.getAllByRole("button", { name: /Berikutnya/ })[0]);
      fireEvent.click(screen.getAllByRole("button", { name: /Berikutnya/ })[0]);
      const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="_pandu.css"></head><body class="bg-background text-foreground" style="margin:0">${dialog.outerHTML}</body></html>`;
      writeFileSync(KELUAR + "pandu-layar-sidang-" + nama + ".html", html, "utf8");
      cleanup();
    }
  });

  it("dispensasi kawin: keterangan anak", async () => {
    lebar(1366);
    render(
      createElement(PanduanPemeriksaanSaksi, {
        perkara: { nomorPerkara: "902/Pdt.P/2026/PA.Uji", jenisPerkaraId: 362, alurPerkaraId: 16, jenisPerkara: "Dispensasi Kawin" },
        sidangId: "7002",
        kunciBagian: "pandu-tangkap",
        muat,
        menonjol: true,
        namaSaksi: { P: [], T: [] },
      })
    );
    await siap();
    fireEvent.click(screen.getByRole("tab", { name: /Keterangan anak, calon, dan orang tua/ }));
    simpan("pandu-dispensasi-keterangan-laptop1366", 1366);
    cleanup();
  });

  it("harta bersama: saksi tergugat", async () => {
    lebar(1366);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      createElement(PanduanPemeriksaanSaksi, {
        perkara: { nomorPerkara: "905/Pdt.G/2026/PA.Uji", jenisPerkaraId: 348, alurPerkaraId: 15, jenisPerkara: "Harta Bersama" },
        sidangId: "7005",
        kunciBagian: "pandu-tangkap",
        muat,
        menonjol: true,
        keadaanAwal: { bantahan: ["sudah-dibagi"] },
        namaSaksi: { P: ["Saksi Rekaan P"], T: ["Saksi Rekaan T"] },
      })
    );
    await siap();
    fireEvent.click(screen.getByRole("tab", { name: /Saksi Tergugat/ }));
    simpan("pandu-harta-bersama-saksi-tergugat-laptop1366", 1366);
    cleanup();
  });
});
