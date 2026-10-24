"use strict";

/**
 * ============================================================================
 * ALETA Ai - RELAI PEKERJA LATAR UNTUK GELEMBUNG DI e-COURT (23 Okt 2026)
 * ============================================================================
 *
 * Situs e-Court (ecourt.mahkamahagung.go.id) BEDA ASAL dengan portal ALETA,
 * jadi gelembung chat di sana tidak dapat memanggil /aleta/api langsung.
 * Pekerja latar (latar.js memuat berkas ini) meneruskan permintaannya ke
 * portal ALETA dengan sesi ALETA di Chrome ini - ekstensi TETAP tidak memegang
 * kunci API dan tidak memanggil layanan AI.
 *
 * Penjagaan: hanya port bernama "aleta-ai-relai" dari ekstensi ini sendiri;
 * hanya tiga permintaan yang dikenal (ringkas, buat percakapan, kirim pesan);
 * badan hanya JSON kecil; tidak ada yang disimpan. Jawaban SSE diteruskan
 * potong demi potong; port putus = permintaan dibatalkan.
 *
 * Pesan:  -> {jalur, metode, badan?}
 *         <- {status, isi} (JSON)  |  {potong} ... {selesai: true, status} (aliran)
 */
(function pasang(akar) {
  const NAMA_PORT = "aleta-ai-relai";
  const BATAS_BADAN = 70000;
  const IZIN = [
    { metode: "GET", pola: /^\/api\/aleta-ai\/ringkas$/, aliran: false },
    { metode: "POST", pola: /^\/api\/aleta-ai\/percakapan$/, aliran: false },
    { metode: "POST", pola: /^\/api\/aleta-ai\/percakapan\/[A-Za-z0-9_-]{1,80}\/pesan$/, aliran: true },
  ];

  /** Murni: aturan izin satu permintaan; null = ditolak. */
  function izinRelai(m) {
    if (!m || typeof m !== "object") return null;
    const metode = String(m.metode || "GET").toUpperCase();
    const jalur = String(m.jalur || "");
    const aturan = IZIN.find((a) => a.metode === metode && a.pola.test(jalur));
    if (!aturan) return null;
    const badan = m.badan === undefined ? undefined : JSON.stringify(m.badan);
    if (badan && badan.length > BATAS_BADAN) return null;
    return { metode, jalur, badan, aliran: aturan.aliran };
  }

  /**
   * chromeApi: objek chrome; ambil: fetch; asalPortal: async () => "http://.../aleta".
   */
  function pasangRelaiAletaAi(chromeApi, ambil, asalPortal) {
    if (!chromeApi || !chromeApi.runtime || !chromeApi.runtime.onConnect) return;
    chromeApi.runtime.onConnect.addListener((port) => {
      if (!port || port.name !== NAMA_PORT) return;
      const pengirim = port.sender || {};
      if (pengirim.id && chromeApi.runtime.id && pengirim.id !== chromeApi.runtime.id) {
        port.disconnect();
        return;
      }
      const kendali = typeof AbortController === "function" ? new AbortController() : null;
      let putus = false;
      port.onDisconnect.addListener(() => {
        putus = true;
        if (kendali) kendali.abort();
      });
      const kirim = (x) => {
        if (putus) return;
        try {
          port.postMessage(x);
        } catch {
          putus = true;
        }
      };
      port.onMessage.addListener(async (m) => {
        const izin = izinRelai(m);
        if (!izin) {
          kirim({ status: 400, isi: { ok: false, error: { message: "Permintaan ini tidak diteruskan." } }, selesai: true });
          return;
        }
        let asal = "";
        try {
          asal = String((await asalPortal()) || "").replace(/\/+$/, "");
        } catch {
          asal = "";
        }
        if (!asal) {
          kirim({ status: 503, isi: { ok: false, error: { message: "Alamat portal ALETA belum diketahui. Buka portal ALETA sekali di Chrome ini." } }, selesai: true });
          return;
        }
        try {
          const r = await ambil(`${asal}${izin.jalur}`, {
            method: izin.metode,
            credentials: "include",
            cache: "no-store",
            headers: izin.badan ? { "Content-Type": "application/json", Accept: izin.aliran ? "text/event-stream" : "application/json" } : { Accept: "application/json" },
            body: izin.badan,
            signal: kendali ? kendali.signal : undefined,
          });
          if (izin.aliran && r.ok && r.body && typeof r.body.getReader === "function") {
            const pembaca = r.body.getReader();
            const dekoder = new TextDecoder();
            for (;;) {
              const { value, done } = await pembaca.read();
              if (done || putus) break;
              kirim({ potong: dekoder.decode(value, { stream: true }) });
            }
            kirim({ selesai: true, status: r.status });
            return;
          }
          if (izin.aliran && r.ok) {
            kirim({ potong: await r.text() });
            kirim({ selesai: true, status: r.status });
            return;
          }
          let isi = null;
          try {
            isi = await r.json();
          } catch {
            isi = null;
          }
          kirim({ status: r.status, isi, selesai: true });
        } catch {
          kirim({ status: 502, isi: { ok: false, error: { message: "Portal ALETA belum dapat dihubungi dari Chrome ini." } }, selesai: true });
        }
      });
    });
  }

  akar.AletaAiRelai = { NAMA_PORT, izinRelai, pasangRelaiAletaAi };
})(typeof self !== "undefined" ? self : globalThis);
