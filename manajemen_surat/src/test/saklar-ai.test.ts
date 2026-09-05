// @vitest-environment node
import { describe, expect, it } from "vitest";

import { normalizePanelSettings } from "@/lib/panel-settings";
import { hitungSaklar, periksaSaklar, type Saklar } from "@/lib/saklar-ai";

/**
 * Saklar mati AI (I6) dan pintu berpikir bebas (I7).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu hal, dan seluruh gunanya ada padanya: **satu "mati" mematikan
 * seluruhnya.** Saklar yang dapat dibatalkan lapisan lain bukan saklar - yang
 * menekannya mengira sudah mati, dan pengiriman tetap berjalan.
 *
 * Yang kedua: sebab yang ditampilkan harus yang paling LUAS. Memberi tahu
 * hakim bahwa perkaranya dimatikan padahal seluruh pengadilan juga dimatikan
 * akan membuatnya menyalakan perkaranya, gagal, lalu tidak tahu apa lagi.
 */

function saklar(lebih: Partial<Saklar>): Saklar {
  return {
    lingkup: "perkara",
    kunci: "",
    menyala: false,
    alasan: "",
    diputuskanOleh: "",
    ...lebih,
  };
}

const KONTEKS = { peran: "hakim", perkaraId: "10601" };

describe("satu mati mematikan seluruhnya", () => {
  it("tanpa satu pun saklar, keadaannya mengikuti setelan global", () => {
    expect(hitungSaklar([], KONTEKS, true).menyala).toBe(true);
    expect(hitungSaklar([], KONTEKS, false).menyala).toBe(false);
  });

  it("global mati tidak dapat dinyalakan saklar mana pun", () => {
    // Saklar yang dapat membatalkan lapisan di atasnya bukan saklar.
    const hasil = hitungSaklar(
      [
        saklar({ lingkup: "pengadilan", menyala: true }),
        saklar({ lingkup: "peran", kunci: "hakim", menyala: true }),
        saklar({ lingkup: "perkara", kunci: "10601", menyala: true }),
      ],
      KONTEKS,
      false
    );
    expect(hasil.menyala).toBe(false);
    expect(hasil.dimatikanOleh).toBe("pengadilan");
  });

  it("saklar pengadilan mati tidak dapat dinyalakan saklar peran maupun perkara", () => {
    const hasil = hitungSaklar(
      [
        saklar({ lingkup: "pengadilan", menyala: false, alasan: "menunggu keputusan pimpinan" }),
        saklar({ lingkup: "peran", kunci: "hakim", menyala: true }),
        saklar({ lingkup: "perkara", kunci: "10601", menyala: true }),
      ],
      KONTEKS,
      true
    );
    expect(hasil.menyala).toBe(false);
    expect(hasil.dimatikanOleh).toBe("pengadilan");
  });

  it("saklar peran mati mematikan meski pengadilan dan perkara menyala", () => {
    const hasil = hitungSaklar(
      [saklar({ lingkup: "peran", kunci: "hakim", menyala: false, alasan: "belum dilatih" })],
      KONTEKS,
      true
    );
    expect(hasil.menyala).toBe(false);
    expect(hasil.dimatikanOleh).toBe("peran");
  });

  it("saklar perkara mati mematikan hanya perkara itu", () => {
    const daftar = [
      saklar({ lingkup: "perkara", kunci: "10601", menyala: false, alasan: "para pihak dikenal luas" }),
    ];
    expect(hitungSaklar(daftar, KONTEKS, true).menyala).toBe(false);
    expect(hitungSaklar(daftar, { peran: "hakim", perkaraId: "10999" }, true).menyala).toBe(true);
  });
});

describe("sebab yang ditampilkan adalah yang paling luas", () => {
  it("pengadilan dan perkara sama-sama mati: yang disebut pengadilan", () => {
    // Hakim yang diberi tahu perkaranya dimatikan akan menyalakan perkaranya,
    // gagal, lalu tidak tahu apa lagi.
    const hasil = hitungSaklar(
      [
        saklar({ lingkup: "pengadilan", menyala: false, alasan: "pagu habis" }),
        saklar({ lingkup: "perkara", kunci: "10601", menyala: false, alasan: "perkara sensitif" }),
      ],
      KONTEKS,
      true
    );
    expect(hasil.dimatikanOleh).toBe("pengadilan");
    expect(hasil.sebab).toContain("pagu habis");
  });

  it("sebabnya menyebut siapa yang memutuskan", () => {
    const hasil = hitungSaklar(
      [
        saklar({
          lingkup: "perkara",
          kunci: "10601",
          menyala: false,
          alasan: "para pihak dikenal luas",
          diputuskanOleh: "Dra. Siti Zubaidah, M.H.",
        }),
      ],
      KONTEKS,
      true
    );
    expect(hasil.sebab).toContain("Dra. Siti Zubaidah");
    expect(hasil.sebab).toContain("para pihak dikenal luas");
    expect(hasil.sebab).toContain("perkara ini");
  });

  it("keadaan menyala tidak membawa sebab", () => {
    const hasil = hitungSaklar([saklar({ lingkup: "perkara", kunci: "10601", menyala: true })], KONTEKS, true);
    expect(hasil.menyala).toBe(true);
    expect(hasil.sebab).toBe("");
    expect(hasil.dimatikanOleh).toBe("");
  });
});

