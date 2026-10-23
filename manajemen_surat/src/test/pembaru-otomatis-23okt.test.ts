// @vitest-environment node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { EKSTENSI_BERKAS } from "@/server/shared/ekstensi-berkas";
import { sidikPaketEkstensi, zipEkstensiUnduh } from "@/server/shared/ekstensi-paket";
import { crlf, susunPemasang } from "@/server/shared/pembaru-pemasang";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * PEMBARU OTOMATIS TANPA BERTANYA (23 Okt 2026) - BUKTI, BUKAN JANJI
 * ============================================================================
 *
 * Dilaporkan: tombol Perbaharui menghasilkan ZIP 0 byte (15 berkas, semuanya
 * 0 KB sejak 13 Okt) dan pembaruan tetap harus dikerjakan petugas. Yang dibangun:
 *
 *   A. unduhan manual diperiksa ukurannya (tidak lagi "berhasil" palsu);
 *   B. pembantu lokal (native messaging host, PowerShell) yang mengunduh
 *      LANGSUNG dari server, mencocokkan sidik, menukar folder ekstensi, lalu
 *      latar.js memuat ulang ekstensi pada saat aman;
 *   C. setelan petugas TIDAK berubah: ID ekstensi tetap (kebijakan "key"),
 *      tidak ada yang ditulis selain catatan pembaruan, tidak ada clear().
 *
 * Uji pembantu MENJALANKAN PowerShell sungguhan di folder sementara dengan
 * server HTTP tiruan; uji pemasang menulis ke kunci registri uji di HKCU yang
 * dihapus lagi.
 */

const AKAR = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const BACA = (n: string) => fs.readFileSync(path.join(AKAR, n), "utf8");
const ADA_POWERSHELL = process.platform === "win32" && spawnSync("powershell.exe", ["-NoProfile", "-Command", "exit 0"]).status === 0;
const lewati = !ADA_POWERSHELL;

// ---------------------------------------------------------------------------
// Alat bersama
// ---------------------------------------------------------------------------
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

