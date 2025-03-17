const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const translationLanguage = document.getElementById("translation-language");
const playBtn=document.getElementById("play-btn");



let socket;
let audioQueue = []; // Queue to handle audio messages
let userInteracted = false; // Ensure user interaction




// ✅ Function to create a new WebSocket connection
function createWebSocket() {
    return new WebSocket(
        window.location.protocol === "https:" ? "wss://liveword.io" : "ws://localhost:3000"
    );
}

window.onload = () => {
    // Add a click event listener to enable audio playback
    playBtn.addEventListener('click', () => {
        if(userInteracted){
            console.log("🔇 Disabling Audio");
            userInteracted = false;
            playBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i><span class="sm:block hidden">Enable TTS</span>`
            playBtn.classList.remove("bg-red-500");
            playBtn.classList.add("bg-blue-500");
        }else{
            console.log("🔊 Enabling Audio");
            userInteracted = true; 
             playBtn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> <span class="sm:block hidden">Disable TTS</span>`
             playBtn.classList.add("bg-red-500");
             playBtn.classList.remove("bg-blue-500");
      
            // Create a silent audio to unlock the audio context
            const audio = new Audio();
            audio.play().catch(() => {
                console.error("❌ Audio playback was prevented");
                alert("Audio playback was prevented. Please allow audio autoplay.");
    
            });playNextAudio();
        }
    
       
    
    });

    try {
        socket = createWebSocket();
        socket.onopen = () => {
            console.log("✅ WebSocket Connected on translation side");

            // ✅ Send selected transcription and translation languages
            console.log("🌐 Transcription:", translationLanguage.value); // ✅ Debugging Log
            translationLanguage.onchange = () => {
                socket.send(
                    JSON.stringify({
                        type: "setTranslation",
                        targetLanguage: translationLanguage.value,  // ✅ Send selected translation language
                    })
                );
            };
            socket.send(
                JSON.stringify({
                    type: "setTranslation",
                    targetLanguage: translationLanguage.value,  // ✅ Send selected translation language
                })
            );
        };

        socket.onmessage = handleSocketMessage;
        socket.onclose = () => console.log("❌ Disconnected from WebSocket server");
    } catch (error) {
        console.error("❌ Error opening microphone:", error);
    }
};

// ✅ Handle WebSocket Messages
function handleSocketMessage(event) {
    if (event.data === "") return;

    // Check if the message is binary data (TTS audio)
    if (event.data instanceof Blob) {
        if(userInteracted){

            audioQueue.push(event.data); // Add audio to queue
            if (audioQueue.length === 1) {
                playNextAudio(); // Play immediately if queue was empty
            }
        }
        return;
    }

    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error("❌ Failed to parse JSON:", e);
        return;
    }
    console.log(data);

    // ✅ Handle Translation
    if (data.type === "translation") {
        console.log("📌 Received Translation:", data.translation); // ✅ Debugging Log
        let newTranslationDiv = document.createElement("div");
        newTranslationDiv.innerText = data.translation;
        newTranslationDiv.className = "translation-sentence";
        translationBox.appendChild(newTranslationDiv);
        translationBox.scrollTop = translationBox.scrollHeight; // ✅ Auto-scroll for translations
    }
}

// ✅ Function to play audio from a Blob
function playAudio(blob) {
    console.log("🔊 Playing TTS audio");
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play().then(() => {
        console.log("🔊 Playing TTS audio");
    }).catch((error) => {
        console.error("❌ Error playing TTS audio:", error);
    });
}

// ✅ Function to play the next audio in the queue
function playNextAudio() {
    console.log("🔊 Playing next TTS audio",userInteracted);
    if (audioQueue.length === 0 || !userInteracted) return; // Ensure user interaction
    const blob = audioQueue.shift();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play().then(() => {
        console.log("🔊 Finished playing TTS audio");
        setTimeout(playNextAudio, 500); // Add a delay before playing the next audio
    }).catch((error) => {
        console.error("❌ Error playing TTS audio:", error);
        setTimeout(playNextAudio, 500); // Add a delay before trying to play the next audio
    });
}