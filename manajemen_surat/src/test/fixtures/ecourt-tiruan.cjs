"use strict";
/**
 * e-Court TIRUAN untuk uji & simulasi status akun (30 Okt 2026).
 *
 * Meniru perilaku e-Court yang dibaca ALETA Bot, sejauh yang terukur:
 *   GET  /Login            sesi sah -> 302 /dashboard; sesi gerbang -> 302 /GateLogin;
 *                          selain itu halaman masuk (surel, sandi, captcha #captchaimage,
 *                          captcha diganti lewat /capcay/regenerate saat window.load)
 *   POST /Login/aksi       captcha salah -> 302 /Login/index/CAPTCHA; sandi salah ->
 *                          302 /Login/index/GAGAL + pesan "Email atau password salah";
 *                          benar -> cookie sesi + 302 /dashboard (atau /GateLogin)
 *   GET  /GateLogin        tombol Lanjut -> POST /GateLogin/lanjut
 *   GET  /dashboard        sesi sah -> "Selamat datang ..."; selain itu 302 /Login
 *
 * Kendali uji (BUKAN bagian e-Court):
 *   tiruan.atur({ mode: "normal" | "gangguan503" | "gerbang", sandi })
 *   tiruan.habiskanSemuaSesi()   - sesi di sisi server diputus (kedaluwarsa)
 *   tiruan.captchaTerakhir()     - kode yang "dibaca manusia" dari gambar
 *   tiruan.tutup()
 *
 * Captcha di sini dibaca oleh PENGUJI yang berperan sebagai manusia - ALETA
 * sendiri tidak pernah memecahkan captcha.
 */
const http = require("http");
const crypto = require("crypto");

