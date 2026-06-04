import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  History,
  AlertCircle,
  Clock,
  ArrowRight,
  User,
  HeartHandshake
} from "lucide-react";
import { ToneType, ExampleMessage, GenerationHistory } from "./types";

const EXAMPLE_TEMPLATES: ExampleMessage[] = [
  {
    id: "pricing",
    label: "Pricing Inquiry",
    category: "Incentive",
    content: "Hi, I saw your product online and we want to know what the plans are. Do you offer an annual discount or a startup pricing model for companies with under 10 employees?",
    suggestedTone: "Sales-focused",
  },
  {
    id: "demo",
    label: "Demo Request",
    category: "Corporate",
    content: "Hi there, I'm the ops lead at highgrowth.io and we have been looking at your automation tool. We'd love a personalized demo next Monday for about 20 minutes if your team is free.",
    suggestedTone: "Formal",
  },
  {
    id: "custom",
    label: "Integration Questions",
    category: "Technical",
    content: "Hello, does your software support direct synchronization with HubSpot and Salesforce? We need accurate hourly exports for our lead records and want to ensure there is no data loss.",
    suggestedTone: "Formal",
  },
  {
    id: "support",
    label: "setup assistance",
    category: "Relational",
    content: "Hey folks, we are trying to initialize our webhook integrations but we are getting a 403 authorization error. Is there an updated documentation URL we can reference to fix this?",
    suggestedTone: "Friendly",
  },
];

