// @vitest-environment node

import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { suggestAiConnectionFix } from "@/server/shared/error-sanitizer";
import { describeNetworkError, outboundFetch, resolveProxyForUrl } from "@/server/shared/outbound-http";

/**
 * Uji jalur keluar ALETA ke penyedia AI.
 *
 * Latar: di server kantor, Uji Koneksi hanya menampilkan "fetch failed". Itu
 * pesan generik undici - sebab sebenarnya tersimpan berlapis di `cause`, dan
 * `fetch` bawaan Node sama sekali tidak membaca HTTPS_PROXY sehingga di
 * jaringan yang wajib lewat proxy ia pasti gagal tanpa keterangan.
 */
const envAsli = { ...process.env };

afterEach(() => {
  process.env = { ...envAsli };
  vi.unstubAllGlobals();
});

function bersihkanProxyEnv() {
  for (const key of [
    "HTTP_PROXY",
    "http_proxy",
    "HTTPS_PROXY",
    "https_proxy",
    "NO_PROXY",
    "no_proxy",
    "ALETA_HTTP_PROXY",
    "ALETA_HTTPS_PROXY",
  ]) {
    delete process.env[key];
  }
}

describe("penentuan proxy", () => {
  it("memakai HTTPS_PROXY untuk target https", () => {
    bersihkanProxyEnv();
    process.env.HTTPS_PROXY = "http://proxy-kantor:8080";

    expect(resolveProxyForUrl(new URL("https://generativelanguage.googleapis.com/v1beta"))?.host).toBe(
      "proxy-kantor:8080"
    );
  });

  it("menerima alamat tanpa skema", () => {
    bersihkanProxyEnv();
    process.env.HTTPS_PROXY = "proxy-kantor:3128";

    const proxy = resolveProxyForUrl(new URL("https://api.openai.com/v1"));
    expect(proxy?.protocol).toBe("http:");
    expect(proxy?.host).toBe("proxy-kantor:3128");
  });

  it("menghormati NO_PROXY termasuk subdomain", () => {
    bersihkanProxyEnv();
    process.env.HTTPS_PROXY = "http://proxy-kantor:8080";
    process.env.NO_PROXY = "localhost,127.0.0.1,.internal.test";

    expect(resolveProxyForUrl(new URL("http://127.0.0.1:11434/api/chat"))).toBeNull();
    expect(resolveProxyForUrl(new URL("https://ollama.internal.test/api"))).toBeNull();
    expect(resolveProxyForUrl(new URL("https://generativelanguage.googleapis.com/v1"))).not.toBeNull();
  });

  it("tidak memakai proxy bila tidak ada variabel yang diatur", () => {
    bersihkanProxyEnv();
    expect(resolveProxyForUrl(new URL("https://generativelanguage.googleapis.com/v1"))).toBeNull();
  });

  it("mengeluh keras bila alamat proxy salah tulis", () => {
    bersihkanProxyEnv();
    process.env.HTTPS_PROXY = "http://:::salah";

    // Salah tulis tidak boleh berubah jadi "koneksi langsung" diam-diam,
    // karena admin akan mengira proxy-nya sudah dipakai.
    expect(() => resolveProxyForUrl(new URL("https://generativelanguage.googleapis.com/v1"))).toThrow(
      /proxy tidak valid/i
    );
  });
});

