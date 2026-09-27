import { describe, expect, it } from "vitest";

import {
  SEBUTAN_MEDIATOR,
  adaMediatorHakim,
  adaMediatorNonHakim,
  daftarMediator,
  golonganMediator,
  golonganSatuMediator,
  golonganTiapMediator,
  namaTiapMediator,
  sebutanMediator,
  statusMediatorBelumTercatat,
} from "@/lib/sebutan-mediator";

/**
 * Sandi yang SUNGGUH ada di perkara_mediasi.status_mediator - terukur
 * 27 Sep 2026 pada sipp_donggala dan sipp (PA Bungku). Uji memakai sandi
 * sungguhan, bukan karangan: sebutan pihak pernah lolos uji berbulan-bulan
 * karena ujinya memakai ejaan "Itsbat" yang tidak ada di basis data.
 */
const SANDI_TERUKUR = ["H", "H,H", "N", "", null];

describe("sebutan mediator menurut sandi SIPP", () => {
  it("H adalah Mediator Hakim - aturan lama /hakim/i tidak pernah cocok dengan huruf ini", () => {
    expect(sebutanMediator("H")).toBe("Mediator Hakim");
    expect(golonganMediator("H")).toBe("hakim");
    expect(adaMediatorHakim("H")).toBe(true);
    expect(adaMediatorNonHakim("H")).toBe(false);
  });

  it("besar-kecil huruf dan spasi tidak mengubah golongan", () => {
    expect(golonganSatuMediator("h")).toBe("hakim");
    expect(golonganSatuMediator("  H  ")).toBe("hakim");
  });

  it("N dan sandi lain apa pun adalah Mediator Non Hakim (ketentuan: selainnya)", () => {
    expect(sebutanMediator("N")).toBe("Mediator Non Hakim");
    expect(golonganMediator("N")).toBe("non-hakim");
    expect(adaMediatorNonHakim("N")).toBe(true);
    expect(adaMediatorHakim("N")).toBe(false);
    for (const asing of ["NH", "X", "P", "Non Hakim", "non-hakim"]) {
      expect(golonganSatuMediator(asing)).toBe("non-hakim");
    }
  });

  it("status kosong BUKAN Non Hakim - disebut belum tercatat dan tidak masuk hitungan mana pun", () => {
    for (const kosong of ["", "   ", null, undefined, "-", "—"]) {
      expect(sebutanMediator(kosong)).toBe("Status mediator belum tercatat");
      expect(golonganMediator(kosong)).toBe("belum-tercatat");
      expect(statusMediatorBelumTercatat(kosong)).toBe(true);
      expect(adaMediatorHakim(kosong)).toBe(false);
      expect(adaMediatorNonHakim(kosong)).toBe(false);
      expect(golonganTiapMediator(kosong)).toEqual([]);
    }
  });

  it("sandi berangkai H,H: dua hakim, sebutan tidak diulang", () => {
    expect(golonganTiapMediator("H,H")).toEqual(["hakim", "hakim"]);
    expect(golonganMediator("H,H")).toBe("hakim");
    expect(sebutanMediator("H,H")).toBe("Mediator Hakim");
    // Rangkaian utuh "H,H" bukan huruf H - pembanding kesamaan sederhana
    // akan menjatuhkannya ke Non Hakim.
    expect(adaMediatorNonHakim("H,H")).toBe(false);
  });

  it("rangkaian campuran H,N masuk KEDUA golongan dan menyebut keduanya", () => {
    expect(golonganMediator("H,N")).toBe("campuran");
    expect(adaMediatorHakim("H,N")).toBe(true);
    expect(adaMediatorNonHakim("H,N")).toBe(true);
    expect(sebutanMediator("H,N")).toBe("Mediator Hakim, Mediator Non Hakim");
  });

  it("aman dipanggil atas keluarannya sendiri - Hakim tidak berbalik menjadi Non Hakim", () => {
    for (const sandi of [...SANDI_TERUKUR, "H,N"]) {
      const sekali = sebutanMediator(sandi);
      expect(sebutanMediator(sekali)).toBe(sekali);
      expect(golonganMediator(sekali)).toBe(golonganMediator(sandi));
    }
  });

  it("tiap sandi terukur mendapat tepat satu dari tiga sebutan baku", () => {
    const baku = Object.values(SEBUTAN_MEDIATOR);
    for (const sandi of SANDI_TERUKUR) {
      expect(baku).toContain(sebutanMediator(sandi));
    }
  });
});

describe("nama mediator berpasangan dengan sandinya", () => {
  it("pemisah <br/> SIPP dipecah, bukan ditulis mentah", () => {
    expect(namaTiapMediator("Mohamad Arif, S.Ag.,M.H.<br/>Mazidah, S.Ag., M.H.")).toEqual([
      "Mohamad Arif, S.Ag.,M.H.",
      "Mazidah, S.Ag., M.H.",
    ]);
    expect(namaTiapMediator("A<br>B<BR />C")).toEqual(["A", "B", "C"]);
    expect(namaTiapMediator("")).toEqual([]);
  });

  it("nama ke-n berpasangan dengan sandi ke-n, dua arah", () => {
    expect(daftarMediator("Hakim Satu<br/>Mediator Luar", "H,N")).toEqual([
      { nama: "Hakim Satu", golongan: "hakim", sebutan: "Mediator Hakim" },
      { nama: "Mediator Luar", golongan: "non-hakim", sebutan: "Mediator Non Hakim" },
    ]);
    // Urutan dibalik - pasangan harus ikut terbalik, bukan tetap.
    expect(daftarMediator("Mediator Luar<br/>Hakim Satu", "N,H")).toEqual([
      { nama: "Mediator Luar", golongan: "non-hakim", sebutan: "Mediator Non Hakim" },
      { nama: "Hakim Satu", golongan: "hakim", sebutan: "Mediator Hakim" },
    ]);
  });

  it("sandi yang kurang tidak dipinjam dari mediator lain", () => {
    expect(daftarMediator("A<br/>B", "H")).toEqual([
      { nama: "A", golongan: "hakim", sebutan: "Mediator Hakim" },
      { nama: "B", golongan: "belum-tercatat", sebutan: "Status mediator belum tercatat" },
    ]);
  });

  it("nama tanpa sandi: satu mediator yang statusnya belum tercatat", () => {
    expect(daftarMediator("Akbar Ali, S.H.I", "")).toEqual([
      { nama: "Akbar Ali, S.H.I", golongan: "belum-tercatat", sebutan: "Status mediator belum tercatat" },
    ]);
    expect(daftarMediator("", "")).toEqual([]);
  });
});
