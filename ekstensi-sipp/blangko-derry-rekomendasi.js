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
 * 2 Nov sore (butir 7): kotak BAWAAN TERLIPAT - satu baris ringkas "Rekomendasi: Dikabulkan · keyakinan cukup" (chip lembut, warna token);
 * klik membuka rincian lengkap. Buka/tutup diingat per pengguna di PC ini (ingatan lipat bersama panel-alat.js, kunci KUNCI_LIPAT).
 *
 * 2 Nov sore (butir 8) - SATU SUMBER KEBENARAN arah putusan untuk saran blangko:
 *   1. majelis sudah memutus (status SIPP / keterangan sidang menyebut hasilnya) -> arah majelis; rekomendasi menyusul di bawah;
 *   2. belum diputus -> arah REKOMENDASI ini (alat bukti + saksi). Keyakinan cukup: saran putusan lama yang arahnya BERTENTANGAN
 *      (mis. perkiraan "dikabulkan" padahal rekomendasi "ditolak") tidak lagi bertanda disarankan (blangkonya tetap ada di kelompoknya);
 *      keyakinan ragu: semua saran putusan bertanda "ragu", tidak ada yang dipilih otomatis, pilihan lain tetap tampil.
 *   Arah blangko dibaca dari tanda namanya ([Kabul...], [Tolak...], [NO]) - arahBlangko().
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

  /**
   * Arah putusan sebuah blangko putusan menurut tanda di namanya: "[Kabul ...]" -> dikabulkan, "[Tolak ...]" -> ditolak,
   * "[NO]" / "Tidak Dapat Diterima" -> tidak-dapat-diterima; selain itu (Gugur, Cabut, Coret, Damai, Sela, Ikrar ...) "" = bukan arah pokok.
   * "[Sela Kabul]"/"[Sela Tolak]" adalah putusan sela, bukan arah putusan akhir -> "". Murni.
   */
  function arahBlangko(nama) {
    const t = teks(nama);
    if (/\[\s*sela\b/i.test(t)) return "";
    if (/\[\s*no\s*\]|\btidak\s+dapat\s+diterima\b/i.test(t)) return "tidak-dapat-diterima";
    if (/\[\s*tolak/i.test(t)) return "ditolak";
    if (/\[\s*kabul/i.test(t)) return "dikabulkan";
    return "";
  }

  // Butir 7: chip ringkas di baris terlipat (warna lembut dari token tema, lihat blangko-derry.css .bd-rp-chip).
  const KUNCI_LIPAT = "blangkoDerry:rekomendasiPutusan";
  let bukaDiingat = null; // null = belum diubah di halaman ini (pakai ingatan lipat / bawaan terlipat)
  /** Kalimat chip ringkas (murni): "Rekomendasi: Dikabulkan (verstek) · keyakinan cukup". */
  function ringkasChip(data, galat) {
    if (galat && !data) return { teks: "belum terbaca", kelas: "abu" };
    if (!data) return { teks: "menyusun…", kelas: "abu" };
    const r = data.rekomendasi;
    if (!data.ada || !r || !r.hasil) return { teks: "belum dapat direkomendasikan", kelas: "abu" };
    const lain = r.pilihanLain ? ` · pilihan lain ${teks(r.pilihanLain.label)}` : "";
    return { teks: `Rekomendasi: ${teks(r.label)} · keyakinan ${teks(r.keyakinan)}${lain}`, kelas: r.keyakinan === "cukup" ? "cukup" : "ragu" };
  }
  /** Terbuka? Pilihan di halaman ini > ingatan lipat per pengguna (panel-alat.js) > bawaan TERLIPAT. */
  function terbuka() {
    if (bukaDiingat !== null) return bukaDiingat;
    try {
      const v = typeof alatLipatDiingat === "function" ? alatLipatDiingat(KUNCI_LIPAT) : undefined;
      if (typeof v === "boolean") return v;
    } catch {
      /* ingatan lipat tidak ada: bawaan */
    }
    return false;
  }
  /** Dicatat saat petugas membuka/menutup (sebelum peramban membalik <details>). */
  function setelBuka(nilai) {
    bukaDiingat = Boolean(nilai);
    try {
      if (typeof alatSimpanLipat === "function") alatSimpanLipat(KUNCI_LIPAT, bukaDiingat);
    } catch {
      /* hanya untuk halaman ini */
    }
    return bukaDiingat;
  }
  /** Ingatan lipat dibaca asinkron sekali per halaman: kotak yang sudah tergambar dibuka bila petugas dulu membukanya. */
  function pulihkanIngatan() {
    try {
      if (bukaDiingat !== null || typeof alatMuatLipat !== "function" || typeof alatLipatDiingat !== "function") return;
      void Promise.resolve(alatMuatLipat()).then(() => {
        const el = typeof document !== "undefined" ? document.getElementById("bd-rekput") : null;
        const v = terbuka();
        if (el && bukaDiingat === null && el.open !== v) el.open = v;
      });
    } catch {
      /* bawaan terlipat */
    }
  }

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
   * Butir 8: kalimat blangko yang SAMA dengan tanda "disarankan" di daftar Pilih blangko (gabungSaran memakai aturan yang sama). Murni.
   */
  function htmlBlangko(r, opsi) {
    const utama = r.blangko && r.blangko[0] ? teks(r.blangko[0].berkas).replace(/\.rtf$/i, "") : "";
    if (!utama) return "";
    const lain = r.pilihanLain && r.pilihanLain.blangko ? teks(r.pilihanLain.blangko).replace(/\.rtf$/i, "") : "";
    if (opsi && opsi.sudahDiputus) {
      return `<p class="bd-catat bd-rp-blangko">Majelis sudah memutus: saran blangko mengikuti putusan majelis. Blangko menurut rekomendasi ini, <b>${esc(utama)}</b>, ada di bawah saran itu.</p>`;
    }
    if (r.keyakinan !== "cukup") {
      return `<p class="bd-catat bd-rp-blangko">Blangko menurut rekomendasi (ragu): <b>${esc(utama)}</b>${lain ? `; pilihan lain: <b>${esc(lain)}</b>` : ""}. Di daftar Pilih blangko bertanda "disarankan · ragu" dan tidak dipilih otomatis - majelis yang menentukan.</p>`;
    }
    return `<p class="bd-catat bd-rp-blangko">Blangko yang disarankan: <b>${esc(utama)}</b> - sama dengan tanda "disarankan" paling atas di daftar Pilih blangko.</p>`;
  }

  /**
   * Isi kotak (tanpa pembungkus). Murni.
   * @param {{ada:boolean, rekomendasi:object|null, catatan?:string[], denganPenilaian?:boolean}|null} data
   * @param {{galat?:string, putusSipp?:string, sudahDiputus?:boolean}} [o] putusSipp = status putusan yang sudah tercatat/terucap
   *        (pembanding); sudahDiputus = majelis sudah memutus (SIPP atau keterangan sidang) - saran blangko mengikuti majelis
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
    // Keputusan 133 (R1): pilihan kedua yang tegas (mis. DK tanpa kehamilan: Ditolak - ragu, pilihan lain Dikabulkan - ragu).
    const pl = r.pilihanLain;
    const lain = pl
      ? `<p class="bd-rp-lain"><b>Pilihan lain:</b> <span class="bd-tanda ${WARNA_HASIL[pl.hasil] || "abu"}">${esc(pl.label)}</span> <span class="bd-tanda kuning">keyakinan ${esc(pl.keyakinan)}</span> <span class="bd-catat">${esc(pl.alasan)}${pl.blangko ? ` Blangko: <b>${esc(teks(pl.blangko).replace(/\.rtf$/i, ""))}</b> (tepat di bawah blangko utama).` : ""}</span></p>`
      : "";
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
    const blangko = htmlBlangko(r, opsi);
    return `${kepala}${lain}${beda}${ragu}<ul class="bd-rp-daftar">${baris}</ul>${belum}${blangko}<p class="bd-catat bd-rp-kaki">Usulan dari alat bukti tertulis dan keterangan saksi${data.denganPenilaian ? " (dengan penilaian pembuktian per dalil)" : ""} - bukan putusan; majelis yang menilai.</p>`;
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
      const ragu = r.keyakinan !== "cukup";
      out.push({
        berkas,
        kelompok: k ? k.nama : "",
        jenis: "put",
        alasan: b.utama ? `rekomendasi dari bukti dan saksi: ${r.label.toLowerCase()}${ragu ? " (ragu - majelis yang menentukan)" : ""}` : teks(b.alasan),
        utama: Boolean(b.utama),
        rekomendasiBukti: true,
        // Butir 8: keyakinan rekomendasi ikut ke saran blangko (ragu = tanda "disarankan · ragu", tidak dipilih otomatis).
        ragu,
        arah: arahBlangko(berkas) || (b.utama ? teks(r.hasil) : ""),
        // Varian "(N Saksi)" dipilih panel (sesuaikanSaran) menurut banyaknya saksi pihak pertama.
        saksi: Number(r.jumlahSaksi && r.jumlahSaksi.P) || 0,
      });
    }
    if (out.length && !out.some((x) => x.utama)) out[0].utama = true;
    return out;
  }

  /**
   * Saran blangko gabungan - SATU SUMBER KEBENARAN arah putusan (butir 8). Murni.
   *   - majelis sudah memutus (saran lama dari keterangan sidang/SIPP yang menyebut hasilnya): saran lama tetap di atas, rekomendasi
   *     yang berbeda menyusul tanpa tanda utama;
   *   - belum diputus: rekomendasi PALING ATAS (disorot). Keyakinan cukup: saran putusan lama yang arahnya bertentangan dengan arah
   *     rekomendasi (arahBlangko) dibuang dari "Disarankan" - blangkonya tetap dapat dipilih di kelompoknya. Keyakinan ragu: saran lama
   *     dipertahankan tetapi ikut bertanda ragu (tidak ada yang tampil pasti), tanpa tanda utama.
   */
  function gabungSaran(lama, rek, sudahDiputus) {
    const l = Array.isArray(lama) ? lama : [];
    const semuaRek = Array.isArray(rek) ? rek : [];
    const sama = (a, b) => teks(a).toLowerCase() === teks(b).toLowerCase();
    const r = semuaRek.filter((x) => !l.some((y) => y.jenis === "put" && sama(y.berkas, x.berkas)));
    const kembar = semuaRek.filter((x) => l.some((y) => y.jenis === "put" && sama(y.berkas, x.berkas)));
    // Saran lama yang sama dengan rekomendasi ikut bertanda (disorot sebagai rekomendasi) dan membawa keyakinannya - kecuali majelis sudah
    // memutus: putusan majelis yang menentukan, saran itu tidak ikut "ragu".
    const tandai = l.map((y) => {
      const x = kembar.find((z) => sama(z.berkas, y.berkas));
      return x ? { ...y, rekomendasiBukti: true, ...(!sudahDiputus && x.ragu !== undefined ? { ragu: x.ragu } : {}), ...(x.arah ? { arah: x.arah } : {}) } : y;
    });
    if (!semuaRek.length) return tandai;
    if (sudahDiputus) return tandai.concat(r.map((x) => ({ ...x, utama: false })));
    const ragu = semuaRek.some((x) => x.ragu === true);
    const arahRek = new Set(semuaRek.map((x) => teks(x.arah) || arahBlangko(x.berkas)).filter(Boolean));
    const put = [];
    for (const y of tandai.filter((z) => z.jenis === "put")) {
      const arah = arahBlangko(y.berkas);
      const bertentangan = !y.rekomendasiBukti && Boolean(arah) && arahRek.size > 0 && !arahRek.has(arah);
      if (bertentangan && !ragu) continue; // keyakinan cukup: arah lain tidak lagi "disarankan"
      put.push({ ...y, utama: false, ...(ragu ? { ragu: true } : {}) });
    }
    // Blangko rekomendasi yang sudah ada di saran lama (kembar) naik ke depan; tanpa blangko baru, yang terdepan menjadi utama.
    put.sort((a, b) => Number(Boolean(b.rekomendasiBukti)) - Number(Boolean(a.rekomendasiBukti)));
    if (!r.length && put.length) put[0] = { ...put[0], utama: true };
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
    if (isi) isi.innerHTML = htmlIsi(k ? k.data : null, { galat: k && k.galat, putusSipp: k && k.o ? k.o.putusSipp : "", sudahDiputus: Boolean(k && k.o && k.o.sudahDiputus) });
    const chip = el.querySelector(".bd-rp-chip");
    if (chip) {
      const c = ringkasChip(k ? k.data : null, k && k.galat);
      chip.textContent = c.teks;
      chip.className = `bd-rp-chip ${c.kelas}`;
    }
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
   *          putusSipp?:string, sudahDiputus?:boolean, tes?:boolean, ambil:(url:string, opsi:object)=>Promise<any>, bahan:()=>object|null, saatSiap?:(data:any)=>void}} o
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

  /**
   * Pembungkus kotak (isi dari singgahan bila ada). Butir 7: <details> BAWAAN TERLIPAT; ringkasan satu baris memuat chip hasil.
   * Rincian tetap digambar (ringan, dan gambar() memperbaruinya) - hanya tersembunyi selama terlipat.
   */
  function htmlBungkus(nomor, jenisPerkara, putusSipp, sudahDiputus) {
    if (!jenisBerlaku(jenisPerkara, nomor)) return "";
    const k = keadaan.get(teks(nomor));
    const buka = terbuka();
    if (bukaDiingat === null) pulihkanIngatan();
    const c = ringkasChip(k ? k.data : null, k && k.galat);
    return (
      `<details class="bd-rekput" id="bd-rekput" data-rp-nomor="${esc(nomor)}" aria-label="Rekomendasi putusan"${buka ? " open" : ""}>` +
      `<summary class="bd-rp-judul" data-bd2="lipatrekput" title="Buka atau lipat rincian rekomendasi putusan">Rekomendasi putusan <span class="bd-rp-chip ${c.kelas}">${esc(c.teks)}</span><span class="bd-catat bd-rp-sub"> menurut alat bukti tertulis dan keterangan saksi</span></summary>` +
      `<div class="bd-rp-isi">${htmlIsi(k ? k.data : null, { galat: k && k.galat, putusSipp, sudahDiputus: Boolean(sudahDiputus) })}</div></details>`
    );
  }

  const api = { API, TUNDA_MS, KUNCI_LIPAT, jenisBerlaku, kehadiranDari, sidik, htmlIsi, htmlBungkus, saranBlangko, gabungSaran, segarkan, tersinggah, arahBlangko, ringkasChip, terbuka, setelBuka };
  globalThis.AletaBdRekomendasi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("blangko-derry-rekomendasi.js"); // K11-SELESAI
