// @vitest-environment node
import { describe, expect, it } from "vitest";

import { rekomendasiBlangko, statusDariKeteranganPutus } from "@/lib/rekomendasi-blangko";

/**
 * ============================================================================
 * 27 OKT 2026 - SARAN PUTUSAN MENGIKUTI HASIL DI KETERANGAN SIDANG (perkara 591)
 * ============================================================================
 *
 * Perkara 591 Cerai Gugat: keterangan sidang "putus Tidak Dapat Diterima", status putusan belum tercatat di SIPP; dulu disarankan
 * "[01] [Kabul Verstek]" karena sidang memutus tanpa status selalu dianggap dikabulkan. Kini hasil di keterangan dipakai lebih dulu.
 */
const CG = "Cerai Gugat";

describe("statusDariKeteranganPutus", () => {
  it("nama status SIPP sesudah kata putus (huruf besar/kecil, verstek, baris gabungan)", () => {
    expect(statusDariKeteranganPutus("putus Tidak Dapat Diterima")).toBe("Tidak Dapat Diterima");
    expect(statusDariKeteranganPutus("putus DIKABULKAN (verstek)")).toBe("Dikabulkan");
    expect(statusDariKeteranganPutus("Panggil Tergugat · putus ditolak")).toBe("Ditolak");
    expect(statusDariKeteranganPutus("putus DICABUT")).toBe("Dicabut");
    expect(statusDariKeteranganPutus("putus dicoret dari register")).toBe("Dicoret dari Register");
  });
  it("singkatan lazim: NO, kabul, tolak, gugur", () => {
    expect(statusDariKeteranganPutus("putus NO")).toBe("Tidak Dapat Diterima");
    expect(statusDariKeteranganPutus("Putus kabul verstek")).toBe("Dikabulkan");
    expect(statusDariKeteranganPutus("putus tolak")).toBe("Ditolak");
    expect(statusDariKeteranganPutus("putus gugur")).toBe("Gugur");
  });
  it("tanpa hasil: kosong (anggapan lama tetap berlaku)", () => {
    expect(statusDariKeteranganPutus("putus")).toBe("");
    expect(statusDariKeteranganPutus("Putus Verstek")).toBe("");
    expect(statusDariKeteranganPutus("musyawarah majelis")).toBe("");
    expect(statusDariKeteranganPutus("Pembacaan putusan")).toBe("");
    expect(statusDariKeteranganPutus("Penundaan karena hakim tidak dapat hadir")).toBe("");
  });
});

describe("saran putusan memakai hasil dari keterangan sidang", () => {
  const dasar = { jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, mediasi: null, mediasiTerbaca: true };

  it("perkara 591: 'putus Tidak Dapat Diterima' tanpa status tercatat -> bukan blangko Kabul", () => {
    const r = rekomendasiBlangko({ ...dasar, alasanDitunda: "putus Tidak Dapat Diterima" });
    expect(r.putusan.length).toBeGreaterThan(0);
    expect(r.putusan[0].berkas).not.toMatch(/\[Kabul/);
    expect(r.putusan[0].alasan).toMatch(/^Putusan tidak dapat diterima/);
    expect(r.putusan[0].alasan).toContain("menurut keterangan sidang");
    expect(r.putusan[0].alasan).not.toContain("diperkirakan dikabulkan");
    expect(r.putusan[0].perkiraan).toBe(false);
    // Sama dengan saran bila status NO sudah tercatat di SIPP.
    const tercatat = rekomendasiBlangko({ ...dasar, sudahPutus: true, statusPutusan: "Tidak Dapat Diterima" });
    expect(r.putusan[0].berkas).toBe(tercatat.putusan[0].berkas);
  });

  it("'putus ditolak' -> blangko Tolak; 'putus' saja tetap perkiraan dikabulkan", () => {
    expect(rekomendasiBlangko({ ...dasar, alasanDitunda: "putus ditolak" }).putusan[0].berkas).toMatch(/\[Tolak/);
    const polos = rekomendasiBlangko({ ...dasar, alasanDitunda: "putus" }).putusan[0];
    expect(polos.berkas).toMatch(/\[Kabul/);
    expect(polos.perkiraan).toBe(true);
    expect(polos.alasan).toContain("diperkirakan dikabulkan");
  });

  it("status tercatat di SIPP tetap menang atas keterangan", () => {
    const r = rekomendasiBlangko({ ...dasar, sudahPutus: true, statusPutusan: "Dikabulkan", alasanDitunda: "putus Tidak Dapat Diterima" });
    expect(r.putusan[0].berkas).toMatch(/\[Kabul/);
  });
});

describe("NO karena Penggugat hadir sidang pertama lalu tidak hadir (SEMA 1/2022, perkara 591)", () => {
  // Data SIPP 591: sidang 1 dihadiri Penggugat (2), sidang 2 para pihak tidak hadir (4), sidang 3 putus NO tercatat "Penggugat saja" (2).
  const k591 = { jenisPerkara: CG, nomorPerkara: "591/Pdt.G/2026/PA.Dgl", urutanSidang: 3, dihadiriOleh: 2, hadirSebelumnya: 4, penggugatPernahHadir: true, tergugatPernahHadir: false, mediasi: null, mediasiTerbaca: true };
  it("keterangan 'putus Tidak Dapat Diterima' -> blangko 4a SEMA 1 2022 sebagai saran utama", () => {
    expect(rekomendasiBlangko({ ...k591, alasanDitunda: "putus Tidak Dapat Diterima" }).putusan[0].berkas).toMatch(/4a\. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir \(SEMA 1 2022\)/);
  });
  it("status NO tercatat di SIPP -> sama", () => {
    expect(rekomendasiBlangko({ ...k591, sudahPutus: true, statusPutusan: "Tidak Dapat Diterima" }).putusan[0].berkas).toMatch(/4a\./);
  });
  it("Penggugat tidak pernah hadir, atau hadir di sidang sebelumnya: bukan SEMA", () => {
    expect(rekomendasiBlangko({ ...k591, penggugatPernahHadir: false, alasanDitunda: "putus Tidak Dapat Diterima" }).putusan[0].berkas).not.toMatch(/4a\./);
    expect(rekomendasiBlangko({ ...k591, hadirSebelumnya: 2, alasanDitunda: "putus Tidak Dapat Diterima" }).putusan[0].berkas).not.toMatch(/4a\./);
  });
  it("status lain (dikabulkan) tidak terpengaruh", () => {
    expect(rekomendasiBlangko({ ...k591, alasanDitunda: "putus DIKABULKAN" }).putusan[0].berkas).toMatch(/\[Kabul/);
  });
});