/** Menjalankan pembantu SUNGGUHAN: semua pesan ditulis, stdin ditutup, jawaban dibaca. */
function tanyaPembantu(rumah: string, pesan: unknown[], batasMs = 90000): Promise<{ jawab: any[]; sisa: number; stderr: string }> {
  return new Promise((selesai, gagal) => {
    const p = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(rumah, "pembaru-aleta.ps1")],
      { stdio: ["pipe", "pipe", "pipe"], env: process.env }
    );
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

/**
 * ZIP "store" tanpa membersihkan nama - susunZip membuang jalur menaik (itu sudah baik), jadi
 * ZIP berbahaya untuk menguji PEMBANTU harus dirakit mentah.
 */
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

/** Paket sah + butir tambahan yang namanya TIDAK dibersihkan. */
function zipPaketMentah(versi: string, tambahan: { nama: string; isi: Buffer }[]): Buffer {
  const b = (nama: string, isi: string) => ({ nama: `ekstensi-sipp/${nama}`, isi: Buffer.from(isi, "utf8") });
  return zipMentah([b("manifest.json", manifestTeks(versi)), b("latar.js", "// x"), b("popup.html", "<!-- x -->"), ...tambahan]);
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

type ServerUji = { asal: string; hitung: () => number; tutup: () => Promise<void>; isi: { zip: Buffer } };
async function serverPaket(zip: Buffer): Promise<ServerUji> {
  const isi = { zip };
  let n = 0;
  const s = http.createServer((q, r) => {
    n += 1;
    if (!String(q.url).startsWith("/aleta/api/aleta-ecourt/ekstensi/pembaru/paket?")) {
      r.statusCode = 404;
      r.end();
      return;
    }
    r.setHeader("Content-Length", String(isi.zip.length));
    r.end(isi.zip);
  });
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const port = (s.address() as AddressInfo).port;
  return {
    asal: `http://127.0.0.1:${port}/aleta`,
    hitung: () => n,
    isi,
    tutup: () => new Promise((ok) => s.close(() => ok())),
  };
}

/** Rumah pembantu uji: skrip asli + konfigurasi.json yang menunjuk folder ekstensi dan server uji. */
function siapkanRumah(folder: string, asal: string[]): string {
  const rumah = folderSementara("rumah");
  fs.copyFileSync(path.join(AKAR, "pembaru/pembaru-aleta.ps1"), path.join(rumah, "pembaru-aleta.ps1"));
  fs.writeFileSync(path.join(rumah, "konfigurasi.json"), JSON.stringify({ folder, asal, id: ["abcdefghijklmnopabcdefghijklmnop"] }));
  return rumah;
}

// ---------------------------------------------------------------------------
// 1. PEMBANTU (PowerShell sungguhan)
// ---------------------------------------------------------------------------
describe.skipIf(lewati)("pembantu lokal: unduh langsung, sidik, tukar folder", () => {
  it("ping menyebut folder sah, versi yang terpasang, dan tidak ada keluaran liar di luar bingkai", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const { jawab, sisa } = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(sisa).toBe(0);
    expect(jawab).toHaveLength(1);
    expect(jawab[0]).toMatchObject({ ok: true, selesai: true, versiPembantu: 1, folderSah: true, versiFolder: "1.0.0" });
  }, 60000);

  it("folder yang bukan ALETA E-Court ditolak - pembantu tidak menyentuh folder lain", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "lain");
    tulisFolderEkstensi(folder, "1.0.0", undefined, "Ekstensi Lain");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const { jawab } = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(jawab[0]).toMatchObject({ ok: true, folderSah: false });
    expect(String(jawab[0].sebab)).toMatch(/bukan ekstensi ALETA/);
  }, 60000);

  it("siapkan + pasang: folder berisi versi baru, versi lama tersimpan di samping, tanpa 'key' bila yang terpasang tanpa 'key'", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0"); // TANPA key: ID-nya diturunkan Chrome dari alamat folder
    const zip = zipPaket("1.0.1", { kunci: "KUNCISERVERABC123" }); // server menyisipkan key
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "pasang", versi: "1.0.1" },
      ]);
      expect(jawab[0]).toMatchObject({ ok: true, siap: true, versi: "1.0.1" });
      expect(jawab[1]).toMatchObject({ ok: true, versi: "1.0.1" });

      const m = fs.readFileSync(path.join(folder, "manifest.json"), "utf8");
      expect(JSON.parse(m).version).toBe("1.0.1");
      // ID ekstensi TIDAK boleh berubah (setelan petugas tersimpan per ID).
      expect(m).not.toContain('"key"');
      expect(fs.readFileSync(path.join(folder, "baru.js"), "utf8")).toContain("berkas baru");
      expect(fs.existsSync(path.join(folder, "ikon/aleta-16.png"))).toBe(true);
      // Versi lama dijaga di samping untuk jalan pulang; folder sementara tidak tersisa.
      expect(JSON.parse(fs.readFileSync(`${folder}.aleta-lama/manifest.json`, "utf8")).version).toBe("1.0.0");
      expect(fs.existsSync(`${folder}.aleta-baru`)).toBe(false);
      expect(fs.existsSync(path.join(rumah, "tahap.json"))).toBe(false);
      expect(srv.hitung()).toBe(1);
    } finally {
      await srv.tutup();
    }
  }, 90000);

  it("'key' manifest: yang terpasang BERKUNCI tetap memakai kuncinya sendiri (ID sama), apa pun yang dikirim server", async () => {
    for (const kunciServer of [undefined, "KUNCIBEDA999"]) {
      const induk = folderSementara("ext");
      const folder = path.join(induk, "ekstensi-sipp");
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
  }, 120000);

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
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(Buffer.from("bukan paket ini")), ukuran: 0 },
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

  it("asal yang tidak ada di daftar ditolak SEBELUM jaringan disentuh", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1");
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]); // server uji TIDAK terdaftar
      const { jawab } = await tanyaPembantu(rumah, [{ perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length }]);
      expect(jawab[0]).toMatchObject({ ok: false, galat: "asal-ditolak" });
      expect(srv.hitung()).toBe(0);
    } finally {
      await srv.tutup();
    }
  }, 60000);

  it("ZIP berbahaya (keluar folder, .exe, nama aneh, versi tak cocok) ditolak dan tidak menulis apa pun di luar folder sementara", async () => {
    const kasus: { nama: string; zip: Buffer; kata: RegExp }[] = [
      { nama: "keluar folder", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/../../buruk.js", isi: Buffer.from("x") }]), kata: /tidak aman/ },
      { nama: "exe", zip: zipPaketMentah("1.0.1", [{ nama: "ekstensi-sipp/virus.exe", isi: Buffer.from("MZ") }]), kata: /jenis berkas/ },
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
  }, 240000);

  it("folder terkunci (dipakai proses lain): jatuh ke penyalinan berkas satu per satu, manifest TERAKHIR, ID tetap", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1", { kunci: "KUNCISERVER" });
    const srv = await serverPaket(zip);
    // Proses lain yang folder kerjanya = folder ekstensi: folder itu tidak dapat diganti namanya.
    const penahan = spawn("cmd.exe", ["/c", "ping -n 40 127.0.0.1 > nul"], { cwd: folder, stdio: "ignore" });
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "pasang", versi: "1.0.1" },
      ]);
      expect(jawab[1], JSON.stringify(jawab)).toMatchObject({ ok: true, cara: "salin" });
      const m = fs.readFileSync(path.join(folder, "manifest.json"), "utf8");
      expect(JSON.parse(m).version).toBe("1.0.1");
      expect(m).not.toContain('"key"');
      expect(fs.readFileSync(path.join(folder, "latar.js"), "utf8")).toContain("1.0.1");
      expect(fs.existsSync(path.join(folder, "baru.js"))).toBe(true);
      expect(fs.existsSync(`${folder}.aleta-baru`)).toBe(false);
    } finally {
      spawnSync("taskkill", ["/PID", String(penahan.pid), "/T", "/F"]);
      await srv.tutup();
    }
  }, 90000);

  it("pulihkan mengembalikan versi sebelumnya sesudah pemasangan", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const zip = zipPaket("1.0.1");
    const srv = await serverPaket(zip);
    try {
      const rumah = siapkanRumah(folder, [srv.asal]);
      const { jawab } = await tanyaPembantu(rumah, [
        { perintah: "siapkan", asal: srv.asal, versi: "1.0.1", sha256: sha(zip), ukuran: zip.length },
        { perintah: "pasang", versi: "1.0.1" },
        { perintah: "pulihkan" },
      ]);
      expect(jawab[2]).toMatchObject({ ok: true, versi: "1.0.0" });
      expect(JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8")).version).toBe("1.0.0");
      expect(fs.existsSync(path.join(folder, "lama.js"))).toBe(true);
    } finally {
      await srv.tutup();
    }
  }, 90000);

  it("perintah tak dikenal dan pasang tanpa siap dijawab galat bersih (satu jawaban akhir tiap pesan)", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const rumah = siapkanRumah(folder, ["http://192.168.10.10/aleta"]);
    const { jawab, sisa } = await tanyaPembantu(rumah, [{ perintah: "hapus-semua" }, { perintah: "pasang", versi: "1.0.1" }, { perintah: "ping" }]);
    expect(sisa).toBe(0);
    expect(jawab.map((j) => j.selesai)).toEqual([true, true, true]);
    expect(jawab[0].galat).toBe("perintah-tidak-dikenal");
    expect(jawab[1].galat).toBe("belum-siap");
    expect(jawab[2].ok).toBe(true);
  }, 60000);
});

