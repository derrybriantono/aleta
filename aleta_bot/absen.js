const puppeteer = require("puppeteer");
require("dotenv").config();

const username = process.env.SIKEP_USERNAME || "";
const password = process.env.SIKEP_PASSWORD || "";
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

let getDataMasuk = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  
  const maxRetries = 10; // Maksimal percobaan
  let attempt = 0; // Hitung percobaan
  let success = false; // Status keberhasilan
  let message = ''; // Pesan hasil

  while (attempt < maxRetries && !success) {
    try {
      attempt++;
      await page.goto("https://sikep.mahkamahagung.go.id/site/login", {
        waitUntil: "networkidle0",
        timeout: 300000, // Tunggu hingga 5 menit
      });

      await page.waitForSelector(".login-box-body", {
        visible: true,
      });

      await page.type("#loginform-username", username);
      await page.type("#loginform-password", password);

      const [button] = await page.$x("//button[contains(@name, 'login-button')]");

      if (button) {
        await button.click();
      }

      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 300000 }); // Tunggu hingga 5 menit

      await page.goto(
        "https://sikep.mahkamahagung.go.id/laporan/absensi-online",
        {
          waitUntil: "networkidle0",
          timeout: 300000, // Tunggu hingga 5 menit
        }
      );

      const rows = await page.$$(
        "#crud-datatable-container > table > tbody > tr"
      );

      let time = new Date();

      let responseMessage = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nomor = await row.$eval(
          "td:nth-child(1)",
          (element) => element.textContent
        );
        const tanggal = await row.$eval(
          "td:nth-child(2)",
          (element) => element.textContent
        );
        const nama = await row.$eval(
          "td:nth-child(4)",
          (element) => element.textContent
        );
        const statusPresensi = await row.$eval(
          "td:nth-child(5)",
          (element) => element.textContent
        );
        const jamMasuk = await row.$eval(
          "td:nth-child(6)",
          (element) => element.textContent
        );

        const removeAfterTagGlobal = (str, tag) => {
          const regex = new RegExp(`${tag}\\s*:[^\\n]*`, 'g');
          return str.replace(regex, '');
        };
        
        const tag = "<br>";
        const jamMasukFix = removeAfterTagGlobal(jamMasuk, tag);

        if (jamMasukFix == "-") {
          responseMessage.push(
            `${nomor}. Nama : ${nama}\nStatus Presensi : *Belum Absen Masuk/Cuti*`
          );
        }
        else {
          responseMessage.push(
            `${nomor}. Nama : ${nama}\ntanggal : ${tanggal}\n${jamMasukFix}`
          );
        }
      }
      const absen = responseMessage.join("\n-------------------\n");
      message = `*Data absen pagi/masuk hari ${dayNames[time.getDay()]}, tanggal ${time.getDate()} ${monthNames[time.getMonth()]} ${time.getFullYear()}, diambil pukul ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} :*\n ${absen}`;
      success = true; // Set status keberhasilan
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        console.log('Pesan absen getDataMasuk gagal dikirim.');
      }
    }
  }

  await browser.close();
  return message;
};

let getDataKeluar = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage();
  
  const maxRetries = 10; // Maksimal percobaan
  let attempt = 0; // Hitung percobaan
  let success = false; // Status keberhasilan
  let message = ''; // Pesan hasil

  while (attempt < maxRetries && !success) {
    try {
      attempt++;
      await page.goto("https://sikep.mahkamahagung.go.id/site/login", {
        waitUntil: "networkidle0",
        timeout: 300000, // Tunggu hingga 5 menit
      });

      await page.waitForSelector(".login-box-body", {
        visible: true,
      });

      await page.type("#loginform-username", username);
      await page.type("#loginform-password", password);

      const [button] = await page.$x("//button[contains(@name, 'login-button')]");

      if (button) {
        await button.click();
      }

      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 300000 }); // Tunggu hingga 5 menit

      await page.goto(
        "https://sikep.mahkamahagung.go.id/laporan/absensi-online",
        {
          waitUntil: "networkidle0",
          timeout: 300000, // Tunggu hingga 5 menit
        }
      );

      // Tambahkan kode untuk memilih tanggal sehari sebelumnya
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const formattedDate = `${yesterday.getDate()} ${monthNames[yesterday.getMonth()]} ${yesterday.getFullYear()}`;

      await page.click("#tmstpegawaipresensisearch-datesearch-disp-kvdate .kv-date-picker");
      await page.type("#tmstpegawaipresensisearch-datesearch-disp", formattedDate);
      await page.keyboard.press('Enter'); // Simulasi menekan Enter setelah mengetik tanggal

      // Pilih "Semua Pegawai"
      await page.select("#dropdownlist-presensionly", "5");

      // Tunggu beberapa saat untuk memastikan data dimuat
      await page.waitForTimeout(2000); // Tunggu 2 detik, sesuaikan jika perlu

      const rows = await page.$$(
        "#crud-datatable-container > table > tbody > tr"
      );

      let time = new Date();

      let responseMessage = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nomor = await row.$eval(
          "td:nth-child(1)",
          (element) => element.textContent
        );
        const tanggal = await row.$eval(
          "td:nth-child(2)",
          (element) => element.textContent
        );
        const nama = await row.$eval(
          "td:nth-child(4)",
          (element) => element.textContent
        );
        const statusPresensi = await row.$eval(
          "td:nth-child(5)",
          (element) => element.textContent
        );
        const jamKeluar = await row.$eval(
          "td:nth-child(8)",
          (element) => element.textContent
        );

        const removeAfterTagGlobal = (str, tag) => {
          const regex = new RegExp(`${tag}\\s*:[^\\n]*`, 'g');
          return str.replace(regex, '');
        };
        
        const tag = "<br>";
        const jamKeluarFix = removeAfterTagGlobal(jamKeluar, tag);

        if (jamKeluarFix == "-") {
          responseMessage.push(
            `${nomor}. Nama : ${nama}\nStatus Presensi : *Belum Absen Pulang/Cuti*`
          );
        }
        else {
          responseMessage.push(
            `${nomor}. Nama : ${nama}\ntanggal : ${tanggal}\n${jamKeluarFix}`
          );
        }
      }
      const absen = responseMessage.join("\n-------------------\n");
      message = `*Data absen sore/keluar hari ${dayNames[time.getDay()]}, tanggal ${time.getDate()} ${monthNames[time.getMonth()]} ${time.getFullYear()}, diambil pukul ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} :*\n ${absen}`;
      success = true; // Set status keberhasilan
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        console.log('Pesan absen getDataKeluar gagal dikirim.');
      }
    }
  }

  await browser.close();
  return message;
};

module.exports = { 
  getDataMasuk,
  getDataKeluar
};
