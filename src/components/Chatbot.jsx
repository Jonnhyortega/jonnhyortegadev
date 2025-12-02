"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import callChatAPI from "../utils/chatbot";
import "animate.css";
import { Send } from "lucide-react";
import { leapfrog } from "ldrs";
import { useLanguage } from "../context/LanguageContext"; // ← USAMOS TU CONTEXTO

leapfrog.register();

const botResponseSound = typeof Audio !== "undefined" ? new Audio("/sounds/bot-response.mp3") : null;
const userSendSound = typeof Audio !== "undefined" ? new Audio("/sounds/send.mp3") : null;
const typingSound = typeof Audio !== "undefined" ? new Audio("/sounds/typing.mp3") : null;

export default function Chatbot({ context = "" }) {
  const { t } = useLanguage();

  const presentacion = t("chatbot.presentacion"); 

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", content: presentacion }]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickReplies = [
    t("chatbot.quickReplies.budget"),
    // t("chatbot.quickReplies.social"),
  ];

  const toggleChat = () => {setChatOpen((prev) => !prev)};

useEffect(() => {
  if (chatOpen) {
    document.body.style.overflow = "hidden"; 
  } else {
    document.body.style.overflow = "auto";    
  }

  return () => {
    document.body.style.overflow = "auto";    
  };
}, [chatOpen]);


  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(scrollToBottom, [messages, scrollToBottom]);

  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && setChatOpen(false);
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const send = async (text) => {
    setMessages((prev) => [...prev, { from: "user", content: text }]);
    setHistory((prev) => [...prev, { role: "user", content: text }]);

    if (userSendSound) {
      userSendSound.currentTime = 0;
      userSendSound.play().catch(() => {});
    }

    setLoading(true);

    let reply;

    // 🌐 RESPUESTAS PREDEFINIDAS MULTI-IDIOMA
    switch (text) {
      case t("chatbot.quickReplies.budget"):
        reply = (
          <span className="flex flex-col items-start justify-end gap-2">
              Por whatsapp es mas fluido:{" "}
            <a
              className="flex items-center gap-2 text-white underline"
              href="https://wa.me/1122684234"
              target="_blank"
              rel="noopener noreferrer"
            >  
              <img width="24" src="https://img.icons8.com/fluency/48/whatsapp.png" />
              +541122684234
            </a>
          </span>
        );
        break;

      case "¿De donde es Jonathan Ortega?":
      case "Where is Jonathan Ortega from?":
        reply = t("Jonathan Ortega actualmente reside en Ciudad Autónoma de Buenos Aires.");
        break;

      case t("chatbot.quickReplies.social"):
        reply = (
          <span className="flex items-center gap-2">
            {t("Sígueme en")}{" "}
            <a className="flex items-center gap-2 text-white underline" href="https://instagram.com/jonnhyortega" target="_blank">
              <img width="24" src="https://img.icons8.com/color/48/instagram.png" />
              Instagram
            </a>{" "}
            {t("y")}{" "}
            <a className="flex items-center gap-2 text-white underline" href="https://linkedin.com/in/jonathan-ortega-a00970191" target="_blank">
              <img width="24" src="https://img.icons8.com/fluency/48/linkedin.png" />
              LinkedIn
            </a>
          </span>
        );
        break;

      default:
        try {
          typingSound && (() => {
            typingSound.loop = true;
            typingSound.volume = 0.3;
            typingSound.currentTime = 0;
            typingSound.play().catch(() => {});
          })();

          reply = await callChatAPI(text, history, context);
        } catch {
          reply = t("Lo siento, ocurrió un error. Intenta nuevamente.");
        }
    }

    typingSound && typingSound.pause();

    setMessages((prev) => [...prev, { from: "bot", content: reply }]);
    setHistory((prev) => [
      ...prev,
      { role: "assistant", content: typeof reply === "string" ? reply : "" },
    ]);

    botResponseSound && (() => {
      botResponseSound.currentTime = 0;
      botResponseSound.volume = 0.7;
      botResponseSound.play().catch(() => {});
    })();

    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    send(input.trim());
    setInput("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-[10000] font-sans">

        {/* BOTÓN ABRIR */}
        {!chatOpen ? (
        <button
            onClick={toggleChat}
            className="group flex items-center gap-2 px-4 py-3 rounded-2xl 
            bg-white/10 backdrop-blur-md border border-white/20 shadow-lg
            hover:bg-white/20 transition-all text-white font-light 
            hover:shadow-purple-500/30"
        >
            <img
            width="22"
            src="https://img.icons8.com/ios-filled/50/chat.png"
            className="opacity-80 group-hover:opacity-100 transition"
            />
            <span className="font-[var(--kanit)]">
            {t("chatbot.openButton")}
            </span>
        </button>
        ) : (

        /* OVERLAY */
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]"
            onClick={toggleChat}
        >
            {/* CHAT WINDOW */}
            <div
            className="w-[95%] sm:w-[420px] h-[75vh] bg-gradient-to-br 
            from-purple-900/40 to-indigo-900/30 backdrop-blur-xl rounded-3xl 
            border border-white/20 shadow-2xl flex flex-col overflow-hidden 
            animate__animated animate__fadeInUp fixed bottom-3 right-3"
            onClick={(e) => e.stopPropagation()}
            >
            {/* HEADER */}
            <header className="px-5 py-4 flex justify-between items-center 
            bg-white/10 border-b border-white/20 text-white font-semibold 
            backdrop-blur-xl shadow-lg">
                <span className="tracking-wide">
                {t("chatbot.header")}
                </span>

                <button
                className="text-2xl hover:text-purple-300 transition"
                onClick={toggleChat}
                >
                ×
                </button>
            </header>

            {/* MENSAJES */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-transparent">
                {messages.map((m, i) => (
                <div
                    key={i}
                    className={`
                    px-4 py-2 max-w-[80%] rounded-2xl shadow-lg animate__animated animate__fadeIn 
                    ${m.from === "user"
                        ? "ml-auto bg-white/20 text-white backdrop-blur-lg border border-white/30"
                        : "mr-auto bg-purple-600 text-white shadow-purple-500/30"
                    }
                    `}
                >
                    {m.content}
                </div>
                ))}

                {loading && (
                <div className="flex items-center gap-3 text-purple-300 text-sm">
                    <l-leapfrog size="35" speed="2.5"></l-leapfrog>
                    {t("chatbot.loadingMessage")}
                </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* RESPUESTAS RÁPIDAS */}
            <div className="p-3 flex flex-wrap gap-2 bg-white/10 backdrop-blur-sm border-t border-white/20">
                {quickReplies.map((q, i) => (
                <button
                    key={i}
                    onClick={() => send(q)}
                    className="px-3 py-2 text-xs rounded-xl bg-white/20 
                    hover:bg-purple-600 hover:text-white transition-all text-white
                    border border-white/20 backdrop-blur-md"
                >
                    {q}
                </button>
                ))}
            </div>

            {/* INPUT */}
            <form
                className="flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-md 
                border-t border-white/20"
                onSubmit={handleSubmit}
            >
                <input
                type="text"
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 text-white placeholder-white/60 
                backdrop-blur-md border border-white/20 outline-none"
                placeholder={t("chatbot.inputPlaceholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                />

                <button
                type="submit"
                className="p-3 rounded-xl bg-purple-600 hover:bg-purple-500 
                transition text-white flex items-center justify-center shadow-purple-500/30 shadow-md"
                >
                <Send className="w-4 h-4" />
                </button>
            </form>

            </div>
        </div>
        )}
    </div>
    );

}
