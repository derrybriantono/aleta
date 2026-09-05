"use strict";

/**
 * Jembatan ke dunia halaman SIPP.
 *
 * ============================================================================
 * KENAPA BERKAS INI TERPISAH
 * ============================================================================
 *
 * konten.js berjalan di dunia TERASING. Ia berbagi DOM dengan halaman SIPP,
 * tetapi tidak berbagi obyek JavaScript-nya - window.jQuery, window.CKEDITOR,
 * dan select2 milik halaman tidak terlihat dari sana sama sekali.
 *
 * Untuk isian biasa itu tidak jadi soal: menyetel value lalu melepas peristiwa
 * input dan change sudah cukup. Tetapi SIPP memakai select2 untuk daftar hakim
 * dan CKEditor untuk isian panjang, dan keduanya menyimpan nilainya di dalam
 * obyek JavaScript, bukan di DOM. Menyetel value pada elemen aslinya membuat
 * tampilannya berubah tanpa nilainya ikut berubah - dan yang tersimpan
 * kemudian bukan yang terlihat.
 *
 * Berkas ini berjalan di dunia UTAMA supaya dapat menyentuh obyek itu.
 *
 * ============================================================================
 * IA TIDAK MEMUTUSKAN APA PUN
 * ============================================================================
 *
 * Jembatan hanya mengerjakan tiga hal yang diminta: menyebutkan medan apa yang
 * ada di halaman, mengisi satu medan, dan menekan satu tombol. Ia tidak tahu
 * perkara, tidak tahu penunjukan, dan tidak menghubungi siapa pun.
 *
 * Seluruh keputusan - siapa yang ditunjuk, medan mana yang diisi, apakah
 * tombolnya boleh ditekan - dibuat di sisi lain dan sudah lewat pemeriksaan
 * kewenangan di server. Menaruh keputusan di sini berarti menaruhnya di dunia
 * yang sama dengan halaman SIPP, tempat skrip apa pun dapat memanggilnya.
 */

