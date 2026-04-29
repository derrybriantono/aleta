const axios = require("axios");
require("dotenv").config();

const aiProviderAdapter = require("./services/aiProviderAdapter");
const aiRuntimeConfigService = require("./services/aiRuntimeConfigService");

async function chatWithGPT3(prompt) {
  const runtimeEnabled = await aiRuntimeConfigService.isAiEnabledForPublicQa().catch(() => false);
  if (runtimeEnabled) {
    try {
      const result = await aiProviderAdapter.completeChat({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        maxTokens: 500,
        metadata: { mode: "legacy_gpt_wrapper", intentKey: "legacy_gpt" },
      });
      return `Berikut referensi atas pertanyaan/pesan yang anda kirimkan : \n\n ${result.text} \n\n Untuk mengoptimalkan jawaban yang dihasilkan, gunakan pertanyaan yang lebih spesifik!`;
    } catch (error) {
      return "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silahkan coba lagi.";
    }
  }

  const fallbackEnabled = String(process.env.ALETA_BOT_AI_FALLBACK_ENV_ENABLED || "false") === "true";
  const apiKey = fallbackEnabled ? process.env.OPENAI_API_KEY || "" : "";
  if (!apiKey) {
    return "Layanan AI belum dikonfigurasi.";
  }

  try {
    console.warn("[ALETA Bot] GPT legacy env fallback digunakan. Untuk produksi, sinkronkan AI config dari manajemen_surat.");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: process.env.ALETA_BOT_AI_DEFAULT_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    // The response will contain the generated text

    const generatedText = `Berikut referensi atas pertanyaan/pesan yang anda kirimkan : \n\n ${response.data.choices[0].message.content} \n\n Untuk mengoptimalkan jawaban yang dihasilkan, gunakan pertanyaan yang lebih spesifik!`;
    return generatedText;
  } catch (error) {
    console.error(
      "Error:",
      aiProviderAdapter.sanitizeAiError(error.response ? error.response.data : error.message)
    );
    return "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silahkan coba lagi.";
  }
}

module.exports = {
  chatWithGPT3,
};
