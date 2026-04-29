const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const aiProviderAdapter = require("./services/aiProviderAdapter");
const aiRuntimeConfigService = require("./services/aiRuntimeConfigService");

async function chatGeminiBot(prompt) {
    const runtimeEnabled = await aiRuntimeConfigService.isAiEnabledForPublicQa().catch(() => false);
    if (runtimeEnabled) {
        try {
            const result = await aiProviderAdapter.completeChat({
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                maxTokens: 500,
                metadata: { mode: "legacy_gemini_wrapper", intentKey: "legacy_gemini" },
            });
            return result.text;
        } catch (error) {
            return "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silahkan coba lagi.";
        }
    }

    const fallbackEnabled = String(process.env.ALETA_BOT_AI_FALLBACK_ENV_ENABLED || "false") === "true";
    const geminiApiKey = fallbackEnabled ? process.env.GEMINI_API_KEY || "" : "";
    if (!geminiApiKey) {
        return "Layanan AI belum dikonfigurasi.";
    }

    console.warn("[ALETA Bot] Gemini legacy env fallback digunakan. Untuk produksi, sinkronkan AI config dari manajemen_surat.");
    try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: process.env.ALETA_BOT_AI_DEFAULT_MODEL || "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;
    } catch (error) {
        console.error("Error di chatGeminiBot:", aiProviderAdapter.sanitizeAiError(error));
        return "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silahkan coba lagi.";
    }
}

module.exports = {
    chatGeminiBot,
};
