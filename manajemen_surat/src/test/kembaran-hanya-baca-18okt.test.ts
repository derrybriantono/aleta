// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Keputusan 18 Okt 2026 (butir 23): selama ALETA_MODE=kembaran, SIPP/ABT lokal (port 8056) hanya-baca.
 * Penjaga statis atas skrip PowerShell (tidak menjalankan MySQL): sifat yang tidak boleh hilang.
 */
const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const kunci = baca("scripts/kembaran/kunci-sipp-abt.ps1");
const nyalakan = baca("scripts/kembaran/nyalakan.ps1");
const doc = baca("docs/kembaran/KEMBARAN-LAPTOP.md");

// Buang baris komentar agar pemeriksaan hanya menilai perintah.
const kode = kunci
  .split("\n")
  .filter((b) => !b.trim().startsWith("#"))
  .join("\n");

describe("kembaran: SIPP/ABT lokal hanya-baca (butir 23)", () => {
  it("tidak pernah mengubah sandi atau mengganti akun yang ada; tidak menyentuh berkas SIPP/ABT", () => {
    expect(kode).not.toMatch(/ALTER\s+USER|SET\s+PASSWORD|IDENTIFIED\s+BY\s+'|RENAME\s+USER|DROP\s+USER\s+IF\s+EXISTS\s+'root'/i);
    expect(kode).not.toMatch(/config\.ini|database\.php|aps_badilag\\application|Set-Content[^\n]*SIPP/i);
    // hak asli root dipasang kembali dari SHOW GRANTS yang disimpan, bukan ditulis ulang tangan
    expect(kode).toContain("SHOW GRANTS FOR 'root'");
    expect(kode).toContain("grants-asli.sql");
  });

  it("akun penuh dicoba masuk SEBELUM root dicabut; root hanya SELECT pada tiga basis data", () => {
    const bagianKunci = kode.slice(kode.indexOf("$hostList = @(Jalankan-Sql $penggunaAsli"));
    const iCoba = bagianKunci.indexOf("SELECT 1;");
    const iCabut = bagianKunci.indexOf("REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'root'");
    expect(iCoba).toBeGreaterThan(-1);
    expect(iCabut).toBeGreaterThan(iCoba);
    for (const db of ["sipp_donggala", "aps_badilag", "sipp_turunan_antrian"]) expect(kode).toContain(`'${db}'`);
    expect(kode).toContain("GRANT SELECT ON");
    expect(kode).not.toMatch(/GRANT\s+(ALL|INSERT|UPDATE|DELETE)[^\n]*TO 'root'/i);
  });

  it("bisa dibalik: -Balik memulihkan hak asli, memastikan ALL PRIVILEGES, baru menghapus akun penuh; -Uji tersedia", () => {
    expect(kode).toContain("[switch]$Balik");
    expect(kode).toContain("[switch]$Uji");
    const balik = kode.slice(kode.indexOf("if ($Balik)"), kode.indexOf("$hostList = @(Jalankan-Sql $penggunaAsli"));
    expect(balik.indexOf("ALL PRIVILEGES ON")).toBeGreaterThan(-1);
    expect(balik.indexOf("DROP USER IF EXISTS")).toBeGreaterThan(balik.indexOf("ALL PRIVILEGES ON"));
  });

  it("hanya menulis di drive D: (atau C:\\aleta\\) dan tanpa sandi di berkas", () => {
    expect(kode).toContain("D:\\Aplikasi\\aleta\\tmp");
    expect(kode).toMatch(/folderKembaran harus di drive D:/);
    expect(kode).not.toMatch(/MYSQL_PWD\s*=\s*['"][^'"]/);
  });

  it("nyalakan.ps1: mengunci sebelum menyalakan (gagal tertutup), bot memakai akun penuh, -Henti membalik, -TanpaKunci memperingatkan", () => {
    expect(nyalakan).toContain("[switch]$TanpaKunci");
    const iKunci = nyalakan.indexOf("& (Join-Path $PSScriptRoot 'kunci-sipp-abt.ps1')\n  # Bot memakai");
    const iBot = nyalakan.indexOf("Start-Process -FilePath 'node'");
    expect(iKunci).toBeGreaterThan(-1);
    expect(iKunci).toBeLessThan(iBot);
    expect(nyalakan).toContain("ALETA_BOT_DB_USER', 'ALETA_BOT_DB_SIPP_USER', 'ALETA_BOT_DB_APS_USER', 'ALETA_BOT_DB_ANTRIAN_USER') { Set-Item -Path \"Env:$n\" -Value 'kembaran_penuh' }");
    expect(nyalakan).toContain("kunci-sipp-abt.ps1') -Balik");
    expect(nyalakan.indexOf("kunci-sipp-abt.ps1') -Balik")).toBeLessThan(nyalakan.indexOf("$env:ALETA_MODE = 'kembaran'"));
    expect(nyalakan).toMatch(/PERINGATAN: -TanpaKunci/);
  });

  it("dicatat di KEMBARAN-LAPTOP.md (cara kerja, pembalikan, batasan alat lain)", () => {
    expect(doc).toContain("SIPP/ABT lokal HANYA-BACA");
    expect(doc).toContain("kunci-sipp-abt.ps1 -Balik");
    expect(doc).toContain("kembaran_penuh");
    expect(doc).toContain("tanpa mengubah sandi satu akun pun");
  });
});
