// @vitest-environment node

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_VERSION } from "@/lib/patch-notes";
import { downloadAndStageUpdateFromManifest } from "@/server/modules/system-update/service";

/**
 * Unduh paket rilis baru dari manifest, untuk satker yang punya akses internet.
 *
 * Ini menarik KODE YANG AKAN BERJALAN di server, jadi pemeriksaannya ketat:
 *   - checksum wajib ada di manifest, kalau tidak unduhan dibatalkan,
 *   - hanya versi yang benar-benar lebih baru yang diunduh,
 *   - isi diperiksa (gzip) dan checksum dicocokkan sebelum ditampung.
 *
 * Penerapannya tetap di host — di sini hanya menampung ke inbox.
 */
const GZIP_HEADER = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
const paketSah = Buffer.concat([GZIP_HEADER, Buffer.alloc(128, 9)]);
const shaSah = createHash("sha256").update(paketSah).digest("hex");

const MANIFEST_URL = "https://rilis.aleta.test/manifest.json";
const DOWNLOAD_URL = "https://rilis.aleta.test/aleta-installer-9.9.9.tar.gz";

// Folder tujuan dihitung dari process.cwd() saat modul dimuat, jadi berkas yang
// benar-benar ditulis dibersihkan sendiri agar repo tidak ikut kotor.
const INBOX = path.join(process.cwd(), "reports", "updates", "inbox");
const berkasDibuat: string[] = [];
function catat(nama: string) {
  berkasDibuat.push(path.join(INBOX, nama), path.join(INBOX, `${nama}.sha256`));
}

const envAsli = { ...process.env };

beforeEach(async () => {
  await fs.mkdir(INBOX, { recursive: true });
  process.env.ALETA_UPDATE_MANIFEST_URL = MANIFEST_URL;
  // Pastikan tidak ada proxy yang ikut campur pada uji ini.
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) delete process.env[key];
});

afterEach(() => {
  process.env = { ...envAsli };
  vi.unstubAllGlobals();
});

afterAll(async () => {
  for (const berkas of berkasDibuat) await fs.rm(berkas, { force: true });
  await fs.rm(path.join(INBOX, "uploads.jsonl"), { force: true });
});

/**
 * Memasang fetch tiruan: URL manifest mengembalikan JSON, URL unduhan
 * mengembalikan bytes paket.
 */
function pasangFetch(manifest: Record<string, unknown>, paket: Buffer | null = paketSah) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === MANIFEST_URL) {
        return new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === DOWNLOAD_URL && paket) {
        return new Response(new Uint8Array(paket), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    })
  );
}

const manifestSah = {
  version: "9.9.9",
  packageName: "aleta-installer-9.9.9.tar.gz",
  downloadUrl: DOWNLOAD_URL,
  packageSha256: shaSah,
  title: "ALETA v9.9.9",
};

describe("unduh update dari manifest", () => {
  it("mengunduh, memverifikasi, dan menampung paket rilis baru", async () => {
    catat("aleta-installer-9.9.9.tar.gz");
    pasangFetch(manifestSah);

    const hasil = await downloadAndStageUpdateFromManifest({ actorLabel: "Super Admin Uji" });

    expect(hasil.version).toBe("9.9.9");
    expect(hasil.fileName).toBe("aleta-installer-9.9.9.tar.gz");
    expect(hasil.sha256).toBe(shaSah);
    expect(hasil.hostPath).toContain("/reports/updates/inbox/aleta-installer-9.9.9.tar.gz");

    // Berkas dan checksum-nya benar-benar ada di inbox.
    const isi = await fs.readFile(path.join(INBOX, "aleta-installer-9.9.9.tar.gz"));
    expect(isi.equals(paketSah)).toBe(true);
  });

  it("menolak bila manifest tidak memuat checksum", async () => {
    const tanpaSha = { ...manifestSah };
    delete (tanpaSha as { packageSha256?: string }).packageSha256;
    pasangFetch(tanpaSha);

    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/checksum/i);
  });

  it("menolak bila versi manifest tidak lebih baru dari yang terpasang", async () => {
    pasangFetch({ ...manifestSah, version: APP_VERSION });
    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/sudah sama atau lebih baru/i);
  });

  it("menolak bila manifest tidak memuat alamat unduhan", async () => {
    const tanpaUrl = { ...manifestSah };
    delete (tanpaUrl as { downloadUrl?: string }).downloadUrl;
    pasangFetch(tanpaUrl);

    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/alamat unduhan/i);
  });

  it("menolak bila berkas yang diunduh checksum-nya tidak cocok", async () => {
    // Manifest menjanjikan checksum tertentu, tapi berkas yang datang berbeda.
    const paketLain = Buffer.concat([GZIP_HEADER, Buffer.alloc(128, 1)]);
    pasangFetch(manifestSah, paketLain);

    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/checksum/i);
  });

  it("menolak berkas yang bukan gzip walau dari manifest sah", async () => {
    const bukanGzip = Buffer.from("#!/bin/bash\nrm -rf /\n", "utf8");
    const shaBukanGzip = createHash("sha256").update(bukanGzip).digest("hex");
    pasangFetch({ ...manifestSah, packageSha256: shaBukanGzip }, bukanGzip);

    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/bukan arsip/i);
  });

  it("melaporkan sumber tidak terjangkau dengan jelas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      })
    );
    await expect(downloadAndStageUpdateFromManifest({ actorLabel: "x" })).rejects.toThrow(/tidak dapat membaca informasi update|tidak terjangkau/i);
  });
});
