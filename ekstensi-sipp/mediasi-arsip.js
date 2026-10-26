"use strict";

/**
 * ============================================================================
 * UNGGAH HASIL MEDIASI - ARSIP PER PERKARA DI TAB MEDIASI SIPP (21 Okt 2026)
 * ============================================================================
 *
 * SIPP tidak punya tempat unggah dokumen hasil mediasi (tab Mediasi hanya mencetak Laporan Mediator
 * dan Pernyataan Para Pihak dari template; kolom e-Doc terdekat, isi_akta_perdamaian_dok, adalah Akta
 * Perdamaian). Atas persetujuan pengguna dokumennya disimpan di ARSIP perkara itu (portal), bukan di SIPP.
 *
 * Yang tampil di tab Mediasi, tepat di bawah "Edit Hasil Mediasi":
 *   - tombol "Unggah hasil mediasi": PDF, RTF, DOC, DOCX (seret atau pilih). Yang bukan PDF diubah ke
 *     PDF oleh server; berkas asli DAN PDF-nya disimpan. Selalu ada langkah konfirmasi sebelum unggah;
 *     berkas yang sama persis tidak diunggah dua kali (dicegah server dan tombol dikunci selama jalan);
 *   - daftar berkas perkara itu: Lihat (pratinjau), Unduh, Ganti (konfirmasi tegas, versi baru) dan
 *     Hapus (konfirmasi; hanya pengunggah atau Admin - ditegakkan server, jejak tersimpan).
 *
 * HASIL "Berhasil Dengan Akta Perdamaian" (Y1): di dialog unggah ada pilihan TERPISAH "kirim juga ke e-Doc
 * Akta Perdamaian SIPP". Kirimannya memakai jalur unggah SIPP sendiri (fileupload/<mediasi>/mediasi ->
 * fileupload_c/validatePost) atas akun SIPP yang sedang masuk di peramban ini - SIPP yang mencatat dan
 * menegakkan haknya. Tidak pernah menimpa tanpa konfirmasi tegas: berkas lama di SIPP disebut namanya dulu.
 * Catatan telaah SIPP: rute fileupload/.../mediasi menganggap id pertama adalah mediasi_id (bukan perkara_id),
 * dan tidak ada tombol SIPP yang memakainya - maka alamatnya diisi enc mediasi di KEDUA ruas, persis seperti
 * yang dibaca controller (fileupload_c: group2 menyalin enc ke enc1).
 *
 * Hak: ditegakkan server (matriks peran mediasi.arsip-*: mediator, hakim, pimpinan, panitera, panmud, PP;
 * Admin/Super Admin). Peran lain mendapat 403 dan tidak melihat apa pun di tab ini.
 *
 * Tidak satu pun kata/atribut bernama aleta ditulis ke SIPP (nama berkas yang dikirim "hasil-mediasi.pdf";
 * hanya elemen lokal berkelas aleta-sisip di DOM peramban yang diabaikan pengamat konten.js).
 */
