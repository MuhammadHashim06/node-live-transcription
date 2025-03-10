const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const recordBtn = document.getElementById("record-btn");
const transcriptionLang = document.getElementById("transcription-language");
const translationLang = document.getElementById("translation-language");

let isRecording = false;
let microphone;
let socket = new WebSocket("ws://localhost:3000"); // ✅ Connect WebSocket to server

async function getMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return new MediaRecorder(stream, { mimeType: "audio/webm" });
    } catch (error) {
        console.error("❌ Error accessing microphone:", error);
        alert("Microphone access denied. Please allow microphone permission.");
        throw error;
    }
}

async function openMicrophone(mic) {
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

        mic.start(1000); // ✅ Sends audio every 1 second
    });
}

async function closeMicrophone(mic) {
    mic.stop();
}

// ✅ Start/Stop Button Logic
recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            microphone = await getMicrophone();
            await openMicrophone(microphone);
        } catch (error) {
            console.error("❌ Error opening microphone:", error);
        }
    } else {
        // ✅ Send stop signal to the server
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "stop" }));
        }

        // ✅ Close the microphone
        await closeMicrophone(microphone);
        microphone = undefined;

        // ✅ Close WebSocket (force disconnect)
        socket.close();
        socket = new WebSocket("ws://localhost:3000"); // ✅ Reset WebSocket for next use
    }
    isRecording = !isRecording;
});

// ✅ Send Selected Transcription Language to Server
transcriptionLang.addEventListener("change", () => {
    const selectedLang = transcriptionLang.value;
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "setLanguage", language: selectedLang }));
        console.log(`🌐 Transcription language changed to: ${selectedLang}`);
    }
});

// ✅ Handle WebSocket Messages (Real-time Updates)
socket.addEventListener("message", (event) => {
    if (event.data === "") return;

    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e);
        return;
    }

    let lastSentenceDiv = captions.lastElementChild;

    if (data.transcript) {
        if (!data.is_final) {
            // ✅ Live update: Update or create a placeholder for the ongoing transcription
            if (lastSentenceDiv && lastSentenceDiv.dataset.type === "interim") {
                lastSentenceDiv.innerText = data.transcript;
            } else {
                let newTranscriptionDiv = document.createElement("div");
                newTranscriptionDiv.innerText = data.transcript;
                newTranscriptionDiv.className = "transcription-sentence";
                newTranscriptionDiv.dataset.type = "interim"; // Mark as temporary
                captions.appendChild(newTranscriptionDiv);
            }
        } else {
            // ✅ Final result: Remove interim and add final transcript
            if (lastSentenceDiv && lastSentenceDiv.dataset.type === "interim") {
                captions.removeChild(lastSentenceDiv); // Remove interim
            }
            let newFinalTranscriptionDiv = document.createElement("div");
            newFinalTranscriptionDiv.innerText = data.transcript;
            newFinalTranscriptionDiv.className = "transcription-sentence";
            captions.appendChild(newFinalTranscriptionDiv);
            captions.scrollTop = captions.scrollHeight;
        }
    }

    if (data.translation) {
        const newTranslationDiv = document.createElement("div");
        newTranslationDiv.innerText = data.translation;
        newTranslationDiv.className = "translation-sentence";
        translationBox.appendChild(newTranslationDiv);
        translationBox.scrollTop = translationBox.scrollHeight;
    }
});

socket.addEventListener("close", () => {
    console.log("❌ Disconnected from WebSocket server");
});
