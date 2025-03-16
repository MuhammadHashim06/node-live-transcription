const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const recordBtn = document.getElementById("record-btn");
const transcriptionLang = document.getElementById("transcription-language");
// const translationLang = document.getElementById("translation-language");

let isRecording = false;
let microphone;
let socket;

// ✅ Function to create a new WebSocket connection
function createWebSocket() {
    return new WebSocket(
        window.location.protocol === "https:" ? "wss://liveword.io" : "ws://localhost:3000"
    );
}

// ✅ Update UI State
function updateUI(isActive) {
    transcriptionLang.disabled = isActive;
    // translationLang.disabled = isActive;
    recordBtn.innerHTML = isActive
        ? `<i class="fas fa-stop"></i> Stop Listening`
        : `<i class="fas fa-microphone"></i> Start Listening`;
    recordBtn.classList.toggle("bg-red-500", isActive);
    recordBtn.classList.toggle("bg-blue-500", !isActive);
}

// ✅ Get User Microphone Access
async function getMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        return new MediaRecorder(stream, {mimeType: "audio/webm"});
    } catch (error) {
        console.error("❌ Error accessing microphone:", error);
        alert("Microphone access denied. Please allow microphone permission.");
        throw error;
    }
}

// ✅ Open Microphone and Start Recording
async function openMicrophone(mic) {
    return new Promise((resolve) => {
        mic.onstart = () => {
            console.log("🎤 Microphone started");
            updateUI(true);
            resolve();
        };

        mic.onstop = () => {
            console.log("🎤 Microphone stopped");
            updateUI(false);
        };

        mic.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        mic.start(1000); // ✅ Sends audio every 1 second
    });
}

// ✅ Close Microphone
async function closeMicrophone(mic) {
    if (mic) {
        mic.stop();
    }
}

// ✅ Start/Stop Button Logic
recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            socket = createWebSocket();
            socket.onopen = () => {
                console.log("✅ WebSocket Connected");

                // ✅ Send selected transcription and translation languages
                socket.send(
                    JSON.stringify({
                        type: "setLanguage",
                        language: transcriptionLang.value,  // ✅ Send selected STT language
                    })
                );
            };

            socket.onmessage = handleSocketMessage;
            socket.onclose = () => console.log("❌ Disconnected from WebSocket server");

            microphone = await getMicrophone();
            await openMicrophone(microphone);
        } catch (error) {
            console.error("❌ Error opening microphone:", error);
        }
    } else {
        // ✅ Send stop signal to the server
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({type: "stop"}));
        }

        // ✅ Close microphone
        await closeMicrophone(microphone);
        microphone = null;

        // ✅ Close WebSocket (force disconnect)
        socket.close();
        console.log("🔌 WebSocket closed.");
    }
    isRecording = !isRecording;
});

// ✅ Handle WebSocket Messages
function handleSocketMessage(event) {
    if (event.data === "") return;

    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e);
        return;
    }

    // ✅ Handle Transcription
    if (data.transcript) {
        let lastSentenceDiv = captions.lastElementChild;

        if (!data.is_final) {
            if (lastSentenceDiv && lastSentenceDiv.dataset.type === "interim") {
                lastSentenceDiv.innerText = data.transcript;
            } else {
                let newTranscriptionDiv = document.createElement("div");
                newTranscriptionDiv.innerText = data.transcript;
                newTranscriptionDiv.className = "transcription-sentence";
                newTranscriptionDiv.dataset.type = "interim";
                captions.appendChild(newTranscriptionDiv);
            }
        } else {
            if (lastSentenceDiv && lastSentenceDiv.dataset.type === "interim") {
                captions.removeChild(lastSentenceDiv);
            }

            let finalSentenceDiv = document.createElement("div");
            finalSentenceDiv.innerText = data.transcript;
            finalSentenceDiv.className = "transcription-sentence";
            captions.appendChild(finalSentenceDiv);
        }

        captions.scrollTop = captions.scrollHeight; // ✅ Auto-scroll
    }

    // ✅ Handle Translation
    if (data.translation) {
        console.log("📌 Received Translation:", data.translation); // ✅ Debugging Log
        let newTranslationDiv = document.createElement("div");
        newTranslationDiv.innerText = data.translation;
        newTranslationDiv.className = "translation-sentence";
        translationBox.appendChild(newTranslationDiv);
        translationBox.scrollTop = translationBox.scrollHeight; // ✅ Auto-scroll for translations
    }
}

