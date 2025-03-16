const captions = document.getElementById("captions");
const translationBox = document.getElementById("translation-box");
const translationLanguage= document.getElementById("translation-language");
let socket;

// ✅ Function to create a new WebSocket connection
function createWebSocket() {
    return new WebSocket(
        window.location.protocol === "https:" ? "wss://liveword.io" : "ws://localhost:3000"
    );
}


window.onload = () => {

try {
    socket = createWebSocket();
    socket.onopen = () => {
        console.log("✅ WebSocket Connected on trnalsatipon side ");

        // ✅ Send selected transcription and translation languages
        console.log("🌐 Transcription:", translationLanguage.value); // ✅ Debugging Log
        translationLanguage.onchange = () =>{
            socket.send(
                JSON.stringify({
                    type: "setTranslation",
                    targetLanguage: translationLanguage.value,  // ✅ Send selected translation language
                })
            );
        }
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

    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) { 
        console.error("❌ Failed to parse JSON:", e);
        return;
    }
    console.log(data)
    // ✅ Handle Translation
    if(data.type === "translation"){
    
        console.log("📌 Received Translation:", data.translation); // ✅ Debugging Log
        let newTranslationDiv = document.createElement("div");
        newTranslationDiv.innerText = data.translation;
        newTranslationDiv.className = "translation-sentence";
        translationBox.appendChild(newTranslationDiv);
        translationBox.scrollTop = translationBox.scrollHeight; // ✅ Auto-scroll for translations
    }
}