// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Sandi 'E' di SIPP tidak lagi dibaca sebagai bukti e-Summons terkirim.
 * Perkara 385/Pdt.G/2026/PA.Dgl: tergugat tanpa email di e-Court, dipanggil
 * surat tercatat, relaasnya bersandi E - ALETA menuduhnya salah saluran BERAT.
 * Uji perilakunya yang lengkap ada di aleta_bot/scripts/verify-kesiapan-panggilan.js;
 * di sini bentuk kodenya dijaga, ditambah satu jalannya kasus 385 supaya nama
 * ruas yang dibaca portal ikut terjaga.
 */
const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");
const panggilan = baca("aleta_bot/services/ecourtPanggilanService.js");
const kesiapan = baca("aleta_bot/services/kesiapanSidangService.js");
const status = baca("aleta_bot/services/sippStatusPerkaraService.js");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

describe("salah saluran elektronik menuntut e-Summons tercatat di e-Court", () => {
  it("sandi E tanpa e-Summons tidak menjadi salah saluran", () => {
    const i = panggilan.indexOf("const eSummonsTerkirim");
    const blok = panggilan.slice(i, panggilan.indexOf("tanggalPanggilan = teksTanggal(tanggalPanggilan);", i));
    expect(i).toBeGreaterThan(0);
    expect(blok).toContain('jejakRelaas.sandi === "E"');
    expect(blok).toContain('seharusnya !== "elektronik"');
    expect(blok).toContain("!eSummonsTerkirim");
    expect(blok).toContain('terlaksana = "";');
  });
  it("salah saluran tetap dihitung dari terlaksana dan seharusnya - tidak dibungkam", () => {
    expect(panggilan).toContain("const salahSaluran = Boolean(terlaksana) && terlaksana !== seharusnya;");
  });
  it("email e-Court tidak dibuang saat pihak digabung", () => {
    expect(panggilan).toContain("terbacaEcourt: true,");
    expect(panggilan).toContain('email: sudah.email || String(isian.email || "").trim(),');
  });
  it("sandi kosong tidak ditebak dari pendaftaran e-Court", () => {
    expect(panggilan).not.toMatch(/:\s*lewatEcourt\s*\?\s*"elektronik"/);
  });
});

describe("panggilan dinilai untuk sidang ini", () => {
  it("relaas disaring per sidang, e-Summons dicocokkan lewat teksTanggal", () => {
    expect(panggilan).toContain("if (!untukSidangIni(item)) continue;");
    expect(panggilan).not.toContain("String(item.tanggalSidang).slice(0, 10)");
  });
  it("skor kesiapan dan status perkara mengirim nomor sidangnya", () => {
    expect(kesiapan).toContain("sidangId: fakta.sidangId || null,");
    const i = kesiapan.indexOf("return nilaiKesiapan({\n    agenda,");
    expect(i).toBeGreaterThan(0);
    expect(kesiapan.slice(i, kesiapan.indexOf("});", i))).toContain("sidangId: sidangId || null,");
    expect(status).toContain("sidangId: sidangAcuan ? sidangAcuan.sidangId : null,");
    // sidangId tanpa sisiWajib menandai penggugat yang hadir belum dipanggil.
    expect(status).toContain("sisiWajib: wajibAcuan,");
  });
});

describe("layar tidak merah untuk catatan yang bertentangan", () => {
  it("penghambatnya ringan, catatannya tampil di bawah jalur seharusnya", () => {
    const i = kesiapan.indexOf('kunci: "saluran_belum_pasti"');
    expect(i).toBeGreaterThan(0);
    expect(kesiapan.slice(i - 200, i)).toContain("tingkat: TINGKAT.ringan,");
    expect(layar).toContain(") : pihak.catatanSaluran ? (");
  });
});

// ===========================================================================
// KASUS 385 DIJALANKAN - NAMA RUAS YANG DIBACA PORTAL
// ===========================================================================

const require_ = createRequire(import.meta.url);
type Pihak = Record<string, unknown> & { nama: string };
const layanan = require_(path.join(akar, "aleta_bot/services/ecourtPanggilanService.js")) as {
  susunKeadaanPanggilan: (isian: Record<string, unknown>) => {
    sidangId: string | null;
    tanggalSidang: string | null;
    pihak: Pihak[];
    ringkasan: Record<string, number>;
  };
};

