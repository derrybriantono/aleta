// @vitest-environment node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";
import { zipEkstensiAkar, zipEkstensiUnduh } from "@/server/shared/ekstensi-paket";
import { normalisasiOsPemasang, susunPemasang, susunPemasangMac, susunPemasangUntuk } from "@/server/shared/pembaru-pemasang";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * PEMBARU OTOMATIS UNTUK MACBOOK (26 Okt 2026)
 * ============================================================================
 *
 * Permintaan: pembaru otomatis (23 Okt, Windows) juga untuk Mac, dan portal
 * memilih pemasangnya menurut sistem komputer. Yang dibuktikan di sini:
 *
 *   A. skrip macOS (bash) dijalankan SUNGGUHAN lewat Git Bash: protokol native
 *      messaging, unduh + sidik + tukar folder, ZIP berbahaya, "key" manifest,
 *      pemasang (profil tanpa extensions.settings tidak membuatnya berhenti);
 *   B. route pemasang menyajikan berkas yang benar per ?os=;
 *   C. ZIP/.crx TIDAK memuat berkas Mac (pembantu Windows yang sudah terpasang
 *      menolak jenis .sh/.command di dalam paket);
 *   D. latar.js/popup.js memilih pemasang menurut sistem dan petunjuknya
 *      menyebut Terminal (bukan .cmd) di Mac.
 *
 * Yang TIDAK terbukti di sini: macOS sungguhan (osascript/JXA, Gatekeeper,
 * folder NativeMessagingHosts yang dibaca Chrome Mac). Dicatat apa adanya.
 */

const AKAR = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const BACA = (n: string) => fs.readFileSync(path.join(AKAR, n), "utf8");

// ---------------------------------------------------------------------------
// Git Bash (Windows) atau bash sistem (Linux/Mac)
// ---------------------------------------------------------------------------
function cariBash(): string {
  const calon = [process.env.ALETA_BASH || "", "C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe", "/bin/bash", "/usr/bin/bash"];
  for (const c of calon) {
    if (!c || !fs.existsSync(c)) continue;
    const r = spawnSync(c, ["-c", "command -v unzip curl && echo ok"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.includes("ok")) return c;
  }
  return "";
}
const BASH = cariBash();
const lewati = !BASH;

/** Jalur Windows -> jalur POSIX yang dipahami Git Bash (D:\a\b -> /d/a/b). Di Linux/Mac tidak berubah. */
function posix(p: string): string {
  if (process.platform !== "win32") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => "/" + d.toLowerCase());
}

function envBash(home: string, tambahan: Record<string, string> = {}): NodeJS.ProcessEnv {
  const git = "C:\\Program Files\\Git";
  const depan = process.platform === "win32" ? `${git}\\mingw64\\bin;${git}\\usr\\bin;${git}\\bin;` : "";
  return { ...process.env, PATH: depan + (process.env.PATH || ""), HOME: posix(home), ...tambahan };
}

const SEMUA_TEMP: string[] = [];
function folderSementara(awalan: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `${awalan}-`));
  SEMUA_TEMP.push(d);
  return d;
}
afterAll(() => {
  for (const d of SEMUA_TEMP) {
    try {
      fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* sisa folder uji di TEMP boleh tertinggal */
    }
  }
});

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function bingkai(o: unknown): Buffer {
  const j = Buffer.from(JSON.stringify(o), "utf8");
  const k = Buffer.alloc(4);
  k.writeUInt32LE(j.length, 0);
  return Buffer.concat([k, j]);
}

function uraiBingkai(buf: Buffer): { pesan: any[]; sisa: number } {
  const pesan: any[] = [];
  let i = 0;
  while (i + 4 <= buf.length) {
    const n = buf.readUInt32LE(i);
    if (i + 4 + n > buf.length) break;
    pesan.push(JSON.parse(buf.subarray(i + 4, i + 4 + n).toString("utf8")));
    i += 4 + n;
  }
  return { pesan, sisa: buf.length - i };
}

/** Menjalankan pembantu bash SUNGGUHAN: semua pesan ditulis, stdin ditutup, jawaban dibaca. */
function tanyaPembantu(rumah: string, pesan: unknown[], batasMs = 90000): Promise<{ jawab: any[]; sisa: number; stderr: string }> {
  return new Promise((selesai, gagal) => {
    const p = spawn(BASH, [posix(path.join(rumah, "pembaru-aleta.sh"))], { stdio: ["pipe", "pipe", "pipe"], env: envBash(rumah) });
    const keluar: Buffer[] = [];
    const galat: Buffer[] = [];
    p.stdout.on("data", (d) => keluar.push(d));
    p.stderr.on("data", (d) => galat.push(d));
    const henti = setTimeout(() => {
      p.kill();
      gagal(new Error("pembantu tidak selesai tepat waktu"));
    }, batasMs);
    p.on("close", () => {
      clearTimeout(henti);
      const { pesan: jawab, sisa } = uraiBingkai(Buffer.concat(keluar));
      selesai({ jawab, sisa, stderr: Buffer.concat(galat).toString("utf8") });
    });
    for (const m of pesan) p.stdin.write(bingkai(m));
    p.stdin.end();
  });
}

function manifestTeks(versi: string, kunci?: string): string {
  const m: Record<string, unknown> = { manifest_version: 3, name: "ALETA E-Court", version: versi, permissions: ["storage"] };
  if (kunci) m.key = kunci;
  return JSON.stringify(m, null, 2);
}

function tulisFolderEkstensi(dir: string, versi: string, kunci?: string, nama = "ALETA E-Court") {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), manifestTeks(versi, kunci).replace("ALETA E-Court", nama));
  fs.writeFileSync(path.join(dir, "latar.js"), `// latar ${versi}\n`);
  fs.writeFileSync(path.join(dir, "popup.html"), `<!-- popup ${versi} -->\n`);
  fs.writeFileSync(path.join(dir, "lama.js"), "// hanya di versi lama\n");
}

function zipPaket(versi: string, opsi: { kunci?: string; tambahan?: BerkasZip[] } = {}): Buffer {
  const b = (nama: string, isi: string): BerkasZip => ({ nama: `ekstensi-sipp/${nama}`, isi: Buffer.from(isi, "utf8") });
  return susunZip([
    b("manifest.json", manifestTeks(versi, opsi.kunci)),
    b("latar.js", `// latar ${versi}\n`),
    b("popup.html", `<!-- popup ${versi} -->\n`),
    b("baru.js", "// berkas baru\n"),
    b("ikon/aleta-16.png", "PNG"),
    ...(opsi.tambahan || []),
  ]);
}

