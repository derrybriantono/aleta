import { describe, expect, it } from "vitest";

import { shouldUseEnvSecretForBotAi } from "@/server/modules/aleta-bot/service";

/**
 * Sinkronisasi AI ke ALETA Bot punya dua jalur pemasokan API key:
 *
 *   Cara 1 - key disimpan sebagai env di container bot (GEMINI_API_KEY dst.).
 *            Portal TIDAK mengirim secret; bot membacanya dari env.
 *   Cara 2 - key hanya diisi di UI Pengaturan AI portal. Portal meneruskan key
 *            itu ke bot lewat jalur internal bertoken antar container.
 *
 * Keputusannya kini berdasarkan APAKAH ENV KEY BENAR-BENAR TERISI, bukan sekadar
 * "production". Dulu production selalu memakai env-secret walau env key kosong,
 * sehingga admin yang hanya mengisi key di UI mendapati bot berjalan TANPA key.
 */
describe("pemilihan sumber API key AI untuk ALETA Bot", () => {
  it("env key terisi: bot membaca dari env, portal tidak mengirim secret", () => {
    expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: true, allowVolatileSecret: undefined })).toBe(true);
  });

  it("env key KOSONG: portal meneruskan key dari UI (inti perbaikan)", () => {
    // Dulu di production ini true → key dikosongkan → bot tanpa key. Sekarang
    // false → key dari Pengaturan AI portal diteruskan ke bot.
    expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: false, allowVolatileSecret: undefined })).toBe(false);
  });

  it("opsi volatile menang walau env key terisi", () => {
    expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: true, allowVolatileSecret: "true" })).toBe(false);
    expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: true, allowVolatileSecret: "TRUE" })).toBe(false);
  });

  it("nilai selain true tidak mengaktifkan jalur volatile", () => {
    for (const nilai of ["false", "1", "ya", "", undefined]) {
      expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: true, allowVolatileSecret: nilai })).toBe(true);
      expect(shouldUseEnvSecretForBotAi({ envKeyHasValue: false, allowVolatileSecret: nilai })).toBe(false);
    }
  });
});