describe("permintaan lewat proxy", () => {
  it("meneruskan metode, header, dan badan lalu mengembalikan respons apa adanya", async () => {
    const diterima: { url?: string; auth?: string; badan?: string; metode?: string } = {};

    const proxy = http.createServer((permintaan, respons) => {
      const potongan: Buffer[] = [];
      permintaan.on("data", (bagian: Buffer) => potongan.push(bagian));
      permintaan.on("end", () => {
        diterima.url = permintaan.url;
        diterima.metode = permintaan.method;
        diterima.auth = permintaan.headers["proxy-authorization"] as string | undefined;
        diterima.badan = Buffer.concat(potongan).toString("utf8");
        respons.writeHead(200, { "content-type": "application/json" });
        respons.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));
      });
    });

    await new Promise<void>((selesai) => proxy.listen(0, "127.0.0.1", selesai));
    const port = (proxy.address() as AddressInfo).port;

    try {
      bersihkanProxyEnv();
      process.env.HTTP_PROXY = `http://petugas:sandi@127.0.0.1:${port}`;

      const respons = await outboundFetch("http://penyedia-ai.test/v1/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ halo: "dunia" }),
      });

      expect(respons.status).toBe(200);
      await expect(respons.json()).resolves.toMatchObject({
        candidates: [{ content: { parts: [{ text: "OK" }] } }],
      });

      // Proxy penerus menerima URL absolut, bukan hanya path.
      expect(diterima.url).toBe("http://penyedia-ai.test/v1/generate");
      expect(diterima.metode).toBe("POST");
      expect(diterima.badan).toBe(JSON.stringify({ halo: "dunia" }));
      // Kredensial proxy ikut terkirim.
      expect(Buffer.from(String(diterima.auth).replace(/^Basic /, ""), "base64").toString("utf8")).toBe(
        "petugas:sandi"
      );
    } finally {
      await new Promise<void>((selesai) => proxy.close(() => selesai()));
    }
  });

  it("membuka terowongan CONNECT untuk target https dan menyertakan kredensial", async () => {
    const diterima: { path?: string; auth?: string } = {};

    const proxy = http.createServer();
    proxy.on("connect", (permintaan, socket) => {
      diterima.path = permintaan.url;
      diterima.auth = permintaan.headers["proxy-authorization"] as string | undefined;
      // Sengaja ditolak: yang diuji di sini adalah bentuk permintaan CONNECT
      // dan bagaimana penolakan proxy dilaporkan.
      socket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
    });

    await new Promise<void>((selesai) => proxy.listen(0, "127.0.0.1", selesai));
    const port = (proxy.address() as AddressInfo).port;

    try {
      bersihkanProxyEnv();
      process.env.HTTPS_PROXY = `http://petugas:sandi@127.0.0.1:${port}`;

      await expect(
        outboundFetch("https://generativelanguage.googleapis.com/v1beta/models", { method: "POST", body: "{}" })
      ).rejects.toThrow(/menolak CONNECT.*407/i);

      expect(diterima.path).toBe("generativelanguage.googleapis.com:443");
      expect(Buffer.from(String(diterima.auth).replace(/^Basic /, ""), "base64").toString("utf8")).toBe(
        "petugas:sandi"
      );
    } finally {
      await new Promise<void>((selesai) => proxy.close(() => selesai()));
    }
  });

  it("memakai fetch biasa dengan batas waktu bila tidak ada proxy", async () => {
    bersihkanProxyEnv();
    const palsu = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", palsu);

    await outboundFetch("https://generativelanguage.googleapis.com/v1beta", { method: "POST" }, 1234);

    const opsi = palsu.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(opsi?.method).toBe("POST");
    expect(opsi?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("penjelasan sebab kegagalan jaringan", () => {
  it("menggali rantai cause di balik 'fetch failed'", () => {
    const dalam = Object.assign(new Error("getaddrinfo ENOTFOUND generativelanguage.googleapis.com"), {
      code: "ENOTFOUND",
    });
    const tengah = Object.assign(new Error("connect failed"), { cause: dalam });
    const luar = Object.assign(new TypeError("fetch failed"), { cause: tengah });

    const hasil = describeNetworkError(luar);

    expect(hasil).toContain("fetch failed");
    expect(hasil).toContain("ENOTFOUND");
    expect(hasil).toContain("->");
  });

  it("menambahkan kode galat bila belum tersebut di pesan", () => {
    const galat = Object.assign(new Error("connect gagal"), { code: "ECONNREFUSED" });
    expect(describeNetworkError(galat)).toBe("connect gagal (ECONNREFUSED)");
  });

  it("tidak mengulang pesan yang sama", () => {
    const dalam = new Error("fetch failed");
    const luar = Object.assign(new Error("fetch failed"), { cause: dalam });
    expect(describeNetworkError(luar)).toBe("fetch failed");
  });

  it("aman untuk nilai yang bukan Error", () => {
    expect(describeNetworkError("apa saja")).toBe("");
    expect(describeNetworkError(null)).toBe("");
  });
});

describe("saran penanganan mengikuti sebab yang tergali", () => {
  const kasus: Array<[string, RegExp]> = [
    ["fetch failed -> getaddrinfo ENOTFOUND generativelanguage.googleapis.com", /DNS/i],
    ["fetch failed -> connect ETIMEDOUT 142.250.0.0:443", /firewall|port 443/i],
    ["fetch failed -> connect ECONNREFUSED 10.0.0.1:443", /ditolak|firewall/i],
    ["unable to verify the first certificate", /NODE_EXTRA_CA_CERTS/i],
    ["self signed certificate in certificate chain", /NODE_EXTRA_CA_CERTS/i],
    ["Proxy 10.0.0.9:8080 menolak CONNECT ke x (HTTP 407).", /HTTPS_PROXY/i],
    ["Tidak dapat menghubungi proxy 10.0.0.9:8080: connect ECONNREFUSED", /HTTPS_PROXY/i],
    ["Alamat proxy tidak valid: http://:::salah", /HTTPS_PROXY/i],
    ["API key not valid. Please pass a valid API key.", /API key/i],
    ["models/gemini-9 is not found for API version v1beta", /model/i],
    ["Quota exceeded for quota metric", /kuota/i],
  ];

  it.each(kasus)("memberi saran khusus untuk %s", (pesan, harapan) => {
    expect(suggestAiConnectionFix(pesan)).toMatch(harapan);
  });

  it("sertifikat disadap tidak salah dibaca sebagai gangguan jaringan biasa", () => {
    // Sebelumnya semua diarahkan ke "server tidak punya internet", padahal
    // penanganannya sama sekali berbeda: pasang CA kantor, bukan buka firewall.
    const saran = suggestAiConnectionFix("fetch failed -> unable to verify the first certificate");
    expect(saran).toMatch(/CA/);
    expect(saran).not.toMatch(/tidak dapat menjangkau internet/i);
  });
});
