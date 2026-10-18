"use strict";

/**
 * ============================================================================
 * SUSUN SAKSI MENURUT KEADAAN PERKARA DAN JENIS PERKARA (18 Okt 2026)
 * ============================================================================
 *
 * Borang di panel ABT yang menyusun tanya-jawab 2 sampai 5 saksi dari KATALOG
 * jenis perkara (saksi-katalog.js + saksi-katalog-data.js). Berkas ini hanya
 * borangnya; mesin pemilih pertanyaan dan varian ada di saksi-katalog.js.
 *
 * Yang membedakannya dari "Susun keterangan saksi 1 & 2":
 *   - jenis perkaranya dikenali dari data SIPP (jenis_perkara_id dan alur),
 *     BUKAN dari variabel cerai. Perkara yang jenisnya tidak punya katalog
 *     tidak mendapat tombolnya - tidak ada cadangan "dianggap cerai";
 *   - pertanyaan disusun menurut pokok pembuktian jenis itu dan keadaan
 *     perkara (verstek / kontradiktoir / kumulasi / alasan / siapa yang
 *     menghadirkan saksi);
 *   - tiap saksi dapat dipilih jenis keterangannya: melihat sendiri,
 *     mendengar sendiri, tahu dari cerita, hanya sebagian, tidak tahu, ragu,
 *     dan "berbeda dari saksi lain" per butir; jumlah saksi 2 sampai 5;
 *   - kalimat jawaban dipilih dari varian yang maksudnya sama: dua saksi pada
 *     satu butir tidak pernah berbunyi sama persis.
 *
 * Petugas membaca dan dapat menyunting setiap jawaban sebelum disimpan.
 * Penyimpanan memakai rute simpan ABT yang sama dengan penyusun lama
 * (kirimTanyaJawab); titik-titik "..." menandai isian yang tidak dapat diambil
 * dari data perkara dan tidak pernah ditebak.
 *
 * Perilaku cerai lama tidak disentuh: tombol dan borang lama tetap ada.
 * Borang ini ditambahkan di sebelahnya, hanya pada tampilan Baru / UI Baru.
 *
 * Konteks (fungsi milik abt.js) diberikan lewat pasang(k); berkas ini tidak
 * membaca apa pun dari abt.js secara langsung, supaya dapat diuji tersendiri.
 */
