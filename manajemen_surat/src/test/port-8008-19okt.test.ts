// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import { buildTrustedOrigins, portPortalTambahan } from "@/lib/auth";

/**
 * K1 (19 Okt 2026): ALETA di port sendiri, http://192.168.10.10:8008/aleta.
 * Dijaga: origin tepercaya memuat 8008, berkas Apache siap pasang memuat
 * proxy yang sama dengan port 80, dan ekstensi memilih 8008 dengan cadangan
 * port 80.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

const simpanEnv = { ...process.env };
afterEach(() => {
  for (const k of ["BETTER_AUTH_TRUSTED_ORIGINS", "ALETA_PORT_PORTAL_TAMBAHAN"]) {
    if (simpanEnv[k] === undefined) delete process.env[k];
    else process.env[k] = simpanEnv[k];
  }
});

describe("origin tepercaya Better Auth", () => {
  it("bentuk produksi (BETTER_AUTH_URL /aleta + origin 192.168.10.10): 8008 ikut dipercaya", () => {
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = "http://192.168.10.10";
    delete process.env.ALETA_PORT_PORTAL_TAMBAHAN;
    const asal = buildTrustedOrigins("http://192.168.10.10/aleta");
    expect(asal).toContain("http://192.168.10.10");
    expect(asal).toContain("http://192.168.10.10:8008");
  });

  it("env kosong mematikan port tambahan; beberapa port boleh; 80/443/sampah diabaikan", () => {
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = "http://192.168.10.10";
    process.env.ALETA_PORT_PORTAL_TAMBAHAN = "";
    expect(buildTrustedOrigins("http://192.168.10.10/aleta")).not.toContain("http://192.168.10.10:8008");
    process.env.ALETA_PORT_PORTAL_TAMBAHAN = "8008, 8080,80,443,abc";
    expect(portPortalTambahan()).toEqual(["8008", "8080"]);
    const asal = buildTrustedOrigins("http://192.168.10.10/aleta");
    expect(asal).toContain("http://192.168.10.10:8080");
  });

  it("loopback tidak dilebarkan ke port 8008 (yang lokal punya aturannya sendiri)", () => {
    delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    delete process.env.ALETA_PORT_PORTAL_TAMBAHAN;
    expect(buildTrustedOrigins("http://localhost:3000")).not.toContain("http://localhost:8008");
  });
});

describe("deploy/apache/aleta-8008.conf", () => {
  const conf = baca("deploy/apache/aleta-8008.conf");
  const aktif = conf
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b && !b.startsWith("#"));
  const portLama = baca("deploy/apache/aleta.conf")
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => /^ProxyPass(Reverse)? \/aleta /.test(b));

  it("Listen 8008 dan VirtualHost *:8008", () => {
    expect(aktif).toContain("Listen 8008");
    expect(aktif).toContain("<VirtualHost *:8008>");
    expect(aktif).toContain("</VirtualHost>");
  });

  it("proxy /aleta SAMA dengan port 80, pengecualian uploads/prefix/logo lebih dulu", () => {
    expect(portLama.length).toBe(2);
    for (const b of portLama) expect(aktif).toContain(b);
    const iProxy = aktif.indexOf("ProxyPass /aleta http://127.0.0.1:3000/aleta timeout=120");
    for (const k of ["ProxyPass /aleta/uploads/ !", "ProxyPass /aleta/aleta/ !", "ProxyPass /aleta/aleta !", "ProxyPass /mahkamah-agung-logo.png !"]) {
      expect(aktif.indexOf(k)).toBeGreaterThan(-1);
      expect(aktif.indexOf(k)).toBeLessThan(iProxy);
    }
    expect(aktif).toContain("ProxyPassInherit Off");
    expect(aktif).toContain("ProxyPreserveHost On");
  });

  it("X-Forwarded-Host membawa port; akar dialihkan ke /aleta/", () => {
    expect(aktif).toContain('RequestHeader set X-Forwarded-Host "192.168.10.10:8008"');
    expect(aktif).toContain('RequestHeader set X-Forwarded-Proto "http"');
    expect(aktif).toContain("RedirectMatch 302 ^/$ /aleta/");
  });

  it("pengalihan port 80 -> 8008 hanya OPSI tertulis (dikomentari), dibatasi port 80, tanpa api/_next/uploads", () => {
    expect(aktif.some((b) => b.includes(":8008/aleta/$1"))).toBe(false);
    expect(conf).toContain("# <If \"%{SERVER_PORT} == '80'\">");
    expect(conf).toContain("#     RedirectMatch 302 ^/aleta/(?!api/|_next/|uploads/)(.*)$ http://192.168.10.10:8008/aleta/$1");
  });
});

// ===========================================================================
// Ekstensi: alamat-portal.js dijalankan apa adanya di vm.
// ===========================================================================
type Ruang = {
  AletaAlamatPortal: {
    ASAL_8008: string;
    ASAL_80: string;
    pilihAsal: (asal: string) => Promise<string>;
  };
};

function muat(hidup: () => boolean) {
  const sesi: Record<string, unknown> = {};
  const diuji: string[] = [];
  const ruang: Record<string, unknown> = {
    setTimeout,
    clearTimeout,
    AbortController,
    URLSearchParams,
    fetch: async (url: string) => {
      diuji.push(url);
      if (!hidup()) throw new TypeError("Failed to fetch");
      return { ok: true, status: 200 };
    },
    chrome: {
      storage: {
        session: {
          get: async (k: string[]) => Object.fromEntries(k.filter((x) => x in sesi).map((x) => [x, sesi[x]])),
          set: async (o: Record<string, unknown>) => void Object.assign(sesi, o),
        },
      },
    },
  };
  ruang.globalThis = ruang;
  vm.createContext(ruang);
  vm.runInContext(baca("ekstensi-sipp/alamat-portal.js"), ruang, { filename: "alamat-portal.js" });
  return { api: (ruang as unknown as Ruang).AletaAlamatPortal, sesi, diuji };
}

describe("ekstensi: alamat portal 8008 dengan cadangan port 80", () => {
  it("8008 terjangkau: alamat bawaan port 80 dipindah ke 8008, diingat (uji sekali)", async () => {
    const { api, diuji, sesi } = muat(() => true);
    expect(await api.pilihAsal("http://192.168.10.10/aleta")).toBe("http://192.168.10.10:8008/aleta");
    expect(await api.pilihAsal("http://192.168.10.10/aleta/")).toBe("http://192.168.10.10:8008/aleta");
    expect(await api.pilihAsal("http://192.168.10.10:8008/aleta")).toBe("http://192.168.10.10:8008/aleta");
    expect(diuji).toEqual(["http://192.168.10.10:8008/aleta/api/install"]);
    expect((sesi.asalPortalHidup as { asal: string }).asal).toBe("http://192.168.10.10:8008/aleta");
  });

  it("8008 tidak terjangkau (firewall belum dibuka): cadangan port 80, diuji ulang sesudah ingatannya habis", async () => {
    let buka = false;
    const { api, diuji, sesi } = muat(() => buka);
    expect(await api.pilihAsal("http://192.168.10.10:8008/aleta")).toBe("http://192.168.10.10/aleta");
    expect(await api.pilihAsal("http://192.168.10.10/aleta")).toBe("http://192.168.10.10/aleta");
    expect(diuji).toHaveLength(1);
    // Ingatan "mati" berumur pendek: sesudah habis, 8008 diuji lagi.
    (sesi.asalPortalHidup as { sampai: number }).sampai = Date.now() - 1;
    buka = true;
    expect(await api.pilihAsal("http://192.168.10.10/aleta")).toBe("http://192.168.10.10:8008/aleta");
    expect(diuji).toHaveLength(2);
  });

  it("alamat yang bukan bawaan satker dan alamat kosong dipakai apa adanya, tanpa uji", async () => {
    const { api, diuji } = muat(() => true);
    expect(await api.pilihAsal("http://127.0.0.1/aleta")).toBe("http://127.0.0.1/aleta");
    expect(await api.pilihAsal("")).toBe("");
    expect(diuji).toEqual([]);
  });

  it("dimuat pekerja latar dan popup; izin host 8008; ikut paket ekstensi", () => {
    const manifest = JSON.parse(baca("ekstensi-sipp/manifest.json"));
    expect(manifest.host_permissions).toContain("http://192.168.10.10:8008/*");
    expect(baca("ekstensi-sipp/latar.js")).toContain('importScripts("alamat-portal.js")');
    const popup = baca("ekstensi-sipp/popup.html");
    expect(popup.indexOf('<script src="alamat-portal.js"></script>')).toBeGreaterThan(-1);
    expect(popup.indexOf('<script src="alamat-portal.js"></script>')).toBeLessThan(popup.indexOf('<script src="popup.js"></script>'));
    expect(baca("manajemen_surat/scripts/susun-ekstensi.mjs")).toContain('"alamat-portal.js"');
  });
});
