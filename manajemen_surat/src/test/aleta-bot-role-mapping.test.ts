import { describe, expect, it } from "vitest";

import type { AletaBotEmployeeRecipient } from "@/lib/aleta-bot-types";
import { filterEmployeeRecipientsByMapping } from "@/server/modules/aleta-bot/service";

/**
 * Ketua dan Wakil Ketua Pengadilan adalah HAKIM juga: mereka memegang perkara
 * dan bersidang. Aplikasi lama menyatakan ini dengan mendaftarkan nomor yang
 * SAMA di hakimIds sekaligus ketuaId. Di ALETA satu user hanya punya satu role
 * utama, jadi keterkaitannya dinyatakan lewat IMPLICIT_ROLE_IDS.
 *
 * Test ini menjaga dua arah sekaligus: pimpinan ikut menerima notifikasi hakim,
 * tetapi hakim biasa tidak ikut menerima notifikasi khusus pimpinan.
 */
function pegawai(overrides: Partial<AletaBotEmployeeRecipient>): AletaBotEmployeeRecipient {
  return {
    id: "u",
    name: "Pegawai",
    username: "pegawai",
    roleId: "hakim",
    positionId: "",
    positionName: "",
    unitKerja: "",
    additionalRoleIds: [],
    whatsappNumber: "6285255956962",
    whatsappChatId: "6285255956962@c.us",
    ...overrides,
  };
}

const ketua = pegawai({ id: "u1", roleId: "ketua", name: "ABDUL SALAM, S.HI. MH." });
const wakilKetua = pegawai({ id: "u2", roleId: "wakil-ketua", name: "AKBAR ALI, S.H.I." });
const hakim = pegawai({ id: "u3", roleId: "hakim", name: "DERRY BRIANTONO, S.H." });
const panitera = pegawai({ id: "u4", roleId: "panitera", name: "SRI SUSILOWATI" });
const jurusita = pegawai({ id: "u5", roleId: "jurusita", name: "FAHRI SAIFUDDIN" });

const semua = [ketua, wakilKetua, hakim, panitera, jurusita];
const idHasil = (roleHints: string[]) =>
  filterEmployeeRecipientsByMapping(semua, { roleHints }).map((item) => item.id);

describe("notifikasi hakim mencakup pimpinan yang juga bersidang", () => {
  it("mengikutsertakan Ketua dan Wakil Ketua pada notifikasi hakim", () => {
    expect(idHasil(["hakim"])).toEqual(["u1", "u2", "u3"]);
  });

  it("tidak melebar ke panitera atau jurusita", () => {
    const hasil = idHasil(["hakim"]);
    expect(hasil).not.toContain("u4");
    expect(hasil).not.toContain("u5");
  });
});

describe("notifikasi khusus pimpinan tidak bocor ke hakim biasa", () => {
  it("hanya pimpinan yang cocok dengan roleHints ketua", () => {
    const hasil = idHasil(["ketua"]);
    expect(hasil).toContain("u1");
    expect(hasil).not.toContain("u3");
    expect(hasil).not.toContain("u4");
  });
});

describe("peran lain tidak terpengaruh", () => {
  it("notifikasi panitera hanya untuk panitera", () => {
    expect(idHasil(["panitera"])).toEqual(["u4"]);
  });

  it("notifikasi jurusita hanya untuk jurusita", () => {
    expect(idHasil(["jurusita"])).toEqual(["u5"]);
  });

  it("Ketua tidak ikut notifikasi panitera maupun jurusita", () => {
    expect(idHasil(["panitera"])).not.toContain("u1");
    expect(idHasil(["jurusita"])).not.toContain("u1");
  });
});

describe("role tambahan pada satu akun tetap dihormati", () => {
  it("pegawai rangkap jabatan cocok dengan role tambahannya", () => {
    const rangkap = pegawai({ id: "u6", roleId: "panitera", additionalRoleIds: ["jurusita"] });
    const hasil = filterEmployeeRecipientsByMapping([rangkap], { roleHints: ["jurusita"] });
    expect(hasil.map((item) => item.id)).toEqual(["u6"]);
  });
});
