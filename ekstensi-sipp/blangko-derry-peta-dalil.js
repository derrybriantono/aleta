"use strict";

/**
 * ============================================================================
 * BLANGKO ABT BY DERRY BRIANTONO - PETA DALIL (P2, 1 Nov 2026)
 * ============================================================================
 *
 * Tampilan ringkas matriks dalil satu sumber (portal GET aleta-ecourt/matriks-dalil): tiap dalil gugatan (dan gugatan rekonvensi,
 * jawaban) berhadapan dengan tanggapan pihak lawan - diakui / dibantah / diakui sebagian / tidak ditanggapi. Matriks disusun
 * SEKALI di server dan disimpan per perkara; di sini hanya dibaca dan digambar.
 *
 * KINERJA (arahan 1 Nov): bagian ini DILIPAT bawaan dan tidak membaca apa pun sampai dibuka; hasilnya disinggahkan per perkara
 * (5 menit) sehingga menggambar ulang panel tidak membaca ulang; tabel paling banyak 40 baris sebelum "tampilkan semua"; tanpa
 * pemantauan berkala (satu kali baca ulang 8 detik kemudian bila server masih menyusun dalil dari berkas baru).
 *
 * Fungsi murni (htmlPeta, ringkasPeta, lencanaDalil, labelStatus) diuji tanpa DOM; `pasang` satu-satunya yang menyentuh DOM.
 * Tidak ada yang ditulis ke ABT/SIPP/e-Court.
 */
