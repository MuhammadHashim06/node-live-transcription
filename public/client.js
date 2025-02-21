const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const recordBtn = document.getElementById("record-btn");
const transcriptionLang = document.getElementById("transcription-language");
const translationLang = document.getElementById("translation-language");

let isRecording = false;
let microphone;
let socket = new WebSocket("ws://localhost:3000"); // Ensure correct WebSocket connection

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
            document.body.classList.add("recording");
            recordBtn.innerHTML = `<i class="fas fa-stop"></i> Stop Listening`;
            recordBtn.classList.add("bg-red-500");
            recordBtn.classList.remove("bg-blue-500");
            resolve();
        };

        mic.onstop = () => {
            console.log("🎤 Microphone stopped");
            document.body.classList.remove("recording");
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
            microphone = await getMicrophone();
            await openMicrophone(microphone, socket);
        } catch (error) {
            console.error("Error opening microphone:", error);
        }
    } else {
        await closeMicrophone(microphone);
        microphone = undefined;
    }
    isRecording = !isRecording;
});

socket.addEventListener("open", () => {
    console.log("✅ Connected to WebSocket server");
});

socket.addEventListener("message", (event) => {
    if (event.data === "") return;

    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error("Failed to parse JSON:", e);
        return;
    }

    if (data && data.channel && data.channel.alternatives[0].transcript !== "") {
        const transcriptionText = data.channel.alternatives[0].transcript;

        // ✅ Remove placeholders on first transcription
        if (captions.innerHTML.trim() === "Waiting for speech input...") {
            captions.innerHTML = "";
        }
        if (translationBox.innerHTML.trim() === "Translation will appear here...") {
            translationBox.innerHTML = "";
        }

        // ✅ List of punctuation marks indicating sentence completion
        const sentenceEndings = [
            ".", "!", "?", "…", ":", ";", "—", "。", "！", "？"
        ];

        let lastChar = transcriptionText.slice(-1);
        let isSentenceComplete = sentenceEndings.includes(lastChar);

        if (isSentenceComplete) {
            // ✅ Create a new transcription sentence div
            let newTranscriptionDiv = document.createElement("div");
            newTranscriptionDiv.innerText = transcriptionText;
            newTranscriptionDiv.className = "transcription-sentence bg-gray-600 p-2 rounded-lg mt-1";
            captions.appendChild(newTranscriptionDiv);

            // ✅ Auto-scroll to the latest transcription
            captions.scrollTop = captions.scrollHeight;

            // ✅ Call translation function & send the transcription to DeepL
            sendToDeepL(transcriptionText);
        } else {
            // ✅ Update the last ongoing sentence in real-time
            let lastSentenceDiv = captions.lastElementChild;
            if (lastSentenceDiv) {
                lastSentenceDiv.innerText = transcriptionText;
            } else {
                let newTranscriptionDiv = document.createElement("div");
                newTranscriptionDiv.innerText = transcriptionText;
                newTranscriptionDiv.className = "transcription-sentence bg-gray-600 p-2 rounded-lg mt-1";
                captions.appendChild(newTranscriptionDiv);
            }
        }
    }
});

socket.addEventListener("close", () => {
    console.log("❌ Disconnected from WebSocket server");
});

// ✅ **Function to send text to DeepL API via backend**
async function sendToDeepL(text) {
    const targetLang = translationLang.value; // Get selected translation language

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

            // ✅ Auto-scroll to the latest translation
            translationBox.scrollTop = translationBox.scrollHeight;
        } else {
            console.error("DeepL translation error:", translationData);
        }
    } catch (error) {
        console.error("DeepL API error:", error);
    }
}
