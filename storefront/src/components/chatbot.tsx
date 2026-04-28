"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "Merhaba! 👋 Ben Cino, Mobilya Furniture'ın dijital asistanıyım. Size ürünlerimiz, siparişleriniz veya mağazamız hakkında yardımcı olabilirim. Nasıl yardımcı olabilirim?",
};

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const cartStore = useCartStore();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Show pulse after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setHasInteracted(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const apiMessages = updatedMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Üzgünüm, yanıt alınamadı.",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle AI Actions
      if (data.actions && data.actions.length > 0) {
        for (const action of data.actions) {
          if (action.type === "navigate_to") {
            const path = action.payload.path;
            if (path) router.push(path);
          } else if (action.type === "add_to_cart") {
            const { item_id, quantity } = action.payload;
            if (item_id && quantity) {
              try {
                // Fetch product details to add to cart
                const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/storefront/catalog/${item_id}`);
                if (productRes.ok) {
                  const product = await productRes.json();
                  const existingItem = cartStore.items.find(i => i.id === product.id);
                  const currentQty = existingItem ? existingItem.quantity : 0;
                  const newQty = currentQty + quantity;

                  if (existingItem) {
                    cartStore.updateQuantity(product.id, newQty);
                  } else {
                    cartStore.addItem({
                      id: product.id,
                      name: product.name,
                      sku: product.sku,
                      price: product.selling_price,
                      available_stock: product.available_stock
                    });
                    if (newQty > 1) {
                      cartStore.updateQuantity(product.id, newQty);
                    }
                  }
                  cartStore.openCart();
                }
              } catch (err) {
                console.error("Failed to execute add_to_cart action:", err);
              }
            }
          }
        }
      }

    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Action Button — Cino Avatar */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setIsOpen(true); setHasInteracted(false); }}
            className="fixed bottom-4 right-4 z-[9999] w-36 h-36 flex items-center justify-center group transition-transform drop-shadow-2xl"
            id="cino-chat-fab"
          >
            <Image
              src="/images/cino-avatar.png"
              alt="Cino"
              width={144}
              height={144}
              className="object-contain"
            />
            {/* Pulse ring behind the image */}
            {hasInteracted && (
              <span className="absolute inset-4 rounded-full animate-ping bg-sky-400/40 -z-10" />
            )}
            {/* Tooltip */}
            <span className="absolute right-[132px] px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-neutral-700 shadow-lg">
              Cino&apos;ya sor 💬
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-[9999] w-[400px] h-[600px] flex flex-col overflow-hidden rounded-3xl border border-neutral-700/60 shadow-2xl shadow-black/60"
            style={{
              background: "rgba(15, 15, 15, 0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
            id="cino-chat-window"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/60"
              style={{
                background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(14,165,233,0.05))",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center border border-sky-300/30">
                    <Image
                      src="/images/cino-avatar.png"
                      alt="Cino"
                      width={44}
                      height={44}
                      className="object-contain"
                    />
                  </div>
                  {/* Online indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-neutral-900" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Cino</h3>
                  <p className="text-[10px] text-sky-400/80 font-medium">Mobilya AI Asistanı • Çevrimiçi</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl hover:bg-neutral-800/80 transition-colors text-neutral-400 hover:text-white"
                id="cino-close-btn"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth" id="cino-messages">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  {msg.role === "assistant" ? (
                    <div className="w-7 h-7 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center">
                      <Image src="/images/cino-avatar.png" alt="Cino" width={28} height={28} className="object-contain" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center bg-amber-500/20 text-amber-400">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[80%] px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-amber-500/15 text-amber-100 rounded-2xl rounded-tr-md border border-amber-500/20"
                        : "bg-neutral-800/60 text-neutral-200 rounded-2xl rounded-tl-md border border-neutral-700/40"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center">
                    <Image src="/images/cino-avatar.png" alt="Cino" width={28} height={28} className="object-contain" />
                  </div>
                  <div className="bg-neutral-800/60 border border-neutral-700/40 rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mx-auto text-center px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
                >
                  {error}
                </motion.div>
              )}
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {[
                  "Ürün kategorileriniz neler?",
                  "İade politikası nedir?",
                  "Kargo süresi ne kadar?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-neutral-700/60 text-neutral-400 hover:text-sky-400 hover:border-sky-400/40 transition-all bg-neutral-900/50 hover:bg-sky-500/5"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <form
              id="cino-form"
              onSubmit={onSubmit}
              className="flex items-center gap-2 px-4 py-3 border-t border-neutral-800/60 bg-neutral-900/40"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Cino'ya bir şey sorun..."
                className="flex-1 bg-neutral-800/60 border border-neutral-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-400/50 transition-colors"
                disabled={isLoading}
                id="cino-input"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2.5 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{
                  background: input.trim()
                    ? "linear-gradient(135deg, #38bdf8, #0ea5e9)"
                    : "rgba(115,115,115,0.3)",
                }}
                id="cino-send-btn"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin text-neutral-400" />
                ) : (
                  <Send size={18} />
                )}
              </motion.button>
            </form>

            {/* Footer */}
            <div className="text-center py-1.5 text-[9px] text-neutral-600 bg-neutral-950/60">
              Powered by <span className="text-sky-400 font-semibold">Cino AI</span> • Mobilya Furniture
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
