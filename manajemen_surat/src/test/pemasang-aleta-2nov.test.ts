// @vitest-environment node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NAMA_BERKAS_PAKET_PORTAL } from "@/lib/deteksi-os-pemasang";
import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";
import { versiEkstensi, zipEkstensiUnduh } from "@/server/shared/ekstensi-paket";
import {
  NAMA_BERKAS_PEMASANG_PAKET,
  NAMA_BERKAS_PENCOPOT,
  normalisasiBentukUnduh,
  susunPemasangPaket,
  susunPencopot,
} from "@/server/shared/pembaru-pemasang";

/**
 * ============================================================================
 * PEMASANG ALETA SEPAKET (2 Nov 2026)
 * ============================================================================
 *
 * Permintaan: tombol unduh di portal menyajikan pemasang yang (a) memasang
 * ekstensi ke lokasi tetap yang jarang tersentuh (%USERPROFILE%\.aleta), (b)
 * menyalakan Mode Pengembang Chrome, (c) memasang pembaru otomatis yang sudah
 * ada - satu paket. Yang dibuktikan di sini:
 *
 *   A. rute unduh ekstensi: ?bentuk=pemasang|pencopot menyajikan .cmd dengan
 *      alamat server yang dilihat petugas (header/konfigurasi yang sama dengan
 *      pembaru), tanpa rahasia; ZIP lama tetap; penjaga sesi sama;
 *   B. skrip: ASCII, kurung/kutip seimbang, fungsi yang dipanggil memang ada,
 *      tidak pernah menulis Secure Preferences, menulis Preferences hanya
 *      sesudah Chrome tertutup dan dicadangkan, tidak mematikan Chrome tanpa
 *      jawaban Y, tidak memakai --load-extension;
 *   C. Windows sungguhan (hanya di laptop, Windows PowerShell 5.1): pemasang
 *      dijalankan di profil Chrome tiruan + registri uji, lalu dicopot.
 *
 * Yang TIDAK terbukti di sini: Chrome sungguhan menerima Preferences yang
 * ditulis ulang, ID hasil hitungan sama dengan ID yang dibuat Chrome, dan
 * jendela "Load unpacked". Dicatat apa adanya untuk dicoba di PC kantor.
 */

const AKAR_EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const BACA = (n: string) => fs.readFileSync(path.join(AKAR_EKSTENSI, n), "utf8");
const PASANG = BACA("pembaru/pasang-aleta.cmd");
const COPOT = BACA("pembaru/copot-aleta.cmd");
const PASANG_PEMBARU = BACA("pembaru/pasang-pembaru-aleta.cmd");

const bagianPs = (t: string) => t.slice(t.indexOf("#PS-MULAI"));
const bagianBatch = (t: string) => t.slice(0, t.indexOf("#PS-MULAI"));

/** Huruf a-p dari 16 bita pertama SHA-256 - rumus ID ekstensi Chrome. */
function idDariBita(b: Buffer): string {
  return createHash("sha256")
    .update(b)
    .digest()
    .subarray(0, 16)
    .toString("hex")
    .replace(/[0-9a-f]/g, (h) => String.fromCharCode(97 + parseInt(h, 16)));
}
function idDariJalur(p: string): string {
  const baku = /^[a-z]:/.test(p) ? p[0].toUpperCase() + p.slice(1) : p;
  return idDariBita(Buffer.from(baku, "utf16le"));
}

