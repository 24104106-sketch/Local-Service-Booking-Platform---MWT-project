/**
 * FixIt Assistant Speech Service (Web Speech API)
 * Handles Speech Recognition (Voice Input) and Speech Synthesis (Voice Output)
 * Supports English and Tamil (including Tanglish playback) with graceful fallbacks.
 */

// Check Speech Recognition support
export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Check Speech Synthesis support
export function isSpeechSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== "undefined");
}

/**
 * Start listening for voice input.
 * @param {Object} options
 * @param {string} options.lang - "en" | "ta" | "tanglish"
 * @param {Function} options.onResult - callback with recognized text string
 * @param {Function} options.onError - callback with error message
 * @param {Function} options.onEnd - callback when listening ends
 * @returns {Object} { stop: Function }
 */
export function startVoiceRecognition({ lang = "en", onResult, onError, onEnd }) {
  if (!isSpeechRecognitionSupported()) {
    onError?.(
      lang === "ta" || lang === "tanglish"
        ? "தமிழ் voice input இந்த browser-ல் support ஆகாமல் இருக்கலாம். Message-ஐ type செய்து தொடரலாம்."
        : "Voice input isn't supported on this browser. You can type your message instead."
    );
    return { stop: () => {} };
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // Pick suitable language tag
  recognition.lang = lang === "ta" ? "ta-IN" : "en-IN";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let finalTranscript = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    const currentText = finalTranscript || interim;
    if (currentText && onResult) {
      onResult(currentText);
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      onError?.(
        lang === "ta" || lang === "tanglish"
          ? "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. Browser settings-ல் மைக் அனுமதியை சரிபார்க்கவும்."
          : "Microphone permission was denied. Please allow microphone access in your browser settings."
      );
    } else if (event.error !== "no-speech") {
      onError?.(
        lang === "ta" || lang === "tanglish"
          ? "குரல் பதிவு பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்."
          : "Could not recognize speech. Please try speaking again."
      );
    }
  };

  recognition.onend = () => {
    onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    console.warn("Error starting speech recognition:", err);
    onEnd?.();
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Clean markdown symbols, bullets, and emojis for smooth TTS reading.
 */
function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/[•\-\#]/g, "") // bullets/headings
    .replace(/[1-9]️⃣/g, "") // number emojis
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // common emojis
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Speak text aloud in the requested language.
 * @param {string} text - text to speak
 * @param {string} lang - "en" | "ta" | "tanglish"
 * @param {Function} onStart - callback when speech begins
 * @param {Function} onEnd - callback when speech finishes
 */
export function speakResponse(text, lang = "en", onStart, onEnd) {
  if (!isSpeechSynthesisSupported()) return;

  // Stop any active speech
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Check if text has Tamil Unicode characters
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(cleanText);
  const isTamil = lang === "ta" || hasTamilScript;

  utterance.lang = isTamil ? "ta-IN" : "en-IN";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Find appropriate voice if available
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (voices.length > 0) {
    let matchedVoice;
    if (isTamil) {
      matchedVoice = voices.find(
        (v) => v.lang.startsWith("ta") || v.name.toLowerCase().includes("tamil")
      );
    } else {
      matchedVoice = voices.find(
        (v) => v.lang === "en-IN" || v.lang === "en-US" || v.lang.startsWith("en")
      );
    }
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

/**
 * Cancel any ongoing speech synthesis.
 */
export function stopSpeech() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}
