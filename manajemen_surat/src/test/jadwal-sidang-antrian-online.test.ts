/**
 * Perbaikan 2 Okt 2026 sore, butir 4 (agen J): Jadwal Sidang memberi IKON bila
 * nomor antriannya diambil lewat ANTRIAN ONLINE, bukan di loket/anjungan.
 *
 * Sumber pembedanya kolom `online` antrian_sidang (lihat
 * @/lib/tanda-antrian-online). Yang dijaga di sini:
 *   1. aturannya - yang tidak pasti (kedua sisi berjam) tidak ditebak;
 *   2. saklar Tampilan "Tanda antrian online" - menyala bawaan, dapat dimatikan;
 *   3. sel Antrian/Jam dan panel Rincian SUNGGUH menggambarnya (dirender, bukan
 *      disisir teksnya), dan mode Ringkas tinggal ikon.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RincianSidang, SelAntrianJam } from "@/components/portal/aleta-ecourt-sidang";
import { TandaAntrianOnline, TandaAntrianOnlineRincian } from "@/components/portal/jadwal-sidang-2okt";
import { FRASA_ANTRIAN_ONLINE, tandaAntrianOnline } from "@/lib/tanda-antrian-online";
import {
  SAKLAR_TAMPILAN,
  SAKLAR_WAJIB,
  bacaTampilan,
  kelompokTampilan,
  tampil,
  tampilanBawaan,
} from "@/lib/tampilan-antrian-sidang";

type PropsSel = Parameters<typeof SelAntrianJam>[0];
type AntrianSel = NonNullable<PropsSel["antrian"]>;

function antrian(sebagian: Partial<AntrianSel>): AntrianSel {
  return {
    nomor: 3,
    tanggalSidang: "2026-10-02",
    waktuAmbil: "08:12",
    online: false,
    pihak1: "",
    pihak2: "",
    saksi: "",
    keadaan: "menunggu",
    menitMenunggu: null,
    jamPanggil: "",
    noRuang: 1,
    ruanganId: 1,
    namaPetugas: "",
    majelisKode: "",
    ...sebagian,
  };
}

const baris = {
  perkaraId: "9001",
  nomorPerkara: "459/Pdt.G/2026/PA.Dgl",
  tanggalSidang: "2026-10-02",
  jamSidang: "09:00",
} as unknown as PropsSel["baris"];

function sel(props: Partial<PropsSel>) {
  return renderToStaticMarkup(
    createElement(SelAntrianJam, {
      baris,
      tanggalTampil: "2026-10-02",
      sidangSelesai: false,
      ...props,
    } as PropsSel)
  );
}

describe("aturan tanda antrian online", () => {
  it("tanpa online === true tidak ada tanda (NULL dan 0 bukan 'pasti loket', tetapi juga bukan online)", () => {
    expect(tandaAntrianOnline(undefined)).toBeNull();
    expect(tandaAntrianOnline(null)).toBeNull();
    expect(tandaAntrianOnline({ online: false, pihak1: "08:00" })).toBeNull();
    expect(tandaAntrianOnline({ online: null, pihak1: "08:00" })).toBeNull();
  });

  it("hanya penggugat berjam: sisi P beserta jamnya", () => {
    const t = tandaAntrianOnline({ online: true, pihak1: "08:12", waktuAmbil: "08:12" });
    expect(t).toMatchObject({ sisi: "P", jam: "08:12" });
    expect(t?.keterangan).toContain(FRASA_ANTRIAN_ONLINE);
    expect(t?.keterangan).toContain("penggugat/pemohon, pukul 08:12");
  });

  it("hanya tergugat berjam: sisi T beserta jamnya", () => {
    const t = tandaAntrianOnline({ online: true, pihak2: "09:40" });
    expect(t).toMatchObject({ sisi: "T", jam: "09:40" });
    expect(t?.keterangan).toContain("tergugat/termohon, pukul 09:40");
  });

  it("KEDUA sisi berjam: sisi tidak ditebak, keduanya disebut, dan dikatakan tidak diketahui", () => {
    const t = tandaAntrianOnline({ online: true, pihak1: "08:12", pihak2: "08:40", waktuAmbil: "08:12" });
    expect(t?.sisi).toBe("");
    expect(t?.jam).toBe("");
    expect(t?.keterangan).toContain(FRASA_ANTRIAN_ONLINE);
    expect(t?.keterangan).toContain("P pukul 08:12");
    expect(t?.keterangan).toContain("T pukul 08:40");
    expect(t?.keterangan).toContain("tidak diketahui");
  });

  it("hari lampau dari rekaman (tanpa jam per sisi): jam ambil terawal, tanpa sisi", () => {
    const t = tandaAntrianOnline({ online: true, pihak1: "", pihak2: "", waktuAmbil: "07:55" });
    expect(t).toMatchObject({ sisi: "", jam: "07:55" });
    expect(t?.keterangan).toContain("jam ambil terawal 07:55");
  });

  it("online tanpa jam sama sekali tetap ditandai, tanpa jam karangan", () => {
    const t = tandaAntrianOnline({ online: true });
    expect(t?.jam).toBe("");
    expect(t?.keterangan).toContain(FRASA_ANTRIAN_ONLINE);
    expect(t?.keterangan).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe("saklar Tampilan 'Tanda antrian online'", () => {
  const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === "tanda-antrian-online");

  it("ada, berlabel persis, di kelompok penanda, tidak wajib, menyala bawaan", () => {
    expect(saklar).toBeDefined();
    expect(saklar?.label).toBe("Tanda antrian online");
    expect(saklar?.kelompok).toBe("penanda");
    expect(SAKLAR_WAJIB).not.toContain("tanda-antrian-online");
    expect(saklar?.bawaanMati ?? false).toBe(false);
    expect(tampilanBawaan()["tanda-antrian-online"]).toBe(true);
    // Simpanan lama (sebelum saklarnya ada) tetap melihat tandanya.
    expect(tampil(bacaTampilan(JSON.stringify({ "menunggu-lama": false })), "tanda-antrian-online")).toBe(true);
    expect(tampil({ "tanda-antrian-online": false }, "tanda-antrian-online")).toBe(false);
    expect(kelompokTampilan().find((k) => k.kunci === "penanda")?.anggota.map((x) => x.kunci)).toContain(
      "tanda-antrian-online"
    );
  });
});

describe("sel Antrian/Jam menggambar ikonnya", () => {
  it("online: ikon (svg) beserta title dan aria-label 'diambil lewat antrian online' + jam", () => {
    const html = sel({ antrian: antrian({ online: true, pihak1: "08:12" }) });
    expect(html).toContain('data-tanda-antrian-online="P"');
    expect(html).toMatch(/data-tanda-antrian-online="P"[^>]*aria-label="[^"]*diambil lewat antrian online[^"]*08:12/);
    expect(html).toMatch(/data-tanda-antrian-online="P"[^>]*title="[^"]*diambil lewat antrian online/);
    expect(html).toMatch(/data-tanda-antrian-online="P"[\s\S]*?<svg/);
    // Chip jam P ikut bertanda ponsel, chip saksi tidak.
    expect(html).toContain('aria-label="lewat antrian online"');
  });

  it("tidak online: tidak ada ikon", () => {
    const html = sel({ antrian: antrian({ online: false, pihak1: "08:12" }) });
    expect(html).not.toContain("data-tanda-antrian-online");
    expect(html).not.toContain("lewat antrian online");
  });

  it("saklar dimatikan: ikon dan tanda pada chip hilang, nomor dan jam tetap", () => {
    const html = sel({ antrian: antrian({ online: true, pihak1: "08:12" }), tampilTandaOnline: false });
    expect(html).not.toContain("data-tanda-antrian-online");
    expect(html).not.toContain("lewat antrian online");
    expect(html).toContain(">3<");
    expect(html).toContain("P 08:12");
  });

  it("kedua sisi berjam: ikon tanpa sisi, tidak ada chip yang ditandai", () => {
    const html = sel({ antrian: antrian({ online: true, pihak1: "08:12", pihak2: "08:40" }) });
    expect(html).toContain('data-tanda-antrian-online="ya"');
    expect(html).not.toContain('aria-label="lewat antrian online"');
  });

  it("mode Ringkas tinggal ikon: kata 'online' berkelas kolom-lengkap, yang disembunyikan tabel Ringkas", () => {
    const html = renderToStaticMarkup(
      createElement(TandaAntrianOnline, { tanda: tandaAntrianOnline({ online: true, pihak2: "10:01" }) })
    );
    expect(html).toMatch(/<span class="kolom-lengkap"[^>]*>online<\/span>/);
    expect(html).toContain("<svg");
    const layar = readFileSync(
      path.resolve(__dirname, "../components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    expect(layar).toContain('? "min-w-[640px] xl:min-w-0 [&_.kolom-lengkap]:hidden"');
  });
});

describe("panel Rincian menyebutnya dalam kalimat", () => {
  const rincianKosong = {
    sipp: null,
    pesanSipp: "",
    ecourt: [],
    pesanEcourt: "",
    pihak: [],
    identitas: null,
    hakim: null,
    kesiapan: null,
  };

  function rincian(tandaOnline: ReturnType<typeof tandaAntrianOnline>) {
    return renderToStaticMarkup(
      createElement(RincianSidang, {
        rincian: rincianKosong,
        nomorPerkara: "459/Pdt.G/2026/PA.Dgl",
        perkaraId: "9001",
        sidangId: "1",
        tampilCatatanHitung: false,
        tandaOnline,
      } as unknown as Parameters<typeof RincianSidang>[0])
    );
  }

  it("online: satu baris keterangan utuh beserta jamnya", () => {
    const html = rincian(tandaAntrianOnline({ online: true, pihak1: "08:12" }));
    expect(html).toContain('data-tanda-antrian-online-rincian="P"');
    expect(html).toContain("diambil lewat antrian online");
    expect(html).toContain("pukul 08:12");
  });

  it("tidak online atau saklarnya mati (null): tidak ada barisnya", () => {
    expect(rincian(null)).not.toContain("data-tanda-antrian-online-rincian");
    expect(
      renderToStaticMarkup(createElement(TandaAntrianOnlineRincian, { tanda: null }))
    ).toBe("");
  });

  it("baris jadwal meneruskan saklar yang SAMA ke sel dan ke Rincian", () => {
    const layar = readFileSync(
      path.resolve(__dirname, "../components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    expect(layar).toContain('tampilTandaOnline={tampil(tampilan, "tanda-antrian-online")}');
    expect(layar).toMatch(
      /tandaOnline=\{\s*tampil\(tampilan, "tanda-antrian-online"\)\s*\?\s*tandaAntrianOnline\(antrianUntuk\(antrian\.peta, baris\)\)/
    );
  });
});
