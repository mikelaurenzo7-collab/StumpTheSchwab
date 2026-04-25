import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { useEngineStore } from "../store/engine";

export function RecorderModal({ onClose }: { onClose: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addSampleToLibrary = useEngineStore((state) => state.addSampleToLibrary);

  const levelRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const meterRef = useRef<Tone.Meter | null>(null);

  useEffect(() => {
    async function initMic() {
      try {
        const mic = new Tone.UserMedia();
        await mic.open();
        const recorder = new Tone.Recorder();
        const meter = new Tone.Meter({ smoothing: 0.8 });
        mic.connect(recorder);
        mic.connect(meter);
        
        micRef.current = mic;
        recorderRef.current = recorder;
        meterRef.current = meter;
      } catch {
        setError("Microphone access denied or unavailable.");
      }
    }
    initMic();

    let af: number;
    const loop = () => {
      if (meterRef.current && levelRef.current) {
        const val = meterRef.current.getValue();
        const level = typeof val === "number" ? val : val[0];
        const percent = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
        levelRef.current.style.width = `${percent}%`;
      }
      af = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(af);
      if (micRef.current) {
        try { micRef.current.close(); } catch {}
        micRef.current.dispose();
      }
      if (recorderRef.current) recorderRef.current.dispose();
      if (meterRef.current) meterRef.current.dispose();
    };
  }, []);

  const handleToggleRecord = async () => {
    if (!recorderRef.current) return;
    if (isRecording) {
      const recording = await recorderRef.current.stop();
      const url = URL.createObjectURL(recording);
      setAudioUrl(url);
      setIsRecording(false);
    } else {
      setAudioUrl(null);
      recorderRef.current.start();
      setIsRecording(true);
    }
  };

  const handleSave = () => {
    if (!audioUrl) return;
    const name = prompt("Enter a name for this recording:") || "Mic Recording";
    addSampleToLibrary({
      id: "mic_" + Date.now(),
      name,
      url: audioUrl,
      category: "Mic",
      tags: ["recording"],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6 text-zinc-100">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 text-lg">●</span>
            <h2 className="font-semibold text-lg">Record Sample</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-surface-3 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {error ? (
          <div className="text-red-400 text-sm mb-4">{error}</div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-center mb-6">
              <button
                onClick={handleToggleRecord}
                className={`flex h-16 w-16 items-center justify-center rounded-full transition-all text-xl font-bold ${
                  isRecording 
                  ? "bg-red-500/20 text-red-500 animate-pulse border-2 border-red-500" 
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {isRecording ? "■" : "●"}
              </button>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800 mb-6">
              <div ref={levelRef} className="h-full bg-yellow-500 transition-all duration-75" style={{ width: "0%" }} />
            </div>

            {audioUrl && (
              <div className="space-y-4">
                <audio src={audioUrl} controls className="w-full h-10 rounded-lg" />
                <button
                  onClick={handleSave}
                  className="w-full rounded-lg bg-yellow-500 py-2 font-medium text-black hover:bg-yellow-400 transition-colors"
                >
                  Save to Library
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