(function mediasiArsipModul() {
  if (typeof globalThis === "undefined" || typeof document === "undefined" || globalThis.aletaMediasiArsip) return;

  const API = {
    dasar: "/aleta/api/aleta-ecourt/mediasi-arsip",
    berkas: "/aleta/api/aleta-ecourt/mediasi-arsip/berkas",
    jejak: "/aleta/api/aleta-ecourt/mediasi-arsip/jejak",
  };
  const BATAS_BAJT = 20 * 1024 * 1024;
  const AKHIRAN_SAH = ["pdf", "rtf", "doc", "docx"];
  const KUNCI_TEMA = "temaPanel";
  const ID_DIALOG = "aleta-mediasi-dialog";
  const POLA_EDIT = /popup_form\(\s*['"]([^'"]*?)\/edit_hasil_mediasi\/([^/'"]+)\/([^/'"]+)\/([^/'"]+)\/([^/'"]+)['"]\s*\)/;

  const sebaris = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const fungsi = (nama) => (typeof globalThis[nama] === "function" ? globalThis[nama] : null);
  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks != null) e.textContent = teks;
    return e;
  }
  function tombol(teks, kelas, judul) {
    const b = el("button", kelas, teks);
    b.type = "button";
    if (judul) b.title = judul;
    return b;
  }
  const ukuranTeks = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const akhiranNama = (nama) => (/\.([A-Za-z0-9]{2,5})$/.exec(String(nama || "")) || [, ""])[1].toLowerCase();

  function halamanSipp() {
    const p = String((location && location.pathname) || "");
    return !/\/aps_badilag\//i.test(p) && !/^\/aleta(?:\/|$)/i.test(p);
  }

  // --------------------------------------------------------------------------
  // Murni: pembacaan tautan Edit dan hasil mediasi dari tabel SIPP
  // --------------------------------------------------------------------------
  /** { dasar, enc, encMediasi, encMed, urutan } dari atribut onclick tautan "Edit Hasil Mediasi"; null bila bukan. */
  function bacaTautanEdit(onclick) {
    const m = POLA_EDIT.exec(String(onclick || ""));
    if (!m) return null;
    return { dasar: m[1], enc: m[2], encMediasi: m[3], encMed: m[4], urutan: Number(m[5]) || 0 };
  }

  /** Teks hasil mediasi pada baris-baris tabel SIPP sesudah baris `tr` (sampai pembatas bagian berikutnya). */
  function hasilMediasiDari(tr) {
    let b = tr ? tr.nextElementSibling : null;
    let n = 0;
    while (b && n < 40) {
      if (b.querySelector && b.querySelector("td.divider")) break;
      const sel = b.querySelector ? b.querySelector("td") : null;
      if (sel && /^\s*hasil\s+mediasi\s*$/i.test(sel.textContent || "")) {
        const tebal = b.querySelector("b");
        return sebaris(tebal ? tebal.textContent : "");
      }
      b = b.nextElementSibling;
      n += 1;
    }
    return "";
  }
  const hasilBerhasilAkta = (teks) => /berhasil\s+dengan\s+akta\s+perdamaian/i.test(String(teks || ""));

  function nomorHalaman(doc) {
    const l1 = globalThis.aletaSippIdeL1;
    try {
      const n = l1 && l1.murni && typeof l1.murni.nomorHalamanDetil === "function" ? l1.murni.nomorHalamanDetil(doc || document) : "";
      if (n) return n;
    } catch {
      /* jatuh ke konten.js */
    }
    try {
      return typeof cariNomorPerkara === "function" ? String(cariNomorPerkara() || "") : "";
    } catch {
      return "";
    }
  }

  async function bitaDari(blob) {
    if (blob && typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
    return await new Promise((selesaiBaca, gagal) => {
      const pembaca = new FileReader();
      pembaca.onload = () => selesaiBaca(new Uint8Array(pembaca.result));
      pembaca.onerror = () => gagal(pembaca.error || new Error("berkas tidak terbaca"));
      pembaca.readAsArrayBuffer(blob);
    });
  }

  // --------------------------------------------------------------------------
  // Portal
  // --------------------------------------------------------------------------
  async function ambilJson(alamat, opsi, sebut) {
    const ambil = fungsi("alatAmbil");
    let r;
    try {
      r = ambil ? await ambil(alamat, opsi, sebut) : await fetch(alamat, opsi);
    } catch (galat) {
      return { ok: false, status: 0, data: null, pesan: sebaris((galat && galat.message) || galat) || `${sebut} gagal.` };
    }
    let luar = null;
    try {
      luar = await r.json();
    } catch {
      luar = null;
    }
    const data = luar && typeof luar === "object" && "data" in luar ? luar.data : luar;
    const galatPortal = luar && luar.error ? (typeof luar.error === "object" ? luar.error.message : luar.error) : "";
    const kode = luar && luar.error && typeof luar.error === "object" && luar.error.details ? luar.error.details.kode || "" : "";
    const pesan = sebaris((data && typeof data === "object" && (data.sebab || data.alasan || data.pesan)) || galatPortal || "");
    return { ok: Boolean(r.ok) && !(data && typeof data === "object" && data.ok === false), status: r.status, data, pesan, kode };
  }

  async function ambilBlob(id, bentuk, aksi) {
    const ambil = fungsi("alatAmbil");
    const alamat = `${API.berkas}?id=${encodeURIComponent(id)}&bentuk=${bentuk}&aksi=${aksi}`;
    const r = ambil ? await ambil(alamat, { credentials: "include", cache: "no-store", batasMs: 120000 }, "Mengambil berkas") : await fetch(alamat, { credentials: "include" });
    if (!r.ok) {
      let pesan = `Berkas tidak dapat diambil (kode ${r.status}).`;
      try {
        const j = await r.json();
        if (j && j.error && j.error.message) pesan = String(j.error.message);
      } catch {
        /* pesan bawaan */
      }
      throw new Error(pesan);
    }
    return await r.blob();
  }

  // --------------------------------------------------------------------------
  // Jalur unggah SIPP sendiri (e-Doc Akta Perdamaian)
  // --------------------------------------------------------------------------
  /**
   * Membuka "popup" unggah e-Doc SIPP (GET: SIPP menyiapkan sesinya sendiri) dan membaca isian tersembunyinya
   * serta nama berkas yang sudah tersimpan. Pulang { ok, slot: {dasar, enc, enc1, from, urutan}, namaLama } atau { ok:false, pesan }.
   */
  async function bacaSlotSipp(info) {
    try {
      const alamat = `${info.dasar}/fileupload/${info.encMediasi}/mediasi`;
      const r = await fetch(alamat, { credentials: "include", cache: "no-store" });
      if (!r.ok) return { ok: false, pesan: `SIPP menjawab kode ${r.status} untuk halaman unggah e-Doc.` };
      const html = await r.text();
      const d = new DOMParser().parseFromString(html, "text/html");
      const nilai = (id) => {
        const e = d.getElementById(id);
        return e ? String(e.getAttribute("value") || "") : "";
      };
      const slot = { dasar: info.dasar, enc: nilai("enc"), enc1: nilai("enc1"), from: nilai("from"), urutan: nilai("urutan") };
      if (slot.from !== "mediasi" || !slot.enc || !slot.enc1) {
        return { ok: false, pesan: "Halaman unggah e-Doc SIPP tidak terbaca (sesi SIPP habis atau tampilannya berubah). Masuk ke SIPP lagi lalu coba lagi." };
      }
      // "File Tersimpan": SIPP menulis namanya, atau "Dokumen Belum Ada".
      let namaLama = "";
      for (const s of Array.from(d.querySelectorAll("td span"))) {
        const t = sebaris(s.textContent);
        if (!t || /dokumen belum ada/i.test(t)) continue;
        if (/\.[a-z0-9]{2,5}$/i.test(t)) {
          namaLama = t;
          break;
        }
      }
      return { ok: true, slot, namaLama };
    } catch (galat) {
      return { ok: false, pesan: `Halaman unggah e-Doc SIPP tidak terjangkau: ${sebaris((galat && galat.message) || galat).slice(0, 120)}` };
    }
  }

  /** Mengirim PDF lewat fileupload_c/validatePost (SIPP sendiri). Pulang { ok, pesan }. */
  async function kirimAktaSipp(slot, bita) {
    try {
      const badan = new FormData();
      badan.append("enc", slot.enc);
      badan.append("enc1", slot.enc1);
      badan.append("from", slot.from);
      badan.append("urutan", slot.urutan);
      badan.append("fileform", new File([bita], "hasil-mediasi.pdf", { type: "application/pdf" }));
      const r = await fetch(`${slot.dasar}/fileupload_c/validatePost`, { method: "POST", body: badan, credentials: "include" });
      let j = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }
      const pesan = sebaris(String((j && j.msg) || "").replace(/<[^>]*>/g, " "));
      if (r.ok && j && Number(j.st) === 1) return { ok: true, pesan: pesan || "Tersimpan di e-Doc SIPP." };
      return { ok: false, pesan: pesan || `SIPP menjawab kode ${r.status}.` };
    } catch (galat) {
      return { ok: false, pesan: sebaris((galat && galat.message) || galat).slice(0, 160) };
    }
  }

  // --------------------------------------------------------------------------
  // Dialog (Shadow DOM)
  // --------------------------------------------------------------------------
  const GAYA = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .latar { --bg:#ffffff; --fg:#0f172a; --muted:#475569; --garis:#e2e8f0; --aksen:#1d4ed8; --aksen-fg:#fff; --sekunder:#f1f5f9; --awas-bg:#fffbeb; --awas-fg:#78350f; --awas-garis:#f59e0b; --galat:#b91c1c; --ok:#15803d;
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.38); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); font:14px/1.5 system-ui,"Segoe UI",Arial,sans-serif; color:var(--fg); }
    .latar[data-tema="gelap"] { background:rgba(5,8,12,.62); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); --bg:#111827; --fg:#f1f5f9; --muted:#94a3b8; --garis:#334155; --aksen:#3b82f6; --sekunder:#1e293b; --awas-bg:#422006; --awas-fg:#fde68a; --galat:#f87171; --ok:#4ade80; }
    .kotak { width:min(560px,100%); max-height:92vh; overflow:auto; background:var(--bg); border:1px solid var(--garis); border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,.4); padding:18px 20px; outline:none; }
    h2 { margin:0 0 4px; font-size:17px; } .sub { color:var(--muted); font-size:13px; margin-bottom:12px; }
    .seret { border:2px dashed var(--garis); border-radius:12px; padding:22px 12px; text-align:center; background:var(--sekunder); cursor:pointer; }
    .seret.sorot { border-color:var(--aksen); } .seret b { display:block; margin-bottom:2px; }
    .berkas { margin-top:10px; padding:8px 10px; border:1px solid var(--garis); border-radius:8px; background:var(--sekunder); word-break:break-all; }
    .kecil { color:var(--muted); font-size:12px; }
    .awas { margin-top:12px; padding:10px 12px; border-radius:8px; background:var(--awas-bg); color:var(--awas-fg); border:1px solid var(--awas-garis); font-size:13px; }
    .awas b { font-weight:650; }
    label.pilihan { display:flex; gap:8px; align-items:flex-start; margin-top:12px; padding:10px 12px; border:1px solid var(--garis); border-radius:8px; cursor:pointer; }
    label.pilihan input { margin-top:3px; }
    .pesan { margin-top:10px; font-size:13px; min-height:18px; } .pesan.salah { color:var(--galat); } .pesan.ok { color:var(--ok); }
    .baris { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; flex-wrap:wrap; }
    button { font:inherit; min-height:40px; padding:0 16px; border-radius:9px; border:1px solid var(--garis); background:var(--sekunder); color:var(--fg); cursor:pointer; }
    button:hover:not(:disabled) { filter:brightness(1.07); } button:disabled { opacity:.55; cursor:default; }
    button:focus-visible, .seret:focus-visible { outline:2px solid var(--aksen); outline-offset:2px; }
    button.utama { background:var(--aksen); border-color:var(--aksen); color:var(--aksen-fg); font-weight:650; }
    button.bahaya { background:var(--galat); border-color:var(--galat); color:#fff; font-weight:650; }
    input[type=file] { display:none; }
    @media (max-width:480px) { .latar { padding:0; align-items:flex-end; } .kotak { border-radius:14px 14px 0 0; width:100%; } }`;

  let dialogAktif = null;
  function tutupDialog() {
    const d = dialogAktif;
    dialogAktif = null;
    if (d && d.bersihkan) d.bersihkan();
  }

  /** Dasar dialog: kepala, badan, pesan, baris tombol. Mengembalikan pengendali. */
  /**
   * Latar redup + agak kabur (26 Okt 2026): nilai dibaca dari token bersama di panel.css (-terang / -gelap;
   * kabur dibuang mode ringan dan prefers-reduced-transparency) lalu dipasang sebagai gaya baris pada latar.
   * Tanpa token, nilai harfiah di GAYA berlaku. Lewat gaya baris supaya teks gaya Shadow DOM tidak memuat nama token.
   */
  function pasangTirai(latar, tema) {
    try {
      const cs = getComputedStyle(document.documentElement);
      const t = tema === "terang" ? "terang" : "gelap";
      const warna = cs.getPropertyValue("--aleta-tirai-warna-" + t).trim();
      const kabur = cs.getPropertyValue("--aleta-tirai-kabur-" + t).trim();
      if (warna) latar.style.background = warna;
      if (kabur) {
        latar.style.setProperty("backdrop-filter", kabur);
        latar.style.setProperty("-webkit-backdrop-filter", kabur);
      }
    } catch {
      /* gaya harfiah di GAYA berlaku */
    }
  }

  function bukaDialog(judul, sub) {
    tutupDialog();
    const host = document.createElement("div");
    host.id = ID_DIALOG;
    host.className = "aleta-sisip";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483100;";
    const akar = host.attachShadow({ mode: "open" });
    const gaya = document.createElement("style");
    gaya.textContent = GAYA;
    const latar = el("div", "latar");
    latar.setAttribute("data-tema", "terang");
    pasangTirai(latar, "terang");
    const kotak = el("section", "kotak");
    kotak.setAttribute("role", "dialog");
    kotak.setAttribute("aria-modal", "true");
    kotak.tabIndex = -1;
    const h = el("h2", "", judul);
    kotak.appendChild(h);
    const subEl = el("div", "sub", sub || "");
    subEl.hidden = !sub;
    kotak.appendChild(subEl);
    const isi = el("div");
    const pesan = el("div", "pesan");
    pesan.setAttribute("role", "status");
    pesan.setAttribute("aria-live", "polite");
    const baris = el("div", "baris");
    kotak.appendChild(isi);
    kotak.appendChild(pesan);
    kotak.appendChild(baris);
    latar.appendChild(kotak);
    akar.appendChild(gaya);
    akar.appendChild(latar);
    const sebelumFokus = document.activeElement;
    (async () => {
      try {
        // Pusat tema (terang | gelap | sistem) lebih dahulu: sinkron dan sudah
        // menguraikan "ikuti sistem". Cermin temaPanel hanya cadangan.
        if (globalThis.AletaTemaPusat) {
          latar.setAttribute("data-tema", globalThis.AletaTemaPusat.keadaan().resolusi === "terang" ? "terang" : "gelap");
          pasangTirai(latar, latar.getAttribute("data-tema"));
          return;
        }
        const s = await chrome.storage.local.get([KUNCI_TEMA]);
        latar.setAttribute("data-tema", s && s[KUNCI_TEMA] === "terang" ? "terang" : s && s[KUNCI_TEMA] === "gelap" ? "gelap" : "terang");
        pasangTirai(latar, latar.getAttribute("data-tema"));
      } catch {
        /* tema terang */
      }
    })();
    function dengarTombol(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!pengendali.terkunci) tutupDialog();
      }
    }
    window.addEventListener("keydown", dengarTombol, true);
    latar.addEventListener("mousedown", (e) => {
      if (e.target === latar && !pengendali.terkunci) tutupDialog();
    });
    const pengendali = {
      host,
      akar,
      isi,
      baris,
      terkunci: false,
      judul(t) {
        h.textContent = t;
      },
      pesan(teks, nada) {
        pesan.textContent = teks || "";
        pesan.className = `pesan${nada ? ` ${nada}` : ""}`;
      },
      kosongkan() {
        subEl.hidden = true;
        isi.textContent = "";
        baris.textContent = "";
        pesan.textContent = "";
      },
      bersihkan() {
        window.removeEventListener("keydown", dengarTombol, true);
        host.remove();
        try {
          if (sebelumFokus && typeof sebelumFokus.focus === "function") sebelumFokus.focus();
        } catch {
          /* fokus tidak dapat dikembalikan */
        }
      },
    };
    (document.body || document.documentElement).appendChild(host);
    try {
      kotak.focus();
    } catch {
      /* fokus awal hanya kemudahan */
    }
    dialogAktif = pengendali;
    return pengendali;
  }

  // --------------------------------------------------------------------------
  // Keadaan satu blok (satu tautan "Edit Hasil Mediasi")
  // --------------------------------------------------------------------------
  /**
   * Alur unggah: pilih berkas -> konfirmasi -> kirim ke arsip -> (opsional, Y1) kirim ke e-Doc Akta Perdamaian SIPP.
   * ganti = baris berkas yang diganti (atau null).
   */
  function dialogUnggah(blok, ganti) {
    const d = bukaDialog(
      ganti ? "Ganti berkas hasil mediasi" : "Unggah hasil mediasi",
      ganti
        ? `Menggantikan ${ganti.nama} (versi ${ganti.versi}). Berkas lama tidak lagi tersimpan; riwayatnya tetap tercatat.`
        : `Perkara ${blok.nomor}. Disimpan di arsip perkara ini (bukan di SIPP). PDF, RTF, DOC, atau DOCX, paling besar 20 MB.`
    );
    let file = null;
    let sibuk = false;
    const input = el("input");
    input.type = "file";
    input.accept = ".pdf,.rtf,.doc,.docx";
    const zona = el("div", "seret");
    zona.tabIndex = 0;
    zona.setAttribute("role", "button");
    zona.setAttribute("aria-label", "Pilih atau seret berkas hasil mediasi");
    zona.appendChild(el("b", "", "Seret berkas ke sini atau klik untuk memilih"));
    zona.appendChild(el("span", "kecil", "PDF, RTF, DOC, DOCX"));
    const info = el("div", "berkas");
    info.hidden = true;
    const pilihSipp = el("label", "pilihan");
    const cek = el("input");
    cek.type = "checkbox";
    const tekPilih = el("span");
    tekPilih.appendChild(el("b", "", "Kirim juga sebagai e-Doc Akta Perdamaian di SIPP"));
    tekPilih.appendChild(el("div", "kecil", "Hasil mediasi ini \"Berhasil Dengan Akta Perdamaian\". Berkas dikirim lewat halaman unggah e-Doc SIPP atas akun SIPP Anda yang sedang masuk. Tidak menimpa berkas yang ada di SIPP tanpa persetujuan Anda."));
    pilihSipp.appendChild(cek);
    pilihSipp.appendChild(tekPilih);
    pilihSipp.hidden = !blok.y1;
    d.isi.appendChild(zona);
    d.isi.appendChild(input);
    d.isi.appendChild(info);
    d.isi.appendChild(pilihSipp);

    const batal = tombol("Batal", "");
    const lanjut = tombol("Lanjut", "utama");
    lanjut.disabled = true;
    d.baris.appendChild(batal);
    d.baris.appendChild(lanjut);
    batal.addEventListener("click", () => tutupDialog());

    function pilihBerkas(f) {
      file = null;
      info.hidden = true;
      lanjut.disabled = true;
      d.pesan("");
      if (!f) return;
      const ak = akhiranNama(f.name);
      if (!AKHIRAN_SAH.includes(ak)) return d.pesan("Hanya PDF, RTF, DOC, atau DOCX yang dapat diunggah.", "salah");
      if (f.size === 0) return d.pesan("Berkasnya kosong.", "salah");
      if (f.size > BATAS_BAJT) return d.pesan("Ukuran berkas melampaui 20 MB.", "salah");
      file = f;
      info.hidden = false;
      info.textContent = `${f.name} - ${ak.toUpperCase()}, ${ukuranTeks(f.size)}`;
      lanjut.disabled = false;
    }
    zona.addEventListener("click", () => input.click());
    zona.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => pilihBerkas(input.files && input.files[0]));
    for (const nama of ["dragenter", "dragover"]) {
      zona.addEventListener(nama, (e) => {
        e.preventDefault();
        zona.classList.add("sorot");
      });
    }
    for (const nama of ["dragleave", "drop"]) {
      zona.addEventListener(nama, (e) => {
        e.preventDefault();
        zona.classList.remove("sorot");
      });
    }
    zona.addEventListener("drop", (e) => pilihBerkas(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]));

    lanjut.addEventListener("click", () => {
      if (!file) return;
      konfirmasiUnggah(d, blok, file, ganti, cek.checked && !pilihSipp.hidden);
    });
    return d;
  }

  /** Langkah konfirmasi: ringkasan apa yang akan terjadi, lalu kirim. */
  function konfirmasiUnggah(d, blok, file, ganti, keSipp) {
    d.kosongkan();
    d.judul(ganti ? "Yakin mengganti berkas ini?" : "Yakin mengunggah berkas ini?");
    const ring = el("div", "berkas");
    ring.textContent = `${file.name} - ${ukuranTeks(file.size)}`;
    d.isi.appendChild(ring);
    const ket = el("div", "kecil");
    ket.style.marginTop = "8px";
    ket.textContent = `Akan disimpan di arsip perkara ${blok.nomor}${blok.urutan ? ` (mediasi ke-${blok.urutan})` : ""}. Berkas yang bukan PDF diubah ke PDF; berkas asli dan PDF-nya sama-sama disimpan.`;
    d.isi.appendChild(ket);
    if (ganti) {
      const a = el("div", "awas");
      a.appendChild(el("b", "", "Berkas lama diganti. "));
      a.appendChild(document.createTextNode(`${ganti.nama} (versi ${ganti.versi}) tidak lagi dapat diunduh; riwayat penggantian tetap tercatat.`));
      d.isi.appendChild(a);
    }
    if (keSipp) {
      const a = el("div", "awas");
      a.appendChild(el("b", "", "Juga dikirim ke SIPP. "));
      a.appendChild(document.createTextNode("Sesudah tersimpan di arsip, PDF-nya dikirim ke e-Doc Akta Perdamaian di SIPP atas akun SIPP Anda. Bila di SIPP sudah ada berkasnya, Anda akan ditanya lagi sebelum menimpa."));
      d.isi.appendChild(a);
    }
    const kembali = tombol("Kembali", "");
    const ya = tombol(ganti ? "Ya, ganti" : "Ya, unggah", "utama");
    d.baris.appendChild(kembali);
    d.baris.appendChild(ya);
    kembali.addEventListener("click", () => dialogUnggah(blok, ganti));
    let jalan = false;
    ya.addEventListener("click", async () => {
      if (jalan) return; // cegah unggah ganda
      jalan = true;
      d.terkunci = true;
      kembali.disabled = true;
      ya.disabled = true;
      d.pesan("Mengunggah…");
      const badan = new FormData();
      badan.append("berkas", file, file.name);
      badan.append("nomorPerkara", blok.nomor);
      badan.append("urutanMediasi", String(blok.urutan || 0));
      if (ganti) {
        badan.append("gantiId", ganti.id);
        badan.append("konfirmasiGanti", "1");
      }
      const r = await ambilJson(API.dasar, { method: "POST", credentials: "include", body: badan, batasMs: 180000 }, "Mengunggah hasil mediasi");
      if (!r.ok || !r.data || !r.data.berkas) {
        d.terkunci = false;
        jalan = false;
        kembali.disabled = false;
        ya.disabled = false;
        d.pesan(r.pesan || "Unggah tidak berhasil.", "salah");
        return;
      }
      const baru = r.data.berkas;
      const peringatan = Array.isArray(r.data.peringatan) ? r.data.peringatan : [];
      await muat(blok);
      if (keSipp) {
        await langkahSipp(d, blok, baru, peringatan);
      } else {
        selesai(d, peringatan.length ? `Tersimpan di arsip. ${peringatan.join(" ")}` : "Tersimpan di arsip perkara.");
      }
    });
  }

  function selesai(d, teks, galat) {
    d.kosongkan();
    d.terkunci = false;
    d.judul(galat ? "Selesai dengan catatan" : "Selesai");
    d.isi.appendChild(el("div", "berkas", teks));
    const tutup = tombol("Tutup", "utama");
    d.baris.appendChild(tutup);
    tutup.addEventListener("click", () => tutupDialog());
    try {
      tutup.focus();
    } catch {
      /* fokus hanya kemudahan */
    }
  }

  /** Kirim ke e-Doc Akta Perdamaian SIPP: baca slot, tanya bila akan menimpa, kirim, catat jejak. */
  async function langkahSipp(d, blok, berkas, peringatan) {
    d.pesan("Menyiapkan unggahan e-Doc di SIPP…");
    const slot = await bacaSlotSipp(blok.info);
    if (!slot.ok) {
      await catatJejakSipp(berkas.id, "gagal", `Tidak dikirim ke SIPP: ${slot.pesan}`, false);
      return selesai(d, `Tersimpan di arsip perkara. Tidak dikirim ke SIPP: ${slot.pesan}`, true);
    }
    let menimpa = false;
    if (slot.namaLama) {
      const setuju = await tanyaTimpa(d, slot.namaLama);
      if (!setuju) {
        await catatJejakSipp(berkas.id, "gagal", "Tidak dikirim ke SIPP: petugas tidak setuju menimpa berkas yang sudah ada.", false);
        return selesai(d, `Tersimpan di arsip perkara. Tidak dikirim ke SIPP; berkas ${slot.namaLama} di SIPP tidak diubah.`);
      }
      menimpa = true;
    }
    d.kosongkan();
    d.judul("Mengirim ke SIPP");
    d.pesan("Mengirim PDF ke e-Doc Akta Perdamaian SIPP…");
    let blob = null;
    try {
      blob = await ambilBlob(berkas.id, "pdf", "lihat");
    } catch (galat) {
      await catatJejakSipp(berkas.id, "gagal", `PDF tidak dapat diambil: ${sebaris((galat && galat.message) || galat)}`, menimpa);
      return selesai(d, `Tersimpan di arsip perkara. PDF-nya tidak dapat diambil untuk dikirim ke SIPP: ${sebaris((galat && galat.message) || galat)}`, true);
    }
    if (!berkas.adaPdf && berkas.bentukAsal !== "pdf") {
      await catatJejakSipp(berkas.id, "gagal", "Tidak dikirim ke SIPP: PDF belum dapat dibuat dari berkas ini.", menimpa);
      return selesai(d, "Tersimpan di arsip perkara. Tidak dikirim ke SIPP karena PDF-nya belum dapat dibuat dari berkas ini.", true);
    }
    const bita = await bitaDari(blob);
    const k = await kirimAktaSipp(slot.slot, bita);
    await catatJejakSipp(berkas.id, k.ok ? "berhasil" : "gagal", k.ok ? `Terkirim ke e-Doc Akta Perdamaian SIPP${menimpa ? " (menimpa berkas lama)" : ""}.` : `Gagal dikirim ke SIPP: ${k.pesan}`, menimpa);
    await muat(blok);
    if (k.ok) return selesai(d, `Tersimpan di arsip perkara dan dikirim ke e-Doc Akta Perdamaian SIPP. ${peringatan.join(" ")}`.trim());
    return selesai(d, `Tersimpan di arsip perkara. Gagal dikirim ke SIPP: ${k.pesan}`, true);
  }

  /** Konfirmasi tegas sebelum menimpa e-Doc yang sudah ada di SIPP. Pulang true/false. */
  function tanyaTimpa(d, namaLama) {
    return new Promise((selesaiTanya) => {
      d.kosongkan();
      d.terkunci = false;
      d.judul("Di SIPP sudah ada e-Doc");
      const a = el("div", "awas");
      a.appendChild(el("b", "", "Menimpa berkas di SIPP. "));
      a.appendChild(document.createTextNode(`E-Doc Akta Perdamaian yang sekarang di SIPP: ${namaLama}. Bila dilanjutkan, SIPP sendiri menghapus berkas itu dan menggantinya dengan berkas baru. Tindakan ini tidak dapat dibatalkan dari sini.`));
      d.isi.appendChild(a);
      const jangan = tombol("Jangan kirim ke SIPP", "");
      const timpa = tombol("Ya, timpa berkas di SIPP", "bahaya");
      d.baris.appendChild(jangan);
      d.baris.appendChild(timpa);
      jangan.addEventListener("click", () => selesaiTanya(false));
      timpa.addEventListener("click", () => selesaiTanya(true));
      try {
        jangan.focus();
      } catch {
        /* fokus hanya kemudahan */
      }
    });
  }

  async function catatJejakSipp(id, hasil, ringkas, menimpa) {
    try {
      await ambilJson(API.jejak, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hasil, ringkas, menimpa }) }, "Mencatat jejak");
    } catch {
      /* jejak gagal tidak menggagalkan apa pun */
    }
  }

  // --------------------------------------------------------------------------
  // Daftar berkas di halaman
  // --------------------------------------------------------------------------
  const tanggalWaktu = (iso) => {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return "";
    const p2 = (n) => String(n).padStart(2, "0");
    return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()} ${p2(t.getHours())}.${p2(t.getMinutes())}`;
  };

  async function lihatBerkas(b, bentuk) {
    const blob = await ambilBlob(b.id, bentuk, "lihat");
    const pratinjau = globalThis.aletaPratinjauBasRelaas;
    const dasar = String(b.nama).replace(/\.[A-Za-z0-9]{2,5}$/, "") || "hasil-mediasi";
    const nama = `${dasar}.${bentuk === "asli" ? b.bentukAsal : "pdf"}`;
    if (pratinjau && typeof pratinjau.bukaBerkas === "function") {
      await pratinjau.bukaBerkas({ blob, nama, jenis: "dokumen" });
      return;
    }
    const unduh = fungsi("alatUnduh");
    if (unduh) await unduh(blob, nama);
  }

  async function unduhBerkas(b, bentuk) {
    const blob = await ambilBlob(b.id, bentuk, "unduh");
    const dasar = String(b.nama).replace(/\.[A-Za-z0-9]{2,5}$/, "") || "hasil-mediasi";
    const unduh = fungsi("alatUnduh");
    if (!unduh) throw new Error("Unduhan belum siap di halaman ini.");
    const h = await unduh(blob, `${dasar}.${bentuk === "asli" ? b.bentukAsal : "pdf"}`);
    if (h && h.ok === false && !h.dibatalkan) throw new Error(h.pesan || "Unduhan tidak berhasil.");
  }

  function dialogHapus(blok, b) {
    const d = bukaDialog("Hapus berkas hasil mediasi?", `${b.nama} (versi ${b.versi}), diunggah ${b.diunggahNama || "-"} ${tanggalWaktu(b.dibuatPada)}.`);
    const a = el("div", "awas");
    a.appendChild(el("b", "", "Berkas dibuang dari arsip. "));
    a.appendChild(document.createTextNode("Berkas asli dan PDF-nya tidak dapat diunduh lagi; siapa yang menghapus dan kapan tetap tercatat."));
    d.isi.appendChild(a);
    const alasan = el("input");
    alasan.type = "text";
    alasan.placeholder = "Alasan (boleh dikosongkan)";
    alasan.maxLength = 200;
    alasan.style.cssText = "width:100%;margin-top:12px;min-height:38px;padding:0 10px;border:1px solid #94a3b8;border-radius:8px;font:inherit;";
    d.isi.appendChild(alasan);
    const batal = tombol("Batal", "");
    const hapus = tombol("Ya, hapus", "bahaya");
    d.baris.appendChild(batal);
    d.baris.appendChild(hapus);
    batal.addEventListener("click", () => tutupDialog());
    let jalan = false;
    hapus.addEventListener("click", async () => {
      if (jalan) return;
      jalan = true;
      d.terkunci = true;
      hapus.disabled = true;
      batal.disabled = true;
      d.pesan("Menghapus…");
      const r = await ambilJson(`${API.dasar}?id=${encodeURIComponent(b.id)}&konfirmasi=1&alasan=${encodeURIComponent(alasan.value)}`, { method: "DELETE", credentials: "include" }, "Menghapus berkas");
      d.terkunci = false;
      if (!r.ok) {
        jalan = false;
        hapus.disabled = false;
        batal.disabled = false;
        d.pesan(r.pesan || "Penghapusan tidak berhasil.", "salah");
        return;
      }
      await muat(blok);
      tutupDialog();
    });
  }

  /** Menggambar ulang daftar berkas satu blok. */
  function gambarDaftar(blok) {
    const wadah = blok.daftar;
    wadah.textContent = "";
    const kepala = el("div");
    kepala.style.cssText = "font-weight:700;margin:0 0 4px;";
    kepala.textContent = "Berkas hasil mediasi (arsip perkara)";
    wadah.appendChild(kepala);
    const ket = el("div");
    ket.style.cssText = "color:#6b7280;font-size:11px;margin-bottom:6px;";
    ket.textContent = "Disimpan di arsip perkara ini, tidak tercatat di SIPP.";
    wadah.appendChild(ket);
    if (blok.galat) {
      const g = el("div");
      g.style.cssText = "color:#b91c1c;";
      g.textContent = blok.galat;
      wadah.appendChild(g);
      return;
    }
    if (!blok.berkas.length) {
      const k = el("div");
      k.style.cssText = "color:#6b7280;";
      k.textContent = "Belum ada berkas.";
      wadah.appendChild(k);
      return;
    }
    for (const b of blok.berkas) {
      const baris = el("div", "aleta-sisip");
      baris.setAttribute("data-am-berkas", b.id);
      baris.style.cssText = "display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:6px 0;border-top:1px solid #e5e7eb;";
      const nama = el("span");
      nama.style.cssText = "flex:1 1 220px;min-width:0;word-break:break-all;";
      const tebal = el("b", "", b.nama);
      nama.appendChild(tebal);
      const rinci = el("div");
      rinci.style.cssText = "color:#6b7280;font-size:11px;";
      rinci.textContent = [
        b.bentukAsal.toUpperCase() + (b.adaPdf && b.bentukAsal !== "pdf" ? " + PDF" : ""),
        ukuranTeks(b.ukuranAsal),
        b.versi > 1 ? `versi ${b.versi}` : "",
        b.diunggahNama ? `oleh ${b.diunggahNama}` : "",
        tanggalWaktu(b.dibuatPada),
        b.keSipp ? `terkirim ke e-Doc Akta Perdamaian SIPP (${tanggalWaktu(b.keSipp.pada)})` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      nama.appendChild(rinci);
      if (b.peringatan) {
        const p = el("div");
        p.style.cssText = "color:#92400e;font-size:11px;";
        p.textContent = b.peringatan;
        nama.appendChild(p);
      }
      baris.appendChild(nama);
      const aksi = el("span");
      aksi.style.cssText = "display:inline-flex;gap:4px;flex-wrap:wrap;";
      const tambah = (teks, judul, fn, kelas) => {
        const t = tombol(teks, `btn btn-default btn-sm${kelas ? ` ${kelas}` : ""}`, judul);
        t.addEventListener("click", async () => {
          if (t.disabled) return;
          t.disabled = true;
          try {
            await fn();
          } catch (galat) {
            blok.pesan(sebaris((galat && galat.message) || galat) || "Tidak berhasil.");
          } finally {
            t.disabled = false;
          }
        });
        aksi.appendChild(t);
      };
      if (b.adaPdf || b.bentukAsal === "pdf") tambah("Lihat", "Lihat isi berkas", () => lihatBerkas(b, "pdf"));
      tambah("Unduh", `Unduh berkas asli (${b.bentukAsal.toUpperCase()})`, () => unduhBerkas(b, "asli"));
      if (b.adaPdf && b.bentukAsal !== "pdf") tambah("PDF", "Unduh versi PDF", () => unduhBerkas(b, "pdf"));
      if (blok.hak.unggah) tambah("Ganti", "Ganti dengan berkas lain (versi baru)", async () => dialogUnggah(blok, b));
      if (b.bolehHapus) tambah("Hapus", "Hapus berkas ini (hanya pengunggah atau Admin)", async () => dialogHapus(blok, b), "btn-danger");
      baris.appendChild(aksi);
      wadah.appendChild(baris);
    }
  }

  async function muat(blok) {
    const r = await ambilJson(`${API.dasar}?nomorPerkara=${encodeURIComponent(blok.nomor)}`, { credentials: "include", cache: "no-store" }, "Membaca arsip hasil mediasi");
    if (r.status === 401 || r.status === 403) {
      blok.hak = { lihat: false, unggah: false };
      blok.sembunyi = true;
      return false;
    }
    if (!r.ok || !r.data) {
      blok.galat = r.pesan || "Arsip belum terbaca.";
      blok.berkas = [];
    } else {
      blok.galat = "";
      blok.berkas = Array.isArray(r.data.berkas) ? r.data.berkas : [];
      blok.hak = r.data.hak || { lihat: true, unggah: false };
    }
    blok.sembunyi = false;
    if (blok.akar.isConnected) {
      blok.tombol.hidden = !blok.hak.unggah;
      gambarDaftar(blok);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Pemasangan di tab Mediasi
  // --------------------------------------------------------------------------
  const TANDA = "data-am-pasang";

  function pasangPada(a) {
    const info = bacaTautanEdit(a.getAttribute("onclick"));
    if (!info) return null;
    const td = a.closest("td");
    const tr = td ? td.closest("tr") : null;
    if (!td || !tr || td.getAttribute(TANDA)) return null;
    const nomor = nomorHalaman(document);
    if (!nomor) return null;
    td.setAttribute(TANDA, "1");
    const hasil = hasilMediasiDari(tr);
    const akar = el("div", "aleta-sisip");
    akar.style.cssText = "margin-top:6px;text-align:right;";
    const btn = tombol("Unggah hasil mediasi", "btn btn-default btn-sm", "Unggah dokumen hasil mediasi ke arsip perkara ini");
    btn.hidden = true;
    const ikon = el("i", "fa fa-file-pdf-o");
    btn.insertBefore(document.createTextNode(" "), btn.firstChild);
    btn.insertBefore(ikon, btn.firstChild);
    akar.appendChild(btn);
    td.appendChild(akar);
    const baris = document.createElement("tr");
    baris.className = "aleta-sisip";
    const sel = document.createElement("td");
    sel.colSpan = 3;
    sel.style.cssText = "padding:6px 10px;font-size:12px;text-align:left;";
    const daftar = el("div");
    sel.appendChild(daftar);
    const catatan = el("div");
    catatan.style.cssText = "color:#b91c1c;font-size:12px;";
    sel.appendChild(catatan);
    baris.appendChild(sel);
    tr.parentElement.insertBefore(baris, tr.nextElementSibling);
    const blok = {
      nomor,
      urutan: info.urutan,
      info,
      y1: hasilBerhasilAkta(hasil),
      akar,
      tombol: btn,
      daftar,
      berkas: [],
      hak: { lihat: false, unggah: false },
      galat: "",
      sembunyi: true,
      pesan(t) {
        catatan.textContent = t || "";
      },
    };
    baris.hidden = true;
    btn.addEventListener("click", () => dialogUnggah(blok, null));
    muat(blok).then((boleh) => {
      baris.hidden = !boleh;
      akar.hidden = !boleh;
    });
    return blok;
  }

  function pasang(doc) {
    let n = 0;
    try {
      for (const a of Array.from((doc || document).querySelectorAll('a[onclick*="edit_hasil_mediasi"]'))) {
        if (pasangPada(a)) n += 1;
      }
    } catch {
      /* pemasangan hanya tambahan */
    }
    return n;
  }

  let jam = 0;
  function jadwalkan() {
    clearTimeout(jam);
    jam = setTimeout(() => {
      if (halamanSipp()) pasang(document);
    }, 300);
  }
  try {
    if (halamanSipp()) {
      new (globalThis.ALETA_PENGAMAT ? globalThis.ALETA_PENGAMAT.Pengamat : MutationObserver)((daftar) => {
        for (const m of daftar) {
          if (m.addedNodes && m.addedNodes.length) {
            jadwalkan();
            return;
          }
        }
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
      jadwalkan();
    }
  } catch {
    /* tanpa pengamat: tidak terpasang */
  }

  globalThis.aletaMediasiArsip = {
    API,
    bacaTautanEdit,
    hasilMediasiDari,
    hasilBerhasilAkta,
    bacaSlotSipp,
    kirimAktaSipp,
    pasang,
    tutup: tutupDialog,
    dialogAktif: () => dialogAktif,
  };
})();