// ---------------------------------------------------------------------------
// Pemeriksa PowerShell sederhana: kurung/kurawal/siku seimbang di luar string,
// komentar, dan here-string. Bukan pengurai lengkap - penjaga kesalahan ketik.
// ---------------------------------------------------------------------------
function periksaPowerShell(teks: string): string[] {
  const galat: string[] = [];
  const tumpuk: Array<{ c: string; baris: number }> = [];
  const lawan: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  let baris = 1;
  let i = 0;
  const maju = (sampai: number) => {
    for (let k = i; k < sampai && k < teks.length; k++) if (teks[k] === "\n") baris++;
    i = sampai;
  };
  while (i < teks.length) {
    const c = teks[i];
    if (c === "@" && (teks[i + 1] === "'" || teks[i + 1] === '"') && /^\r?\n/.test(teks.slice(i + 2, i + 4))) {
      const q = teks[i + 1];
      const akhir = teks.indexOf(`\n${q}@`, i + 2);
      if (akhir < 0) {
        galat.push(`here-string tidak ditutup (baris ${baris})`);
        break;
      }
      maju(akhir + 3);
      continue;
    }
    if (c === "<" && teks[i + 1] === "#") {
      const akhir = teks.indexOf("#>", i + 2);
      if (akhir < 0) {
        galat.push(`komentar blok tidak ditutup (baris ${baris})`);
        break;
      }
      maju(akhir + 2);
      continue;
    }
    if (c === "#") {
      const akhir = teks.indexOf("\n", i);
      maju(akhir < 0 ? teks.length : akhir);
      continue;
    }
    if (c === "'") {
      let k = i + 1;
      for (;;) {
        if (k >= teks.length) {
          galat.push(`kutip tunggal tidak ditutup (baris ${baris})`);
          return galat;
        }
        if (teks[k] === "'" && teks[k + 1] === "'") k += 2;
        else if (teks[k] === "'") break;
        else k++;
      }
      maju(k + 1);
      continue;
    }
    if (c === '"') {
      let k = i + 1;
      for (;;) {
        if (k >= teks.length) {
          galat.push(`kutip ganda tidak ditutup (baris ${baris})`);
          return galat;
        }
        if (teks[k] === "`") k += 2;
        else if (teks[k] === '"' && teks[k + 1] === '"') k += 2;
        else if (teks[k] === '"') break;
        else k++;
      }
      maju(k + 1);
      continue;
    }
    if (c === "`") {
      maju(i + 2);
      continue;
    }
    if (c === "(" || c === "{" || c === "[") tumpuk.push({ c, baris });
    else if (c === ")" || c === "}" || c === "]") {
      const atas = tumpuk.pop();
      if (!atas || atas.c !== lawan[c]) galat.push(`'${c}' tidak berpasangan (baris ${baris})`);
    }
    maju(i + 1);
  }
  for (const t of tumpuk) galat.push(`'${t.c}' dari baris ${t.baris} tidak ditutup`);
  return galat;
}

/** Fungsi berawalan kata kerja Indonesia yang dipanggil harus didefinisikan; tidak dipanggil gaya Name(a, b). */
function periksaFungsi(ps: string): string[] {
  const galat: string[] = [];
  const didefinisikan = new Set([...ps.matchAll(/^\s*function\s+([A-Za-z][\w-]*)/gm)].map((m) => m[1]));
  const kataKerjaInggris = new Set([
    "Add", "Copy", "ConvertFrom", "ConvertTo", "ForEach", "Get", "Join", "New", "Out", "Read", "Remove",
    "Select", "Set", "Sort", "Split", "Start", "Stop", "Test", "Wait", "Where", "Write",
  ]);
  const tanpaString = ps.replace(/'(?:[^']|'')*'/g, "''").replace(/#[^\n]*/g, "");
  for (const m of tanpaString.matchAll(/\b([A-Z][a-z]+(?:-[A-Z][A-Za-z]*)+)\b/g)) {
    const nama = m[1];
    if (kataKerjaInggris.has(nama.split("-")[0])) continue;
    if (!didefinisikan.has(nama)) galat.push(`fungsi tidak didefinisikan: ${nama}`);
  }
  for (const nama of didefinisikan) {
    const salah = tanpaString.split("\n").filter((b) => !/^\s*function\s/.test(b) && b.includes(`${nama}(`));
    if (salah.length) galat.push(`${nama} dipanggil dengan kurung gaya C: ${salah[0].trim()}`);
  }
  return galat;
}

