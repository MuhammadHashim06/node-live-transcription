const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const recordBtn = document.getElementById("record-btn");
const transcriptionLang = document.getElementById("transcription-language");
const translationLang = document.getElementById("translation-language");

let isRecording = false;
let microphone;
let socket = new WebSocket("wss://liveword.io");

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

        mic.start(1000);
    });
}

async function closeMicrophone(mic) {
    mic.stop();
}

recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            // ✅ Clear previous transcription and translation on Start
            captions.innerHTML = "";
            translationBox.innerHTML = "";

            microphone = await getMicrophone();
            await openMicrophone(microphone, socket);
        } catch (error) {
            console.error("Error opening microphone:", error);
        }
    } else {
        await closeMicrophone(microphone);
        microphone = undefined;

        // ✅ Send message to WebSocket to stop Deepgram session
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "stopSession" }));
            console.log("🛑 Deepgram session ended");
        }
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
