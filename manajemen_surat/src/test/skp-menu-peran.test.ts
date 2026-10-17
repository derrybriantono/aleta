// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PETA_ATURAN_APLIKASI } from "@/lib/matriks-peran";
import { moduleVisibility } from "@/lib/mock-data";
import { getAccessibleModules, getAccessiblePortalApps } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

/**
 * Menu SKP (17 Okt 2026): ubin portal dan modul sidebar untuk SEMUA peran -
 * layar /skp dibuka semua pegawai (SKP Saya); tab di dalamnya yang mengikuti
 * hak dari server. Aplikasinya terdaftar di matriks peran sebagai matang.
 */

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: `usr-${roleId}`,
    username: roleId,
    password: "",
    name: `Uji ${roleId}`,
    email: `${roleId}@uji.lokal`,
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const PERAN = [
  ["super-admin", "pos-pranata-komputer"],
  ["admin", "pos-pranata-komputer"],
  ["ketua", "pos-ketua"],
  ["wakil-ketua", "pos-wakil-ketua"],
  ["hakim", "pos-hakim"],
  ["panitera", "pos-panitera"],
  ["panitera-muda", "pos-panitera-muda-gugatan"],
  ["panitera-pengganti", "pos-panitera-pengganti"],
  ["jurusita", "pos-jurusita"],
  ["pelaksana", "pos-staf-umum"],
  ["analis-perkara", "pos-analis-perkara"],
  ["sekretaris", "pos-sekretaris"],
] as const;

describe("menu SKP per peran", () => {
  it("terdaftar di matriks peran sebagai aplikasi matang", () => {
    const aturan = PETA_ATURAN_APLIKASI.get("skp");
    expect(aturan?.status).toBe("matang");
  });

  it.each(PERAN)("%s melihat modul dan ubin SKP", (roleId, posisi) => {
    const pengguna = akun(roleId, posisi);
    expect(getAccessibleModules(pengguna, moduleVisibility).map((m) => m.id)).toContain("skp");
    expect(getAccessiblePortalApps(pengguna, moduleVisibility).map((a) => a.id)).toContain("skp");
  });

  it("alamat modul dan ubin mengarah ke /skp", () => {
    const pengguna = akun("hakim", "pos-hakim");
    expect(getAccessibleModules(pengguna, moduleVisibility).find((m) => m.id === "skp")?.href).toBe("/skp");
    expect(getAccessiblePortalApps(pengguna, moduleVisibility).find((a) => a.id === "skp")?.href).toBe("/skp");
  });
});