(function () {
  const API = "/aleta/api/aleta-ecourt/matriks-dalil";
  const SINGGAH_MS = 5 * 60 * 1000;
  const BATAS_BARIS = 40;
  const singgah = new Map(); // kunci perkara -> { sampai, data }
  const terbuka = new Set(); // kunci perkara yang bagiannya dibuka petugas (bertahan saat panel digambar ulang)
  const sedang = new Map(); // kunci perkara -> Promise

  const teks = (x) => String(x == null ? "" : x);
  const esc = (x) => teks(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const STATUS = {
    diakui: { label: "diakui", warna: "hijau" },
    dibantah: { label: "dibantah", warna: "merah" },
    "diakui-sebagian": { label: "diakui sebagian", warna: "kuning" },
    "tidak-jelas": { label: "ditanggapi, sikap tidak jelas", warna: "kuning" },
    "tidak-ditanggapi": { label: "tidak ditanggapi", warna: "abu" },
    "belum-dijawab": { label: "belum ada jawaban tertulis", warna: "abu" },
  };
  const CARA = {
    rujukan: "menyebut nomor dalil ini",
    "rujukan-induk": "menyebut nomor butir induknya",
    kemiripan: "isinya mirip dengan dalil ini",
    umum: "bantahan/pengakuan umum atas semua dalil",
    "umum-petitum": "hanya petitum yang meminta gugatan ditolak",
  };

  function namaSumber(s, sb) {
    const lawan = teks(sb && sb.P) || "Penggugat";
    if (s === "gugatan") return /pemohon/i.test(lawan) ? "Permohonan" : "Gugatan";
    if (s === "rekonvensi") return "Gugatan rekonvensi";
    return { jawaban: "Jawaban", replik: "Replik", duplik: "Duplik", kesimpulan: "Kesimpulan" }[s] || s;
  }

  /** Label status tanggapan untuk pengguna (tanpa istilah teknis). */
  function labelStatus(t) {
    if (!t) return "";
    const s = STATUS[t.status] || { label: teks(t.status) };
    return `${s.label}${t.ragu ? " - periksa" : ""}`;
  }

  /** Dalil yang ditampilkan (yang dapat ditanggapi lawan): posita & alasan hukum gugatan, gugatan rekonvensi, jawaban. */
  function dalilTampil(data) {
    const d = data && Array.isArray(data.dalil) ? data.dalil : [];
    return d.filter((x) => x && x.jenis !== "petitum" && x.tanggapan && ["gugatan", "rekonvensi", "jawaban", "replik"].includes(x.sumber));
  }

  /** Satu kalimat ringkasan: "12 dalil permohonan · 5 diakui · 4 dibantah · 3 tidak ditanggapi · 2 perlu diperiksa". */
  function ringkasPeta(data, sb) {
    if (!data || !data.ada) return data && data.basi ? "sedang disusun dari berkas perkara" : "belum ada dalil yang terbaca";
    const pokok = dalilTampil(data).filter((x) => x.sumber === "gugatan");
    const hit = {};
    for (const x of pokok) hit[x.tanggapan.status] = (hit[x.tanggapan.status] || 0) + 1;
    const ragu = pokok.filter((x) => x.tanggapan.ragu).length;
    const bagian = [`${pokok.length} dalil ${namaSumber("gugatan", sb).toLowerCase()}`];
    for (const k of ["diakui", "dibantah", "diakui-sebagian", "tidak-jelas", "tidak-ditanggapi", "belum-dijawab"]) if (hit[k]) bagian.push(`${hit[k]} ${STATUS[k].label}`);
    if (ragu) bagian.push(`${ragu} perlu diperiksa`);
    return bagian.join(" · ");
  }

  function barisDalil(x, sb) {
    const t = x.tanggapan;
    const st = STATUS[t.status] || { label: t.status, warna: "abu" };
    const r = (t.rincian || [])[0];
    const asal = r ? `${namaSumber(r.sumber, sb)}${r.nomor ? ` angka ${r.nomor}` : ""} (${CARA[r.cara] || r.cara})` : t.catatan || "";
    const kutip = r && r.kutipan ? `${asal}: "${r.kutipan}"` : asal;
    const huruf = (x.huruf || []).length ? ` <span class="bd-catat">huruf ${esc(x.huruf.join(", "))}</span>` : "";
    // Keputusan 116 (2 Nov): tanda syarat dari penilaian pembuktian ("belum memenuhi 12 bulan" - SEMA 1/2022), catatan saja
    const pb = x.pembuktian && Array.isArray(x.pembuktian.tanda) ? x.pembuktian.tanda : [];
    const tanda = pb.map((s) => ` <span class="bd-tanda kuning" title="${esc(`${s}: SEMA Nomor 1 Tahun 2022 Kamar Agama angka 1 huruf b poin 1 (tidak dinafkahi minimal 12 bulan). Catatan saja, penilaiannya pada majelis.`)}">${esc(s)}</span>`).join("");
    return (
      `<tr><td class="bd-pd-no">${esc(x.nomor || "")}</td>` +
      `<td><span title="${esc(x.teks)}">${esc(x.ringkas || x.teks)}</span>${huruf}${tanda}</td>` +
      `<td><span class="bd-tanda ${st.warna}"${kutip ? ` title="${esc(kutip)}"` : ""}>${esc(st.label)}</span>${t.ragu ? ` <span class="bd-catat">periksa</span>` : ""}</td></tr>`
    );
  }

  /**
   * HTML isi bagian Peta dalil (tanpa pembungkus details). semua=true menampilkan seluruh baris.
   * @param {{ada:boolean, dalil:Array, basi?:boolean, catatan?:string[], sumber?:string}} data
   * @param {{P:string, T:string}} sb sebutan pihak
   */
  function htmlPeta(data, sb, semua) {
    if (!data) return `<p class="bd-catat" role="status">Membaca dalil para pihak…</p>`;
    if (!data.ada) return `<p class="bd-catat">${esc(data.basi ? "Dalil sedang disusun dari berkas perkara; bagian ini diperbarui sendiri." : (data.catatan && data.catatan[0]) || "Belum ada dalil yang terbaca dari berkas perkara.")}</p>`;
    const daftar = dalilTampil(data);
    const kelompok = ["gugatan", "rekonvensi", "jawaban", "replik"].map((s) => ({ s, d: daftar.filter((x) => x.sumber === s) })).filter((k) => k.d.length);
    let sisa = semua ? Infinity : BATAS_BARIS;
    let tersembunyi = 0;
    const bagian = kelompok.map((k) => {
      const tampil = k.d.slice(0, Math.max(0, sisa));
      sisa -= tampil.length;
      tersembunyi += k.d.length - tampil.length;
      if (!tampil.length) return "";
      const penanggap = k.s === "gugatan" ? sb.T : k.s === "rekonvensi" ? sb.P : k.s === "jawaban" ? sb.P : sb.T;
      return (
        `<table class="bd-pd-tabel"><caption>${esc(namaSumber(k.s, sb))} ${esc(k.s === "jawaban" || k.s === "rekonvensi" ? sb.T : k.s === "replik" ? sb.P : sb.P)}</caption>` +
        `<thead><tr><th scope="col">No.</th><th scope="col">Dalil</th><th scope="col">Tanggapan ${esc(penanggap)}</th></tr></thead>` +
        `<tbody>${tampil.map((x) => barisDalil(x, sb)).join("")}</tbody></table>`
      );
    });
    const asal = data.sumber === "sipp" ? "Dalil gugatan dari posita SIPP." : "Dalil dari berkas e-Court.";
    return (
      `<p class="bd-catat">${esc(asal)} Arahkan penunjuk ke dalil atau tanggapan untuk melihat teks lengkapnya. Tanggapan dicocokkan dengan aturan (nomor dalil yang disebut, isi yang mirip, bantahan umum); yang bertanda "periksa" belum pasti.${data.basi ? " Berkas baru sedang dibaca; bagian ini diperbarui sendiri." : ""}</p>` +
      bagian.join("") +
      (tersembunyi ? `<button type="button" class="bd-btn kecil" data-pd="semua">Tampilkan ${tersembunyi} dalil lainnya</button>` : "")
    );
  }

  const KATA_UMUM = new Set(
    "bahwa yang dengan tersebut adalah karena telah tidak akan untuk dalam pada dari oleh sebagai atau juga sudah belum bukan hanya kepada terhadap antara serta para pihak penggugat tergugat pemohon termohon saksi tahu mengetahui melihat mendengar sendiri sering selalu".split(" ")
  );
  function kataIsi(t) {
    const h = new Set();
    for (const w of teks(t).toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ")) if (w.length >= 4 && !KATA_UMUM.has(w) && !/^\d+$/.test(w)) h.add(w);
    return h;
  }

  /**
   * Lencana asal untuk keterangan saksi / kalimat lain: dalil mana yang paling mirip ("dari gugatan" / "dari jawaban"). "" bila tidak
   * ada yang cukup mirip (>= 3 kata isi bersama, tumpang >= 0,6). Dipakai penyusun keterangan saksi (keputusan 61-62).
   */
  const ingatLencana = new WeakMap(); // data -> Map(kalimat -> hasil): dipanggil tiap ketikan, dihitung sekali per kalimat
  function lencanaDalil(kalimat, data) {
    if (!data || typeof data !== "object") return null;
    let ingat = ingatLencana.get(data);
    if (!ingat) ingatLencana.set(data, (ingat = new Map()));
    const kunci = teks(kalimat);
    if (ingat.has(kunci)) return ingat.get(kunci);
    const h = hitungLencana(kunci, data);
    if (ingat.size > 400) ingat.clear();
    ingat.set(kunci, h);
    return h;
  }
  function hitungLencana(kalimat, data) {
    const d = data && Array.isArray(data.dalil) ? data.dalil.filter((x) => x && x.jenis !== "petitum") : [];
    const k = kataIsi(kalimat);
    if (k.size < 3 || !d.length) return null;
    let terbaik = null;
    for (const x of d) {
      const kx = x._kata || (x._kata = kataIsi(x.teks));
      let sama = 0;
      for (const w of k) if (kx.has(w)) sama += 1;
      const skor = sama / Math.min(k.size, kx.size || 1);
      if (sama >= 3 && skor >= 0.6 && (!terbaik || skor > terbaik.skor)) terbaik = { x, skor };
    }
    if (!terbaik) return null;
    const s = terbaik.x.sumber;
    const label = s === "gugatan" ? "dari gugatan" : s === "rekonvensi" ? "dari gugatan rekonvensi" : s === "jawaban" || s === "duplik" ? "dari jawaban" : s === "replik" ? "dari replik" : `dari ${s}`;
    return { label, id: terbaik.x.id, sumber: s, nomor: terbaik.x.nomor, skor: Math.round(terbaik.skor * 100) / 100 };
  }

  const kunciPerkara = (nomor, sb) => `${teks(nomor)}|${teks(sb && sb.P)}|${teks(sb && sb.T)}`;

  /** Data tersinggah untuk perkara ini (tanpa jaringan) - dipakai penyusun saksi yang hanya memberi lencana bila sudah terbaca. */
  function tersinggah(nomor, sb) {
    const s = singgah.get(kunciPerkara(nomor, sb));
    return s && s.sampai > Date.now() ? s.data : null;
  }

  /** Baca matriks perkara (singgahan 5 menit; satu permintaan bersama bila dipanggil berbarengan). */
  function muat(nomor, sb, ambil, paksa) {
    const kunci = kunciPerkara(nomor, sb);
    const s = singgah.get(kunci);
    if (!paksa && s && s.sampai > Date.now()) return Promise.resolve(s.data);
    if (sedang.has(kunci)) return sedang.get(kunci);
    const q = new URLSearchParams({ nomor: teks(nomor), lawan: teks(sb && sb.P) || "Penggugat", pelaku: teks(sb && sb.T) || "Tergugat" });
    const janji = Promise.resolve(ambil(`${API}?${q.toString()}`))
      .then((data) => {
        singgah.set(kunci, { sampai: Date.now() + (data && data.basi ? 15_000 : SINGGAH_MS), data });
        if (singgah.size > 40) singgah.delete(singgah.keys().next().value);
        return data;
      })
      .finally(() => sedang.delete(kunci));
    sedang.set(kunci, janji);
    return janji;
  }

  /** Pembungkus details (dilipat bawaan; dibuka lagi bila petugas sebelumnya membukanya untuk perkara yang sama). */
  function htmlBungkus(nomor, sb) {
    const kunci = kunciPerkara(nomor, sb);
    const buka = terbuka.has(kunci);
    const data = tersinggah(nomor, sb);
    return (
      `<details class="bd-tambahan bd-petadalil" id="bd-petadalil"${buka ? " open" : ""}><summary>Peta dalil<span class="bd-catat"> · ${esc(data ? ringkasPeta(data, sb) : "dalil para pihak dan tanggapan lawan")}</span></summary>` +
      `<div class="bd-pd-isi">${buka ? htmlPeta(data, sb, false) : ""}</div></details>`
    );
  }

  /**
   * Menghidupkan bagian Peta dalil yang sudah digambar (htmlBungkus). Membaca server HANYA saat dibuka.
   * @param {HTMLDetailsElement} el
   * @param {{nomor:string, sebutan:{P:string,T:string}, ambil:(url:string)=>Promise<any>}} o
   */
  function pasang(el, o) {
    if (!el || el.dataset.pdPasang === "1") return;
    el.dataset.pdPasang = "1";
    const kunci = kunciPerkara(o.nomor, o.sebutan);
    const isi = el.querySelector(".bd-pd-isi");
    const ringkas = el.querySelector("summary .bd-catat");
    let semua = false;
    let ulangTerjadwal = false;
    const gambar = (data) => {
      if (!el.isConnected) return;
      if (isi) isi.innerHTML = htmlPeta(data, o.sebutan, semua);
      if (ringkas && data) ringkas.textContent = ` · ${ringkasPeta(data, o.sebutan)}`;
    };
    const baca = (paksa) => {
      gambar(tersinggah(o.nomor, o.sebutan));
      muat(o.nomor, o.sebutan, o.ambil, paksa)
        .then((data) => {
          gambar(data);
          if (data && data.basi && !ulangTerjadwal) {
            ulangTerjadwal = true;
            setTimeout(() => el.open && baca(true), 8000);
          }
        })
        .catch((e) => {
          if (isi && el.isConnected) isi.innerHTML = `<p class="bd-catat" role="alert">Peta dalil belum terbaca: ${esc((e && e.message) || "server tidak menjawab")}.</p>`;
        });
    };
    el.addEventListener("toggle", () => {
      if (el.open) {
        terbuka.add(kunci);
        baca(false);
      } else terbuka.delete(kunci);
    });
    el.addEventListener("click", (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-pd="semua"]') : null;
      if (!t) return;
      semua = true;
      gambar(tersinggah(o.nomor, o.sebutan));
    });
    if (el.open) baca(false);
  }

  const api = { htmlPeta, htmlBungkus, ringkasPeta, labelStatus, lencanaDalil, dalilTampil, pasang, muat, tersinggah, API, BATAS_BARIS };
  globalThis.AletaBdPetaDalil = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
