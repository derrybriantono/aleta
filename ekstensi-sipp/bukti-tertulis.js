"use strict";

/**
 * ============================================================================
 * ALAT BUKTI TERTULIS DI BLANGKO ABT BY DERRY BRIANTONO (6 Nov 2026)
 * ============================================================================
 *
 * Kembaran manajemen_surat/src/lib/bukti-tertulis.ts untuk bagian murni (jenis, kolom, sidik NIK, banding SIPP, berkas), ditambah tampilan
 * lengkap sebagai pop-up. Pop-up menyunting baris yang SAMA dengan kotak bukti di form: tidak ada data kedua, tidak ada jalur tulis kedua.
 * Berkas ini tidak menulis ke SIPP atau ABT; pemanggil yang menyimpan lewat simpanBukti.
 * Global: AletaBuktiTertulis.
 */
(function buktiTertulisModul(akar) {
  if (!akar || akar.AletaBuktiTertulis) return;

  const data = akar.ALETA_BUKTI_KATALOG || { surat: [], elektronik: [] };
  const SURAT = data.surat.map((x) => ({
    kunci: x.k,
    nama: x.n,
    kelompok: x.g,
    oleh: x.o,
    kuat: x.kuat === "O" ? "Akta otentik" : "Dinilai majelis",
    pola: new RegExp(x.p, "i"),
  }));
  const ELEK = data.elektronik.map((x) => ({ kunci: x.k, nama: x.n, kelompok: x.g, bentuk: x.b, objek: x.o, keterangan: x.ket }));

  const JENIS_UMUM = new Set(["keterangan", "pernyataan", "perjanjian"]);
  function jenisBuktiDari(nama) {
    const n = String(nama == null ? "" : nama);
    let kunci = "";
    let panjang = 0;
    for (const x of SURAT) {
      if (JENIS_UMUM.has(x.kunci)) continue;
      const m = x.pola.exec(n);
      if (m && m[0].length > panjang) {
        kunci = x.kunci;
        panjang = m[0].length;
      }
    }
    if (kunci) return kunci;
    const umum = SURAT.find((x) => JENIS_UMUM.has(x.kunci) && x.pola.test(n));
    return umum ? umum.kunci : "";
  }
  const katalogDari = (nama) => {
    const j = jenisBuktiDari(nama);
    return SURAT.find((x) => x.kunci === j) || null;
  };
  const katalogMenurutKunci = (k) => SURAT.find((x) => x.kunci === k) || null;
  const elektronikMenurutKunci = (k) => ELEK.find((x) => x.kunci === k) || null;

  function kolomBukti(nama) {
    const j = jenisBuktiDari(nama);
    if (j === "ktp") return { an: "Atas nama", no: "NIK", contohNo: "16 angka NIK", tgl: "Tanggal KTP dikeluarkan" };
    if (j === "kk") return { an: "Kepala keluarga", no: "Nomor KK", contohNo: "nomor Kartu Keluarga", tgl: "Tanggal" };
    if (j === "nikah" || j === "duplikat") return { an: "Atas nama", no: "Nomor kutipan", contohNo: "boleh kosong", tgl: j === "duplikat" ? "Tanggal duplikat" : "Tanggal kutipan" };
    if (j === "lahir") return { an: "Atas nama anak", no: "Nomor akta", contohNo: "boleh kosong", tgl: "Tanggal akta" };
    if (j === "mati" || j === "aktamati") return { an: "Yang meninggal", no: j === "aktamati" ? "Nomor akta" : "Nomor surat", contohNo: "boleh kosong", tgl: j === "aktamati" ? "Tanggal akta" : "Tanggal surat" };
    if (j === "shm" || j === "hgb") return { an: "Atas nama", no: "Nomor sertifikat", contohNo: "boleh kosong", tgl: "Tanggal terbit" };
    if (j === "bpkb" || j === "stnk") return { an: "Atas nama", no: j === "bpkb" ? "Nomor BPKB" : "Nomor polisi", contohNo: "boleh kosong", tgl: "Tanggal" };
    return { an: "Atas nama", no: "Nomor surat", contohNo: "boleh kosong", tgl: "Tanggal" };
  }

  function sidikNik(nik) {
    const d = String(nik == null ? "" : nik).replace(/\D/g, "");
    if (!d) return "";
    let h = 0x811c9dc5;
    for (let i = 0; i < d.length; i += 1) {
      h ^= d.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  const normal = (t) =>
    String(t == null ? "" : t)
      .toLowerCase()
      .replace(/kantor urusan agama/g, "kua")
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const intiNama = (t) =>
    normal(String(t == null ? "" : t).split(",")[0])
      .replace(/\s+(?:bin|binti)\s+.*$/, "")
      .trim();
  const bandingTeks = (nilai, sipp, sama) => (!sipp || !String(nilai == null ? "" : nilai).trim() ? null : { keadaan: sama ? "sama" : "beda", sipp, pakai: sama ? null : sipp });

  function bandingBaris(r, sisi, urutanKtp, sipp) {
    const hasil = {};
    if (!sipp || typeof r.manual === "string") return hasil;
    const j = jenisBuktiDari(r.nm);
    const pasang = (kolom, h) => {
      if (h) hasil[kolom] = h;
    };
    if (j === "ktp") {
      const daftar = sipp[sisi] || [];
      const an = intiNama(r.an);
      const p = (an ? daftar.find((x) => intiNama(x.nama) === an) : null) || daftar[urutanKtp] || null;
      if (!p) return hasil;
      pasang("an", bandingTeks(r.an, p.nama, intiNama(r.an) === intiNama(p.nama)));
      const samaNik = sidikNik(r.no) === p.nikSidik;
      if (p.nikSidik && String(r.no == null ? "" : r.no).trim()) hasil.no = { keadaan: samaNik ? "sama" : "beda", sipp: p.nikSamar, pakai: null };
      return hasil;
    }
    if ((j === "nikah" || j === "duplikat") && sipp.nikah) {
      const n = sipp.nikah;
      pasang("no", bandingTeks(r.no, n.nomor, String(r.no == null ? "" : r.no).trim() === n.nomor));
      if (j === "nikah") pasang("tgl", bandingTeks(r.tgl, n.tglKutipan, r.tgl === n.tglKutipan));
      pasang("oleh", bandingTeks(r.oleh, n.kua, normal(r.oleh) === normal(n.kua)));
    }
    return hasil;
  }

  function berkasUntukBukti(nama, dokumen) {
    const jenis = katalogDari(nama);
    const daftar = Array.isArray(dokumen) ? dokumen : [];
    return (jenis ? daftar.find((d) => jenis.pola.test(d.judul)) : null) || daftar.find((d) => /\bbukti\b/i.test(d.judul)) || null;
  }

  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  function tanggalIndo(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? "" : iso));
    return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : String(iso == null ? "" : iso);
  }

  function htmlKelompok(daftar, judul, esc) {
    const per = new Map();
    for (const x of daftar) {
      if (!per.has(x.kelompok)) per.set(x.kelompok, []);
      per.get(x.kelompok).push(x);
    }
    let html = `<option value="">${esc(judul)}</option>`;
    for (const [nama, isi] of per) html += `<optgroup label="${esc(nama)}">${isi.map((x) => `<option value="${esc(x.kunci)}">${esc(x.nama)}</option>`).join("")}</optgroup>`;
    return html;
  }
  const htmlKatalogSurat = (esc) => htmlKelompok(SURAT, `Dari katalog (${SURAT.length} jenis)`, esc);
  const htmlKatalogElektronik = (esc) => htmlKelompok(ELEK, `Dari katalog (${ELEK.length} jenis)`, esc);

  const alamatBerkas = (d) => `/aleta/api/aleta-ecourt/berkas?documentKey=${encodeURIComponent(d.documentKey)}&format=pdf&tampil=1`;
  const htmlPindaian = (d, esc) =>
    `<iframe src="${esc(alamatBerkas(d))}" title="Pindaian ${esc(d.judul)}"></iframe><a class="bd-catat" href="${esc(alamatBerkas(d))}" target="_blank" rel="noopener">Buka ${esc(d.judul)} di tab baru</a>`;

  const PIL_METERAI = ["bermeterai cukup dan dinazegelen", "bermeterai cukup tetapi tidak dinazegelen", "tidak bermeterai dan tidak dinazegelen", "tanpa kalimat meterai"];
  const PIL_COCOK = ["telah dicocokkan dengan aslinya dan ternyata sesuai", "tidak dapat dicocokkan dengan aslinya", "dicocokkan dari fotokopinya", "dicocokkan dengan kopian sebelumnya dan ternyata sesuai", "tanpa kalimat pencocokan"];

  /**
   * Tampilan lengkap sebagai pop-up. o: { judul, nomor, sisi, baris(), banding(i), berkas(nama), kalimat(i), ubah(i, kolom, nilai), esc, saatTutup() }.
   * Baris "tulis manual" tampil sebagai kalimat apa adanya. Tutup lewat tombol x atau Escape; klik di luar tidak menutup supaya ketikan tidak hilang.
   */
  function bukaLengkap(induk, o) {
    const lama = induk.querySelector(".bd-blk-tirai");
    if (lama) lama.remove();
    const esc = o.esc;
    let aktif = 0;
    const tirai = document.createElement("div");
    tirai.className = "aleta-sisip bd-modal bd-blk-tirai";
    tirai.setAttribute("role", "dialog");
    tirai.setAttribute("aria-modal", "true");
    tirai.setAttribute("aria-label", "Tampilan lengkap alat bukti");
    tirai.innerHTML = `<div class="bd-blk"><div class="bd-blk-kepala"><b></b><button type="button" class="bd-blk-keluar" data-bl="tutup" aria-label="Tutup" title="Tutup">×</button></div><div class="bd-blk-isi"></div></div>`;
    tirai.querySelector("b").textContent = `${o.judul} · ${o.nomor}`;
    const isi = tirai.querySelector(".bd-blk-isi");
    const kode = (i) => `${o.sisi}.${i + 1}`;
    const keadaan = (r, i) => {
      if (r.diperiksa) return "Sudah diperiksa";
      const beda = Object.values(o.banding(i)).filter((h) => h.keadaan === "beda").length;
      return beda ? `${beda} isian berbeda dari SIPP` : "Belum diperiksa";
    };
    function tandaKolom(i, kolom) {
      const h = o.banding(i)[kolom];
      if (!h) return "";
      if (h.keadaan === "sama") return `<div class="bd-blk-tanda">Sama dengan SIPP</div>`;
      const sipp = kolom === "tgl" ? tanggalIndo(h.sipp) : h.sipp;
      return `<div class="bd-blk-tanda beda"><span>Di SIPP tertulis ${esc(sipp)}</span>${h.pakai === null ? "" : `<button type="button" data-bl="pakai" data-kolom="${esc(kolom)}">Pakai data SIPP</button>`}</div>`;
    }
    function gambar() {
      const rows = o.baris();
      if (aktif >= rows.length) aktif = Math.max(0, rows.length - 1);
      const r = rows[aktif];
      const daftar = rows
        .map((x, i) => `<button type="button" class="bd-blk-pilih" data-bl="pilih" data-i="${i}" aria-current="${i === aktif}"><b>${esc(kode(i))}</b><span>${esc(x.nm || "Tanpa nama")}<small>${esc(keadaan(x, i))}</small></span></button>`)
        .join("");
      let kanan = `<div class="bd-blk-kartu"><p class="bd-blk-catat">Belum ada bukti pada pihak ini.</p></div>`;
      if (r) {
        const j = katalogDari(r.nm);
        const kol = kolomBukti(r.nm);
        const d = o.berkas(r.nm);
        const medan = (kolom, label, jenis, contoh) =>
          `<label>${esc(label)}<input type="${jenis}" data-bl="isi" data-kolom="${kolom}" value="${esc(r[kolom] || "")}" placeholder="${esc(contoh)}"></label><div data-bl-tanda="${kolom}">${tandaKolom(aktif, kolom)}</div>`;
        const pilih = (kolom, label, opsi) =>
          `<label>${esc(label)}<select data-bl="pil" data-kolom="${kolom}">${opsi.map((t, v) => `<option value="${v}" ${Number(r[kolom]) === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
        const manual = typeof r.manual === "string";
        kanan =
          `<div class="bd-blk-kartu"><div class="bd-blk-judul"><b><span>${esc(kode(aktif))}</span> ${esc(r.nm || "Tanpa nama")}</b>${j ? `<span class="bd-blk-kuat">${esc(j.kuat)}</span>` : ""}</div>` +
          `<div class="bd-blk-dua"><div class="bd-blk-pindai">${d ? `<div style="width:100%">${htmlPindaian(d, esc)}</div>` : "Pindaian bukti ini belum ada di arsip e-Court."}</div>` +
          (manual
            ? `<div class="bd-blk-medan"><p class="bd-blk-catat">Bukti ini ditulis sebagai kalimat bebas. Ubah lewat kotak bukti di form.</p></div>`
            : `<div class="bd-blk-medan">${medan("nm", "Nama bukti", "text", "")}${medan("an", kol.an, "text", "boleh kosong")}${medan("no", kol.no, "text", kol.contohNo)}${medan("tgl", kol.tgl, "date", "")}${medan("oleh", "Dikeluarkan oleh", "text", "boleh kosong")}</div>`) +
          `</div></div>` +
          `<div class="bd-blk-kartu">` +
          (manual ? "" : `${pilih("meterai", "Meterai", PIL_METERAI)}${pilih("cocok", "Dicocokkan dengan aslinya", PIL_COCOK)}`) +
          `<div><b>Bunyi di BAS dan putusan</b></div><div class="bd-blk-bunyi" data-bl-bunyi="1">${esc(o.kalimat(aktif))}</div>` +
          `<div class="bd-blk-aksi"><button type="button" data-bl="periksa">${r.diperiksa ? "Batalkan tanda selesai" : "Tandai sudah diperiksa"}</button></div></div>`;
      }
      isi.innerHTML = `<div class="bd-blk-daftar"><div class="bd-blk-catat">Daftar bukti, sama dengan kotak di form.</div>${daftar}</div><div class="bd-blk-kanan">${kanan}</div>`;
    }
    function tutup() {
      document.removeEventListener("keydown", tombol, true);
      tirai.remove();
      if (typeof o.saatTutup === "function") o.saatTutup();
    }
    const tombol = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      tutup();
    };
    document.addEventListener("keydown", tombol, true);
    tirai.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-bl]") : null;
      if (!b) return;
      const aksi = b.getAttribute("data-bl");
      if (aksi === "tutup") return tutup();
      if (aksi === "pilih") {
        aktif = Number(b.getAttribute("data-i"));
        return gambar();
      }
      if (aksi === "pakai") {
        const kolom = b.getAttribute("data-kolom");
        const h = o.banding(aktif)[kolom];
        if (h && h.pakai !== null) o.ubah(aktif, kolom, h.pakai);
        return gambar();
      }
      if (aksi === "periksa") {
        const r = o.baris()[aktif];
        if (r) o.ubah(aktif, "diperiksa", !r.diperiksa);
        return gambar();
      }
      return undefined;
    });
    tirai.addEventListener("input", (e) => {
      const t = e.target;
      if (!t || t.getAttribute("data-bl") !== "isi") return;
      const kolom = t.getAttribute("data-kolom");
      o.ubah(aktif, kolom, t.value);
      const tanda = tirai.querySelector(`[data-bl-tanda="${kolom}"]`);
      if (tanda) tanda.innerHTML = tandaKolom(aktif, kolom);
      const bunyi = tirai.querySelector("[data-bl-bunyi]");
      if (bunyi) bunyi.textContent = o.kalimat(aktif);
    });
    tirai.addEventListener("change", (e) => {
      const t = e.target;
      if (!t || t.getAttribute("data-bl") !== "pil") return;
      o.ubah(aktif, t.getAttribute("data-kolom"), Number(t.value));
      const bunyi = tirai.querySelector("[data-bl-bunyi]");
      if (bunyi) bunyi.textContent = o.kalimat(aktif);
    });
    gambar();
    induk.appendChild(tirai);
    const keluar = tirai.querySelector("[data-bl=tutup]");
    if (keluar) keluar.focus();
    return { tutup };
  }

  akar.AletaBuktiTertulis = Object.freeze({
    SURAT,
    ELEK,
    jenisBuktiDari,
    katalogDari,
    katalogMenurutKunci,
    elektronikMenurutKunci,
    kolomBukti,
    sidikNik,
    bandingBaris,
    berkasUntukBukti,
    tanggalIndo,
    htmlKatalogSurat,
    htmlKatalogElektronik,
    htmlPindaian,
    bukaLengkap,
  });
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null);