describe("385/Pdt.G/2026/PA.Dgl sidang ke-9: tergugat tanpa email e-Court, relaas bersandi E", () => {
  const isian = {
    tanggalSidang: "2026-09-23",
    sidangId: "S9",
    lewatEcourt: true,
    sisiWajib: [2],
    persetujuan: [
      { nama: "Isabella binti Muhamad Aini", peran: "Penggugat", email: "isabella@contoh.id", persetujuan: "setuju" },
      { nama: "Taufik Qurahman bin Dasril", peran: "Tergugat", email: "", persetujuan: "belum" },
    ],
    panggilan: [],
    relaas: [
      { sidangId: "19975", tanggalSidang: "2026-09-09", namaPihak: "Taufik Qurahman bin Dasril", peran: "Tergugat/Termohon", tanggalRelaas: "2026-09-04", noResiPos: "", ketTemu: "E" },
      { sidangId: "S9", tanggalSidang: "2026-09-23", namaPihak: "Taufik Qurahman bin Dasril", peran: "Tergugat/Termohon", tanggalRelaas: "2026-09-17", noResiPos: "", ketTemu: "E" },
    ],
  };

  it("bukan salah saluran; catatan, sandi, dan jejak e-Court dikirim dengan nama ruas yang dibaca portal", () => {
    const h = layanan.susunKeadaanPanggilan(isian);
    const t = h.pihak.find((x) => /Taufik/.test(x.nama))!;
    expect(t).toMatchObject({
      seharusnya: "surat_tercatat",
      terlaksana: "",
      salahSaluran: false,
      sandiRelaas: "E",
      eSummonsTerkirim: false,
      terbacaEcourt: true,
      tanggalPanggilan: "2026-09-17",
    });
    expect(String(t.catatanSaluran)).toMatch(/tidak punya email di e-Court/);
    expect(h.ringkasan).toMatchObject({ salahSaluran: 0, saluranBelumPasti: 1 });
    expect([h.sidangId, h.tanggalSidang]).toEqual(["S9", "2026-09-23"]);
  });

  it("e-Summons yang sungguh tercatat (tanggal tiba sebagai Date) tetap salah saluran", () => {
    const h = layanan.susunKeadaanPanggilan({
      ...isian,
      persetujuan: [isian.persetujuan[0], { ...isian.persetujuan[1], email: "t@contoh.id" }],
      panggilan: [{ namaPihak: "Taufik Qurahman bin Dasril", tanggalSidang: new Date(2026, 8, 23), dikirimPada: new Date(2026, 8, 17, 10) }],
    });
    const t = h.pihak.find((x) => /Taufik/.test(x.nama))!;
    expect(t).toMatchObject({ salahSaluran: true, eSummonsTerkirim: true, catatanSaluran: "" });
    expect(h.ringkasan).toMatchObject({ salahSaluran: 1, saluranBelumPasti: 0 });
  });
});

// ===========================================================================
// TINJAUAN 24 SEPTEMBER 2026 - PIHAK YANG TIDAK WAJIB DIPANGGIL
// ===========================================================================

describe("Status Perkara menilai hanya pihak yang wajib dipanggil", () => {
  const penilaian = require_(path.join(akar, "aleta_bot/services/penilaianPerkaraService.js")) as {
    nilaiPerkara: (fakta: Record<string, unknown>) => {
      rinci: Array<{ kunci: string; catatan: string; dihitung: boolean; bagian: number }>;
    };
  };

  it("penggugat yang hadir tidak ikut penyebut rubrik maupun kalimat analisa", () => {
    // Perkara 521/Pdt.G/2026: dahulu "1 dari 2 pihak dipanggil patut" dan
    // "1 dari 2 pihak belum dipanggil secara patut" atas penggugat yang hadir.
    expect(status).toContain(
      "const pihakWajib = keadaanPanggilan.pihak.filter((p) => !(p.tidakPerluDipanggil && !p.sudahDikirim));"
    );
    expect(status).toContain("    panggilan: panggilanWajib,");
    expect(status).toContain("jumlahPihak: panggilanWajib.jumlahPihak,");
    expect(status).not.toContain("jumlahPihak: keadaanPanggilan.ringkasan.jumlahPihak,");
  });

  it("seluruh pihak hadir: butir panggilan tidak berlaku, bukan 'tidak terbaca'", () => {
    const hasil = penilaian.nilaiPerkara({
      sidangLewat: 2,
      panggilan: { jumlahPihak: 0, patut: 0, tidakWajib: 2 },
    });
    const butir = hasil.rinci.find((x) => x.kunci === "panggilanPatut");
    expect(butir?.dihitung).toBe(false);
    expect(butir?.catatan).toMatch(/Seluruh pihak hadir pada sidang sebelumnya/);
  });

  it("satu pihak wajib dan patut: penuh, bukan setengah", () => {
    const hasil = penilaian.nilaiPerkara({
      sidangLewat: 2,
      panggilan: { jumlahPihak: 1, patut: 1, tidakWajib: 1 },
    });
    const butir = hasil.rinci.find((x) => x.kunci === "panggilanPatut");
    expect(butir?.bagian).toBe(1);
    expect(butir?.catatan).toBe("1 dari 1 pihak dipanggil patut.");
  });
});

describe("kalimat acuan kepatutan di Status Perkara tidak mengaku sidangnya punya relaas", () => {
  const layarStatus = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
  it("bersyarat pada relaas sidang yang dinilai", () => {
    expect(layarStatus).toContain("const acuanBerelaas =");
    expect(layarStatus).toContain('"sidang terakhir yang tercatat - belum ada relaas untuk sidang itu"');
    expect(layarStatus).toContain('if (alasan === "tidak_wajib_dipanggil") return');
  });
});