// ---------------------------------------------------------------------------
// 2. PEMASANG (.cmd) - registri uji di HKCU, dihapus lagi
// ---------------------------------------------------------------------------
describe.skipIf(lewati)("pemasang: sekali per komputer, tanpa admin, tidak menyentuh profil Chrome", () => {
  const ID = "kdmnbvcxzlkjhgfdsaqwertyuiopabcd".replace(/[^a-p]/g, "a").slice(0, 32);
  const dasarReg = `HKCU:\\Software\\ALETA-UJI-W64-${process.pid}`;
  const dasarRegCmd = `HKCU\\Software\\ALETA-UJI-W64-${process.pid}`;

  afterAll(() => {
    spawnSync("reg", ["delete", dasarRegCmd, "/f"]);
  });

  function jalankanCmd(berkas: string, args: string[], env: Record<string, string>): Promise<{ kode: number | null; keluar: string }> {
    return new Promise((selesai, gagal) => {
      const p = spawn("cmd.exe", ["/c", berkas, ...args], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
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
      p.stdin.write("\r\n"); // "pause" di akhir pemasang
      p.stdin.end();
    });
  }

  it("memasang: berkas di rumah pembantu, kunci registri uji, allowed_origins = ID folder, profil Chrome tidak berubah; lalu dicabut", async () => {
    const induk = folderSementara("ext");
    const folder = path.join(induk, "ekstensi-sipp");
    tulisFolderEkstensi(folder, "1.0.0");
    const profil = folderSementara("profil");
    fs.mkdirSync(path.join(profil, "Default"), { recursive: true });
    const pref = JSON.stringify({ extensions: { settings: { [ID]: { path: folder, location: 4 }, bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: { path: "relatif/saja" } } } });
    fs.writeFileSync(path.join(profil, "Default", "Secure Preferences"), pref);
    fs.writeFileSync(path.join(profil, "Default", "Preferences"), "{}");
    const sidikProfilSebelum = sha(Buffer.from(pref));
    const rumah = path.join(folderSementara("rumahpasang"), "ALETA", "pembaru");

    const berkasCmd = path.join(folderSementara("unduhan"), "pasang-pembaru-aleta.cmd");
    fs.writeFileSync(berkasCmd, susunPemasang({ asalPortal: "http://192.168.10.10/aleta", idEkstensi: ID }));
    const env = { ALETA_PEMBARU_RUMAH: rumah, ALETA_PEMBARU_REG: dasarReg, ALETA_PEMBARU_PROFIL: profil };

    const h = await jalankanCmd(berkasCmd, [], env);
    expect(h.keluar).toContain("SELESAI");
    expect(h.kode).toBe(0);

    const cfg = JSON.parse(fs.readFileSync(path.join(rumah, "konfigurasi.json"), "utf8"));
    expect(path.resolve(cfg.folder).toLowerCase()).toBe(path.resolve(folder).toLowerCase());
    expect(cfg.id).toEqual([ID]);
    expect(cfg.asal).toEqual(expect.arrayContaining(["http://192.168.10.10/aleta", "http://192.168.10.10:8008/aleta"]));

    const mh = JSON.parse(fs.readFileSync(path.join(rumah, "id.aleta.pembaru.json"), "utf8"));
    expect(mh.name).toBe("id.aleta.pembaru");
    expect(mh.type).toBe("stdio");
    expect(mh.allowed_origins).toEqual([`chrome-extension://${ID}/`]);
    expect(path.resolve(mh.path).toLowerCase()).toBe(path.resolve(rumah, "pembaru-aleta.cmd").toLowerCase());

    const kunci = spawnSync("reg", ["query", `${dasarRegCmd}\\Google\\Chrome\\NativeMessagingHosts\\id.aleta.pembaru`, "/ve"], { encoding: "utf8" });
    expect(kunci.status).toBe(0);
    expect(kunci.stdout.toLowerCase()).toContain("id.aleta.pembaru.json");

    // Setelan Chrome hanya DIBACA.
    expect(sha(fs.readFileSync(path.join(profil, "Default", "Secure Preferences"))) === sidikProfilSebelum).toBe(true);

    // Lewat peluncur yang sama dengan yang dipakai Chrome.
    const { jawab } = await tanyaPembantu(rumah, [{ perintah: "ping" }]);
    expect(jawab[0]).toMatchObject({ ok: true, folderSah: true });

    // Dicabut: kunci registri dan rumahnya hilang; ekstensi dan setelannya tidak disentuh.
    const c = await jalankanCmd(berkasCmd, ["/cabut"], env);
    expect(c.keluar).toContain("dicabut");
    expect(fs.existsSync(rumah)).toBe(false);
    expect(spawnSync("reg", ["query", `${dasarRegCmd}\\Google\\Chrome\\NativeMessagingHosts\\id.aleta.pembaru`], { encoding: "utf8" }).status).not.toBe(0);
    expect(fs.existsSync(path.join(folder, "manifest.json"))).toBe(true);
  }, 240000);

  it("tanpa ekstensi yang dimuat sebagai folder: berhenti dengan petunjuk, tidak menulis registri", async () => {
    const profil = folderSementara("profilkosong");
    fs.mkdirSync(path.join(profil, "Default"), { recursive: true });
    fs.writeFileSync(path.join(profil, "Default", "Preferences"), JSON.stringify({ extensions: { settings: {} } }));
    const rumah = path.join(folderSementara("rumahpasang"), "ALETA", "pembaru");
    const berkasCmd = path.join(folderSementara("unduhan"), "pasang-pembaru-aleta.cmd");
    fs.writeFileSync(berkasCmd, susunPemasang({ asalPortal: "http://192.168.10.10/aleta" }));
    const dasar2 = `${dasarReg}-kosong`;
    const h = await jalankanCmd(berkasCmd, [], { ALETA_PEMBARU_RUMAH: rumah, ALETA_PEMBARU_REG: dasar2, ALETA_PEMBARU_PROFIL: profil });
    expect(h.kode).toBe(1);
    expect(h.keluar).toMatch(/belum ditemukan|Load unpacked/);
    expect(fs.existsSync(rumah)).toBe(false);
    expect(spawnSync("reg", ["query", `${dasarRegCmd}-kosong`], { encoding: "utf8" }).status).not.toBe(0);
  }, 120000);
});

// ---------------------------------------------------------------------------
// 3. SISI SERVER: penyusun pemasang, rute info/paket, isi ZIP
// ---------------------------------------------------------------------------
describe("server: pemasang disusun dari satu sumber, sidik paket konsisten", () => {
  it("token diganti, nilai tak baku dikosongkan, akhir baris CRLF, pembantu tertanam sama dengan berkasnya", () => {
    const isi = susunPemasang({ asalPortal: "http://192.168.10.10/aleta/", idEkstensi: "abcdefghijklmnopabcdefghijklmnop" });
    expect(isi).toContain("$IdDiminta = 'abcdefghijklmnopabcdefghijklmnop'");
    expect(isi).toContain("$AsalPortal = 'http://192.168.10.10/aleta'");
    expect(isi).not.toContain("@@ID_DIMINTA@@");
    expect(isi).not.toContain("@@ASAL_PORTAL@@");
    expect(isi).not.toContain("@@HOST_PS1@@");
    expect(isi.includes("\r\n")).toBe(true);
    expect(/(?<!\r)\n/.test(isi)).toBe(false);
    expect(isi).toContain(crlf(BACA("pembaru/pembaru-aleta.ps1")).trimEnd().split("\r\n")[10]);

    const jahat = susunPemasang({ asalPortal: "http://x';calc;'", idEkstensi: "';Remove-Item C:\\ -Recurse;'" });
    expect(jahat).toContain("$IdDiminta = ''");
    expect(jahat).toContain("$AsalPortal = ''");
    expect(jahat).not.toContain("calc");
    expect(jahat).not.toContain("Remove-Item C:");
  });

  it.skipIf(lewati)("pemasang hasil susunan dan pembantu lolos penguraian PowerShell", () => {
    const dir = folderSementara("urai");
    const berkas = path.join(dir, "p.cmd");
    fs.writeFileSync(berkas, susunPemasang({ asalPortal: "http://192.168.10.10/aleta", idEkstensi: "abcdefghijklmnopabcdefghijklmnop" }));
    const skrip = path.join(dir, "urai.ps1");
    fs.writeFileSync(
      skrip,
      "param($f,$mulai)\n$t=[IO.File]::ReadAllText($f)\nif($mulai){$t=$t.Substring($t.IndexOf('#PS'+'-MULAI'))}\n$e=$null;$k=$null\n[void][System.Management.Automation.Language.Parser]::ParseInput($t,[ref]$k,[ref]$e)\nif($e.Count){$e|%{$_.Message};exit 1}\n"
    );
    const a = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", skrip, berkas, "1"], { encoding: "utf8" });
    expect(a.status, a.stdout + a.stderr).toBe(0);
    const b = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", skrip, path.join(AKAR, "pembaru/pembaru-aleta.ps1")], { encoding: "utf8" });
    expect(b.status, b.stdout + b.stderr).toBe(0);
  }, 60000);

  it("rute info menyebut versi + sidik + ukuran yang SAMA dengan ZIP yang dilayani rute paket; sidik salah = 404", async () => {
    const info = await (await import("@/app/api/aleta-ecourt/ekstensi/pembaru/info/route")).GET();
    expect(info.status).toBe(200);
    const j = await info.json();
    const zip = zipEkstensiUnduh();
    expect(j).toMatchObject({ ok: true, versi: JSON.parse(EKSTENSI_BERKAS["manifest.json"] as string).version, sha256: sha(zip), ukuran: zip.length });
    expect(sidikPaketEkstensi().sha256).toBe(j.sha256);

    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/aleta-ecourt/ekstensi/pembaru/paket/route");
    const alamat = (v: string, s: string) => new NextRequest(`http://localhost/api/aleta-ecourt/ekstensi/pembaru/paket?versi=${v}&sha256=${s}`);
    expect((await GET(alamat(j.versi, "0".repeat(64)))).status).toBe(404);
    expect((await GET(alamat("0.0.1", j.sha256))).status).toBe(404);
    const ok = await GET(alamat(j.versi, j.sha256));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).not.toMatch(/\.zip/i); // bukan .zip: tidak dicegat IDM bila lewat peramban
    const bita = Buffer.from(await ok.arrayBuffer());
    expect(sha(bita)).toBe(j.sha256);
  }, 60000);

  it("ZIP unduhan memuat pembantu + pemasang (CRLF) dan manifest tetap TANPA 'key' di sumbernya", () => {
    const manifest = JSON.parse(BACA("manifest.json"));
    expect(manifest.key).toBeUndefined();
    expect(manifest.permissions).toContain("nativeMessaging");
    expect(JSON.stringify(manifest)).not.toContain('"tabs"');
    expect(manifest.permissions).not.toContain("scripting");
    const zip = zipEkstensiUnduh();
    const teks = zip.toString("latin1");
    expect(teks).toContain("ekstensi-sipp/pembaru/pembaru-aleta.ps1");
    expect(teks).toContain("ekstensi-sipp/pembaru/pasang-pembaru-aleta.cmd");
    expect(EKSTENSI_BERKAS["pembaru/pembaru-aleta.ps1"]).toBe(BACA("pembaru/pembaru-aleta.ps1"));
  });
});

