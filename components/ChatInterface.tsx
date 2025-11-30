import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, Volume2, Mic, Square, Pause, Play } from 'lucide-react';
import { ChatMessage } from '../types';
import { GeminiService } from '../services/geminiService';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Audio Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, isTranscribing]);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || isRecording || isTranscribing) return;
    
    const text = input;
    setInput('');
    await onSendMessage(text);
  };

  // --- TTS Logic ---
  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) { /* ignore */ }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setPlayingId(null);
    setIsPaused(false);
  };

  const pauseAudio = async () => {
    if (audioCtxRef.current && playingId) {
      await audioCtxRef.current.suspend();
      setIsPaused(true);
    }
  };

  const resumeAudio = async () => {
    if (audioCtxRef.current && playingId) {
      await audioCtxRef.current.resume();
      setIsPaused(false);
    }
  };

  const playAudio = async (msgId: string, text: string) => {
    if (playingId === msgId) {
       // If currently paused, resume. If playing, do nothing or pause? Let's assume pause toggle.
       if (isPaused) {
           resumeAudio();
       } else {
           pauseAudio();
       }
       return;
    }

    // Stop any existing audio
    stopAudio();

    setPlayingId(msgId);
    try {
      const buffer = await GeminiService.generateSpeech(text);
      if (buffer) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
             audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        } else if (audioCtxRef.current.state === 'suspended') {
             await audioCtxRef.current.resume();
        }

        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 1.25; // Speed up playback by 25%
        source.connect(audioCtxRef.current.destination);
        source.onended = () => {
            setPlayingId(null);
            setIsPaused(false);
            sourceNodeRef.current = null;
        };
        source.start(0);
        sourceNodeRef.current = source;
      } else {
        setPlayingId(null);
      }
    } catch (e) {
      console.error(e);
      setPlayingId(null);
    }
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            // Transcribe
            setIsTranscribing(true);
            const transcription = await GeminiService.transcribeAudio(base64String, 'audio/webm');
            if (transcription) {
                setInput(transcription);
            }
            setIsTranscribing(false);
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 shadow-xl w-full max-w-md">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center space-x-2">
        <div className="p-2 bg-indigo-600 rounded-lg">
          <Bot className="text-white w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Assistente FinAI</h2>
          <p className="text-xs text-slate-500">Registre gastos e consulte seu orçamento</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            <p className="text-sm">Tente dizer:</p>
            <p className="text-xs mt-2 italic">"Gastei R$25 em café e pão de queijo"</p>
            <p className="text-xs mt-1 italic">"Recebi meu salário de 4000 hoje"</p>
            <p className="text-xs mt-1 italic">"Paguei 100 reais na conta de internet"</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none'
              }`}
            >
               {/* Icon for assistant */}
               {msg.role === 'assistant' && (
                <div className="flex items-center justify-between mb-1 opacity-50 border-b border-slate-200 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Advisor</span>
                  <div className="flex items-center gap-1">
                    {playingId === msg.id && (
                        <button onClick={stopAudio} title="Parar" className="hover:text-rose-500"><Square size={10} fill="currentColor" /></button>
                    )}
                    <button 
                        onClick={() => playAudio(msg.id, msg.content)}
                        className={`hover:text-indigo-600 transition-colors ${playingId === msg.id ? 'text-indigo-600' : ''}`}
                        title={playingId === msg.id ? (isPaused ? "Retomar" : "Pausar") : "Ouvir"}
                    >
                        {playingId === msg.id ? (
                            isPaused ? <Play size={12} /> : <Pause size={12} />
                        ) : (
                            <Volume2 size={12} />
                        )}
                    </button>
                  </div>
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <div className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {(isProcessing || isTranscribing) && (
           <div className="flex w-full justify-start">
             <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500">
                    {isTranscribing ? "Transcrevendo áudio..." : "Pensando..."}
                </span>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-3 rounded-full transition-all ${
                isRecording 
                ? 'bg-rose-500 text-white animate-pulse' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Gravar áudio"
            disabled={isProcessing || isTranscribing}
          >
            {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
          </button>

          <div className="relative flex-1">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? "Gravando..." : "Digite uma transação..."}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-full pl-4 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400"
                disabled={isProcessing || isRecording || isTranscribing}
            />
          </div>
          
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || isRecording || isTranscribing}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;