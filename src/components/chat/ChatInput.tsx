"use client";

import React, { useState } from "react";
import { Send, Paperclip, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatInput({ onSend }: { onSend?: (msg: string) => Promise<boolean | void> | boolean | void }) {
  const [message, setMessage] = useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message;
    if (!text.trim()) return;
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px';
    }
    // Clear immediately for responsiveness, but hand the text back if the send
    // failed (unless the user has already started typing something new).
    const sent = onSend ? await onSend(text) : true;
    if (sent === false) {
      setMessage((current) => (current ? current : text));
      requestAnimationFrame(adjustHeight);
    }
  };

  return (
    <div className="p-4 bg-[#0F1419]/90 backdrop-blur-3xl border-t border-white/10 sticky bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <form onSubmit={handleSubmit} className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustHeight();
            }}
            placeholder="Type your message..."
            className={cn(
              "w-full bg-black/40 text-white rounded-3xl px-5 py-3.5 border border-white/10 outline-none resize-none min-h-[52px] max-h-[150px]",
              "focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
              "placeholder:text-gray-600"
            )}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim()}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 mb-0.5",
            message.trim() 
              ? "bg-gradient-to-r from-[#D4AF37] to-[#FACC15] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
              : "bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed"
          )}
        >
          <Send className="w-5 h-5 ml-1" />
        </button>
      </form>
    </div>
  );
}
