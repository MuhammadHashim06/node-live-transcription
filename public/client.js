const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const recordBtn = document.getElementById("record-btn");
const transcriptionLang = document.getElementById("transcription-language");
const translationLang = document.getElementById("translation-language");

let isRecording = false;
let microphone;

function createWebSocket() {
    const ws = new WebSocket("wss://liveword.io");

    ws.addEventListener("open", () => {
        console.log("✅ Connected to WebSocket server");
        ws.send(JSON.stringify({
            type: "setLanguage",
            language: transcriptionLang.value
        }));
    });

    ws.addEventListener("close", () => {
        console.log("❌ Disconnected from WebSocket server");
    });

    return ws;
}

let socket = createWebSocket(); // Initialize the WebSocket

async function getMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return new MediaRecorder(stream, { mimeType: "audio/webm" });
    } catch (error) {
        console.error("Error accessing microphone:", error);
        throw error;
    }
}

async function openMicrophone(mic, socket) {
    return new Promise((resolve) => {
        mic.onstart = () => {
            console.log("🎤 Microphone started");
            recordBtn.innerHTML = `<i class="fas fa-stop"></i> Stop Listening`;
            recordBtn.classList.add("bg-red-500");
            recordBtn.classList.remove("bg-blue-500");

            // ✅ Move loader logic inside mic.onstart
            setTimeout(() => {
                const loader = document.getElementById("loader");
                loader.classList.remove("hidden"); // Show loader AFTER mic starts

                setTimeout(() => {
                    loader.classList.add("hidden"); // Hide loader after 5 seconds
                }, 3000);
            }, 0); // Ensure it runs after mic starts

            resolve();
        };

        mic.onstop = () => {
            console.log("🎤 Microphone stopped");
            recordBtn.innerHTML = `<i class="fas fa-microphone"></i> Start Listening`;
            recordBtn.classList.add("bg-blue-500");
            recordBtn.classList.remove("bg-red-500");
        };

        mic.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        mic.start(200); // Reduce buffer time for faster audio streaming
    });
}

async function closeMicrophone(mic) {
    mic.stop();
}

recordBtn.addEventListener("click", async () => {
    const loader = document.getElementById("loader");

    if (!isRecording) {
        try {
            loader.classList.remove("hidden"); // Show loader

            if (socket.readyState !== WebSocket.OPEN) {
                console.log("🔄 Reconnecting WebSocket...");
                socket = createWebSocket();
            }

            microphone = await getMicrophone();

            // ✅ Keep loader visible for 5 seconds before starting transcription
            setTimeout(async () => {
                await openMicrophone(microphone, socket);
                loader.classList.add("hidden"); // Hide loader after 5 seconds
            }, 0);
        } catch (error) {
            console.error("Error opening microphone:", error);
            loader.classList.add("hidden"); // Hide loader if an error occurs
        }
    } else {
        await closeMicrophone(microphone);
        microphone = undefined;
    }

    isRecording = !isRecording;
});

socket.addEventListener("open", () => {
    console.log("✅ Connected to WebSocket server");

    socket.send(JSON.stringify({
        type: "setLanguage",
        language: transcriptionLang.value
    }));
});

transcriptionLang.addEventListener("change", () => {
    const selectedLang = transcriptionLang.value;
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "setLanguage", language: selectedLang }));
        console.log(`🌐 Transcription language changed to: ${selectedLang}`);
    }
});

let lastTranscript = ""; // ✅ Track last processed transcript to prevent duplication

socket.addEventListener("message", (event) => {

    if (event.data === "") return;

    let data;


    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error("Failed to parse JSON:", e);
        return;
    }

    if (data && data.channel && data.channel.alternatives.length > 0) {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final || false; // ✅ Only process final transcriptions

        if (!transcript || transcript === lastTranscript) return; // ✅ Prevent duplication
        lastTranscript = transcript; // ✅ Update last transcript

        if (captions.innerHTML.trim() === "Waiting for speech input...") {
            captions.innerHTML = "";
        }
        if (translationBox.innerHTML.trim() === "Translation will appear here...") {
            translationBox.innerHTML = "";
        }

        const sentenceEndings = [".", "!", "?", "…", ":", ";", "—", "。", "！", "？"];
        let lastChar = transcript.slice(-1);
        let isSentenceComplete = sentenceEndings.includes(lastChar);

        if (isFinal || isSentenceComplete) {
            // ✅ Append only final sentences to prevent duplication
            let newTranscriptionDiv = document.createElement("div");
            newTranscriptionDiv.innerText = transcript;
            newTranscriptionDiv.className = "transcription-sentence bg-gray-600 p-2 rounded-lg mt-1";
            captions.appendChild(newTranscriptionDiv);
            captions.scrollTop = captions.scrollHeight;

            sendToDeepL(transcript);
        } else {
            // ✅ Update ongoing sentence in real-time (intermediate)
            let lastSentenceDiv = captions.lastElementChild;
            if (lastSentenceDiv) {
                lastSentenceDiv.innerText = transcript;
            } else {
                let newTranscriptionDiv = document.createElement("div");
                newTranscriptionDiv.innerText = transcript;
                newTranscriptionDiv.className = "transcription-sentence bg-gray-600 p-2 rounded-lg mt-1";
                captions.appendChild(newTranscriptionDiv);
            }
        }
    }
    if (data.type === "deepgram_ready") {
        console.log("🎙️ Deepgram is ready!");
        loader.classList.add("hidden"); // Hide loader when ready
    }

});

socket.addEventListener("close", () => {
    console.log("❌ Disconnected from WebSocket server");
});

async function sendToDeepL(text) {
    const targetLang = translationLang.value;
    try {
        const response = await fetch("/api/translate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                target_lang: targetLang
            })
        });

        const translationData = await response.json();

        if (translationData.translations && translationData.translations.length > 0) {
            let newTranslationDiv = document.createElement("div");
            newTranslationDiv.innerText = translationData.translations[0].text;
            newTranslationDiv.className = "translation-sentence bg-gray-600 p-2 rounded-lg mt-1";
            translationBox.appendChild(newTranslationDiv);
            translationBox.scrollTop = translationBox.scrollHeight;
        } else {
            console.error("DeepL translation error:", translationData);
        }
    } catch (error) {
        console.error("DeepL API error:", error);
    }
}
