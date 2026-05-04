'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const quickSuggestions = ['🔥 Lagu trending', '😢 Lagu galau', '💪 Lagu semangat'];

export default function AiMusicPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hai! Aku Ai Music 🎵. Tanya rekomendasi lagu, arti lirik, mood playlist, atau info artis ya.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || 'AI sedang sibuk, coba lagi');
      }

      const replyText = payload.reply;

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: replyText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          text: 'AI sedang sibuk, coba lagi',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#0d0f14] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#101114]/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <Sparkles className="h-5 w-5 text-fuchsia-300" />
          <h1 className="text-lg font-semibold">Ai Music</h1>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-28 pt-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {quickSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => sendMessage(suggestion)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10"
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow ${
                  message.role === 'user' ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-zinc-100'
                }`}
              >
                {message.role === 'assistant' && (
                  <span className="mb-1 flex items-center gap-1 text-xs text-fuchsia-200">
                    <Bot className="h-3.5 w-3.5" /> Ai Music
                  </span>
                )}
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm text-zinc-200">
                <Loader2 className="h-4 w-4 animate-spin" /> typing...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </section>

      <form onSubmit={onSubmit} className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#101114]/95 p-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tanya soal musik..."
            className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-fuchsia-400"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500 text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </main>
  );
}