describe("kunci saklar harus cocok tepat", () => {
  it("saklar peran lain tidak mematikan peran ini", () => {
    const daftar = [saklar({ lingkup: "peran", kunci: "panitera", menyala: false, alasan: "x" })];
    expect(hitungSaklar(daftar, KONTEKS, true).menyala).toBe(true);
  });

  it("peran kosong tidak cocok dengan saklar peran mana pun", () => {
    // Kegagalan membaca peran tidak boleh mematikan AI bagi orang yang
    // perannya tidak sedang dimatikan.
    const daftar = [saklar({ lingkup: "peran", kunci: "hakim", menyala: false, alasan: "x" })];
    expect(hitungSaklar(daftar, { peran: "", perkaraId: "10601" }, true).menyala).toBe(true);
  });

  it("perkaraId kosong tidak cocok dengan saklar perkara mana pun", () => {
    const daftar = [saklar({ lingkup: "perkara", kunci: "10601", menyala: false, alasan: "x" })];
    expect(hitungSaklar(daftar, { peran: "hakim", perkaraId: "" }, true).menyala).toBe(true);
  });

  it("peran dicocokkan tanpa membedakan huruf besar-kecil", () => {
    const daftar = [saklar({ lingkup: "peran", kunci: "Hakim", menyala: false, alasan: "x" })];
    expect(hitungSaklar(daftar, { peran: "hakim", perkaraId: "" }, true).menyala).toBe(false);
  });
});

describe("memeriksa masukan saklar", () => {
  it("mematikan WAJIB beralasan, menyalakan tidak", () => {
    // Saklar mati adalah keadaan yang akan ditanyakan orang lain, dan alasan
    // yang tercatat menjawabnya tanpa perlu mencari siapa yang menekan.
    expect(
      periksaSaklar({ lingkup: "perkara", kunci: "1", menyala: false, alasan: "", oleh: "Hakim A" }).ok
    ).toBe(false);
    expect(
      periksaSaklar({ lingkup: "perkara", kunci: "1", menyala: true, alasan: "", oleh: "Hakim A" }).ok
    ).toBe(true);
  });

  it("lingkup selain pengadilan menuntut kuncinya", () => {
    const hasil = periksaSaklar({ lingkup: "peran", kunci: "", menyala: true, alasan: "", oleh: "Admin" });
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toContain("kunci");
  });

  it("lingkup pengadilan tidak menuntut kunci", () => {
    expect(
      periksaSaklar({ lingkup: "pengadilan", kunci: "", menyala: true, alasan: "", oleh: "Admin" }).ok
    ).toBe(true);
  });

  it("siapa yang memutuskan wajib disebut", () => {
    expect(
      periksaSaklar({ lingkup: "pengadilan", kunci: "", menyala: true, alasan: "", oleh: "  " }).ok
    ).toBe(false);
  });

  it("lingkup yang tidak dikenali ditolak", () => {
    expect(
      periksaSaklar({ lingkup: "semesta", kunci: "", menyala: true, alasan: "", oleh: "Admin" }).ok
    ).toBe(false);
  });
});

// ── I7 pintu berpikir bebas ────────────────────────────────────────────────

describe("alamat pintu berpikir bebas", () => {
  it("hanya http dan https yang diterima", () => {
    expect(normalizePanelSettings({ pintuAiBebas: "https://claude.ai/project/abc" }).pintuAiBebas).toContain(
      "claude.ai"
    );
    expect(normalizePanelSettings({ pintuAiBebas: "http://ai.internal/proyek" }).pintuAiBebas).toContain(
      "ai.internal"
    );
  });

  it("skema lain DITOLAK, bukan dilewatkan", () => {
    // javascript: dan data: akan dijalankan peramban sebagai kode saat
    // pintunya ditekan, dan yang menekannya mengira membuka tab biasa.
    expect(normalizePanelSettings({ pintuAiBebas: "javascript:alert(1)" }).pintuAiBebas).toBe("");
    expect(normalizePanelSettings({ pintuAiBebas: "data:text/html,<script>" }).pintuAiBebas).toBe("");
    expect(normalizePanelSettings({ pintuAiBebas: "file:///etc/passwd" }).pintuAiBebas).toBe("");
  });

  it("alamat yang tidak terbaca menghasilkan kosong, bukan dipasang apa adanya", () => {
    expect(normalizePanelSettings({ pintuAiBebas: "bukan alamat" }).pintuAiBebas).toBe("");
    expect(normalizePanelSettings({}).pintuAiBebas).toBe("");
  });
});