(function () {
  const TANDA = "aleta-jembatan";
  const TANDA_JAWAB = "aleta-jembatan-jawab";

  /**
   * Pemilih CSS yang aman untuk dijalankan.
   *
   * Penunjuk medan datang dari pengaturan ALETA, yang hanya dapat disunting
   * Super Admin. Meski begitu ia tetap diperiksa di sini: pemilih yang tidak
   * sah membuat querySelector melempar, dan lemparan di tengah pengisian
   * meninggalkan borang setengah terisi tanpa ada yang tahu medan mana yang
   * gagal.
   */
  function cariElemen(penunjuk) {
    if (typeof penunjuk !== "string" || penunjuk.trim() === "") return null;
    try {
      return document.querySelector(penunjuk);
    } catch (galat) {
      return null;
    }
  }

  /** Label yang tampak untuk satu medan - dipakai mode baca borang. */
  function labelMedan(elemen) {
    if (elemen.id) {
      const label = document.querySelector(`label[for="${CSS.escape(elemen.id)}"]`);
      if (label) return String(label.textContent || "").trim().slice(0, 80);
    }
    const induk = elemen.closest(".form-group, .control-group, tr, div");
    if (induk) {
      const label = induk.querySelector("label");
      if (label) return String(label.textContent || "").trim().slice(0, 80);
    }
    return "";
  }

  /** Penunjuk yang paling tidak mudah basi untuk satu elemen. */
  function penunjukUntuk(elemen) {
    if (elemen.id) return `#${CSS.escape(elemen.id)}`;
    const nama = elemen.getAttribute("name");
    if (nama) return `${elemen.tagName.toLowerCase()}[name="${nama}"]`;
    return "";
  }

  /**
   * Menyebutkan medan apa saja yang ada di halaman ini.
   *
   * Inilah yang membuat peta medan diisi dari kenyataan, bukan dari ingatan.
   * Nilai medannya TIDAK ikut disebutkan - yang dibutuhkan hanya namanya, dan
   * borang perkara yang sedang terbuka memuat data pihak berperkara.
   */
  function bacaBorang() {
    const hasil = [];
    const semua = document.querySelectorAll("input, select, textarea");

    for (const elemen of semua) {
      const jenisMasukan = String(elemen.type || "").toLowerCase();
      if (jenisMasukan === "hidden" || jenisMasukan === "password") continue;
      if (elemen.closest("#aleta-panel")) continue; // panel ALETA sendiri

      hasil.push({
        tag: elemen.tagName.toLowerCase(),
        jenisMasukan,
        nama: elemen.getAttribute("name") || "",
        id: elemen.id || "",
        penunjuk: penunjukUntuk(elemen),
        label: labelMedan(elemen),
        // Petunjuk bahwa medan ini bukan isian biasa, sehingga yang menyusun
        // petanya tahu harus memilih jenis apa.
        select2: Boolean(elemen.classList.contains("select2") || elemen.nextElementSibling?.classList?.contains("select2")),
        ckeditor: Boolean(window.CKEDITOR && elemen.id && window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id]),
        jumlahPilihan: elemen.tagName.toLowerCase() === "select" ? elemen.options.length : 0,
      });
      if (hasil.length >= 300) break;
    }

    return { ok: true, medan: hasil };
  }

  /** Melepas peristiwa yang biasa ditunggu kerangka kerja halaman. */
  function lepasPeristiwa(elemen) {
    for (const nama of ["input", "change", "blur"]) {
      elemen.dispatchEvent(new Event(nama, { bubbles: true }));
    }
  }

  /**
   * Mengisi satu medan, lalu MEMBACANYA KEMBALI.
   *
   * Yang dikembalikan bukan "sudah diisi" melainkan nilai yang benar-benar
   * terbaca sesudahnya. Bedanya penting: select2 yang pilihannya belum dimuat
   * akan menerima setelan tanpa protes dan tetap kosong, dan tanpa pembacaan
   * ulang itu tampak berhasil.
   */
  function isiMedan(penunjuk, jenis, nilai) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const teks = String(nilai === null || nilai === undefined ? "" : nilai);

    try {
      if (jenis === "kaya" && window.CKEDITOR && elemen.id) {
        const editor = window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id];
        if (editor) {
          editor.setData(teks);
          return { ok: true, terbaca: String(editor.getData() || "").trim() };
        }
        // CKEditor diminta tetapi tidak ada - jatuh ke isian biasa, dan itu
        // disebutkan, bukan didiamkan.
        elemen.value = teks;
        lepasPeristiwa(elemen);
        return { ok: true, terbaca: elemen.value, catatan: "ckeditor_tidak_ada" };
      }

      if (jenis === "pilih" || elemen.tagName.toLowerCase() === "select") {
        // Dicocokkan dengan nilai option lebih dulu, lalu dengan tulisannya.
        // SIPP kerap memakai id sebagai nilai dan nama orang sebagai tulisan,
        // dan pemanggil belum tentu tahu yang mana yang dipegang halaman ini.
        let terpilih = "";
        for (const pilihan of elemen.options || []) {
          if (String(pilihan.value) === teks) {
            terpilih = pilihan.value;
            break;
          }
        }
        if (!terpilih) {
          const bandingan = teks.trim().toLowerCase();
          for (const pilihan of elemen.options || []) {
            if (String(pilihan.textContent || "").trim().toLowerCase() === bandingan) {
              terpilih = pilihan.value;
              break;
            }
          }
        }
        if (!terpilih) {
          return {
            ok: false,
            alasan: "pilihan_tidak_ada",
            penunjuk,
            // Beberapa pilihan pertama ikut dikirim supaya yang membaca tahu
            // bentuk nilainya, tanpa memuntahkan seluruh daftar.
            contoh: [...(elemen.options || [])]
              .slice(0, 5)
              .map((x) => ({ nilai: x.value, tulisan: String(x.textContent || "").trim() })),
          };
        }

        elemen.value = terpilih;
        lepasPeristiwa(elemen);
        // select2 menyimpan nilainya sendiri; tanpa trigger jQuery, tampilannya
        // tidak ikut berubah walau nilainya sudah benar.
        if (window.jQuery) {
          try {
            window.jQuery(elemen).val(terpilih).trigger("change");
          } catch (galat) {
            /* halaman tanpa select2 - setelan biasa di atas sudah cukup */
          }
        }
        return { ok: true, terbaca: elemen.value };
      }

      elemen.value = teks;
      lepasPeristiwa(elemen);

      // Datepicker jQuery UI menyimpan tanggalnya terpisah dari value.
      if (jenis === "tanggal" && window.jQuery) {
        try {
          const kotak = window.jQuery(elemen);
          if (kotak.datepicker) kotak.datepicker("setDate", teks);
          kotak.trigger("change");
        } catch (galat) {
          /* bukan datepicker - value di atas sudah cukup */
        }
      }

      return { ok: true, terbaca: elemen.value };
    } catch (galat) {
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200), penunjuk };
    }
  }

  /**
   * Menekan satu tombol.
   *
   * Dipakai hanya bila penyimpanan otomatis dinyalakan di pengaturan ALETA -
   * dan bawaannya mati. Jembatan tidak memeriksa setelan itu sendiri; ia hanya
   * mengerjakan yang diminta. Yang memeriksanya server, sebelum permintaan ini
   * pernah dikirim.
   */
  function tekanTombol(penunjuk) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "tombol_tidak_ketemu", penunjuk };
    if (elemen.disabled) return { ok: false, alasan: "tombol_mati", penunjuk };

    try {
      elemen.click();
      return { ok: true };
    } catch (galat) {
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200) };
    }
  }

  window.addEventListener("message", (peristiwa) => {
    // Hanya pesan dari halaman ini sendiri. Bingkai lain dan jendela lain
    // tidak boleh menyuruh jembatan mengisi apa pun.
    if (peristiwa.source !== window) return;

    const pesan = peristiwa.data;
    if (!pesan || pesan.sumber !== TANDA) return;

    let jawab;
    if (pesan.jenis === "baca") {
      jawab = bacaBorang();
    } else if (pesan.jenis === "isi") {
      jawab = isiMedan(pesan.penunjuk, pesan.jenisMedan, pesan.nilai);
    } else if (pesan.jenis === "tekan") {
      jawab = tekanTombol(pesan.penunjuk);
    } else {
      jawab = { ok: false, alasan: "permintaan_tidak_dikenali" };
    }

    window.postMessage({ sumber: TANDA_JAWAB, id: pesan.id, ...jawab }, "*");
  });
})();
