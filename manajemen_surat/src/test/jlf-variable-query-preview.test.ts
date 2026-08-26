// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveJlfVariableQueryPreview } from "@/lib/judicia-legal-form-query-preview";

describe("JLF variable query preview", () => {
  it("maps hakim variables to the read-only hakim registry query", () => {
    const preview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_hakim",
      sourceKey: "hakim.nama",
      key: "abt_penetapan_cg_hakim_nama",
    });

    expect(preview.status).toBe("registered");
    expect(preview.queryKey).toBe("sipp.hakim.majelis");
    expect(preview.sqlPreview).toContain("perkara_hakim_pn");
    expect(preview.sqlPreview).toContain("GROUP_CONCAT");
    expect(preview.sqlPreview).toContain("AS data");
    expect(preview.sqlPreview).toContain("#perkara_id#");
    expect(preview.readOnly).toBe(true);
  });

  it("builds a variable-specific kuasa hukum query from perkara_pengacara", () => {
    const preview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_perkara",
      sourceKey: "kuasa.penggugat.1.tanggal_kuasa",
      key: "kuasa_penggugat_tanggal",
    });

    expect(preview.status).toBe("registered");
    expect(preview.queryKey).toBe("sipp.perkara.by_nomor");
    expect(preview.sqlPreview).toContain("pa.tanggal_kuasa AS data");
    expect(preview.sqlPreview).toContain("FROM perkara_pengacara AS pa");
    expect(preview.sqlPreview).toContain("pa.pihak_ke = 1");
    expect(preview.sqlPreview).toContain("pa.urutan = 1");
  });

  it("builds a variable-specific pihak query using the proper party table", () => {
    const preview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_pihak",
      sourceKey: "tergugat.2.alamat",
      key: "tergugat_2_alamat",
    });

    expect(preview.status).toBe("registered");
    expect(preview.queryKey).toBe("sipp.pihak.tergugat");
    expect(preview.sqlPreview).toContain("FROM perkara_pihak2 AS pp");
    expect(preview.sqlPreview).toContain("COALESCE(pp.alamat, ph.alamat) AS data");
    expect(preview.sqlPreview).toContain("pp.urutan = 2");
  });

  it("keeps manual/text variables away from SIPP SQL", () => {
    const preview = resolveJlfVariableQueryPreview({
      sourceType: "jlf_manual",
      sourceKey: "manual.posita",
    });

    expect(preview.status).toBe("not_sipp");
    expect(preview.queryKey).toBeNull();
    expect(preview.sqlPreview).toBeNull();
  });

  it("detects selected hearing variables from source metadata", () => {
    const preview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_jadwal_sidang",
      sourceKey: "sidang.terpilih.tanggal_sidang",
    });

    expect(preview.status).toBe("registered");
    expect(preview.queryKey).toBe("sipp.sidang.by_id");
    expect(preview.sqlPreview).toContain("FROM perkara_jadwal_sidang AS js");
    expect(preview.sqlPreview).toContain("js.tanggal_sidang AS data");
    expect(preview.sqlPreview).toContain("js.urutan = #sidang_urutan#");
    expect(preview.allowedParams).toEqual(["perkara_id", "sidang_id", "sidang_urutan"]);
  });

  it("builds specific decision and fee previews from SIPP tables", () => {
    const aktaPreview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_putusan",
      sourceKey: "nomor_akta_cerai",
    });
    const feePreview = resolveJlfVariableQueryPreview({
      sourceType: "sipp_keuangan",
      sourceKey: "biaya_panggilan",
    });

    expect(aktaPreview.sqlPreview).toContain("FROM perkara_akta_cerai AS ac");
    expect(aktaPreview.sqlPreview).toContain("ac.nomor_akta_cerai AS data");
    expect(feePreview.sqlPreview).toContain("FROM perkara_biaya AS pb");
    expect(feePreview.sqlPreview).toContain("LIKE '%panggilan%'");
  });
});
