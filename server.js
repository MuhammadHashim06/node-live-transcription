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
app.get("/translation", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "translation", "translation.html"));
});

const clients = new Map();

wss.on("connection", (ws) => {
    console.log("✅ WebSocket client connected");
    let recognizeStream;
    let transcriptionLang = "en-US";  // ✅ Default to English
    let targetLang = "en";  // ✅ Default translation language

    const startRecognitionStream = () => {
        console.log(`📡 Starting Google STT stream for language: ${transcriptionLang}...`);
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
        });

        recognizeStream.on("data", async (data) => {
            const transcript = data.results[0]?.alternatives[0]?.transcript || "";
            const isFinal = data.results[0]?.isFinal || false;

            if (transcript) {
                console.log(`🔊 Transcript: ${transcript} (Final: ${isFinal})`);

                // ✅ Send normal interim/final transcript
                ws.send(JSON.stringify({transcript, is_final: isFinal}));

                if (isFinal) {
                    console.log("✅ Final transcript received, translating...");
                    if(!targetLang) {
                        console.log("❌ No target language set for translation");
                    } else {
                        // ✅ Broadcast translation to all clients based on their selected language
                        for (const [client, lang] of clients.entries()) {
                            const translation = await translateText(transcript, lang);
                            client.send(JSON.stringify({type: "translation", translation}));
                        }
                    }
                }
            }
        });

        recognizeStream.on("error", (error) => {
            console.error("❌ Recognize Stream Error:", error);
            if (error.code === 11) { // Exceeded maximum allowed stream duration
                console.log("🔄 Restarting recognize stream due to duration limit...");
                startRecognitionStream();
            } else {
                ws.send(JSON.stringify({error: "Speech recognition error"}));
                recognizeStream.end();
                recognizeStream = null;
            }
        });
    };

    ws.on("message", (message) => {
        try {
            const messageString = message.toString().trim();
            // ✅ If message is JSON, handle control messages
            if (messageString.startsWith("{") && messageString.endsWith("}")) {
                const msg = JSON.parse(messageString);

                if (msg.type === "setLanguage") {
                    console.log(`🌐 Transcription: ${msg.language}`);
                    transcriptionLang = msg.language; // ✅ Update STT language
                    return;
                }
                if (msg.type === "setTranslation") {
                    console.log(`🌐 Translation: ${msg.targetLanguage}`);
                    targetLang = msg.targetLanguage; // ✅ Update translation language
                    clients.set(ws, targetLang); // ✅ Store client's target language
                    console.log("🔗 Client added to translation map",targetLang);
                    return;
                }

                if (msg.type === "stop") {
                    if (recognizeStream) {
                        recognizeStream.end();
                        recognizeStream = null; // ✅ Ensure old stream is removed
                    }
                    clients.delete(ws); // ✅ Remove client from the map
                    ws.close();
                    return;
                }
            } else {
                // ✅ This must be raw audio data, send it to STT
                console.log("🎤 Received WebSocket audio data");

                if (!recognizeStream) {
                    startRecognitionStream();
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
        clients.delete(ws); // ✅ Remove client from the map
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