// ---------------------------------------------------------------------------
// A. RUTE UNDUH EKSTENSI
// ---------------------------------------------------------------------------
const aktor = vi.hoisted(() => ({ ada: true }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!aktor.ada) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return { id: "usr_uji", name: "Petugas Uji", roleId: "staf" };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

const RAHASIA = `RAHASIA-UJI-${randomBytes(6).toString("hex")}`;

describe("rute /api/aleta-ecourt/ekstensi: ?bentuk=pemasang|pencopot, ZIP lama tetap", () => {
  beforeEach(() => {
    aktor.ada = true;
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/aleta");
    vi.stubEnv("ALETA_EKSTENSI_ALAMAT_DASAR", "");
    // Rahasia server yang TIDAK boleh ikut ke berkas unduhan.
    vi.stubEnv("ALETA_EKSTENSI_CRX_KEY", `-----BEGIN PRIVATE KEY-----\\n${RAHASIA}\\n-----END PRIVATE KEY-----`);
    vi.stubEnv("ALETA_TOKEN_UJI", RAHASIA);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function minta(kueri: string, kepala: Record<string, string> = { "x-forwarded-host": "192.168.10.10", "x-forwarded-proto": "http" }) {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/aleta-ecourt/ekstensi/route");
    return GET(new NextRequest(`http://localhost:3000/api/aleta-ecourt/ekstensi${kueri}`, { headers: kepala }));
  }

  it("?bentuk=pemasang: pasang-aleta.cmd, CRLF, alamat server dari header + basePath tertanam, lokasi .aleta, tanpa rahasia", async () => {
    const r = await minta("?bentuk=pemasang");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename="${NAMA_BERKAS_PEMASANG_PAKET}"`);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const bita = Buffer.from(await r.arrayBuffer());
    expect(Number(r.headers.get("content-length"))).toBe(bita.length);
    const isi = bita.toString("utf8");

    expect(isi).toBe(susunPemasangPaket({ asalPortal: "http://192.168.10.10/aleta" }));
    expect(isi).toContain("$AsalPortal = 'http://192.168.10.10/aleta'");
    expect(isi).not.toContain("@@ASAL_PORTAL@@");
    expect(isi.replace(/\r\n/g, "")).not.toContain("\n"); // CRLF utuh untuk cmd.exe
    expect(isi.startsWith("@echo off\r\n")).toBe(true);
    // Lokasi tetap di profil, bukan Unduhan/Desktop.
    expect(isi).toContain("Join-Path $env:USERPROFILE '.aleta'");
    expect(isi).toContain("$FOLDER_TETAP = Join-Path $AKAR 'ekstensi'");
    expect(isi).not.toMatch(/Downloads|Desktop'|\\Desktop/);
    // Paket diambil dari rute yang memang ada (sidik SHA-256), pembaru yang ada dipakai ulang.
    expect(isi).toContain("/api/aleta-ecourt/ekstensi/pembaru/info");
    expect(isi).toContain("/api/aleta-ecourt/ekstensi/pembaru/paket?versi=");
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/ekstensi/pembaru/info/route.ts"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/ekstensi/pembaru/paket/route.ts"))).toBe(true);
    expect(isi).toContain("pembaru\\pasang-pembaru-aleta.cmd");
    // Tanpa rahasia/token/kuki.
    expect(isi).not.toContain(RAHASIA);
    // ("SANDI=%errorlevel%" di kepala batch adalah kode keluar, bukan sandi.)
    expect(isi).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY|Authorization|Cookie|Bearer |api[_-]?key|password|sandi\s*=\s*['"]|token\s*=/i);
    // IP lain selain yang sudah dipakai repo tidak muncul.
    const ip = new Set([...isi.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g)].map((m) => m[0]));
    expect([...ip].sort()).toEqual(["192.168.10.10"]);
  });

  it("alamat mengikuti header Host / X-Forwarded-Host dan konfigurasi ALETA_EKSTENSI_ALAMAT_DASAR; nilai tak baku dikosongkan", async () => {
    const lewatHost = await (await minta("?bentuk=pemasang", { host: "192.168.10.10:8008" })).text();
    expect(lewatHost).toContain("$AsalPortal = 'http://192.168.10.10:8008/aleta'");

    vi.stubEnv("ALETA_EKSTENSI_ALAMAT_DASAR", "http://192.168.10.10/aleta");
    const lewatSetelan = await (await minta("?bentuk=pemasang", { "x-forwarded-host": "lain.contoh" })).text();
    expect(lewatSetelan).toContain("$AsalPortal = 'http://192.168.10.10/aleta'");
    vi.stubEnv("ALETA_EKSTENSI_ALAMAT_DASAR", "");

    // Header yang mencoba keluar dari string ber-kutip tunggal tidak pernah masuk ke skrip.
    const jahat = await (await minta("?bentuk=pemasang", { "x-forwarded-host": "x';Remove-Item C:\\ -Recurse;'" })).text();
    expect(jahat).toContain("$AsalPortal = ''");
    expect(jahat).not.toContain("Remove-Item C:\\ -Recurse");
    expect(susunPemasangPaket({ asalPortal: "https://192.168.10.10/aleta" })).toContain("$AsalPortal = ''");
  });

  it("?bentuk=pencopot: copot-aleta.cmd; ?bentuk asing: 400; tanpa sesi: 401 untuk semua bentuk", async () => {
    const r = await minta("?bentuk=pencopot");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename="${NAMA_BERKAS_PENCOPOT}"`);
    expect(await r.text()).toBe(susunPencopot());

    for (const kueri of ["?bentuk=exe", "?bentuk=..%2F..%2Fx", "?bentuk=msi"]) {
      const g = await minta(kueri);
      expect(g.status, kueri).toBe(400);
      expect((await g.json()).error.message).toMatch(/zip, pemasang, atau pencopot/);
    }

    aktor.ada = false;
    for (const kueri of ["?bentuk=pemasang", "?bentuk=pencopot", ""]) {
      expect((await minta(kueri)).status, kueri).toBe(401);
    }
  });

  it("tanpa ?bentuk (dan ?bentuk=zip): ZIP lama tetap, kini juga memuat pemasang + pencopot di folder pembaru", async () => {
    for (const kueri of ["", "?bentuk=zip"]) {
      const r = await minta(kueri);
      expect(r.status, kueri).toBe(200);
      expect(r.headers.get("content-type")).toBe("application/zip");
      expect(r.headers.get("content-disposition")).toBe('attachment; filename="aleta-ekstensi-sipp.zip"');
      const teks = Buffer.from(await r.arrayBuffer()).toString("latin1");
      expect(teks).toContain("ekstensi-sipp/pembaru/pasang-aleta.cmd");
      expect(teks).toContain("ekstensi-sipp/pembaru/copot-aleta.cmd");
      expect(teks).toContain("ekstensi-sipp/pembaru/pasang-pembaru-aleta.cmd");
    }
  }, 60000);

  it("nama berkas portal = nama berkas server; normalisasi ?bentuk=", () => {
    expect(NAMA_BERKAS_PAKET_PORTAL.pemasang).toBe(NAMA_BERKAS_PEMASANG_PAKET);
    expect(NAMA_BERKAS_PAKET_PORTAL.pencopot).toBe(NAMA_BERKAS_PENCOPOT);
    expect(normalisasiBentukUnduh(null)).toBe("zip");
    expect(normalisasiBentukUnduh(" Pemasang ")).toBe("pemasang");
    expect(normalisasiBentukUnduh("PENCOPOT")).toBe("pencopot");
    expect(normalisasiBentukUnduh("cmd")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B. SKRIP: bentuk dan batas keamanan
// ---------------------------------------------------------------------------
describe("skrip pemasang/pencopot: sintaks sederhana dan batas keamanan", () => {
  it("tertanam sama dengan berkasnya dan ikut ZIP dengan nama yang diterima pembaru", () => {
    expect(EKSTENSI_BERKAS["pembaru/pasang-aleta.cmd"]).toBe(PASANG);
    expect(EKSTENSI_BERKAS["pembaru/copot-aleta.cmd"]).toBe(COPOT);
    // Pembaru yang sudah terpasang di PC menolak nama/jenis di luar aturannya (Nama-Aman, JENIS_BOLEH).
    for (const n of ["pembaru/pasang-aleta.cmd", "pembaru/copot-aleta.cmd"]) {
      expect(n.split("/").every((s) => /^[A-Za-z0-9._-]+$/.test(s))).toBe(true);
    }
    expect(BACA("pembaru/pembaru-aleta.ps1")).toMatch(/JENIS_BOLEH = @\([^)]*'cmd'/);
    const zip = zipEkstensiUnduh().toString("latin1");
    expect(zip).toContain("ekstensi-sipp/pembaru/pasang-aleta.cmd");
  });

  it("ASCII saja (PowerShell 5.1 membaca berkas tanpa BOM sebagai ANSI); kepala batch sama dengan pemasang pembaru", () => {
    for (const [nama, t] of [["pasang", PASANG], ["copot", COPOT], ["pasang-pembaru", PASANG_PEMBARU]] as const) {
      expect(/[^\x00-\x7f]/.test(t), nama).toBe(false);
      const batch = bagianBatch(t);
      expect(batch.startsWith("@echo off\n"), nama).toBe(true);
      expect(batch, nama).toContain('set "ALETA_CMD=%~f0"');
      expect(batch, nama).toContain("$i=$t.IndexOf('#PS'+'-MULAI')");
      expect(batch, nama).toContain("if not defined ALETA_TANPA_JEDA pause");
      expect(batch, nama).toMatch(/exit \/b %SANDI%\n$/);
      // Baris rem tanpa karakter yang ditafsirkan cmd.exe.
      for (const b of batch.split("\n").filter((x) => /^rem\b/.test(x))) expect(b, `${nama}: ${b}`).not.toMatch(/[|<>&^"]/);
      // Penanda hanya sekali (pemuat mencari kemunculan pertama).
      expect(t.split("#PS-MULAI").length - 1, nama).toBe(1);
    }
  });

  it("kurung, kurawal, siku, kutip, dan here-string seimbang; fungsi yang dipanggil memang didefinisikan", () => {
    for (const [nama, t] of [["pasang", PASANG], ["copot", COPOT], ["pasang-pembaru", PASANG_PEMBARU]] as const) {
      expect(periksaPowerShell(bagianPs(t)), nama).toEqual([]);
      expect(periksaFungsi(bagianPs(t)), nama).toEqual([]);
    }
    // Kamus hasil JavaScriptSerializer (Dictionary<string,object>): IDictionary.Contains adalah anggota
    // antarmuka eksplisit yang TIDAK dapat dipanggil di Windows PowerShell 5.1 - wajib ContainsKey.
    expect(bagianPs(PASANG)).not.toMatch(/\$(d|e|pref|ext|ui|cek|ekst)\.Contains\(/);
    // Pemeriksanya sungguh dapat gagal.
    expect(periksaPowerShell("if ($a) { Tulis ('x' }")).not.toEqual([]);
    expect(periksaPowerShell("$x = 'tidak ditutup")).not.toEqual([]);
    expect(periksaPowerShell("$x = @'\nisi\n")).not.toEqual([]);
    expect(periksaPowerShell("# komentar ( {\n$y = \"a`\"b\" + 'c''d'")).toEqual([]);
    expect(periksaFungsi("function Tulis-Ini { }\nTulis-Itu 'a'")).toEqual(["fungsi tidak didefinisikan: Tulis-Itu"]);
    expect(periksaFungsi("function Jalur-Sama($a, $b) { }\nif (Jalur-Sama($x, $y)) { }")[0]).toMatch(/gaya C/);
  });

  it("Secure Preferences hanya DIBACA; Preferences ditulis sesudah Chrome tertutup, dicadangkan, dan diurai ulang", () => {
    const ps = bagianPs(PASANG);
    for (const b of ps.split("\n").filter((x) => x.includes("Secure Preferences"))) {
      expect(b).not.toMatch(/Write|Replace|Copy-Item|Set-Content|Out-File|Remove-Item|Move/);
    }
    expect(ps).not.toMatch(/protection|super_mac|\bmacs\b/); // tidak mengakali MAC setelan Chrome
    expect(ps).not.toMatch(/--load-extension|--disable-extensions-except/);
    expect(ps).not.toMatch(/HKLM:[^\n]*(Set-ItemProperty|New-Item)|Set-ItemProperty[^\n]*HKLM|ExtensionInstallForcelist|RunAs|-Verb/);
    expect(ps).not.toMatch(/Invoke-Expression|\biex\b|Invoke-WebRequest|Invoke-RestMethod|DownloadFile|Set-ExecutionPolicy/);

    const atur = ps.slice(ps.indexOf("function Atur-Mode-Pengembang"));
    expect(atur.indexOf("Pastikan-Chrome-Tertutup")).toBeGreaterThan(0);
    expect(atur.indexOf("Pastikan-Chrome-Tertutup")).toBeLessThan(atur.indexOf("Tulis-Mode-Pengembang $p"));
    const tulis = ps.slice(ps.indexOf("function Tulis-Mode-Pengembang"), ps.indexOf("function Atur-Mode-Pengembang"));
    expect(tulis).toContain("$ui['developer_mode'] = $true");
    expect(tulis.indexOf("Copy-Item -LiteralPath $berkas -Destination $cadangan")).toBeGreaterThan(0);
    expect(tulis.indexOf("Copy-Item -LiteralPath $berkas -Destination $cadangan")).toBeLessThan(tulis.indexOf("WriteAllText($sementara"));
    expect(tulis.indexOf("$cek = $js.DeserializeObject($baru)")).toBeLessThan(tulis.indexOf("WriteAllText($sementara"));
    expect(tulis).toContain("Join-Path $profil.FullName 'Preferences'");
    // Default + profil lain.
    expect(ps).toContain("$_.Name -eq 'Default' -or $_.Name -like 'Profile *'");
  });

  it("Chrome tidak dimatikan tanpa jawaban Y; jendela ditutup baik-baik dulu", () => {
    const ps = bagianPs(PASANG);
    const i = ps.indexOf("Stop-Process");
    expect(i).toBeGreaterThan(0);
    expect(ps.split("Stop-Process").length - 1).toBe(1);
    const sebelum = ps.slice(Math.max(0, i - 400), i);
    expect(sebelum).toContain("if ($y -eq 'Y')");
    expect(sebelum).toContain("Hentikan paksa Chrome sekarang? (Y/T)");
    expect(ps.indexOf("CloseMainWindow")).toBeLessThan(i);
  });

  it("langkah Load unpacked: dilewati bila folder sudah dimuat; bila belum, buka chrome://extensions + salin alamat + petunjuk", () => {
    const ps = bagianPs(PASANG);
    expect(ps).toContain("$dimuat = @($terdaftar | Where-Object { Jalur-Sama $_.Folder $folder })");
    expect(ps).toContain("langkah Load unpacked dilewati");
    expect(ps).toContain("if ($dimuat.Count -eq 0) {");
    expect(ps).toContain("Start-Process -FilePath $c -ArgumentList 'chrome://extensions/'");
    expect(ps).toContain("Set-Clipboard -Value $teks");
    expect(ps).toMatch(/Muat yang belum dibuka" \(Load unpacked\)/);
    expect(ps).toContain("Chrome tidak mengizinkan program lain memuat ekstensi di luar Chrome Web Store");
  });

  it("idempoten dan berlog: lokasi tetap ditukar di tempat, .aleta disembunyikan, log ringkas di .aleta\\pasang.log", () => {
    const ps = bagianPs(PASANG);
    expect(ps).toContain("$LOG = Join-Path $AKAR 'pasang.log'");
    expect(ps).toContain("[IO.FileAttributes]::Hidden");
    expect(ps).toContain("[IO.Directory]::Move($staging, $FOLDER_TETAP)");
    expect(ps).toContain("Selaraskan-Kunci $FOLDER_TETAP $staging $true"); // ID tidak berubah saat memperbarui
    expect(ps).toContain("$cfgBerkas = Join-Path $RUMAH_PEMBARU 'konfigurasi.json'"); // pemasangan lama dicari dari pembaru
    expect(ps).toContain("[K] keluar tanpa mengubah apa pun");
  });

  it("pembaru yang ada diarahkan ke folder tetap lewat variabel lingkungan; token dari portal tetap didahulukan", () => {
    const ps = bagianPs(PASANG_PEMBARU);
    expect(ps).toContain("$FolderDiminta = [string]$env:ALETA_PEMBARU_FOLDER");
    expect(ps).toContain("if ($AsalPortal.StartsWith('@@') -and $env:ALETA_PEMBARU_ASAL)");
    expect(ps).toContain("$_ -match '^[a-p]{32}$'");
    // Asal tambahan tetap dibatasi host yang diizinkan manifest (aturan lama tidak dilonggarkan).
    expect(ps).toContain("if (@('192.168.10.10', '127.0.0.1') -contains $hostPortal)");
    const pasang = bagianPs(PASANG);
    expect(pasang).toContain("ALETA_PEMBARU_FOLDER = $folder");
    expect(pasang).toContain("ALETA_PEMBARU_ID = ($ids -join ',')");
  });

  it("pencopot: tidak menghapus apa pun tanpa Y, tidak menyentuh setelan Chrome", () => {
    const ps = bagianPs(COPOT);
    expect(ps.match(/-eq 'Y'/g)?.length).toBe(2);
    expect(ps).not.toMatch(/Preferences'|developer_mode/);
    expect(ps).toContain("$DASAR_REG = if ($env:ALETA_PEMBARU_REG) { $env:ALETA_PEMBARU_REG } else { 'HKCU:\\Software' }");
    expect(ps).not.toMatch(/HKLM/);
  });
});

// ---------------------------------------------------------------------------
// C. WINDOWS SUNGGUHAN (laptop): pemasang + pencopot di profil tiruan
// ---------------------------------------------------------------------------
const ADA_POWERSHELL =
  process.platform === "win32" && spawnSync("powershell.exe", ["-NoProfile", "-Command", "exit 0"]).status === 0;

describe.skipIf(!ADA_POWERSHELL)("pasang-aleta.cmd sungguhan (Windows PowerShell 5.1)", () => {
  const SEMUA_TEMP: string[] = [];
  const dasarReg = `HKCU:\\Software\\ALETA-UJI-PAKET-${process.pid}`;
  const dasarRegCmd = `HKCU\\Software\\ALETA-UJI-PAKET-${process.pid}`;
  function sementara(awalan: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), `${awalan}-`));
    SEMUA_TEMP.push(d);
    return d;
  }
  afterAll(() => {
    spawnSync("reg", ["delete", dasarRegCmd, "/f"]);
    for (const d of SEMUA_TEMP) {
      try {
        fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* sisa folder uji boleh tertinggal */
      }
    }
  });
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

  function jalankan(berkas: string, env: Record<string, string>): Promise<{ kode: number | null; keluar: string }> {
    return new Promise((selesai, gagal) => {
      const p = spawn("cmd.exe", ["/c", berkas], {
        env: { ...process.env, ALETA_TANPA_JEDA: "1", ALETA_PASANG_UJI: "1", ...env },
        stdio: ["pipe", "pipe", "pipe"],
      });
      const o: Buffer[] = [];
      p.stdout.on("data", (d) => o.push(d));
      p.stderr.on("data", (d) => o.push(d));
      const henti = setTimeout(() => {
        p.kill();
        gagal(new Error("pemasang tidak selesai"));
      }, 200000);
      p.on("close", (kode) => {
        clearTimeout(henti);
        selesai({ kode, keluar: Buffer.concat(o).toString("utf8") });
      });
      p.stdin.end();
    });
  }

  function siapkan() {
    const akar = path.join(sementara("rumah"), ".aleta");
    const profil = sementara("profil");
    fs.mkdirSync(path.join(profil, "Default"), { recursive: true });
    fs.mkdirSync(path.join(profil, "Profile 1"), { recursive: true });
    const prefAwal = { extensions: { ui: { developer_mode: false } }, profile: { name: "Uji \u00e9" }, angka: 1.5, daftar: [1, "dua", { tiga: 3 }] };
    fs.writeFileSync(path.join(profil, "Default", "Preferences"), JSON.stringify(prefAwal));
    fs.writeFileSync(path.join(profil, "Profile 1", "Preferences"), JSON.stringify({ browser: { x: true } }));
    fs.writeFileSync(path.join(profil, "Default", "Secure Preferences"), JSON.stringify({ extensions: { settings: {} } }));
    const paket = path.join(sementara("paket"), "paket.zip");
    fs.writeFileSync(paket, zipEkstensiUnduh());
    const rumah = path.join(sementara("pembaru"), "ALETA", "pembaru");
    const berkas = path.join(sementara("unduhan"), "pasang-aleta.cmd");
    fs.writeFileSync(berkas, susunPemasangPaket({ asalPortal: "http://192.168.10.10/aleta" }));
    const env = {
      ALETA_PASANG_AKAR: akar,
      ALETA_PASANG_PROFIL: profil,
      ALETA_PASANG_PAKET: paket,
      ALETA_PASANG_SINKRON: path.join(akar, "tidak-ada"),
      ALETA_PEMBARU_RUMAH: rumah,
      ALETA_PEMBARU_REG: dasarReg,
    };
    return { akar, profil, rumah, berkas, env, prefAwal, folder: path.join(akar, "ekstensi") };
  }

  it("pasang pertama: lokasi tetap tersembunyi, Mode Pengembang di semua profil (cadangan, isi lain utuh), pembaru ke folder tetap, petunjuk Load unpacked", async () => {
    const u = siapkan();
    const secureSebelum = sha(fs.readFileSync(path.join(u.profil, "Default", "Secure Preferences")));
    const h = await jalankan(u.berkas, u.env);
    expect(h.keluar).toContain("SELESAI");
    expect(h.kode).toBe(0);

    expect(JSON.parse(fs.readFileSync(path.join(u.folder, "manifest.json"), "utf8")).version).toBe(versiEkstensi());
    const atribut = spawnSync("powershell.exe", ["-NoProfile", "-Command", `(Get-Item -Force -LiteralPath '${u.akar}').Attributes`], { encoding: "utf8" });
    expect(atribut.stdout).toMatch(/Hidden/);

    const pref = JSON.parse(fs.readFileSync(path.join(u.profil, "Default", "Preferences"), "utf8"));
    expect(pref.extensions.ui.developer_mode).toBe(true);
    expect(pref.profile.name).toBe(u.prefAwal.profile.name);
    expect(pref.angka).toBe(1.5);
    expect(pref.daftar).toEqual(u.prefAwal.daftar);
    expect(JSON.parse(fs.readFileSync(path.join(u.profil, "Profile 1", "Preferences"), "utf8"))).toEqual({ browser: { x: true }, extensions: { ui: { developer_mode: true } } });
    expect(sha(fs.readFileSync(path.join(u.profil, "Default", "Secure Preferences")))).toBe(secureSebelum);
    const cadangan = fs.readdirSync(path.join(u.akar, "cadangan-chrome"));
    expect(cadangan.some((n) => n.startsWith("Default-Preferences-"))).toBe(true);

    expect(fs.readFileSync(path.join(u.akar, "pasang.log"), "utf8")).toContain("lokasi tetap");
    expect(fs.existsSync(path.join(u.akar, "copot-aleta.cmd"))).toBe(true);

    const cfg = JSON.parse(fs.readFileSync(path.join(u.rumah, "konfigurasi.json"), "utf8"));
    expect(path.resolve(cfg.folder).toLowerCase()).toBe(path.resolve(u.folder).toLowerCase());
    expect(cfg.id).toContain(idDariJalur(path.resolve(u.folder)));
    expect(h.keluar).toMatch(/Load unpacked/);
    expect(h.keluar).toContain("SATU LANGKAH TERAKHIR");
  }, 240000);

  it("dijalankan ulang sesudah dimuat: isi diperbarui di folder yang SAMA, Mode Pengembang 'sudah', Load unpacked dilewati", async () => {
    const u = siapkan();
    expect((await jalankan(u.berkas, u.env)).kode).toBe(0);
    const id = idDariJalur(path.resolve(u.folder));
    fs.writeFileSync(path.join(u.profil, "Default", "Secure Preferences"), JSON.stringify({ extensions: { settings: { [id]: { path: u.folder, location: 4 } } } }));
    fs.writeFileSync(path.join(u.folder, "PASANG.md"), "diubah");

    const h = await jalankan(u.berkas, u.env);
    expect(h.kode).toBe(0);
    expect(fs.readFileSync(path.join(u.folder, "PASANG.md"), "utf8")).toBe(EKSTENSI_BERKAS["PASANG.md"]);
    expect(fs.readdirSync(u.akar).filter((n) => n.startsWith("ekstensi") && n !== "ekstensi.aleta-lama")).toEqual(["ekstensi"]);
    expect(h.keluar).toMatch(/Mode Pengembang : sudah menyala/);
    expect(h.keluar).toContain("langkah Load unpacked dilewati");
    expect(h.keluar).not.toContain("SATU LANGKAH TERAKHIR");
  }, 300000);

  it("ada pemasangan lama di lokasi lain: [K] tidak mengubah apa pun; [B] memasang di lokasi tetap dan membawa 'key' lama (ID tetap)", async () => {
    const u = siapkan();
    const lama = path.join(sementara("lama"), "ekstensi-sipp");
    fs.mkdirSync(lama, { recursive: true });
    const kunci = randomBytes(64).toString("base64");
    const mf = JSON.parse(EKSTENSI_BERKAS["manifest.json"]);
    fs.writeFileSync(path.join(lama, "manifest.json"), JSON.stringify({ ...mf, version: "1.0.0", key: kunci }, null, 2));
    fs.writeFileSync(path.join(lama, "latar.js"), "// lama");
    fs.writeFileSync(path.join(u.profil, "Default", "Secure Preferences"), JSON.stringify({ extensions: { settings: { [idDariBita(Buffer.from(kunci, "base64"))]: { path: lama } } } }));

    const k = await jalankan(u.berkas, { ...u.env, ALETA_JAWAB: "K" });
    expect(k.kode).toBe(0);
    expect(k.keluar).toContain("Ditemukan ekstensi ALETA di lokasi lain");
    expect(fs.existsSync(u.akar)).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(u.profil, "Default", "Preferences"), "utf8")).extensions.ui.developer_mode).toBe(false);

    const b = await jalankan(u.berkas, { ...u.env, ALETA_JAWAB: "B" });
    expect(b.kode).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(u.folder, "manifest.json"), "utf8")).key).toBe(kunci);
    expect(fs.existsSync(path.join(lama, "manifest.json"))).toBe(true); // folder lama tidak dihapus
    const cfg = JSON.parse(fs.readFileSync(path.join(u.rumah, "konfigurasi.json"), "utf8"));
    expect(cfg.id).toContain(idDariBita(Buffer.from(kunci, "base64")));
    expect(b.keluar).toMatch(/kartu ALETA E-Court lama/);
  }, 300000);

  it("pencopot: T,T tidak menghapus apa pun; Y,Y mencabut pembaru (registri uji) dan menghapus folder", async () => {
    const u = siapkan();
    expect((await jalankan(u.berkas, u.env)).kode).toBe(0);
    const copot = path.join(sementara("unduhan2"), "copot-aleta.cmd");
    fs.writeFileSync(copot, susunPencopot());

    const t = await jalankan(copot, { ...u.env, ALETA_JAWAB: "T,T" });
    expect(t.kode).toBe(0);
    expect(fs.existsSync(u.folder)).toBe(true);
    expect(fs.existsSync(u.rumah)).toBe(true);

    const y = await jalankan(copot, { ...u.env, ALETA_JAWAB: "Y,Y" });
    expect(y.kode).toBe(0);
    expect(fs.existsSync(u.akar)).toBe(false);
    expect(fs.existsSync(u.rumah)).toBe(false);
    expect(spawnSync("reg", ["query", `${dasarRegCmd}\\Google\\Chrome\\NativeMessagingHosts\\id.aleta.pembaru`]).status).not.toBe(0);
    // Setelan Chrome tidak disentuh pencopot.
    expect(JSON.parse(fs.readFileSync(path.join(u.profil, "Default", "Preferences"), "utf8")).extensions.ui.developer_mode).toBe(true);
  }, 300000);
});
