import express from "express";
import http from "http";
import {WebSocketServer} from "ws";
import {SpeechClient} from "@google-cloud/speech";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import {fileURLToPath} from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({server});

const speechClient = new SpeechClient();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

wss.on("connection", (ws) => {
    console.log("✅ WebSocket client connected");
    let recognizeStream;
    let transcriptionLang = "en-US";  // ✅ Default to English
    let targetLang = "en";  // ✅ Default translation language

    ws.on("message", (message) => {
        try {
            const messageString = message.toString().trim();

            // ✅ If message is JSON, handle control messages
            if (messageString.startsWith("{") && messageString.endsWith("}")) {
                const msg = JSON.parse(messageString);

                if (msg.type === "setLanguage") {
                    console.log(`🌐 Transcription: ${msg.language}, Translation: ${msg.targetLanguage}`);
                    transcriptionLang = msg.language; // ✅ Update STT language
                    targetLang = msg.targetLanguage; // ✅ Update translation language
                    return;
                }

                if (msg.type === "stop") {
                    if (recognizeStream) {
                        recognizeStream.end();
                        recognizeStream = null; // ✅ Ensure old stream is removed
                    }
                    ws.close();
                    return;
                }
            } else {
                // ✅ This must be raw audio data, send it to STT
                console.log("🎤 Received WebSocket audio data");

                if (!recognizeStream) {
                    console.log(`📡 Starting Google STT stream for language: ${transcriptionLang}...`);
                    let finalizationTimeout = null; // ✅ Timeout tracker
                    const FORCE_FINALIZATION_DELAY = 5000; // ✅ 5 seconds delay

                    recognizeStream = speechClient.streamingRecognize({
                        config: {
                            encoding: "WEBM_OPUS",
                            sampleRateHertz: 16000,
                            languageCode: transcriptionLang,
                            enableAutomaticPunctuation: true,
                            speechContexts: [{phrases: [".", "?", "!", "okay", "next", "done"]}], // ✅ Helps finalize sentences faster (English only)
                            maxAlternatives: 1,
                            model: "default",
                            singleUtterance: false,
                        },
                        interimResults: true,
                    }).on("data", async (data) => {
                        const transcript = data.results[0]?.alternatives[0]?.transcript || "";
                        const isFinal = data.results[0]?.isFinal || false;

                        if (transcript) {
                            console.log(`🔊 Transcript: ${transcript} (Final: ${isFinal})`);

                            // ✅ Send normal interim/final transcript
                            ws.send(JSON.stringify({transcript, is_final: isFinal}));

                            if (isFinal) {
                                console.log("✅ Final transcript received, translating...");
                                const translation = await translateText(transcript, targetLang);
                                ws.send(JSON.stringify({translation}));

                                // ✅ Reset the forced finalization timer when a final result is received
                                if (finalizationTimeout) clearTimeout(finalizationTimeout);
                            } else if (transcriptionLang === "sv-SE" || transcriptionLang === "fi-FI") {
                                // ✅ Start a timeout to force finalization **only if no final result comes in**
                                if (!finalizationTimeout) {
                                    finalizationTimeout = setTimeout(async () => {
                                        console.log("⏳ No final transcript received for 3 seconds, forcing finalization...");
                                        ws.send(JSON.stringify({transcript, is_final: true}));

                                        const translation = await translateText(transcript, targetLang);
                                        ws.send(JSON.stringify({translation}));
                                        console.log(`📤 Forced finalization, sent translation: "${translation}"`);

                                        // ✅ Reset timeout after forcing finalization
                                        finalizationTimeout = null;
                                    }, FORCE_FINALIZATION_DELAY);
                                }
                            }
                        }
                    });
                }

                // ✅ Send raw audio data to Google STT
                if (recognizeStream) recognizeStream.write(message);
            }
        } catch (error) {
            console.error("❌ Error processing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("🔌 WebSocket client disconnected");
        if (recognizeStream) {
            recognizeStream.end();
            recognizeStream = null;
        }
    });
});

async function translateText(text, lang) {
    try {
        console.log(`🌍 Sending text for translation: "${text}" → ${lang}`); // ✅ Log translation request

        const response = await fetch("https://api.deepl.com/v2/translate", {
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({text: [text], target_lang: lang}),
        });

        const data = await response.json();
        console.log("🔍 DeepL API Response:", JSON.stringify(data, null, 2)); // ✅ Log full API response

        if (!data.translations || data.translations.length === 0) {
            console.error("❌ No translation returned.");
            return "Translation unavailable.";
        }

        return data.translations[0].text;
    } catch (error) {
        console.error("❌ DeepL Translation API Error:", error);
        return "Translation error.";
    }
}

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));