// ---------------------------------------------------------------------------
// 4. KEAMANAN PEMBANTU (penjaga bentuk skrip)
// ---------------------------------------------------------------------------
describe("pembantu: batas keamanan terbaca langsung dari skripnya", () => {
  const host = BACA("pembaru/pembaru-aleta.ps1");
  const pasang = BACA("pembaru/pasang-pembaru-aleta.cmd");

  it("tidak menjalankan apa pun dari ZIP dan tidak mengunduh lewat cara lain", () => {
    for (const terlarang of [/Invoke-Expression/i, /\biex\b/i, /Start-Process/i, /Invoke-Item/i, /Invoke-WebRequest/i, /Invoke-RestMethod/i, /DownloadFile/i, /\bAdd-Type\s+-TypeDefinition/i, /Set-ExecutionPolicy/i]) {
      expect(host, String(terlarang)).not.toMatch(terlarang);
    }
    // Berkas yang diekstrak hanya dibatasi jenisnya, tidak ada "&" yang menjalankan hasil ekstrak.
    expect(host).toMatch(/JENIS_BOLEH = @\('js', 'css', 'html', 'json', 'png', 'md', 'txt', 'ps1', 'cmd'\)/);
    expect(host).not.toMatch(/'exe'|'dll'|'bat'|'vbs'|'msi'/);
  });

  it("memeriksa asal, sidik, nama berkas, dan folder sebelum menulis", () => {
    expect(host).toContain("Asal-Diizinkan $asal $cfg");
    expect(host).toContain("$hitung -ne $sidik");
    expect(host).toContain("Nama-Aman $rel");
    expect(host).toContain("StartsWith($akar, [StringComparison]::OrdinalIgnoreCase)");
    expect(host).toContain("Periksa-Folder $folder");
    expect(host).toContain("'ALETA E-Court'");
    expect(host).toContain("AllowAutoRedirect = $false");
  });

  it("ASCII saja (Windows PowerShell 5.1 membaca berkas tanpa BOM sebagai ANSI) dan tanpa penyimpanan sandi", () => {
    expect(/[^\x00-\x7f]/.test(host)).toBe(false);
    expect(/[^\x00-\x7f]/.test(pasang)).toBe(false);
    expect(host).not.toMatch(/password|sandi\s*=|Get-Credential|ConvertTo-SecureString/i);
    expect(pasang).not.toMatch(/Get-Credential|ConvertTo-SecureString/i);
  });

  it("pemasang membuka setelan Chrome HANYA-BACA dan menulis hanya ke rumah pembantu + HKCU", () => {
    expect(pasang).toContain("'Open', 'Read', 'ReadWrite, Delete'");
    expect(pasang).not.toMatch(/WriteAllText\(\(?Join-Path \$profil|Set-Content[^\n]*Preferences|Out-File[^\n]*Preferences/);
    expect(pasang).not.toMatch(/HKLM|RunAs|Start-Process[^\n]*-Verb/i);
    expect(pasang).toContain("$DASAR_REG = if ($env:ALETA_PEMBARU_REG) { $env:ALETA_PEMBARU_REG } else { 'HKCU:\\Software' }");
  });
});

// ---------------------------------------------------------------------------
// 5. latar.js SUNGGUHAN di dunia tiruan
// ---------------------------------------------------------------------------
const SUMBER_LATAR = BACA("latar.js");

type Native = (muatan: any) => any | Promise<any>;
type OpsiDunia = {
  versi?: string;
  installType?: string;
  native?: Native | "tidak-ada" | "dilarang";
  /** Jawab untuk GET .../pembaru/info; null = portal tak terjangkau. */
  info?: { versi: string; sha256: string; ukuran: number } | null;
  /** Jawab fetch paket (jalan unduh manual). */
  paket?: Uint8Array;
  /** Ukuran berkas yang dilaporkan chrome.downloads per percobaan unduh (meniru IDM: 0). */
  ukuranUnduhan?: (urutan: number, nama: string, ukuranSebenarnya: number) => number;
  awalLokal?: Record<string, unknown>;
  masuk?: boolean;
  lokal?: Record<string, unknown>;
};

function buatDuniaLatar(o: OpsiDunia = {}) {
  const lokal: Record<string, unknown> = o.lokal || {};
  const sesi: Record<string, unknown> = {};
  const catat = { reload: 0, clear: 0, hapus: [] as string[][], native: [] as any[], unduh: [] as { nama: string; id: number }[], dibuang: [] as number[], tabKabar: [] as any[] };
  const gudang = (isi: Record<string, unknown>, tandai = false) => ({
    get: async (k?: string | string[] | null) => {
      if (k === null || k === undefined) return structuredClone(isi);
      const kunci = Array.isArray(k) ? k : typeof k === "string" ? [k] : Object.keys(k);
      return Object.fromEntries(kunci.filter((x) => x in isi).map((x) => [x, structuredClone(isi[x])]));
    },
    set: async (x: Record<string, unknown>) => {
      Object.assign(isi, structuredClone(x));
    },
    remove: async (k: string | string[]) => {
      if (tandai) catat.hapus.push(Array.isArray(k) ? k : [k]);
      for (const x of Array.isArray(k) ? k : [k]) delete isi[x];
    },
    clear: async () => {
      if (tandai) catat.clear += 1;
      for (const k of Object.keys(isi)) delete isi[k];
    },
  });
  let pendengarPesan: ((p: unknown, k: unknown, j: (x: unknown) => void) => unknown) | null = null;
  const instal: ((d: unknown) => unknown)[] = [];
  const mulai: (() => unknown)[] = [];
  let galatTerakhir: { message: string } | undefined;
  const unduhan: Record<number, { nama: string; ukuran: number; urutan: number }> = {};
  let idUnduh = 0;
  let urutanUnduh = 0;
  const nativeUji = o.native === undefined ? "tidak-ada" : o.native;

  const chrome: any = {
    runtime: {
      id: "kdmnbvcxzlkjhgfdsaqwertyuiopabcd",
      getManifest: () => ({ version: o.versi ?? "1.205.36" }),
      reload: () => {
        catat.reload += 1;
      },
      requestUpdateCheck: async () => ({ status: "no_update" }),
      onUpdateAvailable: { addListener: () => {} },
      onMessage: { addListener: (f: any) => (pendengarPesan = f) },
      onInstalled: { addListener: (f: any) => instal.push(f) },
      onStartup: { addListener: (f: any) => mulai.push(f) },
      get lastError() {
        return galatTerakhir;
      },
      connectNative: (nama: string) => {
        if (nama !== "id.aleta.pembaru") throw new Error("nama pembantu keliru");
        const dengarPesan: ((m: any) => void)[] = [];
        const dengarPutus: (() => void)[] = [];
        const port: any = {
          onMessage: { addListener: (f: any) => dengarPesan.push(f) },
          onDisconnect: { addListener: (f: any) => dengarPutus.push(f) },
          disconnect: () => {},
          postMessage: (m: any) => {
            catat.native.push(m);
            void Promise.resolve().then(async () => {
              if (nativeUji === "tidak-ada" || nativeUji === "dilarang") {
                galatTerakhir = {
                  message: nativeUji === "tidak-ada" ? "Specified native messaging host not found." : "Access to the specified native messaging host is forbidden.",
                };
                for (const f of dengarPutus) f();
                galatTerakhir = undefined;
                return;
              }
              const j = await (nativeUji as Native)(m);
              for (const f of dengarPesan) f({ selesai: true, ...j });
            });
          },
        };
        return port;
      },
    },
    management: { getSelf: async () => ({ installType: o.installType ?? "development" }) },
    storage: { session: gudang(sesi), local: gudang(lokal, true), onChanged: { addListener: () => {} } },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (id: number, m: unknown) => {
        catat.tabKabar.push({ id, m });
      },
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    downloads: {
      onDeterminingFilename: { addListener: () => {} },
      onChanged: { addListener: () => {}, removeListener: () => {} },
      download: (opsi: { url: string; filename: string }, cb: (id?: number) => void) => {
        idUnduh += 1;
        urutanUnduh += 1;
        const b64 = opsi.url.split(",")[1] || "";
        const ukuranAsli = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
        const ukuran = o.ukuranUnduhan ? o.ukuranUnduhan(urutanUnduh, opsi.filename, ukuranAsli) : ukuranAsli;
        unduhan[idUnduh] = { nama: opsi.filename, ukuran, urutan: urutanUnduh };
        catat.unduh.push({ nama: opsi.filename, id: idUnduh });
        cb(idUnduh);
      },
      search: (q: { id: number }, cb: (x: unknown[]) => void) => {
        const u = unduhan[q.id];
        cb(u ? [{ id: q.id, state: "complete", fileSize: u.ukuran, exists: true }] : []);
      },
      removeFile: (id: number, cb: () => void) => {
        catat.dibuang.push(id);
        cb();
      },
      erase: (_q: unknown, cb: () => void) => cb(),
    },
  };

  const fetchTiruan = async (alamat: string) => {
    const balas = (status: number, isi: string | Uint8Array, json?: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json ?? JSON.parse(typeof isi === "string" ? isi : "{}"),
      text: async () => (typeof isi === "string" ? isi : ""),
      arrayBuffer: async () => {
        const b = typeof isi === "string" ? new TextEncoder().encode(isi) : isi;
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      },
    });
    if (alamat.includes("/api/aleta-ecourt/ekstensi/pembaru/info")) {
      if (!o.info) throw new Error("portal tidak terjangkau");
      return balas(200, "{}", { ok: true, ...o.info });
    }
    if (alamat.includes("/api/aleta-ecourt/ekstensi?info=siapa")) {
      if (o.masuk === false) return balas(401, "{}");
      return balas(200, "{}", { ok: true, versi: o.info?.versi ?? "1.205.36", pengguna: { nama: "Uji", peran: "Hakim", kunci: "k1", peranId: "r", golongan: { kode: "g" } } });
    }
    if (alamat.endsWith("/api/aleta-ecourt/ekstensi")) return balas(200, o.paket || new Uint8Array(3000));
    if (alamat.includes("/ekstensi/pembaru/pemasang")) return balas(200, "@echo off\r\nrem pemasang uji\r\n");
    if (alamat.includes(":8008/aleta/api/install")) return balas(404, "");
    throw new Error(`fetch tak dikenal: ${alamat}`);
  };

  const konteks: Record<string, unknown> = {
    chrome,
    setTimeout: (f: () => void, ms?: number) => globalThis.setTimeout(f, ms),
    clearTimeout: (t: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(t),
    console,
    URL,
    TextEncoder,
    TextDecoder,
    btoa: (s: string) => Buffer.from(s, "latin1").toString("base64"),
    fetch: fetchTiruan,
    // Date dibaca saat dipanggil supaya vi.useFakeTimers (toFake: Date) berlaku di dalam pekerja.
    Date: Object.assign(
      function DateUji(this: unknown, ...a: unknown[]) {
        return a.length ? new (globalThis.Date as any)(...a) : new globalThis.Date();
      },
      { now: () => globalThis.Date.now(), parse: (x: string) => globalThis.Date.parse(x), UTC: (...a: number[]) => (globalThis.Date.UTC as any)(...a) }
    ),
  };
  konteks.self = konteks;
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(SUMBER_LATAR, konteks, { filename: "latar.js" });

  const kirim = (pesan: unknown) =>
    new Promise<any>((selesai) => {
      let sudah = false;
      const hasil = pendengarPesan?.(pesan, { id: chrome.runtime.id, frameId: 0, url: "http://192.168.10.10/SIPP/" }, (x) => {
        sudah = true;
        selesai(x);
      });
      if (hasil === undefined && !sudah) selesai(undefined);
    });
  return { kirim, lokal, sesi, catat, instal, mulai, chrome, atur: (ubah: Partial<OpsiDunia>) => Object.assign(o, ubah) };
}

async function tunggu(n = 40) {
  for (let i = 0; i < n; i += 1) await new Promise((r) => setImmediate(r));
}
const SIDIK = "a".repeat(64);
const INFO_BARU = { versi: "1.205.40", sha256: SIDIK, ukuran: 1234 };
const pembantuSehat: Native = (m) => {
  if (m.perintah === "ping") return { ok: true, versiPembantu: 1, folder: "D:\\x\\ekstensi-sipp", folderSah: true, versiFolder: "1.205.36" };
  if (m.perintah === "siapkan") return { ok: true, siap: true, versi: m.versi };
  if (m.perintah === "pasang") return { ok: true, versi: m.versi, cara: "tukar" };
  return { ok: false, galat: "perintah-tidak-dikenal" };
};

describe("latar.js: pembaruan otomatis lewat pembantu", () => {
  it("versi baru + pembantu ada: ping, siapkan (dengan sidik portal), pasang, lalu ekstensi dimuat ulang - tanpa unduhan peramban", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      // Portal belum terjangkau saat pekerja menyala; lalu tersedia versi baru dan pemeriksaan jalan.
      const d = buatDuniaLatar({ native: pembantuSehat, info: null, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(50);
      d.atur({ info: INFO_BARU });
      await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
      await vi.advanceTimersByTimeAsync(2000);
      // Pemeriksaan kedua sebelum reload terjadi tidak memasang lagi.
      await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
      await vi.advanceTimersByTimeAsync(2000);
      const perintah = d.catat.native.map((m) => m.perintah);
      expect(perintah.slice(0, 3)).toEqual(["ping", "siapkan", "pasang"]);
      const siapkan = d.catat.native.find((m) => m.perintah === "siapkan");
      expect(siapkan).toMatchObject({ asal: "http://192.168.10.10/aleta", versi: "1.205.40", sha256: SIDIK, ukuran: 1234 });
      expect(d.catat.unduh).toEqual([]); // tidak ada chrome.downloads
      expect(d.catat.reload).toBe(1);
      expect(d.catat.tabKabar.length).toBeGreaterThan(0);
      expect(d.catat.tabKabar[0].m).toMatchObject({ jenis: "aleta-diperbarui", versi: "1.205.40" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("tanpa masuk ALETA pun terpasang (versi dan sidik dari rute terbuka)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: pembantuSehat, info: INFO_BARU, masuk: false, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(3000);
      expect(d.catat.native.map((m) => m.perintah)).toEqual(expect.arrayContaining(["siapkan", "pasang"]));
      expect(d.catat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ada antrean/putaran kerja: ditunda - tidak menyentuh disk, tidak memuat ulang, dicoba lagi sebentar lagi", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: pembantuSehat, info: null, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(10);
      // Antrean putusan massal sedang berjalan di salah satu tab, lalu versi baru muncul.
      await d.kirim({ sumber: "aleta-panel", jenis: "antrean-kerja-denyut", id: "putusan-1", antrean: "putusan", nama: "putusan massal", selesai: 1, total: 5 });
      d.atur({ info: INFO_BARU });
      d.catat.native.length = 0;
      const jawab = await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(jawab?.keadaan).toBe("pembaru-ditunda");
      expect(d.catat.native.map((m) => m.perintah)).not.toContain("siapkan");
      expect(d.catat.native.map((m) => m.perintah)).not.toContain("pasang");
      expect(d.catat.reload).toBe(0);
      // Pemeriksaan berikutnya dimajukan menjadi ±2 menit, bukan 30 menit.
      const c = d.lokal.pembaruanOtomatis as { periksaPada: number };
      const sisa = c.periksaPada + 30 * 60 * 1000 - Date.now();
      expect(sisa).toBeLessThanOrEqual(2 * 60 * 1000 + 5000);

      // Antrean selesai -> pemeriksaan paksa berikutnya memasang.
      await d.kirim({ sumber: "aleta-panel", jenis: "antrean-kerja-selesai", id: "putusan-1" });
      await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(d.catat.native.map((m) => m.perintah)).toContain("pasang");
      expect(d.catat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("antrean muncul SELAMA paket diunduh: pasang tidak dikirim (titik aman kedua)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      let d: ReturnType<typeof buatDuniaLatar>;
      const native: Native = async (m) => {
        if (m.perintah === "siapkan") {
          await d.kirim({ sumber: "aleta-panel", jenis: "antrean-kerja-denyut", id: "baru", antrean: "x", nama: "BAS massal", selesai: 0, total: 3 });
        }
        return pembantuSehat(m);
      };
      d = buatDuniaLatar({ native, info: null, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(10);
      d.atur({ info: INFO_BARU });
      await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(d.catat.native.map((m) => m.perintah)).toEqual(["ping", "siapkan"]);
      expect(d.catat.reload).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pembantu belum dipasang: jalan unduh manual (bukan galat), status 'belum dipasang' untuk popup", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: "tidak-ada", info: INFO_BARU, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(3000);
      expect(d.catat.reload).toBe(0);
      expect(d.catat.native.map((m) => m.perintah)).toEqual(["ping"]);
      const st = await d.kirim({ sumber: "aleta-panel", jenis: "status-pembaru", segar: true });
      await vi.advanceTimersByTimeAsync(10);
      expect(st).toMatchObject({ ok: true, keadaan: "belum-dipasang" });
      // Paket tetap diunduh lewat jalan lama (diperiksa ukurannya).
      expect(d.catat.unduh.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("status popup: aktif / ID tak cocok / diurus Chrome", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const a = buatDuniaLatar({ native: pembantuSehat, info: null });
      expect(await a.kirim({ sumber: "aleta-panel", jenis: "status-pembaru", segar: true })).toMatchObject({ keadaan: "aktif" });
      await vi.advanceTimersByTimeAsync(10);
      const b = buatDuniaLatar({ native: "dilarang", info: null });
      expect(await b.kirim({ sumber: "aleta-panel", jenis: "status-pembaru", segar: true })).toMatchObject({ keadaan: "id-tak-cocok" });
      const c = buatDuniaLatar({ native: "tidak-ada", info: null, installType: "normal" });
      expect(await c.kirim({ sumber: "aleta-panel", jenis: "status-pembaru", segar: true })).toMatchObject({ keadaan: "chrome" });
      await vi.advanceTimersByTimeAsync(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tombol Perbarui sekarang: memasang lewat pembantu dan menjawab 'dipasang'; ditahan bila ada antrean (paksa melewati)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: pembantuSehat, info: INFO_BARU, lokal: { asalPortal: "http://192.168.10.10/aleta", pembaruanOtomatis: { periksaPada: Date.now() } } });
      await vi.advanceTimersByTimeAsync(10);
      await d.kirim({ sumber: "aleta-panel", jenis: "antrean-kerja-denyut", id: "a", antrean: "x", nama: "relaas massal", selesai: 0, total: 9 });
      d.catat.native.length = 0;
      const ditahan = await d.kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(ditahan).toMatchObject({ ok: false, keadaan: "antrean-berjalan", ditahan: true });
      expect(d.catat.native.map((m) => m.perintah)).not.toContain("pasang");
      const dipaksa = d.kirim({ sumber: "aleta-panel", jenis: "perbarui", paksa: true });
      await vi.advanceTimersByTimeAsync(100);
      expect(await dipaksa).toMatchObject({ ok: true, keadaan: "dipasang", versiBaru: "1.205.40" });
      await vi.advanceTimersByTimeAsync(500);
      expect(d.catat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gagal berulang untuk versi yang sama: berhenti mencoba sendiri (tiga kali), tombol tetap boleh", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const native: Native = (m) => (m.perintah === "siapkan" ? { ok: false, galat: "sidik-beda", pesan: "sidik tidak cocok" } : pembantuSehat(m));
      const d = buatDuniaLatar({ native, info: INFO_BARU, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(3000);
      for (let i = 0; i < 4; i += 1) {
        await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
        await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
        await vi.advanceTimersByTimeAsync(100);
      }
      const jumlahSiapkan = d.catat.native.filter((m) => m.perintah === "siapkan").length;
      expect(jumlahSiapkan).toBe(3);
      expect(d.catat.reload).toBe(0);
      const tombol = await d.kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      await vi.advanceTimersByTimeAsync(100);
      expect(tombol).toMatchObject({ ok: false, keadaan: "pembaru_gagal" });
      expect(d.catat.native.filter((m) => m.perintah === "siapkan").length).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("latar.js: unduhan manual diperiksa ukurannya (sebab 0 byte)", () => {
  it("unduhan ZIP selesai tetapi 0 byte (IDM): dibuang, dicoba sekali lagi dengan akhiran .aleta, lalu dicatat utuh", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({
        native: "tidak-ada",
        info: INFO_BARU,
        paket: new Uint8Array(5000),
        ukuranUnduhan: (_u, nama, asli) => (nama.endsWith(".zip") ? 0 : asli),
        lokal: { asalPortal: "http://192.168.10.10/aleta" },
      });
      await vi.advanceTimersByTimeAsync(3000);
      expect(d.catat.unduh.map((x) => x.nama)).toEqual(["ALETA/aleta-ekstensi-sipp-1.205.40.zip", "ALETA/aleta-ekstensi-sipp-1.205.40.aleta"]);
      expect(d.catat.dibuang).toEqual([1]); // berkas 0 byte dibuang
      const c = d.lokal.pembaruanOtomatis as { diunduh?: { nama: string }; unduhGagal?: unknown };
      expect(c.diunduh?.nama).toBe("ALETA/aleta-ekstensi-sipp-1.205.40.aleta");
      expect(c.unduhGagal).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keduanya kosong: TIDAK dicatat berhasil, pesan menyebut IDM, dan berhenti setelah dua kali per versi", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: "tidak-ada", info: INFO_BARU, paket: new Uint8Array(5000), ukuranUnduhan: () => 0, lokal: { asalPortal: "http://192.168.10.10/aleta" } });
      await vi.advanceTimersByTimeAsync(3000);
      const c = d.lokal.pembaruanOtomatis as { diunduh?: unknown; unduhGagal?: { n: number; pesan: string } };
      expect(c.diunduh).toBeUndefined();
      expect(c.unduhGagal?.n).toBe(1);
      expect(c.unduhGagal?.pesan).toMatch(/0 byte.*Internet Download Manager/);
      const dulu = d.catat.unduh.length;
      for (let i = 0; i < 4; i += 1) {
        await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
        await d.kirim({ sumber: "aleta-panel", jenis: "periksa-pembaruan", paksa: true });
        await vi.advanceTimersByTimeAsync(100);
      }
      // Dua percobaan per kali x dua kali = empat unduhan sejak awal; tidak bertambah terus-menerus.
      expect(d.catat.unduh.length - dulu).toBeLessThanOrEqual(2 * 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("catatan 'sudah diunduh' yang berkasnya hilang/kosong tidak dipercaya lagi", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({
        native: "tidak-ada",
        info: INFO_BARU,
        paket: new Uint8Array(5000),
        lokal: { asalPortal: "http://192.168.10.10/aleta", pembaruanOtomatis: { diunduh: { versi: "1.205.40", id: 999, nama: "ALETA/lama.zip" } } },
      });
      await vi.advanceTimersByTimeAsync(3000);
      expect(d.catat.unduh.length).toBeGreaterThan(0); // id 999 tak ada -> diunduh ulang
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("setelan petugas TETAP sesudah pembaruan", () => {
  const SETELAN = {
    aktif: false,
    tandaiHalaman: true,
    sisipJadwal: false,
    temaPopup: "gelap",
    temaPanel: "terang",
    skalaHuruf: 120,
    warnaGelap: "biru",
    widgetKehadiran: false,
    ideL2Umur: true,
    senyapSampai: 1790000000000,
    modeLatihan: true,
    akunSipp: "fikri",
    "pengaturanAkun:abc123": { nilai: { aktif: false, skalaHuruf: 120 }, diubahPada: "2026-10-20T01:00:00.000Z" },
    identitasPopup: { kunci: "abc123", kode: "hakim" },
    asalPortal: "http://192.168.10.10/aleta",
    tandaChecklist: { a: 1, b: 2 },
    posisiWidget: { x: 12, y: 340 },
  };

  it("pemasangan penuh + onInstalled('update'): semua kunci lama sama persis; hanya catatan pembaruan yang ditulis; tak ada clear()", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const salinan = structuredClone(SETELAN);
      const d = buatDuniaLatar({ native: pembantuSehat, info: INFO_BARU, lokal: structuredClone(SETELAN) });
      await vi.advanceTimersByTimeAsync(3000);
      for (const f of d.instal) await f({ reason: "update", previousVersion: "1.205.33" });
      await vi.advanceTimersByTimeAsync(3000);
      expect(d.catat.reload).toBeGreaterThan(0);

      for (const [k, v] of Object.entries(salinan)) {
        expect(d.lokal[k], `kunci ${k}`).toEqual(v);
      }
      const baru = Object.keys(d.lokal).filter((k) => !(k in salinan));
      expect(baru.every((k) => ["pembaruanOtomatis", "pembaruPembantu"].includes(k)), `kunci baru: ${baru}`).toBe(true);
      expect(d.catat.clear).toBe(0);
      expect(d.catat.hapus.flat().filter((k) => k in salinan)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("unduh manual yang gagal pun tidak menyentuh setelan", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const d = buatDuniaLatar({ native: "tidak-ada", info: INFO_BARU, paket: new Uint8Array(100), ukuranUnduhan: () => 0, lokal: structuredClone(SETELAN) });
      await vi.advanceTimersByTimeAsync(3000);
      for (const f of d.instal) await f({ reason: "update", previousVersion: "1.205.33" });
      await vi.advanceTimersByTimeAsync(3000);
      for (const [k, v] of Object.entries(SETELAN)) expect(d.lokal[k], `kunci ${k}`).toEqual(v);
      expect(d.catat.clear).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("kode ekstensi: tidak ada chrome.storage.*.clear(), ID tidak diubah (tanpa 'key'), onInstalled hanya memeriksa pembaruan", () => {
    const semuaJs = fs.readdirSync(AKAR).filter((n) => n.endsWith(".js") && !n.startsWith("saksi-katalog-data"));
    for (const n of semuaJs) {
      expect(BACA(n), n).not.toMatch(/storage\.(?:local|sync|session)\.clear\s*\(/);
    }
    expect(JSON.parse(BACA("manifest.json")).key).toBeUndefined();
    const dengar = SUMBER_LATAR.match(/onInstalled\.addListener\(([^\n]*)\n/);
    expect(dengar?.[1]).toContain("periksaSesudahMasuk");
    expect(dengar?.[1]).not.toMatch(/storage/);
    // Satu-satunya kunci setelan yang ditulis jalur pembaruan baru: dua kunci catatan.
    const blok = SUMBER_LATAR.slice(SUMBER_LATAR.indexOf("/* === PEMBARU-OTOMATIS 23 Okt === */"));
    const ditulis = [...blok.matchAll(/storage\.local\.set\(\{\s*\[?([A-Za-z_]+)/g)].map((m) => m[1]);
    expect(ditulis.every((k) => ["KUNCI_PEMBARU", "KUNCI_PEMBARUAN_OTOMATIS"].includes(k)), ditulis.join(",")).toBe(true);
  });
});

describe("popup, panel, dan portal menyebut pembaruan otomatis", () => {
  it("popup menampilkan 'Pembaruan otomatis' dan meminta status ke latar; tombol pasang ada", () => {
    const html = BACA("popup.html");
    const js = BACA("popup.js");
    expect(html).toContain('id="pembaruStatus"');
    expect(html).toContain('id="pasangPembaru"');
    expect(js).toContain('mintaKeLatar("status-pembaru")');
    expect(js).toContain('mintaKeLatar("unduh-pemasang-pembaru")');
    for (const teks of ["aktif", "belum dipasang"]) expect(js).toContain(`["${teks}"`);
  });

  it("panel lama diberi tahu lewat tulisan kecil, TANPA memuat ulang halaman sendiri", () => {
    const panel = BACA("panel-alat.js");
    const i = panel.indexOf("__aletaDengarDiperbarui");
    expect(i).toBeGreaterThan(0);
    const potong = panel.slice(i, i + 900);
    expect(potong).toContain("alatTampilkanCatatanPerbarui");
    expect(potong).not.toContain("location.reload");
  });

  it("popup memuat teks pemasang tanpa label teknis (tanpa kata registry/native/host)", () => {
    const js = BACA("popup.js");
    const blok = js.slice(js.indexOf("PEMBARUAN OTOMATIS (pembantu lokal)"), js.indexOf("/* === AKHIR POPUP-PERAN === */"));
    const tampil = [...blok.matchAll(/"([^"\n]{20,})"/g)].map((m) => m[1]).join(" ");
    expect(tampil).not.toMatch(/registry|registri|native|host|PowerShell|HKCU/i);
  });
});

// Dipakai agar beforeAll tidak dilaporkan tidak terpakai pada penyaringan tertentu.
beforeAll(() => undefined);