function buat({ email = "panitera@pa-donggala.go.id", sandi = "SandiBenar#1", nama = "Derry Uji" } = {}) {
  const keadaan = {
    mode: "normal",
    email,
    sandi,
    nama,
    sesi: new Map(), // id -> { sah: bool, gerbang: bool }
    captcha: new Map(), // id-klien -> kode
    kodeTerakhir: "",
    hitung: { login: 0, periksa: 0, captcha: 0 },
  };

  const kukiDari = (req) => {
    const peta = {};
    for (const bagian of String(req.headers.cookie || "").split(";")) {
      const i = bagian.indexOf("=");
      if (i > 0) peta[bagian.slice(0, i).trim()] = bagian.slice(i + 1).trim();
    }
    return peta;
  };
  const kodeBaru = (klien) => {
    const kode = String(crypto.randomInt(10000, 99999));
    keadaan.captcha.set(klien, kode);
    keadaan.kodeTerakhir = kode;
    keadaan.hitung.captcha += 1;
    return kode;
  };
  const svg = (kode) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#eee"/><text x="12" y="28" font-size="22" font-family="monospace">${kode}</text></svg>`;

  const halamanLogin = (pesan = "") => `<!doctype html><html><head><meta charset="utf-8"><title>e-Court tiruan</title></head><body>
<form method="post" action="/Login/aksi">
  ${pesan ? `<div class="alert alert-danger">${pesan}</div>` : ""}
  <input type="email" name="email" id="email" placeholder="Email">
  <input type="password" name="password" id="password">
  <img id="captchaimage" src="/capcay/gambar?awal=1" alt="captcha">
  <input type="text" name="captcha" id="captcha" placeholder="Kode captcha">
  <button type="submit">Login</button>
</form>
<script>
  window.addEventListener("load", function () {
    fetch("/capcay/regenerate", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (u) {
      document.getElementById("captchaimage").src = u;
    });
  });
</script></body></html>`;

  const kirim = (res, kode, kepala, isi = "") => {
    res.writeHead(kode, kepala);
    res.end(isi);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const kuki = kukiDari(req);
    let klien = kuki.klien;
    const kepala = {};
    if (!klien) {
      klien = crypto.randomBytes(6).toString("hex");
      kepala["Set-Cookie"] = [`klien=${klien}; Path=/; HttpOnly`];
    }
    const tambahKuki = (k) => {
      kepala["Set-Cookie"] = [...(kepala["Set-Cookie"] || []), k];
    };
    const sesi = kuki.ci_session ? keadaan.sesi.get(kuki.ci_session) : null;

    if (keadaan.mode === "gangguan503") {
      return kirim(res, 503, { "Content-Type": "text/html" }, "<h1>503 Service Unavailable</h1>");
    }

    if (req.method === "GET" && /^\/Login\/?$/i.test(url.pathname)) {
      keadaan.hitung.periksa += 1;
      if (sesi && sesi.sah) return kirim(res, 302, { ...kepala, Location: "/dashboard" });
      if (sesi && sesi.gerbang) return kirim(res, 302, { ...kepala, Location: "/GateLogin" });
      return kirim(res, 200, { ...kepala, "Content-Type": "text/html" }, halamanLogin());
    }
    if (req.method === "GET" && /^\/Login\/index\/(\w+)/i.test(url.pathname)) {
      const kode = /CAPTCHA/i.test(url.pathname) ? "Kode captcha salah" : "Email atau password salah";
      return kirim(res, 200, { ...kepala, "Content-Type": "text/html" }, halamanLogin(kode));
    }
    if (req.method === "GET" && url.pathname === "/capcay/regenerate") {
      const kode = kodeBaru(klien);
      return kirim(res, 200, { ...kepala, "Content-Type": "text/plain" }, `/capcay/gambar?k=${kode}&t=${Date.now()}`);
    }
    if (req.method === "GET" && url.pathname === "/capcay/gambar") {
      const kode = url.searchParams.get("k") || keadaan.captcha.get(klien) || kodeBaru(klien);
      return kirim(res, 200, { ...kepala, "Content-Type": "image/svg+xml" }, svg(kode));
    }
    if (req.method === "POST" && url.pathname === "/Login/aksi") {
      let badan = "";
      req.on("data", (c) => (badan += c));
      req.on("end", () => {
        const f = new URLSearchParams(badan);
        keadaan.hitung.login += 1;
        if (f.get("captcha") !== keadaan.captcha.get(klien)) {
          keadaan.captcha.delete(klien);
          return kirim(res, 302, { ...kepala, Location: "/Login/index/CAPTCHA" });
        }
        keadaan.captcha.delete(klien);
        if (f.get("email") !== keadaan.email || f.get("password") !== keadaan.sandi) {
          return kirim(res, 302, { ...kepala, Location: "/Login/index/GAGAL" });
        }
        const id = crypto.randomBytes(12).toString("hex");
        const gerbang = keadaan.mode === "gerbang";
        keadaan.sesi.set(id, { sah: !gerbang, gerbang });
        tambahKuki(`ci_session=${id}; Path=/; HttpOnly`);
        return kirim(res, 302, { ...kepala, Location: gerbang ? "/GateLogin" : "/dashboard" });
      });
      return undefined;
    }
    if (req.method === "GET" && url.pathname === "/GateLogin") {
      return kirim(
        res,
        200,
        { ...kepala, "Content-Type": "text/html" },
        `<!doctype html><html><body><p>Akun Anda sedang login di perangkat lain.</p><form method="post" action="/GateLogin/lanjut"><button type="button" onclick="history.back()">Batal</button><button type="submit">Lanjut</button></form></body></html>`
      );
    }
    if (req.method === "POST" && url.pathname === "/GateLogin/lanjut") {
      if (sesi) {
        sesi.sah = true;
        sesi.gerbang = false;
      }
      return kirim(res, 302, { ...kepala, Location: "/dashboard" });
    }
    if (req.method === "GET" && /^\/(dashboard|pendaftaran)/i.test(url.pathname)) {
      if (!sesi || !sesi.sah) return kirim(res, 302, { ...kepala, Location: "/Login" });
      return kirim(
        res,
        200,
        { ...kepala, "Content-Type": "text/html" },
        `<!doctype html><html><body><div class="user-name">${keadaan.nama}</div><p>Selamat datang ${keadaan.nama}</p></body></html>`
      );
    }
    return kirim(res, 404, { ...kepala, "Content-Type": "text/plain" }, "tidak ada");
  });

  const tiruan = {
    alamat: "",
    keadaan,
    mulai(port = 0) {
      return new Promise((selesai) => {
        server.listen(port, "127.0.0.1", () => {
          tiruan.alamat = `http://127.0.0.1:${server.address().port}`;
          selesai(tiruan);
        });
      });
    },
    atur(baru = {}) {
      Object.assign(keadaan, baru);
    },
    habiskanSemuaSesi() {
      for (const s of keadaan.sesi.values()) {
        s.sah = false;
        s.gerbang = false;
      }
    },
    gerbangkanSemuaSesi() {
      for (const s of keadaan.sesi.values()) {
        s.sah = false;
        s.gerbang = true;
      }
    },
    captchaTerakhir: () => keadaan.kodeTerakhir,
    tutup() {
      return new Promise((selesai) => {
        if (typeof server.closeAllConnections === "function") server.closeAllConnections();
        server.close(() => selesai());
      });
    },
  };
  return tiruan;
}

module.exports = { buat };
