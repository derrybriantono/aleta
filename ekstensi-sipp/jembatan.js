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

  /**
   * Tulisan yang berdiri TEPAT SESUDAH sebuah kotak centang atau radio.
   *
   * ==========================================================================
   * INI BENTUK HTML YANG PALING TUA, DAN SIPP MASIH MEMAKAINYA
   * ==========================================================================
   *
   * application/views/putusan/edit_putusan_akhir.php menulis Sumber Hukum
   * begini:
   *
   *   echo "<input type='checkbox' name='sumber_hukum[]' value=" . $row->id
   *        . " />" . $row->nama . "<br/>";
   *
   * Tidak ada <label>, tidak ada id - namanya SIMPUL TEKS telanjang di
   * sebelah kotaknya. Pencarian <label> karena itu memulangkan kosong, dan
   * yang terkirim ke ALETA sebagai "label" adalah nilainya: 8, 9, 10.
   *
   * Akibatnya tepat seperti yang terlihat di panel: keenam sumber hukum
   * bernilai nol, dan Sumber Hukum selalu menjawab "tidak ditemukan" pada
   * putusan yang jelas-jelas menyebut tiga di antaranya.
   *
   * Dibaca sampai <br>, kotak berikutnya, atau akhir induknya - itulah batas
   * satu butir pada bentuk penulisan ini.
   */
  function tulisanSesudah(elemen) {
    let kata = "";
    let simpul = elemen.nextSibling;
    while (simpul) {
      if (simpul.nodeType === 3) {
        kata += simpul.textContent || "";
      } else if (simpul.nodeType === 1) {
        const tag = simpul.tagName.toLowerCase();
        // <br> mengakhiri butir ini; kotak berikutnya apalagi.
        if (tag === "br" || tag === "input" || tag === "select" || tag === "textarea") break;
        kata += simpul.textContent || "";
      }
      simpul = simpul.nextSibling;
    }
    return kata.trim().slice(0, 80);
  }

  /** Label yang tampak untuk satu medan - dipakai mode baca borang. */
  function labelMedan(elemen) {
    if (elemen.id) {
      const label = document.querySelector(`label[for="${CSS.escape(elemen.id)}"]`);
      if (label) return String(label.textContent || "").trim().slice(0, 80);
    }

    // Kotak centang dan radio: yang menamainya hampir selalu tulisan di
    // sebelahnya, bukan <label> milik barisnya. Dicari SEBELUM induknya,
    // sebab <label> milik baris menamai SELURUH kelompok - "Sumber Hukum"
    // untuk keenam kotaknya sekaligus, yang membuat keenamnya kembar.
    const jenis = String(elemen.type || "").toLowerCase();
    if (jenis === "checkbox" || jenis === "radio") {
      const sebelah = tulisanSesudah(elemen);
      if (sebelah) return sebelah;
      // Sebagian borang membungkusnya: <label><input> Nusyuz</label>.
      const pembungkus = elemen.closest("label");
      if (pembungkus) {
        const isi = String(pembungkus.textContent || "").trim();
        if (isi) return isi.slice(0, 80);
      }
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
        // ====================================================================
        // ISI KOLOMNYA IKUT - SEPOTONG, DAN BUKAN DARI SEMBARANG KOLOM
        // ====================================================================
        //
        // Dipakai menebak peta kolom: kolom yang berisi nama juru sita yang
        // diusulkan ALETA hampir pasti kolom juru sita. Tebakan dari ISI dapat
        // diperiksa; tebakan dari nama kolom tidak.
        //
        // Kolom hidden dan password sudah disaring di atas, panel ALETA
        // sendiri juga. Yang tersisa dipotong 200 aksara - yang dicocokkan
        // nama dan tanggal, dan tidak ada gunanya membawa posita sepanjang
        // tiga halaman melintasi jembatan hanya untuk itu.
        nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value).slice(0, 200),
      });
      if (hasil.length >= 300) break;
    }

    return { ok: true, medan: hasil };
  }

  /**
   * Daftar pilihan satu medan, beserta apakah medannya sedang TAMPAK.
   *
   * ============================================================================
   * KENAPA "TAMPAK" IKUT DILAPORKAN
   * ============================================================================
   *
   * Borang Putusan Akhir menampilkan medan yang berbeda-beda menurut jenis
   * perkara dan status putusannya: faktor perceraian hanya muncul pada perkara
   * perceraian yang dikabulkan, alasan dispensasi hanya pada perkara dispensasi
   * kawin, keadaan istri hanya pada keadaan tertentu lagi. SIPP sendiri yang
   * menyembunyikan dan menampilkannya.
   *
   * Karena itu ekstensi tidak perlu tahu satu pun aturan itu: medan yang
   * tersembunyi TIDAK diisi, dan yang menentukan tersembunyi atau tidak adalah
   * halamannya sendiri. Aturan yang disalin ke ekstensi akan menyimpang diam-
   * diam pada hari SIPP mengubahnya.
   *
   * Yang dikembalikan APA ADANYA dari halaman - nilai dan tulisannya - supaya
   * tidak ada satu pun nomor pilihan SIPP yang perlu dihafal di tempat lain.
   */
  function bacaPilihan(penunjuk) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const tampak = Boolean(elemen.offsetParent !== null || elemen.getClientRects().length);
    const tag = elemen.tagName.toLowerCase();

    if (tag === "select") {
      const pilihan = Array.from(elemen.options).map((opsi) => ({
        nilai: opsi.value,
        label: (opsi.textContent || "").trim(),
        terpilih: opsi.selected,
      }));
      return { ok: true, penunjuk, tag, tampak, nilaiSekarang: elemen.value, pilihan };
    }

    // Kelompok radio dibaca lewat namanya - "nusyuz" dan "tidak_nusyuz" adalah
    // dua elemen dengan satu nama, dan yang berarti bagi pemanggil adalah
    // kelompoknya, bukan salah satu kotaknya.
    if (tag === "input" && (elemen.type === "radio" || elemen.type === "checkbox")) {
      const nama = elemen.getAttribute("name") || "";
      const sekelompok = nama
        ? Array.from(document.querySelectorAll(`input[name="${CSS.escape(nama)}"]`))
        : [elemen];
      const pilihan = sekelompok.map((kotak) => ({
        nilai: kotak.value,
        label: (labelMedan(kotak) || kotak.value || "").trim(),
        terpilih: kotak.checked,
      }));
      const terpilih = sekelompok.find((kotak) => kotak.checked);
      return {
        ok: true,
        penunjuk,
        tag: elemen.type,
        tampak,
        nilaiSekarang: terpilih ? terpilih.value : "",
        pilihan,
      };
    }

    return { ok: true, penunjuk, tag, tampak, nilaiSekarang: elemen.value ?? "", pilihan: [] };
  }

  /**
   * Nilai satu medan APA ADANYA, termasuk yang dipegang CKEditor.
   *
   * ============================================================================
   * KENAPA INI TIDAK DAPAT DIKERJAKAN DENGAN elemen.value SAJA
   * ============================================================================
   *
   * Posita dan petitum pada layar Data Umum adalah CKEditor. CKEditor
   * menyimpan isinya di dalam obyek JavaScript miliknya sendiri dan baru
   * menyalinnya ke textarea asli ketika borangnya dikirim. Membaca
   * textarea-nya sebelum itu memulangkan isi TERAKHIR YANG TERSIMPAN - bukan
   * yang sedang diketik petugas.
   *
   * Bedanya justru paling besar tepat ketika bacaan ini dipakai: petugas baru
   * saja menempelkan positanya dan belum menekan Simpan. Membaca textarea di
   * saat itu memulangkan kekosongan, dan usulan yang lahir darinya akan
   * mengaku "tidak ditemukan" atas kalimat yang jelas terpampang di layar.
   *
   * Yang dikembalikan tidak dirapikan sedikit pun - tag HTML-nya utuh. Yang
   * membersihkannya adalah portal, di tempat yang dapat diuji.
   */
  function bacaNilai(penunjuk, jenis) {
    const elemen = cariElemen(penunjuk);
    if (!elemen) return { ok: false, alasan: "medan_tidak_ketemu", penunjuk };

    const tampak = Boolean(elemen.offsetParent !== null || elemen.getClientRects().length);

    try {
      if (jenis === "kaya" && window.CKEDITOR && elemen.id) {
        const editor = window.CKEDITOR.instances && window.CKEDITOR.instances[elemen.id];
        if (editor) {
          return { ok: true, penunjuk, tampak, sumber: "ckeditor", nilai: String(editor.getData() || "") };
        }
        // CKEditor diminta tetapi tidak ada. Textarea-nya tetap dibaca - itu
        // jawaban terbaik yang tersisa - tetapi asalnya disebutkan, bukan
        // didiamkan.
        return {
          ok: true,
          penunjuk,
          tampak,
          sumber: "textarea",
          catatan: "ckeditor_tidak_ada",
          nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value),
        };
      }

      return {
        ok: true,
        penunjuk,
        tampak,
        sumber: "medan",
        nilai: String(elemen.value === null || elemen.value === undefined ? "" : elemen.value),
      };
    } catch (galat) {
      return { ok: false, alasan: String(galat.message || galat).slice(0, 200), penunjuk };
    }
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

      // Radio dan kotak centang tidak diisi dengan menyetel value - itu hanya
      // mengubah nilai yang DIKIRIMKAN kotak itu, bukan memilihnya. Yang benar
      // adalah menemukan anggota kelompok yang nilainya cocok lalu
      // mencentangnya. Tanpa cabang ini, "nusyuz" pada borang putusan tampak
      // terisi sementara yang tersimpan tetap kosong.
      if (elemen.tagName.toLowerCase() === "input" && (elemen.type === "radio" || elemen.type === "checkbox")) {
        const nama = elemen.getAttribute("name") || "";
        const sekelompok = nama
          ? Array.from(document.querySelectorAll(`input[name="${CSS.escape(nama)}"]`))
          : [elemen];
        const cocok =
          sekelompok.find((kotak) => String(kotak.value) === teks) ||
          sekelompok.find(
            (kotak) => (labelMedan(kotak) || "").trim().toLowerCase() === teks.trim().toLowerCase()
          );
        if (!cocok) return { ok: false, alasan: "pilihan_tidak_ada", penunjuk, diminta: teks };
        cocok.checked = true;
        lepasPeristiwa(cocok);
        const terpilih = sekelompok.find((kotak) => kotak.checked);
        return { ok: true, terbaca: terpilih ? terpilih.value : "" };
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
    } else if (pesan.jenis === "pilihan") {
      jawab = bacaPilihan(pesan.penunjuk);
    } else if (pesan.jenis === "nilai") {
      jawab = bacaNilai(pesan.penunjuk, pesan.jenisMedan);
    } else if (pesan.jenis === "isi") {
      jawab = isiMedan(pesan.penunjuk, pesan.jenisMedan, pesan.nilai);
    } else if (pesan.jenis === "tekan") {
      jawab = tekanTombol(pesan.penunjuk);
    } else {
      jawab = { ok: false, alasan: "permintaan_tidak_dikenali" };
    }

    window.postMessage({ sumber: TANDA_JAWAB, id: pesan.id, ...jawab }, "*");
  });

  /**
   * ==========================================================================
   * BIDANG KETIK CKEDITOR LAHIR GELAP, BUKAN DIGELAPKAN SESUDAHNYA
   * ==========================================================================
   *
   * Isi bidang ketik berada di dalam iframe - dokumen tersendiri yang tidak
   * dicapai berkas gaya content script. konten.js menyisipkan gayanya lewat
   * contentDocument, tetapi penyisipan itu menyusul: ia dipicu pengamat DOM
   * yang ditahan 400 milidetik, dan CKEditor sudah menggambar bidangnya jauh
   * sebelum itu.
   *
   * Akibatnya kilatan PUTIH seluas layar tiap kali tingkap dibuka - dan pada
   * layar Putusan Akhir ada tiga bidang sekaligus. Bagi mata, kilatan putih di
   * antara dua keadaan gelap lebih menyakitkan daripada layar yang terang
   * sepanjang waktu.
   *
   * CKEDITOR.addCss menitipkan gaya ke SELURUH bidang ketik yang kelak
   * dibuat - CKEditor menuliskannya ke dalam dokumen iframe pada saat
   * membangunnya, sebelum satu piksel pun digambar. Tidak ada lagi yang
   * menyusul, jadi tidak ada lagi yang berkelebat.
   *
   * Berkas ini berjalan di dunia HALAMAN, dan hanya dari sinilah
   * window.CKEDITOR terlihat. Itu pula sebabnya ia dikerjakan di sini, bukan
   * di konten.js.
   *
   * Penanda temanya dibaca dari elemen html - satu-satunya hal yang memang
   * dibagi kedua dunia. Bila temanya terang, tidak ada yang dititipkan sama
   * sekali, dan CKEditor tampil persis seperti tanpa ekstensi ini.
   */
  const GAYA_ISI_CKEDITOR = [
    "html, body { background: #141d19 !important; color: #dfe8e2 !important; }",
    "body { caret-color: #7fd0a6; }",
    "a { color: #7fd0a6 !important; }",
    "table, td, th, hr { border-color: #27342e !important; }",
    "::selection { background: #22432f; color: #ffffff; }",
    // Naskah yang ditempel dari Word membawa warnanya sendiri, dan warna itu
    // hampir selalu hitam - hitam di atas gelap berarti hilang sama sekali.
    '[style*="color:#000"], [style*="color: #000"], [style*="color:black"],' +
      ' [style*="color: black"], [style*="color:rgb(0,0,0)"], [style*="color: rgb(0, 0, 0)"],' +
      ' font[color="#000000"], font[color="black"] { color: inherit !important; }',
    '[style*="background-color:#fff"], [style*="background-color: #fff"],' +
      ' [style*="background:#fff"], [style*="background: #fff"],' +
      ' [style*="background-color:white"], [style*="background-color: white"]' +
      " { background-color: transparent !important; }",
  ].join("\n");

  function temaGelap() {
    try {
      return document.documentElement.getAttribute("data-aleta-tema-sipp") === "gelap";
    } catch {
      return false;
    }
  }

  /**
   * Menitipkan gayanya ke CKEditor, dan menunggunya bila ia belum dimuat.
   *
   * SIPP memuat ckeditor.js pada sebagian halaman saja, dan urutan muatnya
   * tidak dijamin. Ditunggu sebentar dengan jam yang BERHENTI SENDIRI -
   * halaman tanpa CKEditor tidak boleh meninggalkan jam yang berdetak
   * selamanya hanya untuk menunggu sesuatu yang memang tidak ada.
   */
  function titipkanGayaCkeditor() {
    if (!temaGelap()) return;
    let sisa = 40; // 40 x 250ms = 10 detik
    const coba = () => {
      if (window.CKEDITOR && typeof window.CKEDITOR.addCss === "function") {
        if (!window.CKEDITOR.__aletaGaya) {
          window.CKEDITOR.__aletaGaya = true;
          window.CKEDITOR.addCss(GAYA_ISI_CKEDITOR);
        }
        return;
      }
      sisa -= 1;
      if (sisa > 0) setTimeout(coba, 250);
    };
    coba();
  }

  titipkanGayaCkeditor();
})();