(function () {
  const BATAS_SAKSI = { P: 5, T: 4 };
  const KUNCI_CACHE = "saksiVariabelCache";
  const BATAS_CACHE = 12;

  const Mesin = () => globalThis.AletaSaksiKatalog;
  const DataKatalog = () => (Array.isArray(globalThis.ALETA_SAKSI_KATALOG_DATA) ? globalThis.ALETA_SAKSI_KATALOG_DATA : []);

  // ──────────────────────────────────────────────────────────────────────
  // Pengenal jenis dan keadaan (fungsi murni - diuji langsung)
  // ──────────────────────────────────────────────────────────────────────

  /** Katalog untuk perkara ini, atau null. TIDAK ada cadangan cerai. */
  function katalogUntuk(perkara) {
    const m = Mesin();
    return m ? m.kenaliPaket(DataKatalog(), perkara) : null;
  }

  /** Katalog yang mungkin untuk alur ini (dipakai bila jenis perkara tidak terbaca: petugas memilih). */
  function kandidatKatalog(alur) {
    const a = String(alur || "").trim();
    return DataKatalog().filter((kat) => {
      if (!kat || kat.contoh === true || !kat.syarat || (kat.tambahanUntuk && kat.tambahanUntuk.length)) return false;
      const alurSah = (kat.syarat.alurPerkaraId || []).map(String);
      return !a || !alurSah.length || alurSah.includes(a);
    });
  }

  /** Kehadiran Tergugat/Termohon dari nama blangko atau judul halaman. */
  function kehadiranDariTeks(teks) {
    const t = String(teks || "");
    if (/T\s+Tidak\s+Hadir\s+Setelah\s+Mediasi/i.test(t) || /Hadir\s+(?:sampai|hingga)\s+Mediasi/i.test(t)) return "t-tidak-hadir-setelah-mediasi";
    if (/verstek/i.test(t)) return "verstek";
    if (/P\s*(?:&|dan)\s*T\s+Hadir/i.test(t)) return "kontradiktoir";
    if (/T\s+Tidak\s+Hadir/i.test(t)) return "verstek";
    return "";
  }

  /**
   * Keadaan perkara yang dapat diturunkan sendiri, hanya untuk kunci yang dikenal katalog.
   * @param {object} kat
   * @param {{teks?: string, peta?: Map<string, {nilai: string}>|null}} konteks
   */
  function turunkanKeadaan(kat, konteks) {
    const m = Mesin();
    const k = konteks || {};
    const hasil = {};
    if (!m || !kat) return hasil;
    const dipakai = new Set(m.keadaanUntukBorang(kat).map((x) => x.kunci));
    if (dipakai.has("kehadiran")) {
      const h = kehadiranDariTeks(k.teks);
      if (h) hasil.kehadiran = h;
    }
    const peta = k.peta && typeof k.peta.get === "function" ? k.peta : null;
    const idJenis = ((kat.syarat && kat.syarat.jenisPerkaraId) || []).map(String);
    const perceraian = idJenis.includes("346") || idJenis.includes("347");
    // suami diturunkan dari jenis perkara: cerai gugat = Tergugat (lawan), cerai talak = Pemohon (pengaju)
    if (perceraian && kat.keadaan && kat.keadaan.suami) hasil.suami = idJenis.includes("346") ? "pengaju" : "lawan";
    // huruf alasan dari variabel 8503 hanya berlaku pada perkara cerai; alasan jenis lain (pembatalan, pencegahan, wasiat) dipilih petugas
    if (peta && perceraian && dipakai.has("alasan")) {
      const huruf = peta.get("8503");
      const nilai = huruf && huruf.nilai ? String(huruf.nilai).toUpperCase().replace(/[^A-H]/g, "") : "";
      if (nilai) hasil.alasan = Array.from(new Set(nilai.split("")));
    }
    if (peta && dipakai.has("kumulasi")) {
      const kumulasi = [];
      if (peta.has("5197") || peta.has("8087")) kumulasi.push("itsbat-nikah");
      if (peta.has("6055")) kumulasi.push("mutah");
      if (peta.has("6054")) kumulasi.push("nafkah-iddah");
      if (kumulasi.length) hasil.kumulasi = kumulasi;
    }
    return hasil;
  }

  /** Nilai variabel dari halaman, lalu dari singgahan (halaman tanya-jawab tidak punya tabel variabel). */
  function pembaca(peta, singgahan) {
    const m = Mesin();
    return (kode) => {
      const it = peta && typeof peta.get === "function" ? peta.get(kode) : null;
      const v = it ? it.nilai : "";
      if (m && !m.tidakTerisi(v)) return String(v);
      const c = singgahan && singgahan[kode];
      return m && !m.tidakTerisi(c) ? String(c) : "";
    };
  }

  /** Kode variabel yang dipakai seluruh katalog (untuk singgahan). */
  function kodeDipakaiKatalog(daftar) {
    const kode = new Set(["0046", "0047", "0048", "8503"]);
    for (const kat of daftar || []) {
      for (const q of (kat && kat.pertanyaan) || []) for (const v of q.variabelAbt || []) kode.add(String(v));
      for (const vs of Object.values(Mesin() ? Mesin().VARIABEL_HUBUNGAN : {})) for (const grup of vs) for (const v of grup) kode.add(v);
    }
    return Array.from(kode);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Singgahan nilai variabel (blangko -> halaman tanya-jawab)
  // ──────────────────────────────────────────────────────────────────────

  function bacaSinggahan(nomor) {
    return new Promise((selesai) => {
      try {
        if (!nomor || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return selesai({});
        Promise.resolve(chrome.storage.local.get([KUNCI_CACHE])).then(
          (r) => {
            const semua = (r && r[KUNCI_CACHE]) || {};
            selesai((semua[nomor] && semua[nomor].v) || {});
          },
          () => selesai({})
        );
      } catch {
        selesai({});
      }
    });
  }

  function tulisSinggahan(nomor, peta, daftarKode) {
    try {
      if (!nomor || !peta || peta.size < 5 || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
      const baru = {};
      for (const kode of daftarKode) {
        const it = peta.get(kode);
        if (it && it.nilai && !(Mesin() && Mesin().tidakTerisi(it.nilai))) baru[kode] = String(it.nilai);
      }
      if (!Object.keys(baru).length) return;
      Promise.resolve(chrome.storage.local.get([KUNCI_CACHE])).then(
        (r) => {
          const semua = (r && r[KUNCI_CACHE]) || {};
          semua[nomor] = { t: Date.now(), v: Object.assign({}, semua[nomor] && semua[nomor].v, baru) };
          const urut = Object.entries(semua).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).slice(0, BATAS_CACHE);
          return chrome.storage.local.set({ [KUNCI_CACHE]: Object.fromEntries(urut) });
        },
        () => {}
      ).catch(() => {});
    } catch {
      /* singgahan hanya kemudahan */
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Borang
  // ──────────────────────────────────────────────────────────────────────

  const TULISAN_PIHAK = { P: "Penggugat/Pemohon", T: "Tergugat/Termohon" };

  function pasang(k) {
    const m = Mesin();
    const hasil = { tombol: null, wadah: null, segarkan: () => {} };
    if (!m || !k || typeof k.buatElemen !== "function") return hasil;

    const tombol = k.buatElemen("button", "aleta-permintaan-tombol aleta-ssk-tombol", "Susun saksi menurut keadaan perkara");
    tombol.type = "button";
    tombol.hidden = true;
    const wadah = k.buatElemen("div", "aleta-ssk");
    wadah.hidden = true;
    hasil.tombol = tombol;
    hasil.wadah = wadah;

    const S = {
      kat: null,
      keadaan: {},
      saksi: [],
      isian: {},
      pelaku: "0047",
      singgahan: {},
      perButir: {},
      hasil: null,
      sudahAda: [],
      urutan: "1",
      // keterangan anak, calon, dan orang tua (hanya jenis perkara yang punya katalog keterangan, mis. dispensasi kawin)
      ket: null,
      tab: "saksi",
      kt: { periksa: {}, konfirmasi: false, hasil: null, perButir: {} },
    };

    const peta = () => (typeof k.petaVariabel === "function" ? k.petaVariabel() : null);
    const nomor = () => (typeof k.nomorPerkara === "function" ? k.nomorPerkara() : "");
    const bacaVar = () => pembaca(peta(), S.singgahan);
    const sebutan = (kode, cadangan) => bacaVar()(kode) || cadangan;

    /** Nama slot teks bebas katalog yang manusiawi (tanpa kurung kurawal). */
    const NAMA_SLOT = {
      pengaju: "nama pihak yang mengajukan",
      lawan: "nama pihak lawan",
      sumber: "sumber cerita saksi",
      hal: "hal yang diterangkan",
      daftar: "daftar yang disebut saksi",
      isi: "isian dari petugas",
      lama: "lama kejadian",
      sejak: "waktu mulai kejadian",
      penghasilan: "penghasilan",
    };
    /**
     * Penanda yang belum terisi (#nnnn# atau {slot}) -> nama isian yang dapat dibaca petugas. Kode variabel TIDAK
     * tampil: nama diambil dari kolom nama baris variabel di halaman ABT, bila tidak ada ditulis "satu isian".
     * Kodenya dikembalikan terpisah untuk atribut title (penelusuran).
     */
    function namaKosong(daftarKosong) {
      const nama = [];
      const kode = [];
      let tanpaNama = 0;
      for (const x of daftarKosong) {
        const m4 = /^#(\d{4})#$/.exec(x);
        const msl = /^\{([^{}]*)\}$/.exec(x);
        let n = "";
        if (m4) {
          kode.push(m4[1]);
          const it = peta() && typeof peta().get === "function" ? peta().get(m4[1]) : null;
          n = it && it.nama ? String(it.nama).replace(/#\d{4}#/g, "").replace(/\s+/g, " ").trim() : "";
          if (/^Variabel\s*\d{4}$/i.test(n) || /\d{4}/.test(n)) n = "";
        } else if (msl) {
          n = NAMA_SLOT[msl[1]] || "";
        }
        if (!n) tanpaNama += 1;
        else if (!nama.includes(n)) nama.push(n);
      }
      if (tanpaNama) nama.push(tanpaNama === 1 && !nama.length ? "satu isian" : tanpaNama === 1 ? "satu isian lain" : `${tanpaNama} isian lain`);
      return { teks: nama.join(", "), kode: Array.from(new Set(kode)).join(", ") };
    }

    /** Jenis perkara halaman ini -> katalog (atau null). */
    function kenali() {
      const teks = typeof k.jenisPerkaraTeks === "function" ? k.jenisPerkaraTeks() : "";
      const id = typeof k.idJenisPerkara === "function" ? k.idJenisPerkara(teks) : "";
      const alur = typeof k.alurPerkara === "function" ? k.alurPerkara(nomor()) : "";
      const nama = `${teks} ${document.title || ""}`;
      return { kat: katalogUntuk({ jenisPerkaraId: id, alurPerkaraId: alur, nama }), alur, teks, id };
    }

    function teksHalaman() {
      let t = document.title || "";
      try {
        t += " " + String((document.body && document.body.innerText) || "").slice(0, 800);
      } catch {
        /* jsdom tanpa innerText */
        t += " " + String((document.body && document.body.textContent) || "").slice(0, 800);
      }
      return t;
    }

    function atur(kat) {
      S.kat = kat;
      S.hasil = null;
      S.perButir = {};
      const turun = turunkanKeadaan(kat, { teks: teksHalaman(), peta: peta() });
      S.keadaan = m.keadaanBawaan(kat, turun);
      S.isian = {};
      S.saksi = [
        { pihak: "P", jenis: "melihat", sumber: "", berbeda: [] },
        { pihak: "P", jenis: "melihat", sumber: "", berbeda: [] },
      ];
      aturKeterangan(kat);
    }

    /** Tab keterangan: katalog keterangan pihak yang menempel pada katalog ini, kartu per peran, dan keadaan tambahannya. */
    function aturKeterangan(kat) {
      S.ket = typeof m.kenaliKeterangan === "function" ? m.kenaliKeterangan(DataKatalog(), kat) : null;
      S.tab = "saksi";
      S.kt = { periksa: {}, konfirmasi: false, hasil: null, perButir: {} };
      if (!S.ket) return;
      // isian keadaan keterangan yang belum ada di keadaan saksi (sekolah, pendampingan, dst.) mendapat nilai bawaannya;
      // kunci yang sama dengan katalog saksi (jenis kelamin anak, latar belakang, umur calon) memakai yang sudah dipilih
      const bawaanKet = m.keadaanBawaan(S.ket, {});
      delete bawaanKet.peran;
      S.keadaan = Object.assign({}, bawaanKet, S.keadaan);
      for (const d of m.peranTerurut(S.ket)) {
        S.kt.periksa[d.kode] = {
          hadir: true,
          jumlah: 1,
          orang: [0, 1].map(() => ({ jenis: "melihat", sumber: "", berbeda: [], wali: false })),
        };
      }
    }

    function segarkanTombol() {
      const { kat, alur } = kenali();
      const bisa = (typeof k.t6Aktif !== "function" || k.t6Aktif()) && (typeof k.bolehAbt !== "function" || k.bolehAbt("blangko-abt") !== false);
      const adaPilihan = !kat && typeof k.halamanTanyaJawab === "function" && k.halamanTanyaJawab() && kandidatKatalog(alur).length > 0;
      tombol.hidden = !(bisa && (kat || adaPilihan));
      if (kat) tombol.title = `Pertanyaan saksi menurut pokok pembuktian ${kat.judul} dan keadaan perkara; 2 sampai 5 saksi, semua jenis keterangan.`;
      else tombol.title = "Jenis perkara tidak terbaca di halaman ini; pilih jenis perkaranya di form.";
    }
    hasil.segarkan = segarkanTombol;

    // ── gambar ──────────────────────────────────────────────────────────
    function buat(tag, kelas, teks) {
      return k.buatElemen(tag, kelas, teks);
    }

    function pilihan(daftarOpsi, nilai, saatUbah, kelas) {
      const sel = document.createElement("select");
      sel.className = kelas || "aleta-sdg-pilih";
      for (const [v, t] of daftarOpsi) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        sel.appendChild(o);
      }
      sel.value = nilai;
      sel.addEventListener("change", () => saatUbah(sel.value));
      return sel;
    }

    function label(teks, isi) {
      const baris = buat("label", "aleta-sdg-ruas");
      baris.appendChild(buat("span", "aleta-abt-label", teks));
      baris.appendChild(isi);
      return baris;
    }

    const LABEL_JENIS = m.LABEL_JENIS_KETERANGAN;
    /** Perkara tanpa lawan (pencegahan, asal usul, permohonan): semua saksi dihadirkan pemohon (P). */
    const tanpaLawan = () => Boolean(S.kat && S.kat.tanpaLawan === true) || (typeof k.alurPerkara === "function" && k.alurPerkara(nomor()) === "16");
    const JENIS_PILIHAN = ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"];

    /** Syarat-syarat keadaan di katalog yang memuat kunci ini. */
    function syaratMemuat(kunci, kat) {
      const sumber = kat || S.kat;
      const hasil = [];
      const ambil = (sy) => {
        if (sy && typeof sy === "object" && (kunci in sy || `bukan:${kunci}` in sy)) hasil.push(sy);
      };
      for (const q of sumber.pertanyaan || []) {
        ambil(q.keadaan);
        for (const j of Object.keys(q.jawaban || {})) for (const x of [].concat(q.jawaban[j])) ambil(x && x.keadaan);
      }
      for (const p of sumber.pokokPembuktian || []) ambil(p.keadaan);
      return hasil;
    }

    /** Isian keadaan khusus hanya digambar bila ada butir yang memakainya dan syarat LAIN-nya terpenuhi (mis. isian hak asuh hanya bila hak asuh digabung). */
    function keadaanRelevan(kunci, kat) {
      if (["kehadiran", "kumulasi", "alasan"].includes(kunci)) return true;
      if (kat && kat.jenisKatalog === m.JENIS_KATALOG_KETERANGAN) return true;
      const pakai = syaratMemuat(kunci, kat);
      if (!pakai.length) return true;
      return pakai.some((sy) => {
        const sisa = Object.assign({}, sy);
        delete sisa[kunci];
        delete sisa[`bukan:${kunci}`];
        return m.cocokKeadaan(sisa, S.keadaan);
      });
    }

    function ubahKeadaan() {
      S.hasil = null;
      S.kt.hasil = null;
      gambarUlang();
    }

    /** Isian keadaan perkara. `kat` = katalog sumber isian (saksi atau keterangan); `kecuali` = kunci yang digambar tempat lain. */
    function gambarKeadaan(form, kat, kecuali) {
      const sumberKat = kat || S.kat;
      const tanpa = kecuali || [];
      const kotak = buat("div", "aleta-sdg-alasan");
      kotak.appendChild(buat("div", "aleta-abt-label", "Keadaan perkara"));
      for (const f of m.keadaanUntukBorang(sumberKat)) {
        if (tanpa.includes(f.kunci)) continue;
        if (!keadaanRelevan(f.kunci, sumberKat)) continue;
        const nilaiSekarang = S.keadaan[f.kunci];
        const labelNilai = (n) =>
          (sumberKat.keadaan && sumberKat.keadaan[f.kunci] && sumberKat.keadaan[f.kunci].labelNilai && sumberKat.keadaan[f.kunci].labelNilai[n]) ||
          m.LABEL_NILAI_BAKU[n] ||
          (n.length === 1 ? n : n.replace(/-/g, " "));
        if (f.jamak) {
          const grup = buat("div", "aleta-sdg-ruas");
          grup.appendChild(buat("span", "aleta-abt-label", f.label));
          const terpilih = new Set([].concat(nilaiSekarang === undefined ? [] : nilaiSekarang).map(String));
          for (const n of f.nilai) {
            const c = buat("label", "aleta-sdg-centang");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = n;
            cb.checked = terpilih.has(n);
            cb.addEventListener("change", () => {
              const sekarang = new Set([].concat(S.keadaan[f.kunci] === undefined ? [] : S.keadaan[f.kunci]).map(String));
              if (cb.checked) sekarang.add(n);
              else sekarang.delete(n);
              S.keadaan[f.kunci] = Array.from(sekarang);
              ubahKeadaan();
            });
            c.appendChild(cb);
            c.appendChild(buat("span", "", labelNilai(n)));
            grup.appendChild(c);
          }
          kotak.appendChild(grup);
        } else {
          const opsi = f.nilai.map((n) => [n, labelNilai(n)]);
          const sel = pilihan(opsi, nilaiSekarang !== undefined ? String(nilaiSekarang) : opsi[0][0], (v) => {
            S.keadaan[f.kunci] = v;
            ubahKeadaan();
          });
          if (nilaiSekarang === undefined) S.keadaan[f.kunci] = opsi[0][0];
          kotak.appendChild(label(f.label, sel));
        }
      }
      form.appendChild(kotak);
    }

    function gambarSaksi(form) {
      const kotak = buat("div", "aleta-sdg-alasan");
      kotak.appendChild(buat("div", "aleta-abt-label", "Saksi dan jenis keterangannya"));
      const jumlah = pilihan(
        [["2", "2 saksi"], ["3", "3 saksi"], ["4", "4 saksi"], ["5", "5 saksi"]],
        String(S.saksi.length),
        (v) => {
          const n = Number(v);
          while (S.saksi.length < n) S.saksi.push({ pihak: "P", jenis: "melihat", sumber: "", berbeda: [] });
          S.saksi.length = n;
          S.hasil = null;
          gambarUlang();
        }
      );
      kotak.appendChild(label("Jumlah saksi", jumlah));
      if (!tanpaLawan() && adaButirTergugat()) {
        kotak.appendChild(buat("div", "aleta-abt-kabar", `Saksi yang diajukan ${sebutan("0047", TULISAN_PIHAK.T)} menerangkan versi ${sebutan("0047", TULISAN_PIHAK.T)} bila bantahannya ditandai pada keadaan perkara.`));
      }
      const butirBeda = S.kat.pertanyaan.filter((q) => q.jawaban && q.jawaban.berbeda);
      S.saksi.forEach((s, i) => {
        const baris = buat("div", "aleta-sdg-modus");
        baris.appendChild(buat("span", "aleta-abt-label", `Saksi ${i + 1}`));
        if (tanpaLawan()) s.pihak = "P";
        else {
          baris.appendChild(
            pilihan(
              [["P", `Diajukan oleh ${sebutan("0046", TULISAN_PIHAK.P)}`], ["T", `Diajukan oleh ${sebutan("0047", TULISAN_PIHAK.T)}`]],
              s.pihak,
              (v) => {
                s.pihak = v;
                S.hasil = null;
              }
            )
          );
        }
        baris.appendChild(
          pilihan(
            JENIS_PILIHAN.map((j) => [j, LABEL_JENIS[j]]),
            s.jenis,
            (v) => {
              s.jenis = v;
              S.hasil = null;
              sumberKotak.hidden = s.jenis !== "de-auditu";
            }
          )
        );
        const sumberKotak = document.createElement("input");
        sumberKotak.type = "text";
        sumberKotak.className = "aleta-sdg-pilih aleta-ssk-sumber";
        sumberKotak.placeholder = "Sumber cerita, mis. ibu kandung (kosong = pihak yang menghadirkan)";
        sumberKotak.value = s.sumber;
        sumberKotak.hidden = s.jenis !== "de-auditu";
        sumberKotak.addEventListener("input", () => {
          s.sumber = sumberKotak.value;
        });
        baris.appendChild(sumberKotak);
        if (butirBeda.length) {
          const rinci = document.createElement("details");
          rinci.className = "aleta-ssk-beda";
          const ringkas = document.createElement("summary");
          ringkas.textContent = "Keterangannya berbeda dari saksi lain pada butir tertentu";
          rinci.appendChild(ringkas);
          for (const q of butirBeda) {
            const c = buat("label", "aleta-sdg-centang");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = s.berbeda.includes(q.id);
            cb.addEventListener("change", () => {
              s.berbeda = cb.checked ? Array.from(new Set([...s.berbeda, q.id])) : s.berbeda.filter((x) => x !== q.id);
              S.hasil = null;
            });
            c.appendChild(cb);
            c.appendChild(buat("span", "", q.hal ? q.hal.replace(/\{[^{}]*\}/g, "…") : q.id));
            rinci.appendChild(c);
          }
          baris.appendChild(rinci);
        }
        kotak.appendChild(baris);
      });
      form.appendChild(kotak);
    }

    function gambarIsian(form) {
      const aktif = m.pertanyaanAktif(S.kat, Object.assign({}, S.keadaan), null, { tingkat: ["inti", "pilihan", "tambahan", "jarang"] });
      const slot = m.slotIsianDipakai(aktif);
      const teksKatalog = JSON.stringify(S.kat.pertanyaan);
      const pakaiPelaku = teksKatalog.includes("{pelaku}") || teksKatalog.includes("{korban}");
      if (!slot.length && !pakaiPelaku) return;
      const kotak = buat("div", "aleta-sdg-alasan");
      kotak.appendChild(buat("div", "aleta-abt-label", "Isian dari petugas (kosong = titik-titik)"));
      const NAMA = { daftar: "Daftar alasan/unsur", isi: "Isi/uraian", lama: "Lama", sejak: "Sejak kapan", pekerjaan: "Pekerjaan", penghasilan: "Penghasilan" };
      for (const nama of slot) {
        const kotakTeks = document.createElement("input");
        kotakTeks.type = "text";
        kotakTeks.className = "aleta-sdg-pilih";
        kotakTeks.value = S.isian[nama] || "";
        kotakTeks.addEventListener("input", () => {
          S.isian[nama] = kotakTeks.value;
        });
        kotak.appendChild(label(NAMA[nama] || nama, kotakTeks));
      }
      if (pakaiPelaku) {
        kotak.appendChild(
          label(
            "Pihak yang didalilkan melakukan perbuatan",
            pilihan(
              [["0047", sebutan("0047", TULISAN_PIHAK.T)], ["0046", sebutan("0046", TULISAN_PIHAK.P)]],
              S.pelaku,
              (v) => {
                S.pelaku = v;
                S.hasil = null;
              }
            )
          )
        );
      }
      form.appendChild(kotak);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Tab "Keterangan anak, calon, dan orang tua" (dispensasi kawin)
    // Anak, calon, dan orang tua BUKAN saksi: Hakim mendengar mereka sebagai pihak yang diperiksa.
    // ──────────────────────────────────────────────────────────────────────

    const labelJenisKet = (j) => (S.ket && S.ket.labelJenis && S.ket.labelJenis[j]) || LABEL_JENIS[j];
    /** Keadaan yang digambar pada kartu peran, bukan di daftar keadaan perkara. */
    const KEADAAN_KARTU = ["peran", "tidakHadir", "sebabTidakHadir"];
    const JENIS_DIRI = ["melihat", "ragu"];
    const JENIS_ORTU = ["melihat", "mendengar", "de-auditu", "sebagian", "ragu"];

    function nilaiDapatTidakHadir() {
      const dek = S.ket && S.ket.keadaan && S.ket.keadaan.tidakHadir;
      return dek && Array.isArray(dek.nilai) ? dek.nilai.map(String) : [];
    }

    /** Pihak yang tidak hadir menurut kartu (anak dan calon); orang tua yang tidak hadir hanya tidak diperiksa. */
    function sinkronTidakHadir() {
      const dapat = nilaiDapatTidakHadir();
      S.keadaan.tidakHadir = dapat.filter((kode) => S.kt.periksa[kode] && S.kt.periksa[kode].hadir === false);
    }

    /** Butir keterangan peran ini yang punya versi "berbeda", untuk daftar centang. */
    function butirBedaKet(d) {
      return (S.ket.pertanyaan || []).filter((q) => q.jawaban && q.jawaban.berbeda && [].concat((q.keadaan || {}).peran || []).includes(d.kode));
    }

    function namaPemberi(d, i, banyak) {
      if (banyak === 2) return `${d.label} - ${i === 0 ? "ayah" : "ibu"}`;
      return d.label;
    }

    function gambarKartuPeran(kotak, d) {
      const st = S.kt.periksa[d.kode];
      const kartu = buat("div", "aleta-sdg-alasan aleta-ssk-kartu");
      kartu.setAttribute("data-peran", d.kode);
      kartu.appendChild(buat("div", "aleta-abt-label", d.label));
      kartu.appendChild(
        label(
          "Kehadiran",
          pilihan([["ya", "Hadir"], ["tidak", "Tidak hadir"]], st.hadir ? "ya" : "tidak", (v) => {
            st.hadir = v === "ya";
            sinkronTidakHadir();
            ubahKeadaan();
          })
        )
      );
      if (!st.hadir) {
        if (nilaiDapatTidakHadir().includes(d.kode)) {
          const dek = S.ket.keadaan.sebabTidakHadir;
          if (dek && Array.isArray(dek.nilai)) {
            kartu.appendChild(
              label(
                "Sebab tidak hadir",
                pilihan(
                  dek.nilai.map((n) => [String(n), (dek.labelNilai && dek.labelNilai[n]) || String(n).replace(/-/g, " ")]),
                  String(S.keadaan.sebabTidakHadir || dek.bawaan || dek.nilai[0]),
                  (v) => {
                    S.keadaan.sebabTidakHadir = v;
                    S.kt.hasil = null;
                  }
                )
              )
            );
          }
        }
        kotak.appendChild(kartu);
        return;
      }
      const banyak = d.boleh2 ? (st.jumlah === 2 ? 2 : 1) : 1;
      if (d.boleh2) {
        kartu.appendChild(
          label(
            "Jumlah yang diperiksa",
            pilihan([["1", "1 orang"], ["2", "2 orang (ayah dan ibu)"]], String(banyak), (v) => {
              st.jumlah = Number(v) === 2 ? 2 : 1;
              ubahKeadaan();
            })
          )
        );
      }
      const jenisBoleh = d.kelas === "ortu" ? JENIS_ORTU : JENIS_DIRI;
      for (let i = 0; i < banyak; i += 1) {
        const o = st.orang[i];
        const baris = buat("div", "aleta-sdg-modus aleta-ssk-pemberi");
        baris.setAttribute("data-pemberi", `${d.kode}|${i}`);
        baris.appendChild(buat("span", "aleta-abt-label", namaPemberi(d, i, banyak)));
        const sumberPilih = pilihan(
          m.SUMBER_CERITA.map((x) => [x, x]),
          o.sumber || m.SUMBER_CERITA[0],
          (v) => {
            o.sumber = v;
            S.kt.hasil = null;
          },
          "aleta-sdg-pilih aleta-ssk-sumber"
        );
        sumberPilih.hidden = o.jenis !== "de-auditu";
        baris.appendChild(
          pilihan(
            jenisBoleh.map((j) => [j, labelJenisKet(j)]),
            jenisBoleh.includes(o.jenis) ? o.jenis : "melihat",
            (v) => {
              o.jenis = v;
              S.kt.hasil = null;
              sumberPilih.hidden = v !== "de-auditu";
            }
          )
        );
        baris.appendChild(sumberPilih);
        if (d.kelas === "ortu") {
          const c = buat("label", "aleta-sdg-centang");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = o.wali === true;
          cb.addEventListener("change", () => {
            o.wali = cb.checked;
            S.kt.hasil = null;
          });
          c.appendChild(cb);
          c.appendChild(buat("span", "", "Wali, bukan orang tua kandung (ditulis anak yang saya asuh)"));
          baris.appendChild(c);
        }
        const butirBeda = butirBedaKet(d);
        if (butirBeda.length) {
          const rinci = document.createElement("details");
          rinci.className = "aleta-ssk-beda";
          const ringkas = document.createElement("summary");
          ringkas.textContent = "Keterangannya berbeda atau keberatan pada butir tertentu";
          rinci.appendChild(ringkas);
          for (const q of butirBeda) {
            const c = buat("label", "aleta-sdg-centang");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = o.berbeda.includes(q.id);
            cb.addEventListener("change", () => {
              o.berbeda = cb.checked ? Array.from(new Set([...o.berbeda, q.id])) : o.berbeda.filter((x) => x !== q.id);
              S.kt.hasil = null;
            });
            c.appendChild(cb);
            c.appendChild(buat("span", "", q.hal ? q.hal.replace(/\{[^{}]*\}/g, "…") : q.id));
            rinci.appendChild(c);
          }
          baris.appendChild(rinci);
        }
        kartu.appendChild(baris);
      }
      kotak.appendChild(kartu);
    }

    /** Masukan mesin keterangan dari pilihan di layar. */
    function masukanKet() {
      sinkronTidakHadir();
      const periksa = m.peranTerurut(S.ket).map((d) => {
        const st = S.kt.periksa[d.kode];
        return {
          peran: d.kode,
          hadir: st.hadir,
          jumlah: st.jumlah,
          orang: st.orang.map((o, i) => ({
            jenis: o.jenis,
            sumber: o.sumber,
            berbeda: o.berbeda,
            wali: o.wali,
            perButir: S.kt.perButir[`${d.kode}|${i}`] || {},
          })),
        };
      });
      return {
        keadaan: Object.assign({}, S.keadaan),
        benih: nomor(),
        konfirmasiSebab: S.kt.konfirmasi === true,
        periksa,
        variabel: bacaVar(),
        slot: {},
        tingkat: ["inti", "pilihan", "tambahan"],
      };
    }

    function susunKet() {
      return m.susunKeterangan(S.ket, masukanKet());
    }

    /** Menyalin teks; bila peramban tidak mengizinkan, teks ditaruh di kotak yang dapat dipilih dan disalin sendiri. */
    async function salinTeks(teks, kabar, tempat) {
      let berhasil = false;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(teks);
          berhasil = true;
        }
      } catch {
        berhasil = false;
      }
      if (!berhasil) {
        try {
          const t = document.createElement("textarea");
          t.value = teks;
          t.style.position = "fixed";
          t.style.opacity = "0";
          document.body.appendChild(t);
          t.select();
          berhasil = typeof document.execCommand === "function" && document.execCommand("copy") === true;
          t.remove();
        } catch {
          berhasil = false;
        }
      }
      let kotakManual = tempat.querySelector(".aleta-ssk-salin-teks");
      if (!kotakManual) {
        kotakManual = document.createElement("textarea");
        kotakManual.className = "aleta-ssk-jawab aleta-ssk-salin-teks";
        kotakManual.readOnly = true;
        kotakManual.rows = 6;
        tempat.appendChild(kotakManual);
      }
      kotakManual.value = teks;
      kotakManual.hidden = berhasil;
      kabar.className = berhasil ? "aleta-abt-kabar" : "aleta-abt-kabar aleta-abt-gagal";
      kabar.textContent = berhasil
        ? "Tanya-jawab sudah disalin. Tempel pada bagian pemeriksaan di berita acara."
        : "Peramban tidak mengizinkan menyalin otomatis. Pilih teks pada kotak di bawah lalu salin sendiri.";
    }

    /** Baris tanya-jawab satu pemberi keterangan seperti yang kini tampil (sudah disunting petugas), siap tempel. */
    function teksPemberi(kolom) {
      const baris = [];
      for (const el of Array.from(kolom.querySelectorAll(".aleta-ssk-baris"))) {
        const tanya = String((el.querySelector(".aleta-ssk-tanya") || {}).textContent || "").replace(/^\d+\.\s*/, "");
        const jawab = String((el.querySelector("textarea") || {}).value || "").trim();
        if (jawab) baris.push({ tanya, jawab });
      }
      return m.teksTanyaJawab(baris);
    }

    function gambarHasilKet(wadahKet, kabarKet) {
      wadahKet.textContent = "";
      const h = S.kt.hasil;
      if (!h) return;
      for (const p of h.peringatan) wadahKet.appendChild(buat("div", "aleta-abt-kabar aleta-abt-gagal", p));
      if (h.ditahan.length) {
        wadahKet.appendChild(buat("div", "aleta-abt-kabar", "Butir kehamilan dan hubungan badan belum ikut disusun. Centang konfirmasi di atas bila sudah ditanyakan di persidangan."));
      }
      const semuaKosong = new Set();
      h.pemberi.forEach((pb, idx) => {
        const kolom = buat("div", "aleta-ssk-saksi");
        kolom.setAttribute("data-pemberi", `${pb.peran}|${pb.orangKe}`);
        kolom.appendChild(buat("div", "aleta-abt-label", `${pb.label} - ${labelJenisKet(pb.jenis)}`));
        for (const b of pb.baris) {
          const baris = buat("div", "aleta-ssk-baris");
          baris.setAttribute("data-butir", b.butir);
          baris.setAttribute("data-saksi", String(idx));
          if (b.tandaKuning) baris.classList.add("aleta-ssk-kuning");
          if (b.kosong.length) baris.classList.add("aleta-ssk-merah");
          for (const x of b.kosong) semuaKosong.add(x);
          baris.appendChild(buat("div", "aleta-ssk-tanya", `${b.no}. ${b.tanya}`));
          const jawab = document.createElement("textarea");
          jawab.className = "aleta-ssk-jawab";
          jawab.rows = 2;
          jawab.value = b.jawab;
          baris.appendChild(jawab);
          const butirAsli = S.ket.pertanyaan.find((q) => q.id === b.butir);
          const jenisBoleh = butirAsli ? m.jenisKeteranganButir(butirAsli).filter((j) => j !== "berbeda") : [];
          if (jenisBoleh.length > 1) {
            baris.appendChild(
              pilihan(
                jenisBoleh.map((j) => [j, labelJenisKet(j)]),
                b.jenis === "berbeda" ? "melihat" : b.jenis,
                (v) => {
                  const kunciOrang = `${pb.peran}|${pb.orangKe}`;
                  S.kt.perButir[kunciOrang] = Object.assign({}, S.kt.perButir[kunciOrang], { [b.butir]: v });
                  const baru = susunKet();
                  const pbBaru = baru.pemberi.find((x) => x.ke === pb.ke);
                  const sama = pbBaru && pbBaru.baris.find((x) => x.butir === b.butir);
                  if (sama) {
                    jawab.value = sama.jawab;
                    baris.classList.toggle("aleta-ssk-kuning", sama.tandaKuning);
                    baris.classList.toggle("aleta-ssk-merah", sama.kosong.length > 0);
                  }
                },
                "aleta-sdg-pilih aleta-ssk-jenis-butir"
              )
            );
          }
          if (b.kosong.length) {
            const nk = namaKosong(b.kosong);
            const kabarKosong = buat("div", "aleta-abt-kabar aleta-abt-gagal", `Belum terisi dari data perkara: ${nk.teks} (jadi titik-titik)`);
            if (nk.kode) kabarKosong.title = `Kode isian: ${nk.kode}`;
            baris.appendChild(kabarKosong);
          }
          kolom.appendChild(baris);
        }
        const salin = buat("button", "aleta-permintaan-tombol aleta-ssk-salin", "Salin tanya-jawab ini");
        salin.type = "button";
        salin.addEventListener("click", () => void salinTeks(teksPemberi(kolom), kabarKet, kolom));
        kolom.appendChild(salin);
        wadahKet.appendChild(kolom);
      });
      if (semuaKosong.size) {
        const nsemua = namaKosong(Array.from(semuaKosong));
        const kabarSemua = buat("div", "aleta-abt-kabar aleta-abt-gagal", `Ada titik-titik isian yang harus dilengkapi: ${nsemua.teks}.`);
        if (nsemua.kode) kabarSemua.title = `Kode isian: ${nsemua.kode}`;
        wadahKet.appendChild(kabarSemua);
      }
      if (h.pemberi.length) {
        const semua = buat("button", "aleta-permintaan-tombol aleta-ssk-salin-semua", "Salin semua tanya-jawab ke BAS");
        semua.type = "button";
        semua.addEventListener("click", () => {
          const bagian = Array.from(wadahKet.querySelectorAll(".aleta-ssk-saksi")).map((kolom) => {
            const judul = String((kolom.querySelector(".aleta-abt-label") || {}).textContent || "");
            return `${judul}\n${teksPemberi(kolom)}`;
          });
          void salinTeks(bagian.join("\n\n"), kabarKet, wadahKet);
        });
        wadahKet.appendChild(semua);
      }
    }

    function gambarKeterangan(form) {
      for (const c of S.ket.catatanPetugas || []) form.appendChild(buat("div", "aleta-abt-kabar", c));
      form.appendChild(buat("div", "aleta-abt-kabar", "Pilih siapa yang hadir dan jenis keterangannya, lalu susun."));
      gambarKeadaan(form, S.ket, KEADAAN_KARTU);
      // butir yang sensitif tidak ikut tercetak sebelum petugas mengonfirmasi (bawaan: mati)
      if (["hamil", "hubungan-badan"].includes(String(S.keadaan.sebabDK))) {
        const c = buat("label", "aleta-sdg-centang aleta-ssk-konfirmasi");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = S.kt.konfirmasi === true;
        cb.addEventListener("change", () => {
          S.kt.konfirmasi = cb.checked;
          S.kt.hasil = null;
        });
        c.appendChild(cb);
        c.appendChild(buat("span", "", "Butir kehamilan dan hubungan badan sudah ditanyakan di persidangan dan boleh ikut dicetak"));
        form.appendChild(c);
        if (!S.kt.konfirmasi) form.appendChild(buat("div", "aleta-abt-kabar", "Selama belum dicentang, butir kehamilan dan hubungan badan tidak ikut disusun."));
      }
      const kotak = buat("div", "aleta-sdg-alasan aleta-ssk-kartu-wadah");
      kotak.appendChild(buat("div", "aleta-abt-label", "Pihak yang didengar keterangannya"));
      for (const d of m.peranTerurut(S.ket)) gambarKartuPeran(kotak, d);
      form.appendChild(kotak);
      const aksi = buat("div", "aleta-abt-aksi");
      const tSusun = buat("button", "aleta-permintaan-tombol aleta-ssk-susun-ket", "Susun tanya-jawab keterangan");
      tSusun.type = "button";
      aksi.appendChild(tSusun);
      form.appendChild(aksi);
      const kabarKet = buat("div", "aleta-abt-kabar");
      form.appendChild(kabarKet);
      const wadahKet = buat("div", "aleta-sdg-hasil aleta-ssk-hasil-ket");
      form.appendChild(wadahKet);
      tSusun.addEventListener("click", () => {
        kabarKet.className = "aleta-abt-kabar";
        try {
          S.kt.hasil = susunKet();
          gambarHasilKet(wadahKet, kabarKet);
          kabarKet.textContent = S.kt.hasil.pemberi.length
            ? "Baca dan sunting setiap jawaban sebelum disalin. Baris kuning = ragu, sebagian, atau berbeda."
            : "Tidak ada pihak yang hadir untuk diperiksa.";
        } catch (galat) {
          kabarKet.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarKet.textContent = String((galat && galat.message) || galat);
        }
      });
      if (S.kt.hasil) gambarHasilKet(wadahKet, kabarKet);
    }

    /** Katalog ini punya butir arah Tergugat (versi Tergugat atas harta bersama, kewarisan) yang menggantikan butir arah Penggugat. */
    function adaButirTergugat() {
      return Boolean(S.kat && (S.kat.pertanyaan || []).some((q) => Array.isArray(q.menggantikan) && q.menggantikan.length && (q.pihakSaksi || []).includes("T")));
    }

    /** Menjalankan mesin atas pilihan sekarang. */
    function susun() {
      const kodeVar = bacaVar();
      const slot = Object.assign({}, S.isian);
      for (const kunci of Object.keys(slot)) if (!String(slot[kunci] || "").trim()) delete slot[kunci];
      slot.pelaku = `#${S.pelaku}#`;
      slot.korban = `#${S.pelaku === "0047" ? "0046" : "0047"}#`;
      const keadaan = Object.assign({}, S.keadaan);
      const saksiMasuk = S.saksi.map((s, i) => ({
        pihak: s.pihak,
        jenis: s.jenis,
        perButir: S.perButir[i] || {},
        berbeda: s.berbeda,
      }));
      const slotSaksi = S.saksi.map((s) => (s.jenis === "de-auditu" && String(s.sumber || "").trim() ? { sumber: s.sumber.trim() } : {}));
      const hasilSusun = m.susunSaksi(S.kat, {
        keadaan,
        benih: nomor(),
        saksi: saksiMasuk,
        variabel: kodeVar,
        slot,
        slotSaksi,
        tingkat: ["inti", "pilihan", "tambahan"],
      });
      // saksi Tergugat tanpa bantahan yang ditandai hanya mendapat butir netral: ingatkan petugas
      if (adaButirTergugat() && S.saksi.some((x) => x.pihak === "T") && ![].concat(keadaan.bantahan === undefined ? [] : keadaan.bantahan).length) {
        hasilSusun.peringatan.push(`Saksi ${sebutan("0047", TULISAN_PIHAK.T)} belum menerangkan versinya: tandai bantahan ${sebutan("0047", TULISAN_PIHAK.T)} pada keadaan perkara, lalu susun lagi.`);
      }
      return hasilSusun;
    }

    function variabelSimpan(i) {
      const s = S.saksi[i];
      let keDiPihak = 0;
      for (let j = 0; j < i; j += 1) if (S.saksi[j].pihak === s.pihak) keDiPihak += 1;
      return typeof k.variabelSaksi === "function" ? k.variabelSaksi(s.pihak, keDiPihak + 1) : "";
    }

    function gambarHasil(wadahHasil) {
      wadahHasil.textContent = "";
      const h = S.hasil;
      if (!h) return;
      for (const p of h.peringatan) wadahHasil.appendChild(buat("div", "aleta-abt-kabar aleta-abt-gagal", p));
      const semuaKosong = new Set();
      h.saksi.forEach((sk, i) => {
        const kolom = buat("div", "aleta-ssk-saksi");
        const kepala = buat("div", "aleta-abt-label", `Saksi ${sk.ke} - ${LABEL_JENIS[S.saksi[i].jenis]} (diajukan oleh ${sk.pihak === "T" ? sebutan("0047", TULISAN_PIHAK.T) : sebutan("0046", TULISAN_PIHAK.P)})`);
        kolom.appendChild(kepala);
        if (!variabelSimpan(i)) kolom.appendChild(buat("div", "aleta-abt-kabar aleta-abt-gagal", "Tidak ada variabel tanya-jawab di ABT untuk saksi ini (batas 5 saksi Penggugat dan 4 saksi Tergugat)."));
        for (const b of sk.baris) {
          const baris = buat("div", "aleta-ssk-baris");
          baris.setAttribute("data-butir", b.butir);
          baris.setAttribute("data-saksi", String(i));
          if (b.tandaKuning) baris.classList.add("aleta-ssk-kuning");
          if (b.kosong.length) baris.classList.add("aleta-ssk-merah");
          for (const x of b.kosong) semuaKosong.add(x);
          const tanya = buat("div", "aleta-ssk-tanya", `${b.no}. ${b.tanya}`);
          const jawab = document.createElement("textarea");
          jawab.className = "aleta-ssk-jawab";
          jawab.rows = 2;
          jawab.value = b.jawab;
          jawab.addEventListener("input", () => {
            jawab.setAttribute("data-disunting", "1");
          });
          baris.appendChild(tanya);
          baris.appendChild(jawab);
          const butirAsli = S.kat.pertanyaan.find((q) => q.id === b.butir);
          const jenisBoleh = butirAsli ? m.jenisKeteranganButir(butirAsli).filter((j) => j !== "berbeda") : [];
          if (jenisBoleh.length > 1) {
            baris.appendChild(
              pilihan(
                jenisBoleh.map((j) => [j, LABEL_JENIS[j]]),
                b.jenis === "berbeda" ? "melihat" : b.jenis,
                (v) => {
                  S.perButir[i] = Object.assign({}, S.perButir[i], { [b.butir]: v });
                  const baru = susun();
                  const sama = baru.saksi[i].baris.find((x) => x.butir === b.butir);
                  if (sama) {
                    jawab.value = sama.jawab;
                    baris.classList.toggle("aleta-ssk-kuning", sama.tandaKuning);
                    baris.classList.toggle("aleta-ssk-merah", sama.kosong.length > 0);
                    S.hasil.saksi[i].baris = S.hasil.saksi[i].baris.map((x) => (x.butir === b.butir ? sama : x));
                  }
                },
                "aleta-sdg-pilih aleta-ssk-jenis-butir"
              )
            );
          }
          if (b.kosong.length) {
            const nk = namaKosong(b.kosong);
            const kabarKosong = buat("div", "aleta-abt-kabar aleta-abt-gagal", `Belum terisi dari data perkara: ${nk.teks} (jadi titik-titik)`);
            if (nk.kode) kabarKosong.title = `Kode isian: ${nk.kode}`;
            baris.appendChild(kabarKosong);
          }
          kolom.appendChild(baris);
        }
        wadahHasil.appendChild(kolom);
      });
      if (semuaKosong.size) {
        const nsemua = namaKosong(Array.from(semuaKosong));
        const kabarSemua = buat("div", "aleta-abt-kabar aleta-abt-gagal", `Ada titik-titik isian yang harus dilengkapi: ${nsemua.teks}.`);
        if (nsemua.kode) kabarSemua.title = `Kode isian: ${nsemua.kode}`;
        wadahHasil.appendChild(kabarSemua);
      }
    }

    let kabarBorang = null;
    let wadahHasil = null;
    let tombolSimpan = null;

    async function periksaSudahAda() {
      S.sudahAda = [];
      if (typeof k.ambilTanyaJawab !== "function") return;
      for (let i = 0; i < S.saksi.length; i += 1) {
        const kode = variabelSimpan(i);
        if (!kode) {
          S.sudahAda.push(0);
          continue;
        }
        try {
          const ada = await k.ambilTanyaJawab(kode);
          S.urutan = String(ada.urutan);
          S.sudahAda.push(ada.baris.length);
        } catch {
          S.sudahAda.push(0);
        }
      }
    }

    function gambarUlang() {
      wadah.textContent = "";
      if (!S.kat) {
        gambarPilihJenis();
        return;
      }
      const form = buat("div", "aleta-sdg-form");
      form.appendChild(buat("div", "aleta-abt-label", `Susun saksi - ${S.kat.judul}`));
      for (const c of S.kat.catatanPetugas || []) form.appendChild(buat("div", "aleta-abt-kabar", c));
      // hanya dasar hukum yang sudah terverifikasi yang ditampilkan; yang belum tetap metadata
      const dasar = (S.kat.dasarHukum || []).filter((d) => d.status === "terverifikasi");
      if (dasar.length) {
        const rinci = document.createElement("details");
        rinci.className = "aleta-ssk-dasar";
        const ringkas = document.createElement("summary");
        ringkas.textContent = "Dasar hukum pokok pembuktian";
        rinci.appendChild(ringkas);
        for (const d of dasar) rinci.appendChild(buat("div", "aleta-abt-kabar", `${d.rujukan}: ${d.uraian}`));
        form.appendChild(rinci);
      }
      if (S.ket) {
        // dua tab: saksi, dan keterangan anak, calon, dan orang tua (hanya jenis perkara yang punya katalog keterangan)
        const bar = buat("div", "aleta-ssk-tab");
        for (const [nilai, teks] of [["saksi", "Saksi"], ["keterangan", "Keterangan anak, calon, dan orang tua"]]) {
          const t = buat("button", "aleta-permintaan-tombol aleta-ssk-tab-tombol", teks);
          t.type = "button";
          t.setAttribute("data-tab", nilai);
          t.setAttribute("aria-pressed", S.tab === nilai ? "true" : "false");
          if (S.tab === nilai) t.classList.add("aleta-ssk-tab-aktif");
          t.addEventListener("click", () => {
            if (S.tab === nilai) return;
            S.tab = nilai;
            gambarUlang();
          });
          bar.appendChild(t);
        }
        form.appendChild(bar);
        if (S.tab === "keterangan") {
          gambarKeterangan(form);
          wadah.appendChild(form);
          return;
        }
      }
      gambarKeadaan(form);
      gambarSaksi(form);
      gambarIsian(form);
      const aksi = buat("div", "aleta-abt-aksi");
      const tSusun = buat("button", "aleta-permintaan-tombol", "Susun pertanyaan dan jawaban");
      tSusun.type = "button";
      tSusun.addEventListener("click", async () => {
        tSusun.disabled = true;
        kabarBorang.className = "aleta-abt-kabar";
        kabarBorang.textContent = "Menyusun…";
        try {
          S.hasil = susun();
          await periksaSudahAda();
          gambarHasil(wadahHasil);
          const adaIsi = S.sudahAda.some((n) => n > 0);
          kabarBorang.textContent = adaIsi
            ? `Sudah ada keterangan di ABT untuk ${S.sudahAda.filter((n) => n > 0).length} saksi; menyimpan akan MENIMPANYA. Baca dan sunting dulu.`
            : "Baca dan sunting setiap jawaban sebelum disimpan. Baris kuning = ragu / sebagian / berbeda.";
          tombolSimpan.hidden = false;
          tombolSimpan.disabled = false;
        } catch (galat) {
          kabarBorang.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarBorang.textContent = String((galat && galat.message) || galat);
        } finally {
          tSusun.disabled = false;
        }
      });
      aksi.appendChild(tSusun);
      tombolSimpan = buat("button", "aleta-permintaan-tombol", "Simpan ke ABT");
      tombolSimpan.type = "button";
      tombolSimpan.hidden = true;
      tombolSimpan.addEventListener("click", simpan);
      aksi.appendChild(tombolSimpan);
      form.appendChild(aksi);
      kabarBorang = buat("div", "aleta-abt-kabar");
      form.appendChild(kabarBorang);
      wadahHasil = buat("div", "aleta-sdg-hasil");
      form.appendChild(wadahHasil);
      wadah.appendChild(form);
    }

    function gambarPilihJenis() {
      const { alur } = kenali();
      const form = buat("div", "aleta-sdg-form");
      form.appendChild(buat("div", "aleta-abt-kabar", "Jenis perkara tidak terbaca di halaman ini. Pilih jenis perkaranya."));
      const kandidat = kandidatKatalog(alur);
      const sel = pilihan([["", "- pilih jenis perkara -"], ...kandidat.map((c) => [c.kunci, c.judul])], "", (v) => {
        const kat = kandidat.find((c) => c.kunci === v);
        if (kat) {
          atur(kat);
          gambarUlang();
        }
      });
      form.appendChild(label("Jenis perkara", sel));
      wadah.appendChild(form);
    }

    async function simpan() {
      if (!S.hasil) return;
      tombolSimpan.disabled = true;
      kabarBorang.className = "aleta-abt-kabar";
      const gagal = [];
      let tersimpan = 0;
      const timpa = S.sudahAda.some((n) => n > 0);
      if (timpa && !wadah.querySelector(".aleta-ssk-setuju")) {
        // minta persetujuan eksplisit sekali
        const c = buat("label", "aleta-sdg-centang aleta-ssk-setuju");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        c.appendChild(cb);
        c.appendChild(buat("span", "", "Saya setuju menimpa keterangan saksi yang sudah ada di ABT"));
        wadah.querySelector(".aleta-sdg-form").insertBefore(c, kabarBorang);
        kabarBorang.className = "aleta-abt-kabar aleta-abt-gagal";
        kabarBorang.textContent = "Centang persetujuan menimpa, lalu tekan Simpan lagi.";
        tombolSimpan.disabled = false;
        return;
      }
      if (timpa) {
        const cb = wadah.querySelector(".aleta-ssk-setuju input");
        if (!cb || !cb.checked) {
          kabarBorang.className = "aleta-abt-kabar aleta-abt-gagal";
          kabarBorang.textContent = "Persetujuan menimpa belum dicentang.";
          tombolSimpan.disabled = false;
          return;
        }
      }
      for (let i = 0; i < S.hasil.saksi.length; i += 1) {
        const kode = variabelSimpan(i);
        const nama = `saksi ${i + 1}`;
        if (!kode) {
          gagal.push(`${nama}: tidak ada variabel tanya-jawab untuknya di ABT`);
          continue;
        }
        const kolom = wadahHasil.querySelectorAll(".aleta-ssk-saksi")[i];
        const baris = [];
        if (kolom) {
          for (const el of Array.from(kolom.querySelectorAll(".aleta-ssk-baris"))) {
            const tanya = String((el.querySelector(".aleta-ssk-tanya") || {}).textContent || "").replace(/^\d+\.\s*/, "");
            const jawab = String((el.querySelector("textarea") || {}).value || "").trim();
            if (jawab) baris.push({ no: String(baris.length + 1), tanya, jawab });
          }
        }
        kabarBorang.textContent = `Menyimpan keterangan ${nama} (${i + 1} dari ${S.hasil.saksi.length})…`;
        try {
          const sebelum = typeof k.nilaiVariabel === "function" ? k.nilaiVariabel(kode) : "";
          const r = await k.kirimTanyaJawab(kode, S.urutan || (typeof k.urutanSidang === "function" ? k.urutanSidang() : "1"), baris);
          if (!r.ok) {
            gagal.push(`${nama}: ${r.pesan}`);
            continue;
          }
          tersimpan += 1;
          if (typeof k.catatRiwayat === "function") {
            const jati = typeof k.jatiDiri === "function" ? k.jatiDiri() : null;
            void k.catatRiwayat({
              perkaraId: jati ? jati.perkaraId : "",
              kode,
              nama: `Keterangan ${nama}`,
              sebelum,
              sesudah: `${baris.length} tanya-jawab dari katalog ${S.kat.judul}`,
              cara: `disusun dari katalog ${S.kat.judul} (${LABEL_JENIS[S.saksi[i].jenis]}), diperiksa dan disimpan petugas`,
              pada: new Date().toISOString(),
            });
          }
        } catch (galat) {
          gagal.push(`${nama}: ${String((galat && galat.message) || galat)}`);
        }
      }
      tombolSimpan.disabled = false;
      kabarBorang.className = gagal.length ? "aleta-abt-kabar aleta-abt-gagal" : "aleta-abt-kabar";
      kabarBorang.textContent = gagal.length
        ? `${tersimpan} tersimpan, ${gagal.length} gagal - ${gagal.join("; ")}`
        : `Keterangan ${tersimpan} saksi tersimpan di ABT. Muat ulang halaman supaya isi variabel keterangan saksi ikut berubah.`;
      if (!gagal.length && typeof k.halamanTanyaJawab === "function" && k.halamanTanyaJawab()) {
        kabarBorang.textContent = "Tersimpan. Halaman dimuat ulang…";
        setTimeout(() => location.reload(), 900);
      }
    }

    // ── tombol ──────────────────────────────────────────────────────────
    tombol.addEventListener("click", () => {
      if (!wadah.hidden) {
        wadah.hidden = true;
        return;
      }
      const { kat } = kenali();
      if (kat && (!S.kat || S.kat.kunci !== kat.kunci)) atur(kat);
      wadah.hidden = false;
      gambarUlang();
    });

    // singgahan: simpan dari blangko, baca di halaman tanya-jawab
    const n = nomor();
    const kodeSimpan = kodeDipakaiKatalog(DataKatalog());
    const p = peta();
    if (p && p.size >= 5) tulisSinggahan(n, p, kodeSimpan);
    void bacaSinggahan(n).then((c) => {
      S.singgahan = c || {};
    });
    segarkanTombol();
    // Mode tampilan (Lama/Baru/UI Baru) baru diketahui sesudah pengaturan terbaca: tombol dinilai ulang.
    try {
      document.addEventListener("aleta-uji-berubah", segarkanTombol);
    } catch {
      /* tanpa dokumen */
    }

    // uji
    hasil._uji = { S, kenali, susun, atur, gambarUlang, variabelSimpan, susunKet };
    return hasil;
  }

  globalThis.AletaSaksiSusun = Object.freeze({
    pasang,
    katalogUntuk,
    kandidatKatalog,
    kehadiranDariTeks,
    turunkanKeadaan,
    pembaca,
    kodeDipakaiKatalog,
    BATAS_SAKSI,
  });
})();
