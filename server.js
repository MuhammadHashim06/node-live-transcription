// const express = require("express");
// const http = require("http");
// const WebSocket = require("ws");
// const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
// const dotenv = require("dotenv");
// const cors = require("cors");

// dotenv.config();

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

// app.use(cors());
// app.use(express.json());

// // ✅ Fix: Use Dynamic Import for `node-fetch`
// app.post("/api/translate", async (req, res) => {
//     const { text, target_lang } = req.body;

//     if (!text || !target_lang) {
//         return res.status(400).json({ error: "Missing text or target_lang" });
//     }

//     try {
//         const fetch = (await import("node-fetch")).default; // ✅ Use dynamic import
//         const response = await fetch("https://api.deepl.com/v2/translate", {
//             method: "POST",
//             headers: {
//                 "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify({
//                 text: [text],
//                 target_lang: target_lang
//             })
//         });

//         const data = await response.json();
//         res.json(data);
//     } catch (error) {
//         console.error("DeepL Translation Error:", error);
//         res.status(500).json({ error: "Failed to fetch translation" });
//     }
// });


// const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
// let keepAlive;

// const setupDeepgram = (ws, lang = "en") => {
//     const deepgram = deepgramClient.listen.live({
//         punctuate: true,
//         model: "nova-2",
//         language: lang
//     });

//     let lastTranscript = ""; // ✅ Store last transcript to avoid sending duplicates

//     deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
//         if (data.channel && data.channel.alternatives.length > 0) {
//             const transcript = data.channel.alternatives[0].transcript;
//             const isFinal = data.is_final || false;

//             if (transcript && transcript !== lastTranscript) {
//                 lastTranscript = transcript; // ✅ Prevent duplicate transcripts
//                 console.log(`🔊 Transcribed: ${transcript} (Final: ${isFinal})`);

//                 if (isFinal) {
//                     ws.send(JSON.stringify({ channel: data.channel, is_final: true }));
//                 }
//             }
//         }
//     });

//     if (keepAlive) clearInterval(keepAlive);
//     keepAlive = setInterval(() => {
//         console.log("deepgram: keepalive");
//         deepgram.keepAlive();
//     }, 10 * 1000);

//     deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
//         console.log("deepgram: connected");

//         deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
//             console.log("deepgram: transcript received");
//             console.log("ws: transcript sent to client");
//             ws.send(JSON.stringify(data));
//         });

//         deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
//             console.log("deepgram: disconnected");
//             clearInterval(keepAlive);
//             deepgram.finish();
//         });

//         deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
//             console.log("deepgram: error received");
//             console.error(error);
//         });

//         deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
//             console.log("deepgram: warning received");
//             console.warn(warning);
//         });

//         deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
//             console.log("deepgram: metadata received");
//             console.log("ws: metadata sent to client");
//             ws.send(JSON.stringify({ metadata: data }));
//         });
//     });

//     return deepgram;
// };

// wss.on("connection", (ws) => {
//     console.log("ws: client connected");
//     let selectedLanguage = "en";
//     let deepgram = setupDeepgram(ws, selectedLanguage);

//     ws.on("message", (message) => {
//         try {
//             const messageString = message.toString();
//             if (messageString.startsWith("{") && messageString.endsWith("}")) {
//                 const parsedMessage = JSON.parse(messageString);
//                 if (parsedMessage.type === "setLanguage") {
//                     selectedLanguage = parsedMessage.language || "en";
//                     console.log(`✅ Transcription language set to: ${selectedLanguage}`);

//                     deepgram.finish();
//                     deepgram.removeAllListeners();
//                     deepgram = setupDeepgram(ws, selectedLanguage);
//                     return;
//                 }
//             } else {
//                 deepgram.send(message);
//                 console.log("ws: audio data sent to deepgram");
//             }
//         } catch (error) {
//             console.error("Error processing WebSocket message:", error);
//         }
//     });

//     ws.on("close", () => {
//         console.log("ws: client disconnected");
//         deepgram.finish();
//         deepgram.removeAllListeners();
//     });
// });

// app.use(express.static("public/"));
// app.get("/", (req, res) => {
//     res.sendFile(__dirname + "/public/index.html");
// });

// server.listen(3000, () => {
//     console.log("Server is listening on port 3000");
// });

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// ✅ Fix: Use Dynamic Import for `node-fetch`
app.post("/api/translate", async (req, res) => {
    const { text, target_lang } = req.body;

    if (!text || !target_lang) {
        return res.status(400).json({ error: "Missing text or target_lang" });
    }

    try {
        const fetch = (await import("node-fetch")).default; // ✅ Use dynamic import
        const response = await fetch("https://api.deepl.com/v2/translate", {
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: [text],
                target_lang: target_lang
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("DeepL Translation Error:", error);
        res.status(500).json({ error: "Failed to fetch translation" });
    }
});


const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
let keepAlive;

const setupDeepgram = (ws, lang = "en") => {
    const deepgram = deepgramClient.listen.live({
        punctuate: true,
        model: "nova-2",
        language: lang
    });

    let lastTranscript = ""; // ✅ Store last transcript to avoid sending duplicates

    deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
        if (data.channel && data.channel.alternatives.length > 0) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final || false;

            if (transcript && transcript !== lastTranscript) {
                lastTranscript = transcript; // ✅ Prevent duplicate transcripts
                console.log(`🔊 Transcribed: ${transcript} (Final: ${isFinal})`);

                if (isFinal) {
                    ws.send(JSON.stringify({ channel: data.channel, is_final: true }));
                }
            }
        }
    });

    if (keepAlive) clearInterval(keepAlive);
    keepAlive = setInterval(() => {
        console.log("deepgram: keepalive");
        deepgram.keepAlive();
    }, 10 * 1000);

    deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
        console.log("deepgram: connected");

        deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
            console.log("deepgram: transcript received");
            console.log("ws: transcript sent to client");
            ws.send(JSON.stringify(data));
        });

        deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
            console.log("deepgram: disconnected");
            clearInterval(keepAlive);
            deepgram.finish();
        });

        deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
            console.log("deepgram: error received");
            console.error(error);
        });

        deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
            console.log("deepgram: warning received");
            console.warn(warning);
        });

        deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
            console.log("deepgram: metadata received");
            console.log("ws: metadata sent to client");
            ws.send(JSON.stringify({ metadata: data }));
        });
    });

    return deepgram;
};

wss.on("connection", (ws) => {
    console.log("ws: client connected");
    let selectedLanguage = "en";
    let deepgram = setupDeepgram(ws, selectedLanguage);

    ws.on("message", (message) => {
        try {
            const messageString = message.toString();
            if (messageString.startsWith("{") && messageString.endsWith("}")) {
                const parsedMessage = JSON.parse(messageString);
                if (parsedMessage.type === "setLanguage") {
                    selectedLanguage = parsedMessage.language || "en";
                    console.log(`✅ Transcription language set to: ${selectedLanguage}`);

                    deepgram.finish();
                    deepgram.removeAllListeners();
                    deepgram = setupDeepgram(ws, selectedLanguage);
                    return;
                }
            } else {
                deepgram.send(message);
                console.log("ws: audio data sent to deepgram");
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    });

    ws.on("close", () => {
        console.log("ws: client disconnected");
        deepgram.finish();
        deepgram.removeAllListeners();
    });
});

app.use(express.static("public/"));
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

server.listen(3000, "0.0.0.0", () => {
    console.log("✅ Server is listening on port 3000");
});