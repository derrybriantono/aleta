// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { APP_VERSION } from "@/lib/patch-notes";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  SESI_TANPA_DIINGAT_DETIK,
  hapusSesi,
  periksaSesi,
  tandaiSesi,
} from "@/server/modules/portal/sesi-portal";

/**
 * Masa berlaku sesi portal.
 *
 * Yang dijaga di sini:
 *
 *   - tidak mencentang "Simpan login akun" berarti dua jam,
 *   - mencentangnya berarti tidak diputus waktu,
 *   - pembaruan aplikasi memutus keduanya,
 *   - sesi tanpa penanda diperlakukan sebagai TIDAK diingat.
 *
 * Yang TIDAK boleh terjadi: sesi tanpa penanda hidup selamanya. Penanda dapat
 * hilang karena permintaan penandaannya gagal atau karena sesi itu lahir
 * sebelum fitur ini ada, dan komputer bersama tidak boleh menanggung akibatnya.
 */
let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

const jamLalu = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

describe("masa berlaku sesi", () => {
  it("dua jam bila tidak diingat", async () => {
    await tandaiSesi(db!, "ses-1", false);

    const baru = await periksaSesi(db!, "ses-1", jamLalu(1));
    expect(baru.berlaku).toBe(true);

    const lama = await periksaSesi(db!, "ses-1", jamLalu(3));
    expect(lama).toEqual({ berlaku: false, sebab: "kedaluwarsa" });
  });

  it("tepat pada batasnya masih berlaku, sedetik sesudahnya tidak", async () => {
    await tandaiSesi(db!, "ses-batas", false);
    const sekarang = new Date();
    const tepat = new Date(sekarang.getTime() - SESI_TANPA_DIINGAT_DETIK * 1000);
    const lewat = new Date(sekarang.getTime() - (SESI_TANPA_DIINGAT_DETIK + 2) * 1000);

    expect((await periksaSesi(db!, "ses-batas", tepat, sekarang)).berlaku).toBe(true);
    expect((await periksaSesi(db!, "ses-batas", lewat, sekarang)).berlaku).toBe(false);
  });

  it("tidak diputus waktu bila diingat", async () => {
    await tandaiSesi(db!, "ses-2", true);

    // Tiga bulan pun tetap berlaku - yang memutusnya hanya pembaruan aplikasi.
    const hasil = await periksaSesi(db!, "ses-2", jamLalu(24 * 90));
    expect(hasil).toEqual({ berlaku: true, diingat: true });
  });

  it("pembaruan aplikasi memutus sesi, termasuk yang diingat", async () => {
    await tandaiSesi(db!, "ses-3", true);
    await db!
      .prepare("UPDATE sesi_portal SET versi_aplikasi = ? WHERE session_id = ?")
      .run("0.0.1-lama", "ses-3");

    const hasil = await periksaSesi(db!, "ses-3", jamLalu(1));
    expect(hasil).toEqual({ berlaku: false, sebab: "versi-berubah" });
  });

  it("versi yang dicatat adalah versi aplikasi yang sedang berjalan", async () => {
    await tandaiSesi(db!, "ses-4", true);
    const baris = await db!
      .prepare("SELECT versi_aplikasi FROM sesi_portal WHERE session_id = ?")
      .all<{ versi_aplikasi: string }>("ses-4");
    expect(baris[0].versi_aplikasi).toBe(APP_VERSION);
  });

  it("sesi tanpa penanda diperlakukan sebagai TIDAK diingat", async () => {
    // Arah bawaannya ke sisi yang lebih ketat: penanda yang hilang tidak boleh
    // berakibat sesi yang hidup selamanya di komputer bersama.
    expect((await periksaSesi(db!, "ses-tanpa-tanda", jamLalu(1))).berlaku).toBe(true);
    expect((await periksaSesi(db!, "ses-tanpa-tanda", jamLalu(5))).berlaku).toBe(false);
  });

  it("sesi tanpa penanda TIDAK diputus oleh perbedaan versi", async () => {
    // Sesi yang lahir sebelum fitur ini ada tidak punya versi tercatat.
    // Memutus seluruh pegawai pada saat pemasangan bukan perilaku yang
    // diinginkan siapa pun - dua jam berikutnya sudah cukup membuat semuanya
    // bertanda.
    const hasil = await periksaSesi(db!, "ses-lawas", jamLalu(1));
    expect(hasil).toEqual({ berlaku: true, diingat: false });
  });

  it("tanggal lahir yang tidak terbaca tidak memutus sesi", async () => {
    await tandaiSesi(db!, "ses-5", false);
    expect((await periksaSesi(db!, "ses-5", null)).berlaku).toBe(true);
    expect((await periksaSesi(db!, "ses-5", "bukan tanggal")).berlaku).toBe(true);
  });

  it("menandai dua kali menimpa, bukan menumpuk", async () => {
    await tandaiSesi(db!, "ses-6", false);
    await tandaiSesi(db!, "ses-6", true);

    const baris = await db!
      .prepare("SELECT diingat FROM sesi_portal WHERE session_id = ?")
      .all<{ diingat: number }>("ses-6");
    expect(baris).toHaveLength(1);
    expect(Number(baris[0].diingat)).toBe(1);
  });

  it("menghapus sesi juga menghapus penandanya", async () => {
    await tandaiSesi(db!, "ses-7", true);
    await hapusSesi(db!, "ses-7");

    const baris = await db!
      .prepare("SELECT session_id FROM sesi_portal WHERE session_id = ?")
      .all<{ session_id: string }>("ses-7");
    expect(baris).toHaveLength(0);
  });

  it("pengenal sesi kosong tidak menulis apa pun", async () => {
    await tandaiSesi(db!, "", true);
    const baris = await db!.prepare("SELECT session_id FROM sesi_portal").all<{ session_id: string }>();
    expect(baris).toHaveLength(0);
  });
});
