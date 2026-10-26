/*
 * Jalur cepat widget ke portal (K7, 25 Okt 2026).
 *
 * Halaman SIPP dan ABT dilayani di http://192.168.10.10 (port 80), sama dengan ALETA.
 * Peramban hanya membuka 6 sambungan per host:port, jadi pemanggilan widget ke
 * /aleta/api/... antre di belakang SIPP/ABT sendiri (antrean 26-56 dtk pernah terukur).
 * ALETA juga dilayani di port 8008 (deploy/apache/aleta-8008.conf) dengan 6 sambungan
 * sendiri. Berkas ini mengalihkan permintaan BACA (GET/HEAD) ke /aleta/api/ dari skrip
 * konten di halaman SIPP/ABT ke port 8008 BILA port itu terbukti dapat dipakai.
 *
 * Aturan:
 *   - hanya fetch bergaya "/aleta/api/..." (string relatif) dengan cara GET atau HEAD;
 *     tulisan (POST/PUT/...) dan semua yang lain TETAP di port 80;
 *   - hanya di halaman http pada host satker (192.168.10.10), port 80, bukan di halaman
 *     ALETA sendiri;
 *   - 8008 "terbukti" bila satu GET ke 8008/aleta/api/install dari halaman ini - dengan asal
 *     halaman ini dan kuki - dijawab 200. Bila port belum dibuka, atau portal belum
 *     membolehkan asal ini (ALETA_CORS_ASAL_WIDGET), peramban menolak dan semuanya
 *     TETAP di port 80, tanpa galat yang terlihat;
 *   - bukti diingat di sessionStorage tab ini: hidup 5 menit, mati 2 menit, lalu diuji ulang;
 *   - permintaan pertama (sebelum terbukti) tetap ke port 80, tidak menunggu uji;
 *   - bila permintaan ke 8008 gagal jaringan atau dijawab 404/502/503/504, permintaan yang
 *     SAMA diulang ke port 80 (aman: hanya baca) dan 8008 dianggap mati 2 menit;
 *   - dibatalkan (AbortError) diteruskan apa adanya.
 *
 * Tidak menyentuh kuki atau SameSite: port tidak membedakan situs, jadi kuki sesi yang sama
 * ikut terkirim (credentials: "include").
 */
(function (akar) {
  "use strict";

  if (akar.AletaJalurPortal) return;

  const PORT_CEPAT = "8008";
  const HOST_SATKER = "192.168.10.10";
  const AWALAN = "/aleta/api/";
  const KUNCI = "aleta-jalur-cepat";
  const INGAT_HIDUP_MS = 5 * 60 * 1000;
  const INGAT_MATI_MS = 2 * 60 * 1000;
  const BATAS_UJI_MS = 2500;
  const STATUS_ULANG = new Set([404, 502, 503, 504]);

  const lokasi = akar.location;
  const fetchAsli = typeof akar.fetch === "function" ? akar.fetch.bind(akar) : null;

  /** Halaman ini layak memakai jalur cepat? (host satker, http, port 80, bukan halaman ALETA). */
  function layak(l) {
    try {
      const x = l || lokasi;
      if (!x || x.protocol !== "http:" || x.hostname !== HOST_SATKER) return false;
      if (x.port && x.port !== "80") return false;
      if (x.pathname === "/aleta" || x.pathname.startsWith("/aleta/")) return false;
      return true;
    } catch {
      return false;
    }
  }

  const asalCepat = () => `http://${HOST_SATKER}:${PORT_CEPAT}`;

  let ingatan = null; // { hidup: boolean, sampai: ms }
  let sedangUji = null;

  function bacaIngatan(kini) {
    if (ingatan && ingatan.sampai > kini) return ingatan;
    try {
      const mentah = akar.sessionStorage && akar.sessionStorage.getItem(KUNCI);
      if (mentah) {
        const x = JSON.parse(mentah);
        if (x && typeof x.hidup === "boolean" && Number(x.sampai) > kini) {
          ingatan = { hidup: x.hidup, sampai: Number(x.sampai) };
          return ingatan;
        }
      }
    } catch {
      /* sessionStorage tidak terbaca: diuji ulang */
    }
    return null;
  }

  function tulisIngatan(hidup) {
    ingatan = { hidup, sampai: Date.now() + (hidup ? INGAT_HIDUP_MS : INGAT_MATI_MS) };
    try {
      if (akar.sessionStorage) akar.sessionStorage.setItem(KUNCI, JSON.stringify(ingatan));
    } catch {
      /* tidak diingat di tab ini: tetap di memori */
    }
  }

  /** Satu GET ringan ke 8008 dengan asal dan kuki halaman ini; benar bila dijawab 200. */
  async function uji() {
    if (!fetchAsli) return false;
    const pengendali = typeof AbortController === "function" ? new AbortController() : null;
    const tunda = pengendali ? setTimeout(() => pengendali.abort(), BATAS_UJI_MS) : null;
    try {
      const r = await fetchAsli(`${asalCepat()}${AWALAN}install`, {
        method: "GET",
        mode: "cors",
        credentials: "include",
        cache: "no-store",
        ...(pengendali ? { signal: pengendali.signal } : {}),
      });
      return Boolean(r && r.ok);
    } catch {
      return false;
    } finally {
      if (tunda) clearTimeout(tunda);
    }
  }

  function mulaiUji() {
    if (sedangUji) return sedangUji;
    sedangUji = uji()
      .then((hidup) => {
        tulisIngatan(hidup);
        return hidup;
      })
      .finally(() => {
        sedangUji = null;
      });
    return sedangUji;
  }

  function metodeBaca(init) {
    const m = String((init && init.method) || "GET").toUpperCase();
    return m === "GET" || m === "HEAD";
  }

  /** fetch yang dibungkus; semua yang bukan sasaran lewat apa adanya. */
  function pembungkus(masukan, init) {
    const sebelumnya = fetchAsli;
    try {
      if (typeof masukan !== "string" || !masukan.startsWith(AWALAN) || !metodeBaca(init)) {
        return sebelumnya.apply(akar, arguments);
      }
      const ingat = bacaIngatan(Date.now());
      if (!ingat) {
        // Belum terbukti: uji di latar, permintaan ini tetap ke port 80.
        void mulaiUji();
        return sebelumnya.apply(akar, arguments);
      }
      if (!ingat.hidup) return sebelumnya.apply(akar, arguments);
      const opsi = { ...(init || {}), credentials: "include", mode: "cors" };
      return sebelumnya(`${asalCepat()}${masukan}`, opsi).then(
        (r) => {
          if (r && STATUS_ULANG.has(r.status)) {
            tulisIngatan(false);
            return sebelumnya(masukan, init);
          }
          return r;
        },
        (galat) => {
          if (galat && galat.name === "AbortError") throw galat;
          tulisIngatan(false);
          return sebelumnya(masukan, init);
        }
      );
    } catch {
      return sebelumnya.apply(akar, arguments);
    }
  }

  function pasang() {
    if (!fetchAsli || !layak() || akar.fetch.__aletaJalurCepat) return false;
    pembungkus.__aletaJalurCepat = true;
    akar.fetch = pembungkus;
    return true;
  }

  akar.AletaJalurPortal = {
    PORT_CEPAT,
    HOST_SATKER,
    AWALAN,
    KUNCI,
    layak,
    pasang,
    uji,
    keadaan: () => bacaIngatan(Date.now()),
  };
  pasang();
})(typeof globalThis !== "undefined" ? globalThis : self);
