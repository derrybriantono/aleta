"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - REKOMENDASI PUTUSAN (R, 2 Nov 2026, keputusan Derry 124-125)
 * ============================================================================
 *
 * Kotak "Rekomendasi putusan" di panel Blangko Derry, DI ATAS saran blangko: hasil yang direkomendasikan (dikabulkan / dikabulkan
 * verstek / ditolak / tidak dapat diterima), keyakinan (cukup / ragu), dan alasan ringkas per UNSUR - bukti tertulis mana membuktikan
 * apa (P.1 ...), saksi mana menerangkan apa (keluarga/orang dekat, melihat sendiri atau dari cerita), unsur yang belum terbukti, dasar
 * hukum per unsur. Cerai gugat & cerai talak, itsbat nikah, dispensasi kawin. USULAN UNTUK HAKIM, BUKAN KEPUTUSAN.
 *
 * Aturannya di portal (lib/rekomendasi-putusan.ts, POST aleta-ecourt/rekomendasi-putusan) - membaca penilaian pembuktian A2 bila ada.
 * Blangko putusan yang cocok ikut dikirim portal (peta blangko yang sama dengan saran sidang) dan ditaruh PALING ATAS di saran blangko
 * (gabungSaran), kecuali majelis sudah memutus (keterangan sidang / SIPP menyebut hasilnya): keputusan majelis tetap di atas, rekomendasi
 * yang berbeda ditampilkan dengan tanda.
 *
 * Tampil sendiri tanpa klik; TIDAK mencetak, menyimpan, atau menulis ke SIPP/ABT.
 *
 * KINERJA (arahan 1 Nov): berkas ini dimuat MALAS (AletaModul "rekomendasi-putusan") hanya untuk perkara cerai/itsbat/DK; satu
 * permintaan per perkara 1,2 detik sesudah bahan terakhir berubah (debounce), sidik bahan sama = tanpa permintaan; hasil disinggahkan
 * per perkara (5 menit, paling banyak 30 perkara); DOM hanya kotak ini yang diganti; rincian unsur dilipat (<details>) supaya ringan.
 *
 * Fungsi murni (jenisBerlaku, kehadiranDari, sidik, htmlIsi, saranBlangko, gabungSaran) diuji tanpa DOM.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/rekomendasi-putusan";
  const TUNDA_MS = 1200;
  const SINGGAH_MS = 5 * 60 * 1000;
  const BATAS_PERKARA = 30;
  const BATAS_UNSUR = 14;

  const teks = (x) => String(x == null ? "" : x);
  const esc = (x) => teks(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** Jenis yang dilayani (sama dengan portal jenisRekomendasi); "" = tidak ada kotak. */
  function jenisBerlaku(jenisPerkara, nomor) {
    const j = teks(jenisPerkara).toLowerCase();
    if (/cerai gugat/.test(j)) return "cerai-gugat";
    if (/cerai talak/.test(j)) return "cerai-talak";
    if (/dispensasi kawin|dispensasi nikah/.test(j)) return "dk";
    if (/itsbat|isbat|istbat|pengesahan perkawinan|pengesahan nikah/.test(j)) return /\/pdt\.g\//i.test(teks(nomor)) ? "itsbat-kontensius" : "itsbat";
    return "";
  }

  /**
   * Kehadiran dari riwayat sidang panel (sandi SIPP dihadiri_oleh: 1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada).
   * Sidang sesudah tanggal putusan (mis. ikrar talak) dan sesudah hari ini tidak dihitung.
   * @param {Array<{tanggal:string, hadir:number|null}>} sidang
   * @param {{amarVerstek?:boolean, tandaVerstek?:boolean, tanggalPutusan?:string}|null} putusanSipp
   */
  function kehadiranDari(sidang, putusanSipp, hariIni) {
    const batas = teks((putusanSipp && putusanSipp.tanggalPutusan) || hariIni || "9999-12-31").slice(0, 10);
    const l = (Array.isArray(sidang) ? sidang : [])
      .filter((x) => x && /^\d{4}-\d{2}-\d{2}/.test(teks(x.tanggal)) && teks(x.tanggal).slice(0, 10) <= batas)
      .sort((a, b) => teks(a.tanggal).localeCompare(teks(b.tanggal)))
      .map((x) => Number(x.hadir) || 0)
      .filter((h) => h >= 1 && h <= 4);
    const tPernahHadir = l.length ? l.some((h) => h === 1 || h === 3) : null;
    const akhir = l.slice(-2);
    const pTidakHadirLagi = l.length >= 3 && akhir.every((h) => h === 3 || h === 4) && l.slice(0, -2).some((h) => h === 1 || h === 2);
    const verstekSipp = putusanSipp ? Boolean(putusanSipp.tandaVerstek === true || putusanSipp.amarVerstek === true) : null;
    return { tPernahHadir, pTidakHadirLagi, verstekSipp };
  }

  /** Sidik FNV-1a 32 bit (sama = tanpa permintaan baru). */
  function sidik(o) {
    const t = JSON.stringify(o == null ? null : o);
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  const WARNA_HASIL = { dikabulkan: "hijau", ditolak: "merah", "tidak-dapat-diterima": "kuning", "": "abu" };
  const STATUS_UNSUR = {
    terbukti: { label: "terbukti", warna: "hijau" },
    belum: { label: "belum terbukti", warna: "kuning" },
    "tidak-terbukti": { label: "tidak terpenuhi", warna: "merah" },
    catatan: { label: "catatan", warna: "abu" },
  };

  function rincianUnsur(u) {
    const b = (u.bukti || []).map((x) => `<li><b>${esc(x.kode || x.kelas)}</b> ${esc(x.kode ? `(${x.kelas}) ` : "")}membuktikan ${esc(x.membuktikan)}</li>`);
    const s = (u.saksi || []).map((x) => {
      const asal = x.sebaliknya ? "menerangkan sebaliknya" : x.langsung ? "melihat/mengetahui sendiri" : "dari cerita orang lain";
      const hub = x.hubungan ? `, ${x.hubungan}` : x.golongan === "lain" ? ", bukan keluarga" : "";
      return `<li><b>${esc(x.label)}</b><span class="bd-catat"> (${esc(asal + hub)})</span>${x.kutipan ? `: “${esc(x.kutipan)}”` : ""}</li>`;
    });
    const c = (u.catatan || []).map((x) => `<li class="bd-catat">${esc(x)}</li>`);
    const d = (u.dasar || []).length ? `<p class="bd-catat bd-rp-dasar">Dasar: ${esc(u.dasar.join("; "))}</p>` : "";
    return b.length || s.length || c.length || d ? `<ul class="bd-rp-rinci">${b.join("")}${s.join("")}${c.join("")}</ul>${d}` : "";
  }

  /**
   * Isi kotak (tanpa pembungkus). Murni.
   * @param {{ada:boolean, rekomendasi:object|null, catatan?:string[], denganPenilaian?:boolean}|null} data
   * @param {{galat?:string, putusSipp?:string}} [o] putusSipp = status putusan yang sudah tercatat/terucap (pembanding)
   */
  function htmlIsi(data, o) {
    const opsi = o || {};
    if (opsi.galat && !data) return `<p class="bd-catat" role="alert">Rekomendasi putusan belum terbaca: ${esc(opsi.galat)}.</p>`;
    if (!data) return `<p class="bd-catat" role="status">Menyusun rekomendasi dari bukti dan keterangan saksi…</p>`;
    const r = data.rekomendasi;
    if (!data.ada || !r) return `<p class="bd-catat">${esc((data.catatan && data.catatan[0]) || "Rekomendasi putusan belum tersedia untuk perkara ini.")}</p>`;
    const kepala =
      `<div class="bd-rp-kepala"><span class="bd-tanda ${WARNA_HASIL[r.hasil] || "abu"} bd-rp-hasil">${esc(r.label)}</span>` +
      (r.hasil ? `<span class="bd-tanda ${r.keyakinan === "cukup" ? "hijau" : "kuning"}" title="${esc(r.sebabRagu && r.sebabRagu.length ? `Ragu: ${r.sebabRagu.join("; ")}` : "Semua unsur pokok terbukti")}">keyakinan ${esc(r.keyakinan)}</span>` : "") +
      `<span class="bd-catat"> ${esc(r.ringkas)}</span></div>`;
    const beda =
      opsi.putusSipp && r.statusSipp && teks(opsi.putusSipp).toLowerCase().indexOf(r.statusSipp.toLowerCase()) < 0
        ? `<p class="bd-peringatan bd-rp-beda" role="note">Majelis sudah memutus <b>${esc(opsi.putusSipp)}</b>; rekomendasi ini berbeda - periksa unsur di bawah.</p>`
        : "";
    const ragu = r.sebabRagu && r.sebabRagu.length ? `<p class="bd-catat bd-rp-ragu">Perlu dicermati: ${esc(r.sebabRagu.join("; "))}.</p>` : "";
    const unsur = (r.unsur || []).slice(0, BATAS_UNSUR);
    const baris = unsur
      .map((u) => {
        const s = STATUS_UNSUR[u.status] || STATUS_UNSUR.catatan;
        const rinci = rincianUnsur(u);
        const isi = `<span class="bd-tanda ${s.warna}">${esc(s.label)}</span> <b>${esc(u.judul)}</b> <span class="bd-rp-ringkas">${esc(u.ringkas)}</span>`;
        return rinci ? `<li class="bd-rp-unsur ${esc(u.status)}"><details><summary>${isi}</summary>${rinci}</details></li>` : `<li class="bd-rp-unsur ${esc(u.status)}">${isi}</li>`;
      })
      .join("");
    const belum = r.belum && r.belum.length ? `<p class="bd-catat"><b>Belum terbukti:</b> ${esc(r.belum.join("; "))}.</p>` : "";
    const blangko = r.blangko && r.blangko[0] ? `<p class="bd-catat bd-rp-blangko">Blangko yang cocok: <b>${esc(teks(r.blangko[0].berkas).replace(/\.rtf$/i, ""))}</b> - ditaruh paling atas di saran blangko.</p>` : "";
    return `${kepala}${beda}${ragu}<ul class="bd-rp-daftar">${baris}</ul>${belum}${blangko}<p class="bd-catat bd-rp-kaki">Usulan dari alat bukti tertulis dan keterangan saksi${data.denganPenilaian ? " (dengan penilaian pembuktian per dalil)" : ""} - bukan putusan; majelis yang menilai.</p>`;
  }

  /** Kelompok menu Derry untuk satu blangko rekomendasi: nama menu, alias, atau nama folder (sama dengan saran portal). */
  function kelompokUntuk(menu, r) {
    const rapi = (s) => (typeof alatKunciKelompok === "function" ? alatKunciKelompok(s) : teks(s).replace(/\s+/g, " ").trim().toLowerCase());
    const calon = new Set([r.menu, ...(Array.isArray(r.alias) ? r.alias : [])].map(rapi).filter(Boolean));
    const folder = teks(r.folder).split("/").pop();
    if (folder) {
      calon.add(rapi(folder));
      calon.add(rapi(folder.replace(/^\d+[a-z]{0,2}\s+/i, "")));
    }
    const k = (Array.isArray(menu) ? menu : []).find((x) => x && calon.has(rapi(x.nama)));
    return k ? k : null;
  }

  /**
   * Saran blangko dari rekomendasi yang tersinggah (bentuk titik sambung saran: { berkas, kelompok, jenis: "put", alasan, utama }).
   * Varian yang tidak ada di kelompok yang sudah termuat dibuang (nama blangko server bisa berbeda).
   */
  function saranBlangko(data, menu) {
    const r = data && data.rekomendasi;
    if (!r || !Array.isArray(r.blangko) || !r.hasil) return [];
    const out = [];
    for (const b of r.blangko) {
      const k = kelompokUntuk(menu, b);
      const berkas = teks(b.berkas).replace(/\.rtf$/i, "").trim();
      if (!berkas) continue;
      if (k && Array.isArray(k.berkas) && !k.berkas.some((x) => teks(x.berkas).replace(/\.rtf$/i, "").trim().toLowerCase() === berkas.toLowerCase())) continue;
      if (out.some((x) => x.berkas === berkas)) continue;
      out.push({
        berkas,
        kelompok: k ? k.nama : "",
        jenis: "put",
        alasan: b.utama ? `rekomendasi dari bukti dan saksi: ${r.label.toLowerCase()}` : teks(b.alasan),
        utama: Boolean(b.utama),
        rekomendasiBukti: true,
        // Varian "(N Saksi)" dipilih panel (sesuaikanSaran) menurut banyaknya saksi pihak pertama.
        saksi: Number(r.jumlahSaksi && r.jumlahSaksi.P) || 0,
      });
    }
    if (out.length && !out.some((x) => x.utama)) out[0].utama = true;
    return out;
  }

  /**
   * Saran blangko gabungan: rekomendasi PALING ATAS (disorot) bila perkara belum diputus; bila majelis sudah memutus (saran lama berasal
   * dari keterangan sidang/SIPP yang menyebut hasilnya), saran lama tetap di atas dan rekomendasi yang berbeda menyusul. Murni.
   */
  function gabungSaran(lama, rek, sudahDiputus) {
    const l = Array.isArray(lama) ? lama : [];
    const r = (Array.isArray(rek) ? rek : []).filter((x) => !l.some((y) => y.jenis === "put" && teks(y.berkas).toLowerCase() === teks(x.berkas).toLowerCase()));
    const sama = (Array.isArray(rek) ? rek : []).filter((x) => l.some((y) => y.jenis === "put" && teks(y.berkas).toLowerCase() === teks(x.berkas).toLowerCase()));
    // Saran lama yang sama dengan rekomendasi ikut bertanda (disorot sebagai rekomendasi).
    const tandai = l.map((y) => (sama.some((x) => teks(x.berkas).toLowerCase() === teks(y.berkas).toLowerCase()) ? { ...y, rekomendasiBukti: true } : y));
    if (!r.length) return tandai;
    if (sudahDiputus) return tandai.concat(r.map((x) => ({ ...x, utama: false })));
    const put = tandai.filter((y) => y.jenis === "put").map((y) => ({ ...y, utama: false }));
    return [...r, ...put, ...tandai.filter((y) => y.jenis !== "put")];
  }

  // ── Keadaan per perkara ────────────────────────────────────────────────────
  const keadaan = new Map(); // nomor -> { data, sampai, sidik, waktu, jalan, galat, o }
  const k0 = (nomor) => {
    let k = keadaan.get(nomor);
    if (!k) {
      k = { data: null, sampai: 0, sidik: "", waktu: 0, jalan: null, galat: "", o: null };
      keadaan.set(nomor, k);
      if (keadaan.size > BATAS_PERKARA) keadaan.delete(keadaan.keys().next().value);
    }
    return k;
  };
  function tersinggah(nomor) {
    const k = keadaan.get(teks(nomor));
    return k && k.data && k.sampai > Date.now() ? k.data : null;
  }

  function gambar(nomor) {
    const el = typeof document !== "undefined" ? document.getElementById("bd-rekput") : null;
    if (!el || !el.isConnected || el.dataset.rpNomor !== nomor) return;
    const k = keadaan.get(nomor);
    const isi = el.querySelector(".bd-rp-isi");
    if (isi) isi.innerHTML = htmlIsi(k ? k.data : null, { galat: k && k.galat, putusSipp: k && k.o ? k.o.putusSipp : "" });
  }

  function minta(nomor) {
    const k = k0(nomor);
    const o = k.o;
    if (!o) return null;
    let bahan = null;
    try {
      bahan = o.bahan ? o.bahan() : null;
    } catch {
      bahan = null;
    }
    const dasar = { nomor, jenis: teks(o.jenisPerkara), jenisId: Number(o.jenisPerkaraId) || 0, lawan: teks(o.sebutan && o.sebutan.P), pelaku: teks(o.sebutan && o.sebutan.T), acuan: teks(o.acuan) };
    const kh = o.kehadiran || {};
    const jalan = o.tes
      ? o.ambil(`${API}?${new URLSearchParams({ ...dasar, jenisId: String(dasar.jenisId || ""), tHadir: kh.tPernahHadir === null || kh.tPernahHadir === undefined ? "" : kh.tPernahHadir ? "1" : "0", verstek: kh.verstekSipp ? "1" : "", pTidakHadirLagi: kh.pTidakHadirLagi ? "1" : "" }).toString()}`, {})
      : o.ambil(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...dasar, ...(bahan || {}), kehadiran: kh }) });
    k.jalan = Promise.resolve(jalan)
      .then((data) => {
        k.data = data;
        k.galat = "";
        k.sampai = Date.now() + SINGGAH_MS;
        gambar(nomor);
        if (typeof o.saatSiap === "function") o.saatSiap(data);
        return data;
      })
      .catch((e) => {
        k.galat = teks((e && e.message) || "server tidak menjawab");
        gambar(nomor);
        return null;
      })
      .finally(() => {
        k.jalan = null;
      });
    return k.jalan;
  }

  /**
   * Dipanggil panel setiap menggambar ringkasan blangko / melapor perubahan bahan. Sidik (bahan + kehadiran) berubah = satu permintaan
   * 1,2 detik kemudian; sama dan masih tersinggah = tanpa permintaan.
   * @param {{nomor:string, jenisPerkara:string, jenisPerkaraId?:number, sebutan:{P:string,T:string}, kehadiran:object, acuan?:string,
   *          putusSipp?:string, tes?:boolean, ambil:(url:string, opsi:object)=>Promise<any>, bahan:()=>object|null, saatSiap?:(data:any)=>void}} o
   */
  function segarkan(o) {
    if (!o || !o.nomor || !jenisBerlaku(o.jenisPerkara, o.nomor)) return;
    const nomor = teks(o.nomor);
    const k = k0(nomor);
    k.o = o;
    let bahan = null;
    try {
      bahan = o.bahan ? o.bahan() : null;
    } catch {
      bahan = null;
    }
    const s = sidik([bahan, o.kehadiran || null, o.jenisPerkara, o.acuan || "", Boolean(o.tes)]);
    if (k.sidik === s && (k.jalan || (k.data && k.sampai > Date.now()))) return;
    k.sidik = s;
    clearTimeout(k.waktu);
    // Belum ada hasil sama sekali: permintaan pertama tanpa menunggu (kotak tampil sendiri saat perkara dibuka).
    k.waktu = setTimeout(() => void minta(nomor), k.data ? TUNDA_MS : 0);
  }

  /** Pembungkus kotak (isi dari singgahan bila ada). */
  function htmlBungkus(nomor, jenisPerkara, putusSipp) {
    if (!jenisBerlaku(jenisPerkara, nomor)) return "";
    const k = keadaan.get(teks(nomor));
    return `<section class="bd-rekput" id="bd-rekput" data-rp-nomor="${esc(nomor)}" aria-label="Rekomendasi putusan"><h4 class="bd-rp-judul">Rekomendasi putusan <span class="bd-catat">menurut alat bukti tertulis dan keterangan saksi</span></h4><div class="bd-rp-isi">${htmlIsi(k ? k.data : null, { galat: k && k.galat, putusSipp })}</div></section>`;
  }

  const api = { API, TUNDA_MS, jenisBerlaku, kehadiranDari, sidik, htmlIsi, htmlBungkus, saranBlangko, gabungSaran, segarkan, tersinggah };
  globalThis.AletaBdRekomendasi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("blangko-derry-rekomendasi.js"); // K11-SELESAI