/** ZIP "store" tanpa membersihkan nama - ZIP berbahaya untuk menguji PEMBANTU harus dirakit mentah. */
function zipMentah(daftar: { nama: string; isi: Buffer }[]): Buffer {
  const tabel = new Uint32Array(256).map((_, i) => {
    let n = i;
    for (let j = 0; j < 8; j += 1) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const crc = (b: Buffer) => {
    let h = 0xffffffff;
    for (const x of b) h = (tabel[(h ^ x) & 0xff] as number) ^ (h >>> 8);
    return (h ^ 0xffffffff) >>> 0;
  };
  const lokal: Buffer[] = [];
  const pusat: Buffer[] = [];
  let posisi = 0;
  for (const e of daftar) {
    const nama = Buffer.from(e.nama, "utf8");
    const c = crc(e.isi);
    const kl = Buffer.alloc(30);
    kl.writeUInt32LE(0x04034b50, 0);
    kl.writeUInt16LE(20, 4);
    kl.writeUInt32LE(c, 14);
    kl.writeUInt32LE(e.isi.length, 18);
    kl.writeUInt32LE(e.isi.length, 22);
    kl.writeUInt16LE(nama.length, 26);
    lokal.push(kl, nama, e.isi);
    const kp = Buffer.alloc(46);
    kp.writeUInt32LE(0x02014b50, 0);
    kp.writeUInt16LE(20, 4);
    kp.writeUInt16LE(20, 6);
    kp.writeUInt32LE(c, 16);
    kp.writeUInt32LE(e.isi.length, 20);
    kp.writeUInt32LE(e.isi.length, 24);
    kp.writeUInt16LE(nama.length, 28);
    kp.writeUInt32LE(posisi, 42);
    pusat.push(kp, nama);
    posisi += 30 + nama.length + e.isi.length;
  }
  const daftarIsi = Buffer.concat(pusat);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(daftar.length, 8);
  akhir.writeUInt16LE(daftar.length, 10);
  akhir.writeUInt32LE(daftarIsi.length, 12);
  akhir.writeUInt32LE(posisi, 16);
  return Buffer.concat([...lokal, daftarIsi, akhir]);
}

function zipPaketMentah(versi: string, tambahan: { nama: string; isi: Buffer }[]): Buffer {
  const b = (nama: string, isi: string) => ({ nama: `ekstensi-sipp/${nama}`, isi: Buffer.from(isi, "utf8") });
  return zipMentah([b("manifest.json", manifestTeks(versi)), b("latar.js", "// x"), b("popup.html", "<!-- x -->"), ...tambahan]);
}

type ServerUji = { asal: string; hitung: () => number; tutup: () => Promise<void> };
async function serverPaket(zip: Buffer): Promise<ServerUji> {
  let n = 0;
  const s = http.createServer((q, r) => {
    n += 1;
    if (!String(q.url).startsWith("/aleta/api/aleta-ecourt/ekstensi/pembaru/paket?")) {
      r.statusCode = 404;
      r.end();
      return;
    }
    r.setHeader("Content-Length", String(zip.length));
    r.end(zip);
  });
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const port = (s.address() as AddressInfo).port;
  return { asal: `http://127.0.0.1:${port}/aleta`, hitung: () => n, tutup: () => new Promise((ok) => s.close(() => ok())) };
}

/** Rumah pembantu uji: skrip asli + berkas konfigurasi yang menunjuk folder ekstensi dan server uji. */
function siapkanRumah(folder: string, asal: string[]): string {
  const rumah = folderSementara("rumah");
  fs.copyFileSync(path.join(AKAR, "pembaru/pembaru-aleta.sh"), path.join(rumah, "pembaru-aleta.sh"));
  fs.writeFileSync(path.join(rumah, "folder.txt"), posix(folder) + "\n");
  fs.writeFileSync(path.join(rumah, "asal.txt"), asal.join("\n") + "\n");
  fs.writeFileSync(path.join(rumah, "id.txt"), "abcdefghijklmnopabcdefghijklmnop\n");
  return rumah;
}

// ---------------------------------------------------------------------------
// 1. PEMBANTU (bash sungguhan)
// ---------------------------------------------------------------------------
describe.skipIf(lewati)("pembantu macOS: protokol, unduh langsung, sidik, tukar folder", () => {
  it("ping menyebut folder sah, versi, platform, dan tidak ada keluaran liar di luar bingkai", async () => {
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const { jawab, sisa } = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(sisa).toBe(0);
    expect(jawab).toHaveLength(1);
    expect(jawab[0]).toMatchObject({
      ok: true,
      selesai: true,
      versiPembantu: 1,
      platform: "mac",
      folderSah: true,
      versiFolder: "1.0.0",
      id: ["abcdefghijklmnopabcdefghijklmnop"],
    });
    expect(jawab[0].perintah).toEqual(["ping", "siapkan", "pasang", "pulihkan", "perangkat"]);
  }, 60000);

  it("tanpa konfigurasi atau folder bukan ALETA E-Court: folderSah false dengan sebab, tidak galat", async () => {
    const folder = path.join(folderSementara("ext"), "lain");
    tulisFolderEkstensi(folder, "1.0.0", undefined, "Ekstensi Lain");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const a = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(a.jawab[0]).toMatchObject({ ok: true, folderSah: false });
    expect(String(a.jawab[0].sebab)).toMatch(/bukan ekstensi ALETA/);

    const kosong = folderSementara("kosong");
    fs.copyFileSync(path.join(AKAR, "pembaru/pembaru-aleta.sh"), path.join(kosong, "pembaru-aleta.sh"));
    const b = await tanyaPembantu(kosong, [{ perintah: "ping" }]);
    expect(b.jawab[0]).toMatchObject({ ok: true, folderSah: false });
    expect(String(b.jawab[0].sebab)).toMatch(/konfigurasi/);
  }, 90000);

  it("siapkan + pasang: folder berisi versi baru, versi lama di samping, tanpa 'key' bila yang terpasang tanpa 'key'", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1", { kunci: "KUNCISERVERABC123" });
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "pasang", versi: "1.0.1" },
      ]);
      expect(jawab[0], JSON.stringify(jawab)).toMatchObject({ ok: true, siap: true, versi: "1.0.1", mode: "tukar" });
      expect(jawab[1], JSON.stringify(jawab)).toMatchObject({ ok: true, versi: "1.0.1", cara: "tukar" });

      const m = fs.readFileSync(path.join(folder, "manifest.json"), "utf8");
      expect(JSON.parse(m).version).toBe("1.0.1");
      expect(m).not.toContain('"key"'); // ID ekstensi tidak boleh berubah
      expect(fs.readFileSync(path.join(folder, "baru.js"), "utf8")).toContain("berkas baru");
      expect(fs.existsSync(path.join(folder, "ikon/aleta-16.png"))).toBe(true);
      expect(JSON.parse(fs.readFileSync(`${folder}.aleta-lama/manifest.json`, "utf8")).version).toBe("1.0.0");
      expect(fs.existsSync(`${folder}.aleta-baru`)).toBe(false);
      expect(fs.existsSync(`${folder}.aleta-baru.unzip`)).toBe(false);
      expect(fs.existsSync(path.join(rumah, "tahap.txt"))).toBe(false);
      expect(srv.hitung()).toBe(1);
    } finally {
      await srv.tutup();
    }
  }, 120000);

  it("'key' manifest: yang terpasang BERKUNCI tetap memakai kuncinya sendiri, apa pun yang dikirim server", async () => {
    for (const kunciServer of [undefined, "KUNCIBEDA999"]) {
      const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
      tulisFolderEkstensi(folder, "1.0.0", "KUNCIPETUGAS123");
      const zip = zipPaket("1.0.2", { kunci: kunciServer });
      const srv = await serverPaket(zip);
      try {
        const rumah = siapkanRumah(folder, [srv.asal]);
        const { jawab } = await tanyaPembantu(rumah, [
          { perintah: "siapkan", asal: srv.asal, versi: "1.0.2", sha256: sha(zip), ukuran: zip.length },
          { perintah: "pasang", versi: "1.0.2" },
        ]);
        expect(jawab[1], JSON.stringify(jawab)).toMatchObject({ ok: true });
        const m = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
        expect(m.version).toBe("1.0.2");
        expect(m.key).toBe("KUNCIPETUGAS123");
      } finally {
        await srv.tutup();
      }
    }
  }, 180000);

  it("sidik berbeda dari yang diumumkan: ditolak, folder tidak berubah satu bita pun", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const sebelum = fs.readFileSync(path.join(folder, "manifest.json"), "utf8");
    const zip = zipPaket("1.0.1");
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha("bukan paket ini"), ukuran: 0 },
        { perintah: "pasang", versi: "1.0.1" },
      ]);
      expect(jawab[0]).toMatchObject({ ok: false, galat: "sidik-beda" });
      expect(jawab[1]).toMatchObject({ ok: false, galat: "belum-siap" });
      expect(fs.readFileSync(path.join(folder, "manifest.json"), "utf8")).toBe(sebelum);
      expect(fs.existsSync(`${folder}.aleta-baru`)).toBe(false);
      expect(fs.existsSync(`${folder}.aleta-lama`)).toBe(false);
    } finally {
      await srv.tutup();
    }
  }, 90000);

  it("asal di luar daftar ditolak SEBELUM jaringan disentuh; versi/sidik tak sah ditolak", async () => {
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1");
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]); // server uji TIDAK terdaftar
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "siapkan", asal: "http://192.168.10.10/aleta", versi: "1.0;rm", sha256: sha(zip), ukuran: 1 },
        { perintah: "siapkan", asal: "http://192.168.10.10/aleta", versi: "1.0.1", sha256: "xyz", ukuran: 1 },
      ]);
      expect(jawab[0]).toMatchObject({ ok: false, galat: "asal-ditolak" });
      expect(jawab[1]).toMatchObject({ ok: false, galat: "versi-tidak-sah" });
      expect(jawab[2]).toMatchObject({ ok: false, galat: "sidik-tidak-sah" });
      expect(srv.hitung()).toBe(0);
    } finally {
      await srv.tutup();
    }
  }, 90000);

  it("ZIP berbahaya (keluar folder, .exe, .sh, nama aneh, versi tak cocok) ditolak tanpa menulis apa pun di luar folder sementara", async () => {
    const kasus: { nama: string; zip: Buffer; kata: RegExp }[] = [
      { nama: "keluar folder", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/../../buruk.js", isi: Buffer.from("x") }]), kata: /tidak aman/ },
      { nama: "exe", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/virus.exe", isi: Buffer.from("MZ") }]), kata: /jenis berkas/ },
      { nama: "sh", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/buruk.sh", isi: Buffer.from("rm") }]), kata: /jenis berkas/ },
      { nama: "tanpa ekor", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/buruk", isi: Buffer.from("x") }]), kata: /jenis berkas/ },
      { nama: "nama aneh", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/a b;c.js", isi: Buffer.from("x") }]), kata: /tidak aman/ },
      { nama: "drive", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/C:/buruk.js", isi: Buffer.from("x") }]), kata: /tidak aman/ },
      { nama: "garis miring mundur", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/..\\..\\buruk.js", isi: Buffer.from("x") }]), kata: /tidak aman/ },
      { nama: "di luar folder paket", zip: zipPaketMentah("1.0.1", [{ nama: "lain/buruk.js", isi: Buffer.from("x") }]), kata: /luar folder paket/ },
      { nama: "versi tak cocok", zip: zipPaket("9.9.9"), kata: /versi di paket/ },
    ];
    for (const k of kasus) {
      const induk = folderSementara("ext");
      const folder = path.join(induk, "ekstensi-sipp");
      tulisFolderEkstensi(folder, "1.0.0");
      const srv = await serverPaket(k.zip);
      try {
        const rumah = siapkanRumah(folder, [srv.asal]);
        const { jawab } = await tanyaPembantu(rumah, [
          { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(k.zip), ukuran: k.zip.length },
          { perintah: "pasang", versi: "1.0.1" },
        ]);
        expect(jawab[0], k.nama).toMatchObject({ ok: false });
        expect(String(jawab[0].pesan), k.nama).toMatch(k.kata);
        expect(jawab[1], k.nama).toMatchObject({ ok: false });
        expect(JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8")).version, k.nama).toBe("1.0.0");
        expect(fs.existsSync(path.join(induk, "buruk.js")), k.nama).toBe(false);
        expect(fs.existsSync(path.join(path.dirname(induk), "buruk.js")), k.nama).toBe(false);
      } finally {
        await srv.tutup();
      }
    }
  }, 300000);

  it("pulihkan mengembalikan versi sebelumnya; perintah tak dikenal dan pasang tanpa siap dijawab galat bersih", async () => {
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1");
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const a = await tanyaPembantu(rumah, [{ perintah: "hapus-semua" }, { perintah: "pasang", versi: "1.0.1" }, { perintah: "pulihkan" }, { perintah: "ping" }]);
      expect(a.sisa).toBe(0);
      expect(a.jawab.map((j) => j.selesai)).toEqual([true, true, true, true]);
      expect(a.jawab[0].galat).toBe("perintah-tidak-dikenal");
      expect(a.jawab[1].galat).toBe("belum-siap");
      expect(a.jawab[2].galat).toBe("tanpa-cadangan");
      expect(a.jawab[3].ok).toBe(true);

      const b = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "pasang", versi: "1.0.1" },
        { perintah: "pulihkan" },
      ]);
      expect(b.jawab[2]).toMatchObject({ ok: true, versi: "1.0.0" });
      expect(JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8")).version).toBe("1.0.0");
      expect(fs.existsSync(path.join(folder, "lama.js"))).toBe(true);
    } finally {
      await srv.tutup();
    }
  }, 120000);

  it("perangkat: BACA SAJA, bentuk jawaban sama dengan Windows (nama, mac[], osRinci, akun)", async () => {
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const sebelum = fs.readdirSync(rumah).sort();
    const { jawab } = await tanyaPembantu(rumah, [{ perintah: "perangkat" }]);
    expect(jawab[0]).toMatchObject({ ok: true, selesai: true });
    expect(Array.isArray(jawab[0].mac)).toBe(true);
    expect(typeof jawab[0].namaKomputer).toBe("string");
    expect(typeof jawab[0].osRinci).toBe("string");
    expect(typeof jawab[0].akunWindows).toBe("string");
    for (const m of jawab[0].mac) expect(m).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
    expect(jawab[0].namaKomputer).toMatch(/^[A-Za-z0-9._-]{0,63}$/);
    expect(fs.readdirSync(rumah).sort()).toEqual(sebelum.concat(fs.readdirSync(rumah).filter((n) => n === "pembaru.log")).sort());
  }, 60000);

  it("jalan cadangan 'salin' (folder samping tidak dapat ditulis): berkas lain dahulu, manifest TERAKHIR, berkas lama yang tidak ada di paket dibiarkan", () => {
    const dir = folderSementara("salin");
    const dari = path.join(dir, "dari");
    const ke = path.join(dir, "ke");
    fs.mkdirSync(path.join(dari, "sub"), { recursive: true });
    fs.mkdirSync(ke, { recursive: true });
    fs.mkdirSync(path.join(dir, "rumah"));
    fs.writeFileSync(path.join(dari, "manifest.json"), "baru");
    fs.writeFileSync(path.join(dari, "a.js"), "a");
    fs.writeFileSync(path.join(dari, "sub", "b.js"), "b");
    fs.writeFileSync(path.join(ke, "manifest.json"), "lama");
    fs.writeFileSync(path.join(ke, "lama.js"), "lama");
    const fungsi = /^salin_menimpa\(\) \{[\s\S]*?^\}/m.exec(BACA("pembaru/pembaru-aleta.sh"));
    expect(fungsi).not.toBeNull();
    const r = spawnSync(BASH, ["-c", `RUMAH='${posix(path.join(dir, "rumah"))}'; ${(fungsi as RegExpExecArray)[0]}\nsalin_menimpa '${posix(dari)}' '${posix(ke)}'`], {
      encoding: "utf8",
      env: envBash(dir),
    });
    expect(r.status, r.stderr).toBe(0);
    expect(fs.readFileSync(path.join(ke, "manifest.json"), "utf8")).toBe("baru");
    expect(fs.readFileSync(path.join(ke, "a.js"), "utf8")).toBe("a");
    expect(fs.readFileSync(path.join(ke, "sub", "b.js"), "utf8")).toBe("b");
    expect(fs.existsSync(path.join(ke, "lama.js"))).toBe(true);
  }, 60000);

  it("pesan terlalu besar atau pipa tertutup di tengah bingkai: berhenti bersih tanpa jawaban liar", async () => {
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const kepala = Buffer.alloc(4);
    kepala.writeUInt32LE(5_000_000, 0);
    const r = await new Promise<{ keluar: Buffer }>((selesai, gagal) => {
      const p = spawn(BASH, [posix(path.join(rumah, "pembaru-aleta.sh"))], { stdio: ["pipe", "pipe", "pipe"], env: envBash(rumah) });
      const o: Buffer[] = [];
      p.stdout.on("data", (d) => o.push(d));
      p.on("close", () => selesai({ keluar: Buffer.concat(o) }));
      setTimeout(() => {
        p.kill();
        gagal(new Error("tidak berhenti"));
      }, 30000);
      p.stdin.write(kepala);
      p.stdin.end();
    });
    expect(r.keluar.length).toBe(0);
  }, 60000);
});

// ---------------------------------------------------------------------------
// 2. PEMASANG (.command) - berjalan sungguhan dengan HOME tiruan
// ---------------------------------------------------------------------------
const ID_UJI = "abcdefghijklmnopabcdefghijklmnop";

function jalankanPemasang(berkas: string, home: string, args: string[] = [], env: Record<string, string> = {}): Promise<{ kode: number | null; keluar: string }> {
  return new Promise((selesai, gagal) => {
    const p = spawn(BASH, [posix(berkas), ...args], {
      env: envBash(home, { ALETA_PEMBARU_PAKSA_OS: "1", ...env }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const o: Buffer[] = [];
    p.stdout.on("data", (d) => o.push(d));
    p.stderr.on("data", (d) => o.push(d));
    const henti = setTimeout(() => {
      p.kill();
      gagal(new Error("pemasang tidak selesai"));
    }, 120000);
    p.on("close", (kode) => {
      clearTimeout(henti);
      selesai({ kode, keluar: Buffer.concat(o).toString("utf8") });
    });
  });
}

/** Dunia Mac tiruan: HOME dengan Library/Application Support/<peramban> berisi profil. */
function duniaMac(opsi: { peramban?: string[] } = {}) {
  const home = folderSementara("home");
  const dasar = path.join(home, "Library", "Application Support");
  const akar = (rel: string) => path.join(dasar, ...rel.split("/"));
  for (const rel of opsi.peramban ?? ["Google/Chrome"]) fs.mkdirSync(akar(rel), { recursive: true });
  return { home, dasar, akar };
}

describe.skipIf(lewati)("pemasang macOS: sekali per komputer, tanpa sudo, profil tanpa extensions.settings tidak membuatnya berhenti", () => {
  it("memasang: berkas di rumah, daftar pembantu tiap peramban yang ada, allowed_origins = ID folder, setelan peramban tidak berubah; lalu dicabut", async () => {
    const d = duniaMac({ peramban: ["Google/Chrome", "Microsoft Edge", "BraveSoftware/Brave-Browser"] });
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const chrome = d.akar("Google/Chrome");
    // Profil 1: ada extensions.settings. Profil 2: TANPA extensions.settings. Profil 3: JSON rusak. "Guest Profile": diabaikan.
    fs.mkdirSync(path.join(chrome, "Default"), { recursive: true });
    fs.mkdirSync(path.join(chrome, "Profile 2"), { recursive: true });
    fs.mkdirSync(path.join(chrome, "Profile 3"), { recursive: true });
    const pref = JSON.stringify({
      extensions: { settings: { [ID_UJI]: { path: posix(folder), location: 4 }, bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: { path: "relatif/saja" } } },
    });
    fs.writeFileSync(path.join(chrome, "Default", "Secure Preferences"), pref);
    fs.writeFileSync(path.join(chrome, "Default", "Preferences"), "{}");
    fs.writeFileSync(path.join(chrome, "Profile 2", "Preferences"), JSON.stringify({ browser: { theme: 1 } }));
    fs.writeFileSync(path.join(chrome, "Profile 3", "Preferences"), "{ ini bukan json");
    const sidikSebelum = sha(pref);

    const unduhan = folderSementara("unduhan");
    const berkas = path.join(unduhan, "pasang-pembaru-aleta.command");
    fs.writeFileSync(berkas, susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta", idEkstensi: ID_UJI }));

    const h = await jalankanPemasang(berkas, d.home);
    expect(h.keluar, h.keluar).toContain("SELESAI");
    expect(h.kode).toBe(0);
    expect(h.keluar).toContain("Chrome");

    const rumah = path.join(d.dasar, "ALETA", "pembaru");
    expect(fs.existsSync(path.join(rumah, "pembaru-aleta.sh"))).toBe(true);
    expect(fs.readFileSync(path.join(rumah, "pembaru-aleta.sh"), "utf8")).toBe(fs.readFileSync(path.join(AKAR, "pembaru/pembaru-aleta.sh"), "utf8").replace(/\n+$/, "") + "\n");
    expect(fs.readFileSync(path.join(rumah, "folder.txt"), "utf8").trim()).toBe(posix(folder));
    expect(fs.readFileSync(path.join(rumah, "id.txt"), "utf8").trim().split("\n")).toEqual([ID_UJI]);
    const asalTersimpan = fs.readFileSync(path.join(rumah, "asal.txt"), "utf8").trim().split("\n");
    expect(asalTersimpan).toEqual(expect.arrayContaining(["http://192.168.10.10/aleta", "http://192.168.10.10:8008/aleta"]));
    const cfg = JSON.parse(fs.readFileSync(path.join(rumah, "konfigurasi.json"), "utf8"));
    expect(cfg).toMatchObject({ folder: posix(folder), id: [ID_UJI] });

    for (const rel of ["Google/Chrome", "Microsoft Edge", "BraveSoftware/Brave-Browser"]) {
      const mh = JSON.parse(fs.readFileSync(path.join(d.akar(rel), "NativeMessagingHosts", "id.aleta.pembaru.json"), "utf8"));
      expect(mh.name).toBe("id.aleta.pembaru");
      expect(mh.type).toBe("stdio");
      expect(mh.allowed_origins).toEqual([`chrome-extension://${ID_UJI}/`]);
      expect(mh.path).toBe(posix(path.join(rumah, "pembaru-aleta.sh")));
    }
    // Peramban yang tidak terpasang tidak dibuatkan folder.
    expect(fs.existsSync(d.akar("Chromium"))).toBe(false);

    // Setelan peramban hanya DIBACA.
    expect(sha(fs.readFileSync(path.join(chrome, "Default", "Secure Preferences"))) === sidikSebelum).toBe(true);

    // Lewat berkas yang sama dengan yang dijalankan peramban.
    const { jawab } = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(jawab[0]).toMatchObject({ ok: true, folderSah: true });

    const c = await jalankanPemasang(berkas, d.home, ["--cabut"]);
    expect(c.keluar).toContain("dicabut");
    expect(fs.existsSync(rumah)).toBe(false);
    for (const rel of ["Google/Chrome", "Microsoft Edge", "BraveSoftware/Brave-Browser"]) {
      expect(fs.existsSync(path.join(d.akar(rel), "NativeMessagingHosts", "id.aleta.pembaru.json"))).toBe(false);
    }
    expect(fs.existsSync(path.join(folder, "manifest.json"))).toBe(true);
    expect(sha(fs.readFileSync(path.join(chrome, "Default", "Secure Preferences")))).toBe(sidikSebelum);
  }, 240000);

  it("hanya profil tanpa extensions.settings / tanpa ekstensi: berhenti dengan petunjuk, tidak menulis apa pun", async () => {
    const d = duniaMac();
    const chrome = d.akar("Google/Chrome");
    fs.mkdirSync(path.join(chrome, "Default"), { recursive: true });
    fs.mkdirSync(path.join(chrome, "Profile 1"), { recursive: true });
    fs.writeFileSync(path.join(chrome, "Default", "Preferences"), JSON.stringify({ browser: {} }));
    fs.writeFileSync(path.join(chrome, "Profile 1", "Preferences"), JSON.stringify({ extensions: { settings: {} } }));
    const berkas = path.join(folderSementara("unduhan"), "pasang-pembaru-aleta.command");
    fs.writeFileSync(berkas, susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta" }));
    const h = await jalankanPemasang(berkas, d.home);
    expect(h.kode).toBe(1);
    expect(h.keluar).toMatch(/belum ditemukan|Load unpacked/);
    expect(fs.existsSync(path.join(d.dasar, "ALETA"))).toBe(false);
    expect(fs.existsSync(path.join(chrome, "NativeMessagingHosts"))).toBe(false);
  }, 120000);

  it("beberapa salinan ekstensi: ID yang diminta ekstensi memilih salinannya; tanpa itu dan tanpa terminal, berhenti dengan petunjuk", async () => {
    const d = duniaMac();
    const chrome = d.akar("Google/Chrome");
    fs.mkdirSync(path.join(chrome, "Default"), { recursive: true });
    const induk = folderSementara("ext");
    const f1 = path.join(induk, "salinan-1");
    const f2 = path.join(induk, "salinan-2");
    tulisFolderEkstensi(f1, "1.0.0");
    tulisFolderEkstensi(f2, "1.0.0");
    const id2 = "ponmlkjihgfedcbaponmlkjihgfedcba";
    fs.writeFileSync(
      path.join(chrome, "Default", "Preferences"),
      JSON.stringify({ extensions: { settings: { [ID_UJI]: { path: posix(f1) }, [id2]: { path: posix(f2) } } } })
    );
    const unduhan = folderSementara("unduhan");
    const tanpaId = path.join(unduhan, "a.command");
    fs.writeFileSync(tanpaId, susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta" }));
    const h1 = await jalankanPemasang(tanpaId, d.home);
    expect(h1.kode).toBe(1);
    expect(h1.keluar).toMatch(/beberapa salinan/);
    expect(fs.existsSync(path.join(d.dasar, "ALETA"))).toBe(false);

    const denganId = path.join(unduhan, "b.command");
    fs.writeFileSync(denganId, susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta", idEkstensi: id2 }));
    const h2 = await jalankanPemasang(denganId, d.home);
    expect(h2.kode, h2.keluar).toBe(0);
    expect(fs.readFileSync(path.join(d.dasar, "ALETA", "pembaru", "folder.txt"), "utf8").trim()).toBe(posix(f2));
  }, 180000);

  it("dijalankan dari folder ekstensi (tanpa penyisipan server): memakai pembaru-aleta.sh di sampingnya", async () => {
    const d = duniaMac();
    const chrome = d.akar("Google/Chrome");
    fs.mkdirSync(path.join(chrome, "Default"), { recursive: true });
    const folder = path.join(folderSementara("ext"), "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    fs.writeFileSync(path.join(chrome, "Default", "Preferences"), JSON.stringify({ extensions: { settings: { [ID_UJI]: { path: posix(folder) } } } }));
    const sumber = folderSementara("sumber");
    fs.copyFileSync(path.join(AKAR, "pembaru/pasang-pembaru-aleta.command"), path.join(sumber, "pasang-pembaru-aleta.command"));
    fs.copyFileSync(path.join(AKAR, "pembaru/pembaru-aleta.sh"), path.join(sumber, "pembaru-aleta.sh"));
    const h = await jalankanPemasang(path.join(sumber, "pasang-pembaru-aleta.command"), d.home);
    expect(h.kode, h.keluar).toBe(0);
    expect(h.keluar).toContain("SELESAI");
    // Tanpa pembantu di sampingnya: berhenti dengan petunjuk, bukan menulis berkas kosong.
    fs.rmSync(path.join(sumber, "pembaru-aleta.sh"));
    fs.rmSync(path.join(d.dasar, "ALETA"), { recursive: true, force: true });
    const g = await jalankanPemasang(path.join(sumber, "pasang-pembaru-aleta.command"), d.home);
    expect(g.kode).toBe(2);
    expect(g.keluar).toMatch(/tidak ditemukan di samping/);
  }, 180000);

  it("di luar macOS tanpa saklar uji: menolak dengan keterangan (Linux belum didukung)", async () => {
    const d = duniaMac();
    const berkas = path.join(folderSementara("unduhan"), "p.command");
    fs.writeFileSync(berkas, susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta" }));
    const h = await jalankanPemasang(berkas, d.home, [], { ALETA_PEMBARU_PAKSA_OS: "" });
    if (process.platform === "darwin") return;
    expect(h.kode).toBe(1);
    expect(h.keluar).toMatch(/khusus untuk macOS/);
    expect(fs.existsSync(path.join(d.dasar, "ALETA"))).toBe(false);
  }, 60000);
});

// ---------------------------------------------------------------------------
// 3. SISI SERVER: route, penyusun, isi ZIP
// ---------------------------------------------------------------------------
const aktor = vi.hoisted(() => ({ ada: true }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!aktor.ada) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return { id: "usr_uji" };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

describe("server: route pemasang menyajikan berkas yang benar per ?os=", () => {
  beforeEach(() => {
    aktor.ada = true;
  });

  async function minta(kueri: string) {
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/aleta-ecourt/ekstensi/pembaru/pemasang/route");
    return GET(
      new NextRequest(`http://localhost:3000/api/aleta-ecourt/ekstensi/pembaru/pemasang${kueri}`, {
        headers: { "x-forwarded-host": "192.168.10.10", "x-forwarded-proto": "http" },
      })
    );
  }

  it("tanpa ?os= dan ?os=windows: .cmd, CRLF, isi SAMA dengan penyusun Windows (perilaku lama)", async () => {
    const lama = susunPemasang({ asalPortal: "http://192.168.10.10", idEkstensi: ID_UJI });
    for (const kueri of [`?id=${ID_UJI}`, `?id=${ID_UJI}&os=windows`, `?id=${ID_UJI}&os=WIN`]) {
      const r = await minta(kueri);
      expect(r.status, kueri).toBe(200);
      expect(r.headers.get("content-disposition")).toBe('attachment; filename="pasang-pembaru-aleta.cmd"');
      expect(await r.text()).toBe(lama);
    }
    expect(lama.includes("\r\n")).toBe(true);
  });

  it("?os=mac: .command, LF saja, shebang bash, ID dan asal disisipkan, pembantu tertanam utuh", async () => {
    const r = await minta(`?id=${ID_UJI}&os=mac`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="pasang-pembaru-aleta.command"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    const bita = Buffer.from(await r.arrayBuffer());
    expect(Number(r.headers.get("content-length"))).toBe(bita.length);
    const isi = bita.toString("utf8");
    expect(isi.startsWith("#!/bin/bash\n")).toBe(true);
    expect(isi.includes("\r")).toBe(false);
    expect(isi).toContain(`ID_DIMINTA='${ID_UJI}'`);
    expect(isi).toContain("ASAL_PORTAL='http://192.168.10.10'");
    expect(isi).not.toMatch(/@@(ID_DIMINTA|ASAL_PORTAL|HOST_SH)@@/);
    const host = fs.readFileSync(path.join(AKAR, "pembaru/pembaru-aleta.sh"), "utf8").trimEnd();
    expect(isi).toContain(host);
    expect(isi).not.toContain("#PS-MULAI"); // bukan pemasang Windows
  });

  it("?os=linux atau nilai asing: 400 dengan keterangan; tanpa sesi: 401", async () => {
    for (const kueri of ["?os=linux", "?os=android", "?os=;rm"]) {
      const r = await minta(kueri);
      expect(r.status, kueri).toBe(400);
      const j = await r.json();
      expect(j.error.message).toMatch(/Windows dan macOS/);
      expect(j.error.message).toMatch(/Linux/);
    }
    aktor.ada = false;
    expect((await minta("?os=mac")).status).toBe(401);
  });

  it("normalisasi ?os=, nilai berbahaya dikosongkan di pemasang macOS, heredoc tidak dapat ditembus", () => {
    expect(normalisasiOsPemasang(null)).toBe("windows");
    expect(normalisasiOsPemasang("")).toBe("windows");
    expect(normalisasiOsPemasang(" Mac ")).toBe("mac");
    expect(normalisasiOsPemasang("macOS")).toBe("mac");
    expect(normalisasiOsPemasang("darwin")).toBe("mac");
    expect(normalisasiOsPemasang("linux")).toBeNull();
    expect(susunPemasangUntuk("mac", { asalPortal: "http://192.168.10.10/aleta" }).namaBerkas).toBe("pasang-pembaru-aleta.command");
    expect(susunPemasangUntuk("windows", { asalPortal: "http://192.168.10.10/aleta" }).namaBerkas).toBe("pasang-pembaru-aleta.cmd");

    const jahat = susunPemasangMac({ asalPortal: "http://x';rm -rf ~;'", idEkstensi: "';touch /tmp/x;'" });
    expect(jahat).toContain("ID_DIMINTA=''");
    expect(jahat).toContain("ASAL_PORTAL=''");
    expect(jahat).not.toContain("rm -rf ~");
    expect(jahat).not.toContain("touch /tmp/x");
    // Penutup heredoc muncul tepat dua kali (pembuka + penutup), tidak ada di dalam pembantu.
    expect(jahat.match(/ALETA_AKHIR_HOST/g)).toHaveLength(2);
    expect(EKSTENSI_BERKAS["pembaru/pembaru-aleta.sh"]).not.toContain("ALETA_AKHIR_HOST");
  });
});

/** Nama berkas di direktori pusat ZIP. */
function namaDiZip(zip: Buffer): string[] {
  const nama: string[] = [];
  for (let i = 0; i + 46 < zip.length; i += 1) {
    if (zip.readUInt32LE(i) !== 0x02014b50) continue;
    const n = zip.readUInt16LE(i + 28);
    nama.push(zip.subarray(i + 46, i + 46 + n).toString("utf8"));
    i += 45 + n;
  }
  return nama;
}

describe("ZIP dan .crx tidak memuat berkas Mac (pembantu Windows yang terpasang menolak jenisnya)", () => {
  it("berkas Mac tertanam untuk disajikan, tetapi tidak ikut ZIP unduhan maupun isi .crx; berkas Windows tetap ada", () => {
    expect(EKSTENSI_BERKAS["pembaru/pembaru-aleta.sh"]).toBe(BACA("pembaru/pembaru-aleta.sh"));
    expect(EKSTENSI_BERKAS["pembaru/pasang-pembaru-aleta.command"]).toBe(BACA("pembaru/pasang-pembaru-aleta.command"));
    for (const zip of [zipEkstensiUnduh(), zipEkstensiAkar()]) {
      const nama = namaDiZip(zip).map((n) => n.replace(/^ekstensi-sipp\//, ""));
      expect(nama).not.toContain("pembaru/pembaru-aleta.sh");
      expect(nama).not.toContain("pembaru/pasang-pembaru-aleta.command");
      expect(nama.some((n) => /\.(sh|command)$/.test(n))).toBe(false);
      expect(nama).toContain("pembaru/pembaru-aleta.ps1");
      expect(nama).toContain("pembaru/pasang-pembaru-aleta.cmd");
    }
  });

  it("jenis berkas di dalam ZIP tetap hanya yang dikenal pembantu Windows (daftar dibaca dari skripnya)", () => {
    const ps1 = BACA("pembaru/pembaru-aleta.ps1");
    const m = /\$JENIS_BOLEH = @\(([^)]*)\)/.exec(ps1);
    expect(m).not.toBeNull();
    const boleh = new Set([...(m as RegExpExecArray)[1].matchAll(/'([a-z0-9]+)'/g)].map((x) => x[1]));
    const zip = zipEkstensiUnduh();
    const nama = namaDiZip(zip);
    expect(nama.length).toBeGreaterThan(50);
    for (const n of nama) {
      if (n.endsWith("/")) continue;
      const ujung = n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
      expect(boleh.has(ujung), n).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. BENTUK SKRIP (penjaga)
// ---------------------------------------------------------------------------
describe("skrip macOS: bentuk dan batas keamanan terbaca langsung dari berkasnya", () => {
  const host = BACA("pembaru/pembaru-aleta.sh");
  const pasang = BACA("pembaru/pasang-pembaru-aleta.command");
  const cmd = BACA("pembaru/pasang-pembaru-aleta.cmd");
  const ps1 = BACA("pembaru/pembaru-aleta.ps1");

  it("shebang bash, LF saja, ASCII saja, tanpa sudo / python / penyimpanan sandi", () => {
    for (const [nama, isi] of [["host", host], ["pemasang", pasang]] as const) {
      expect(isi.startsWith("#!/bin/bash\n"), nama).toBe(true);
      expect(isi.includes("\r"), nama).toBe(false);
      expect(/[^\x00-\x7f]/.test(isi), nama).toBe(false);
      const kode = isi.split("\n").filter((b) => !b.trim().startsWith("#")).join("\n");
      expect(kode, nama).not.toMatch(/\bsudo\b/);
      expect(kode, nama).not.toMatch(/python/i);
      expect(kode, nama).not.toMatch(/read\s+-s|security\s+add-|keychain|password/i);
      expect(kode, nama).not.toMatch(/\beval\b/);
    }
  });

  it.skipIf(lewati)("lolos bash -n (pemasang mentah, pemasang hasil susunan, dan pembantu)", () => {
    const dir = folderSementara("sintaks");
    const cek = (nama: string, isi: string) => {
      const b = path.join(dir, nama);
      fs.writeFileSync(b, isi);
      const r = spawnSync(BASH, ["-n", posix(b)], { encoding: "utf8", env: envBash(dir) });
      expect(r.status, `${nama}: ${r.stderr}`).toBe(0);
    };
    cek("host.sh", host);
    cek("pasang-mentah.command", pasang);
    cek("pasang-susun.command", susunPemasangMac({ asalPortal: "http://192.168.10.10/aleta", idEkstensi: ID_UJI }));
  });

  it("nama pembantu, asal bawaan, dan bentuk allowed_origins SAMA dengan Windows; perintah yang sama", () => {
    expect(cmd).toContain("$NAMA_HOST = 'id.aleta.pembaru'");
    expect(pasang).toContain("NAMA_HOST='id.aleta.pembaru'");
    expect(cmd).toContain("$NAMA_MANIFEST = 'ALETA E-Court'");
    expect(pasang).toContain("NAMA_MANIFEST='ALETA E-Court'");
    expect(host).toContain("NAMA_MANIFEST='ALETA E-Court'");
    for (const asal of ["http://192.168.10.10/aleta", "http://192.168.10.10:8008/aleta"]) {
      expect(cmd).toContain(asal);
      expect(pasang).toContain(asal);
    }
    expect(cmd).toContain("'chrome-extension://' + $_ + '/'");
    expect(pasang).toContain("chrome-extension://$x/");
    expect(pasang).toContain("192.168.10.10|127.0.0.1"); // asal tambahan dari portal: host yang sama dengan Windows
    for (const p of ["ping", "siapkan", "pasang", "pulihkan", "perangkat"]) {
      expect(ps1).toContain(`'${p}'`);
      expect(host).toContain(`${p})`);
    }
    // Windows dan Mac menolak pemasangan di luar ekstensi bernama "ALETA E-Court" dan memeriksa sidik paket.
    expect(host).toMatch(/shasum -a 256/);
    expect(host).toContain("sidik paket tidak cocok");
    expect(host).toContain("asal-ditolak");
  });

  it("peramban macOS dan folder NativeMessagingHosts-nya terdaftar; profil tanpa extensions.settings ditangani", () => {
    for (const rel of ["Google/Chrome", "Microsoft Edge", "BraveSoftware/Brave-Browser", "Chromium"]) expect(pasang).toContain(`$DASAR/${rel}`);
    expect(pasang).toContain("Library/Application Support");
    expect(pasang).toContain("NativeMessagingHosts");
    expect(pasang).toContain("Secure Preferences");
    expect(pasang).toMatch(/Profile\\ \*/);
    expect(pasang).toMatch(/extensions\.settings/);
    expect(pasang).toMatch(/st && typeof st === "object"/);
    expect(pasang).toMatch(/--cabut/);
    expect(pasang).toContain("com.apple.quarantine");
    expect(pasang).toContain("klik kanan");
  });

  it("pemasang hanya menulis ke rumah pembantu dan daftar pembantu; setelan peramban hanya dibaca", () => {
    const tulis = [...pasang.matchAll(/>\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const t of tulis) {
      expect(t, t).toMatch(/\$RUMAH|\$HOST|\$akar\/NativeMessagingHosts|\$berkas\.baru|\$HOST\.baru|\/dev\/null|\$HOST"/);
    }
    expect(pasang).not.toMatch(/>\s*"?\$berkas"?/); // $berkas = Preferences peramban
    expect(pasang).not.toMatch(/(?:rm|mv|cp)\s+[^\n]*\$akar\/(?:Default|Profile)/);
  });
});

// ---------------------------------------------------------------------------
// 5. latar.js dan popup.js memilih pemasang menurut sistem
// ---------------------------------------------------------------------------
function ambilFungsi(sumber: string, awal: string, akhirTanda: string): string {
  const i = sumber.indexOf(awal);
  expect(i, awal).toBeGreaterThan(-1);
  const j = sumber.indexOf(akhirTanda, i);
  expect(j, akhirTanda).toBeGreaterThan(i);
  return sumber.slice(i, j);
}

describe("latar.js: unduh pemasang menurut sistem komputer", () => {
  const latar = BACA("latar.js");
  const kode = ambilFungsi(latar, "async function deteksiOsPemasang()", "// Sesudah masuk ALETA: tiap pekerja bangun");

  function dunia(opsi: { os?: string; navigator?: Record<string, unknown> }) {
    const unduh: { url: string; nama: string }[] = [];
    const diminta: string[] = [];
    const konteks: Record<string, unknown> = {
      chrome: {
        runtime: { id: ID_UJI, getPlatformInfo: opsi.os ? async () => ({ os: opsi.os }) : undefined },
        storage: { local: { get: async () => ({ asalPortal: "http://192.168.10.10/aleta" }) } },
      },
      navigator: opsi.navigator,
      asalPortalHidup: async (a: string) => a,
      kePembaruanBase64: () => "QQ==",
      terbitkanUnduhan: async (url: string, nama: string) => {
        unduh.push({ url, nama });
        return { ok: true, id: 5 };
      },
      fetch: async (alamat: string) => {
        diminta.push(alamat);
        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      },
      encodeURIComponent,
      String,
    };
    vm.createContext(konteks);
    vm.runInContext(kode, konteks);
    return { konteks, unduh, diminta, panggil: (os?: string) => (vm.runInContext(`unduhPemasangPembaru(${JSON.stringify(os ?? null)})`, konteks) as Promise<any>), deteksi: () => (vm.runInContext("deteksiOsPemasang()", konteks) as Promise<string>) };
  }

  it("macOS: meminta ?os=mac dan menamai unduhan .command", async () => {
    const d = dunia({ os: "mac" });
    const j = await d.panggil();
    expect(j).toMatchObject({ ok: true, os: "mac", nama: "ALETA/pasang-pembaru-aleta.command" });
    expect(d.diminta).toEqual([`http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/pembaru/pemasang?id=${ID_UJI}&os=mac`]);
    expect(d.unduh[0].nama).toBe("ALETA/pasang-pembaru-aleta.command");
  });

  it("Windows: alamat dan nama berkas persis seperti sebelumnya (tanpa ?os=)", async () => {
    const d = dunia({ os: "win" });
    const j = await d.panggil();
    expect(j).toMatchObject({ ok: true, nama: "ALETA/pasang-pembaru-aleta.cmd" });
    expect(d.diminta).toEqual([`http://192.168.10.10/aleta/api/aleta-ecourt/ekstensi/pembaru/pemasang?id=${ID_UJI}`]);
  });

  it("pilihan petugas (popup) mengalahkan deteksi; Linux dan perangkat lain ditolak dengan keterangan", async () => {
    const d = dunia({ os: "win" });
    expect(await d.panggil("mac")).toMatchObject({ ok: true, os: "mac" });
    expect(d.diminta[0]).toContain("&os=mac");
    for (const os of ["linux", "cros"]) {
      const x = dunia({ os });
      const j = await x.panggil();
      expect(j.ok, os).toBe(false);
      expect(j.pesan, os).toMatch(/Windows dan macOS/);
      expect(x.diminta, os).toHaveLength(0);
    }
  });

  it("tanpa getPlatformInfo: navigator.userAgentData, lalu userAgent; tanpa petunjuk = windows", async () => {
    expect(await dunia({ navigator: { userAgentData: { platform: "macOS" }, userAgent: "x" } }).deteksi()).toBe("mac");
    expect(await dunia({ navigator: { platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }).deteksi()).toBe("mac");
    expect(await dunia({ navigator: { platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }).deteksi()).toBe("windows");
    expect(await dunia({ navigator: { platform: "Linux x86_64", userAgent: "Mozilla/5.0 (X11; Linux x86_64)" } }).deteksi()).toBe("linux");
    expect(await dunia({}).deteksi()).toBe("windows");
  });

  it("pesan 'unduh-pemasang-pembaru' meneruskan pilihan os ke fungsinya", () => {
    expect(latar).toContain("unduhPemasangPembaru(pesan.os)");
  });
});

describe("popup.js: petunjuk menurut sistem, Mac menyebut Terminal (bukan .cmd)", () => {
  const popup = BACA("popup.js");
  const html = BACA("popup.html");
  const kode = ambilFungsi(popup, "function osPemasang()", "function gambarStatusPembaru(st) {");
  const kodeKeterangan = ambilFungsi(popup, "function keteranganSudahDiunduh(os) {", "function pasangPembaruOtomatis() {");

  function jalankan(navigator: Record<string, unknown>) {
    const konteks: Record<string, unknown> = { navigator };
    vm.createContext(konteks);
    vm.runInContext(kode + "\n" + kodeKeterangan, konteks);
    return {
      os: () => vm.runInContext("osPemasang()", konteks) as string,
      petunjuk: (os: string) => vm.runInContext(`petunjukPasang(${JSON.stringify(os)})`, konteks) as string,
      sudah: (os: string) => vm.runInContext(`keteranganSudahDiunduh(${JSON.stringify(os)})`, konteks) as string,
    };
  }

  it("mendeteksi sistem dari userAgent tiruan", () => {
    expect(jalankan({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130", platform: "MacIntel" }).os()).toBe("mac");
    expect(jalankan({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", platform: "Win32" }).os()).toBe("windows");
    expect(jalankan({ userAgentData: { platform: "macOS" }, userAgent: "", platform: "" }).os()).toBe("mac");
    expect(jalankan({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130", platform: "Linux x86_64" }).os()).toBe("linux");
    expect(jalankan({ userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130", platform: "Linux x86_64" }).os()).toBe("lain");
  });

  it("petunjuk Mac menyebut Terminal dan pemasang macOS, tanpa .cmd / klik dua kali; Windows tetap klik dua kali", () => {
    const j = jalankan({ userAgent: "Macintosh", platform: "MacIntel" });
    for (const teks of [j.petunjuk("mac"), j.sudah("mac")]) {
      expect(teks).toMatch(/Terminal/);
      expect(teks).toMatch(/macOS|\.command/);
      expect(teks).not.toMatch(/\.cmd|klik dua kali/i);
    }
    expect(j.petunjuk("windows")).toMatch(/klik dua kali/);
    expect(j.sudah("windows")).toMatch(/klik dua kali/);
    expect(j.petunjuk("linux")).toMatch(/Windows dan macOS/);
  });

  it("tombol utama memakai sistem terdeteksi; dua tombol kecil memilih sendiri; tak ada kata teknis", () => {
    expect(html).toContain('id="pasangPembaruWindows"');
    expect(html).toContain('id="pasangPembaruMac"');
    expect(popup).toContain('mintaKeLatar("unduh-pemasang-pembaru", false, { os })');
    expect(popup).toContain('"windows");\n  pasang(document.getElementById("pasangPembaruWindows"), "windows");');
    expect(popup).toContain('pasang(document.getElementById("pasangPembaruMac"), "mac");');
    const blok = popup.slice(popup.indexOf("PEMBARUAN OTOMATIS (pembantu lokal)"), popup.indexOf("/* === AKHIR POPUP-PERAN === */"));
    const tampil = [...blok.matchAll(/"([^"\n]{20,})"/g)].map((m) => m[1]).join(" ");
    expect(tampil).not.toMatch(/registry|registri|native|host|PowerShell|HKCU/i);
  });
});

describe("susun-ekstensi mendaftarkan berkas Mac", () => {
  it("kedua berkas Mac terdaftar di BERKAS dan bit eksekusi dicatat di git bila repo tersedia", () => {
    const skrip = fs.readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(skrip).toContain('"pembaru/pembaru-aleta.sh"');
    expect(skrip).toContain('"pembaru/pasang-pembaru-aleta.command"');
    const r = spawnSync("git", ["ls-files", "-s", "--", "../ekstensi-sipp/pembaru/pembaru-aleta.sh", "../ekstensi-sipp/pembaru/pasang-pembaru-aleta.command"], { encoding: "utf8", cwd: process.cwd() });
    if (r.status !== 0 || !r.stdout.trim()) return; // belum di-stage / bukan repo: dilewati
    for (const baris of r.stdout.trim().split("\n")) expect(baris.startsWith("100755"), baris).toBe(true);
  });
});
