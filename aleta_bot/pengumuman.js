const puppeteer = require("new-puppeteer");
const moment = require("moment");

let month = moment().format("MM");
let year = moment().format("YYYY");

let getPengumumanMa = async () => {
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
  let responseMessage = [];
  try {
    await page.goto("https://www.mahkamahagung.go.id/id", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    await page.waitForSelector(".w33p.pull-right", {
      visible: true,
    });

    const rows = await page.$x(
      "//h1/span[text()=' Pengumuman']/ancestor::h1/following-sibling::article"
    );
    // console.log(rows);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pengumuman = await row.$eval(
        "a .title",
        (element) => element.textContent
      );

      let tanggal = await row.$eval(
        "a .date",
        (element) => element.textContent
      );
      // let counter = 1;
      const replace = (str, numSpaces = 4) =>
        str.replaceAll("\t", "".repeat(numSpaces));

      const pengumuman_fix = replace(pengumuman);
      const pengumuman_non = pengumuman_fix.replace("\n", "");
      const tanggal_fix = replace(tanggal);
      const tanggal_non = tanggal_fix.replace("\n", "");

      responseMessage.push(
        `*${
          i + 1
        }.* ${pengumuman_non} | *tanggal* : ${tanggal_non}\n`
      );
    }
    await browser.close();
    const message = responseMessage.join("\n");
    return message;
  } catch (error) {
    console.error("Error getPengumumanMa:", error.message);
    await browser.close();
    return "Koneksi ke Mahkamah Agung terputus";
  }
};

let getPengumumanBadilag = async () => {
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
  let responseMessage = [];
  try {
    await page.goto("https://badilag.mahkamahagung.go.id/", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    await page.waitForSelector(".price-col.first", {
      visible: true,
    });

    const rows = await page.$x(
      "//div[@class='price-col first']//ul[@class='line line-icon']/li/a"
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pengumuman = await row.evaluate((element) =>
        element.textContent.trim()
      );

      responseMessage.push(
        `*${i + 1}.* ${pengumuman}\n`
      );
    }
    await browser.close();
    const message = responseMessage.join("\n");
    return message;
  } catch (error) {
    console.error("Error getPengumumanBadilag:", error.message);
    await browser.close();
    return "Koneksi ke Badilag terputus";
  }
};

let getPengumumanPta = async () => {
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
  let responseMessage = [];
  try {
    await page.goto("https://www.pta-palu.go.id/", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });
    await page.waitForSelector(".price-col.first", {
      visible: true,
    });

    const rows = await page.$x(
      "//div[@class='price-col first']//ul[@class='line line-icon']/li/a"
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pengumuman = await row.evaluate((element) =>
        element.textContent.trim()
      );

      responseMessage.push(
        `*${i + 1}.* ${pengumuman}\n`
      );
    }
    await browser.close();
    const message = responseMessage.join("\n");
    return message;
  } catch (error) {
    console.error("Error getPengumumanPta:", error.message);
    await browser.close();
    return "Koneksi ke PTA Palu terputus";
  }
};

// getPengumumanPta().then((res) => console.log(res));
// console.log(year);
module.exports = {
  getPengumumanMa,
  getPengumumanBadilag,
  getPengumumanPta,
};
