import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { SpeechClient } from "@google-cloud/speech";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const speechClient = new SpeechClient();
const PORT = process.env.PORT || 3000;

// ✅ Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

wss.on("connection", (ws) => {
    console.log("✅ WebSocket client connected");
    let recognizeStream;

    async function startRecognitionStream() {
        recognizeStream = speechClient
            .streamingRecognize({
                config: {
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 16000,
                    languageCode: "en-US",
                    enableAutomaticPunctuation: true,
                },
                interimResults: true
            })
            .on("error", (err) => console.error("❌ Google STT Error:", err))
            .on("data", async (data) => {
                const transcript = data.results[0]?.alternatives[0]?.transcript || "";
                const isFinal = data.results[0]?.isFinal || false;

                if (transcript) {
                    console.log(`🔊 Transcribed: ${transcript} (Final: ${isFinal})`);
                    ws.send(JSON.stringify({ transcript, is_final: isFinal }));

                    if (isFinal) {
                        const translation = await translateText(transcript);
                        ws.send(JSON.stringify({ translation }));
                    }
                }
            });
    }

    ws.on("message", (message) => {
        try {
            const messageString = message.toString();

            // ✅ Check if message is JSON (starts with '{' and ends with '}')
            if (messageString.trim().startsWith("{") && messageString.trim().endsWith("}")) {
                const msg = JSON.parse(messageString);

                if (msg.type === "stop") {
                    console.log("🛑 Stop signal received from client.");

                    // ✅ Close Google STT Stream
                    if (recognizeStream) {
                        recognizeStream.end();
                        recognizeStream = null;
                        console.log("🔌 Google STT Stream closed.");
                    }

                    // ✅ Close WebSocket Connection
                    ws.close();
                    console.log("🔌 WebSocket closed.");
                }
            } else {
                console.log("🎤 Received WebSocket audio data");

                if (!recognizeStream) {
                    console.log("📡 Starting Google STT stream...");
                    startRecognitionStream();
                }

                // ✅ Send raw audio to Google STT
                if (recognizeStream) recognizeStream.write(message);
            }
        } catch (error) {
            console.error("❌ Error processing WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        console.log("🔌 WebSocket client disconnected");

        if (recognizeStream) {
            recognizeStream.end();
            recognizeStream = null;
            console.log("🔌 Google STT Stream closed.");
        }
    });
});

// ✅ DeepL Translation Function
async function translateText(text) {
    try {
        const response = await fetch("https://api.deepl.com/v2/translate", {
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: [text], target_lang: "ES" }),
        });

        const data = await response.json();
        return data.translations[0].text;
    } catch (error) {
        console.error("❌ DeepL Translation Error:", error);
        return "Translation Error";
    }
}

server.listen(3000, "0.0.0.0", () => {
    console.log("✅ Server is listening on port 3000");
});