export default function App() {
  const [customerMessage, setCustomerMessage] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState<ToneType>("Friendly");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedReply, setGeneratedReply] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [remainingGenerations, setRemainingGenerations] = useState<number>(15);

  // Load history & daily usage limits from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lead_reply_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }

      const usageStored = localStorage.getItem("lead_reply_usage");
      const todayStr = new Date().toISOString().split("T")[0];
      if (usageStored) {
        const parsed = JSON.parse(usageStored);
        if (parsed.date === todayStr) {
          setRemainingGenerations(parsed.remaining !== undefined ? parsed.remaining : Math.max(0, 15 - (parsed.count || 0)));
        } else {
          // New day, reset limits
          localStorage.setItem("lead_reply_usage", JSON.stringify({ date: todayStr, count: 0, remaining: 15 }));
          setRemainingGenerations(15);
        }
      } else {
        localStorage.setItem("lead_reply_usage", JSON.stringify({ date: todayStr, count: 0, remaining: 15 }));
        setRemainingGenerations(15);
      }
    } catch (e) {
      console.error("Failed to read history/usage from localStorage:", e);
    }
  }, []);

  // Save history to localStorage on update
  const saveHistory = (newHistory: GenerationHistory[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("lead_reply_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save history to localStorage:", e);
    }
  };

  // Safe usage register helper
  const saveUsageCount = (serverRemaining?: number) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const usageStored = localStorage.getItem("lead_reply_usage");
      let count = 1;
      if (usageStored) {
        const parsed = JSON.parse(usageStored);
        if (parsed.date === todayStr) {
          count = (parsed.count || 0) + 1;
        }
      }
      const finalRemaining = serverRemaining !== undefined ? serverRemaining : Math.max(0, 15 - count);
      localStorage.setItem("lead_reply_usage", JSON.stringify({ date: todayStr, count, remaining: finalRemaining }));
      setRemainingGenerations(finalRemaining);
    } catch (e) {
      console.error("Failed to save usage metrics:", e);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerMessage.trim()) return;

    if (remainingGenerations <= 0) {
      setError("Daily generation limit reached! Free users are capped at 15 generations per day to prevent host cost abuse.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedReply("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: customerMessage,
          tone: selectedTone,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setRemainingGenerations(0);
          try {
            const todayStr = new Date().toISOString().split("T")[0];
            localStorage.setItem("lead_reply_usage", JSON.stringify({ date: todayStr, count: 15, remaining: 0 }));
          } catch {}
        }
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.reply) {
        setGeneratedReply(data.reply);
        
        // Update local limits securely from backend feedback count
        saveUsageCount(data.remaining);

        // Add to history list (max 10 items)
        const newItem: GenerationHistory = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          message: customerMessage,
          tone: selectedTone,
          reply: data.reply
        };
        const updatedHistory = [newItem, ...history.slice(0, 9)];
        saveHistory(updatedHistory);
      } else {
        throw new Error("Invalid response received from the generator server.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplate = (tpl: ExampleMessage) => {
    if (remainingGenerations <= 0) {
      setError("Daily generation limit reached! Reset your local cache or try again tomorrow.");
      return;
    }
    setCustomerMessage(tpl.content);
    setSelectedTone(tpl.suggestedTone);
  };

  const handleCopy = async () => {
    if (!generatedReply) return;
    try {
      await navigator.clipboard.writeText(generatedReply);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard", e);
    }
  };

  const handleClear = () => {
    setCustomerMessage("");
    setGeneratedReply("");
    setError(null);
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your local generation history?")) {
      saveHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-indigo-100 selection:text-indigo-900 pb-16">
      {/* Decorative background shape */}
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-50/70 via-slate-50/20 to-transparent -z-10 pointer-events-none" />

      {/* Top Banner & Title info */}
      <header className="max-w-4xl mx-auto pt-10 px-4 md:pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
              <Sparkles className="w-5 h-5" id="brand-sparkle-icon" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold font-display tracking-tight text-slate-900" id="application-heading">
                Lead Response Reply Generator
              </h1>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Safe business reply formatter with explicit fact checks and strict anti-hallucination controls.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-slate-50/80 transition-all cursor-pointer shadow-xs"
            title="View recent response history"
            id="toggle-history-button"
          >
            <History className="w-3.5 h-3.5" />
            History ({history.length})
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-4xl mx-auto px-4 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Work Form Area */}
          <div className="md:col-span-12 bg-white rounded-2xl border border-slate-200/95 shadow-sm p-5 md:p-6">
            
            {/* SaaS Usage Counter */}
            <div className="mb-5 p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 shadow-3xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${remainingGenerations > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-semibold text-slate-700">Free Tier Standard Plan Usage</span>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="font-mono bg-white border border-slate-250 px-2.5 py-1 rounded-md text-slate-800 font-semibold shadow-2xs">
                  {remainingGenerations} of 15 credits remaining today
                </span>
                <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block border border-slate-100">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${(remainingGenerations / 15) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Templates Shelf */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Quick-load message guidelines:
              </label>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => loadTemplate(tpl)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 hover:text-indigo-700 transition cursor-pointer"
                    id={`template-btn-${tpl.id}`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Customer message container */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="customer-message" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    Customer Message
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {customerMessage.length} characters
                  </span>
                </div>
                <textarea
                  id="customer-message"
                  rows={6}
                  placeholder="Paste customer message or lead email inquiry here..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 font-sans text-sm leading-relaxed text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all shadow-inner"
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  required
                />
              </div>

              {/* Action and Tone Controls Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                {/* Tone Select Dropdown */}
                <div className="flex items-center gap-3">
                  <label htmlFor="tone-selector" className="text-sm font-semibold text-slate-700 shrink-0">
                    Desired Tone:
                  </label>
                  <div className="relative">
                    <select
                      id="tone-selector"
                      value={selectedTone}
                      onChange={(e) => setSelectedTone(e.target.value as ToneType)}
                      className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-xs min-w-[160px]"
                    >
                      <option value="Friendly">Friendly 😉</option>
                      <option value="Formal">Formal 💼</option>
                      <option value="Sales-focused">Sales-focused 🚀</option>
                    </select>
                    {/* Native UI indicator */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Submit button and Reset */}
                <div className="flex items-center gap-3">
                  {customerMessage && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100/70 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer flex items-center gap-1.5"
                      title="Reset text fields"
                      id="clear-workspace-btn"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading || !customerMessage.trim() || remainingGenerations <= 0}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-indigo-100 transition-all duration-200 cursor-pointer ${
                      isLoading || !customerMessage.trim() || remainingGenerations <= 0
                        ? "bg-slate-300 shadow-none cursor-not-allowed text-slate-400"
                        : "bg-indigo-600 hover:bg-indigo-700 active:scale-98"
                    }`}
                    id="submit-generate-button"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Composing Reply...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Prompt result / generated response status */}
          <div className="md:col-span-12">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex gap-3 items-start"
                  id="error-banner"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Generation failed:</span>
                    <p className="mt-0.5 opacity-90">{error}</p>
                  </div>
                </motion.div>
              )}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white border border-slate-200/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3"
                  id="loading-mock-card"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-500">
                    Analyzing context & formulation of dynamic next steps...
                  </p>
                  <p className="text-xs text-slate-400">
                    Crafting a polite, clear response optimized for conversion.
                  </p>
                </motion.div>
              )}

              {!isLoading && !error && generatedReply && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl border border-slate-250 border-t-4 border-t-indigo-600 shadow-md p-5 md:p-6"
                  id="results-pane-card"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Generated Response ({selectedTone})
                      </span>
                    </div>
                    
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isCopied
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                      }`}
                      id="copy-to-clipboard-btn"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Reply
                        </>
                      )}
                    </button>
                  </div>

                  {/* Generated text display box */}
                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 md:p-5 text-slate-800 text-sm md:text-base leading-relaxed font-sans whitespace-pre-wrap select-all">
                    {generatedReply}
                  </div>

                  {/* Quality indicators */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        Length: {generatedReply.split(/[.!?]+/).filter(Boolean).length} sentences
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        Words: {generatedReply.split(/\s+/).filter(Boolean).length}
                      </span>
                    </div>

                    <p className="text-xs italic text-indigo-500 flex items-center gap-1 font-medium">
                      <HeartHandshake className="w-3.5 h-3.5" />
                      Rule: Response created strictly from explicit message details. No fake details were invented.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsible History Drawer */}
          {showHistory && (
            <div className="md:col-span-12 border-t border-slate-200/80 pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Recent Generation Logs ({history.length})
                </span>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition cursor-pointer"
                    id="clear-all-history-btn"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="bg-white border border-slate-200/60 rounded-xl p-6 text-center text-sm text-slate-400">
                  No previous replies formatted yet in session database.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-sm">
                            {item.tone}
                          </span>
                          <span className="text-slate-400 font-sans flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.timestamp}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setCustomerMessage(item.message);
                            setSelectedTone(item.tone);
                            setGeneratedReply(item.reply);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                          id={`restore-history-btn-${item.id}`}
                        >
                          Restore
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs border-t border-slate-100 pt-2.5">
                        <div className="line-clamp-2 text-slate-500 bg-slate-50/50 p-2 rounded">
                          <span className="font-semibold text-slate-600 block mb-0.5">Payload inquiry:</span>
                          "{item.message}"
                        </div>
                        <div className="line-clamp-2 text-slate-600 bg-indigo-50/20 p-2 rounded border border-indigo-50/40">
                          <span className="font-semibold text-indigo-700 block mb-0.5">Draft Reply:</span>
                          "{item.reply}"
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
