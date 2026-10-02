// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  blangkoMenurutPemetaan,
  permintaanUntukDokumen,
} from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";

/**
 * 2 Okt sore, butir 1: tombol "Cetak relaas" di Jadwal Sidang portal memakai
 * Pemetaan blangko admin - sama dengan tab Juru Sita di ekstensi. Peta di bawah
 * adalah isian pengguna sungguhan (tangkapan 140 dan 141, 2 Okt 2026).
 */
const RELAAS: Record<string, string> = {
  amplop: "[JS] --AMPLOP PANGGILAN SURAT TERCATAT.rtf",
  delegasi: "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf",
  "panggilan-ikrar": "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf",
  "panggilan-pemohon": "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan) - Pemohon.rtf",
  "panggilan-penggugat": "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
  "panggilan-sidang-pertama": "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf",
  "panggilan-tergugat": "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
  "panggilan-termohon": "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) - Termohon.rtf",
  "relaas-panggilan-sidang-pertama-pemohon": "[JS] 1. Relaas Panggilan Sidang P (Pertama) - Pemohon.rtf",
  "relaas-panggilan-sidang-pertama-penggugat": "[JS] 1. Relaas Panggilan Sidang P (Pertama).rtf",
  "relaas-panggilan-sidang-pertama-tergugat": "[JS] 1. Relaas Panggilan Sidang T (Pertama).rtf",
  "relaas-panggilan-sidang-pertama-termohon": "[JS] 1. Relaas Panggilan Sidang T (Pertama) - Termohon.rtf",
  "bas|Cerai Gugat|1|semua-hadir": "BAS - bukan relaas, harus diabaikan.rtf",
};
const PBT: Record<string, string> = {
  "pbt-pemohon": "[JS] 2. Relaas Pemberitahuan Putusan P - Pemohon.rtf",
  "pbt-penggugat": "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
  "pbt-tergugat": "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
  "pbt-termohon": "[JS] 2. Relaas Pemberitahuan Putusan T - Termohon.rtf",
};

const dok = (golongan: string, pihak: string, ekstra: Record<string, unknown> = {}) => ({
  golongan,
  pihakDipanggil: pihak,
  alurPerkaraId: 15,
  ...ekstra,
});
const pilih = (d: ReturnType<typeof dok>) => blangkoMenurutPemetaan(d, RELAAS, PBT);

describe("cetak relaas portal memakai pemetaan admin (butir 1)", () => {
  it("sidang pertama per pihak memakai kunci buatan pengguna relaas-panggilan-sidang-pertama-*", () => {
    expect(pilih(dok("sidang-pertama", "pertama"))?.kunci).toBe("relaas-panggilan-sidang-pertama-penggugat");
    expect(pilih(dok("sidang-pertama", "kedua"))?.kunci).toBe("relaas-panggilan-sidang-pertama-tergugat");
  });

  it("pemohon/termohon menang atas penggugat/tergugat - dari sebutan pihak atau alur permohonan", () => {
    const talak = { sebutanPihak: { pertama: "Pemohon", kedua: "Termohon" } };
    expect(pilih(dok("sidang-pertama", "pertama", talak))?.kunci).toBe("relaas-panggilan-sidang-pertama-pemohon");
    expect(pilih(dok("sidang-ditunda", "kedua", talak))?.kunci).toBe("panggilan-termohon");
    expect(pilih(dok("sidang-ditunda", "pertama", { alurPerkaraId: 16 }))?.kunci).toBe("panggilan-pemohon");
  });

  it("sidang lanjutan per pihak, P dan T sekaligus, ikrar, dan pemberitahuan putusan", () => {
    expect(pilih(dok("sidang-ditunda", "pertama"))?.berkas).toBe(RELAAS["panggilan-penggugat"]);
    expect(pilih(dok("sidang-ditunda", "kedua"))?.berkas).toBe(RELAAS["panggilan-tergugat"]);
    expect(pilih(dok("sidang-pertama", "keduanya"))?.kunci).toBe("panggilan-sidang-pertama");
    expect(pilih(dok("ikrar-talak", "keduanya"))?.kunci).toBe("panggilan-ikrar");
    expect(pilih(dok("pemberitahuan-putusan", "pertama"))?.kunci).toBe("pbt-penggugat");
    expect(pilih(dok("pemberitahuan-putusan", "kedua", { sebutanPihak: { kedua: "Termohon" } }))?.kunci).toBe("pbt-termohon");
  });

  it("kunci BAS yang disimpan berjenis relaas tidak pernah terpilih; keadaan tak dipetakan = blangko bawaan", () => {
    for (const g of ["sidang-pertama", "sidang-ditunda", "ikrar-talak"]) {
      for (const p of ["pertama", "kedua", "keduanya"]) expect(pilih(dok(g, p))?.kunci ?? "").not.toMatch(/^bas\|/);
    }
    expect(permintaanUntukDokumen(dok("delegasi", "pertama"))).toBeNull();
    expect(pilih(dok("amplop", "keduanya"))).toBeNull();
    expect(pilih(dok("golongan-asing", "pertama"))).toBeNull();
  });

  it("peta kosong (tabel belum ada / server lama) = tidak ada penimpaan", () => {
    expect(blangkoMenurutPemetaan(dok("sidang-pertama", "pertama"), {}, {})).toBeNull();
  });
});
