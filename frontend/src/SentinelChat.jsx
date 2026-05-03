import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SentinelChat = ({ selectedFindingId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: "I'm **SentinelAI**. I've indexed your AWS configuration. How can I assist with your security posture?" }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          result_item_id: selectedFindingId
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply || "No response from Sentinel." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "⚠️ Connection error. Please ensure the backend is running." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 left-8 z-[999] font-sans">
      {!isOpen ? (
        <button
            onClick={() => setIsOpen(true)}
            className="w-[220px] mt-4 flex items-center gap-4 bg-[#2D3848] border border-white/10 p-4 rounded-xl transition-all duration-300 hover:border-[#FF9900]/50 group"
        >
            {/* Identity Icon */}
            <div className="relative shrink-0 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-[#FF9900] to-[#E68A00] rounded-lg shadow-lg">
            <Bot size={20} className="text-white" />
            {/* Live Pulse Indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9900] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            </div>

            {/* Labeling */}
            <div className="flex flex-col text-left">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF9900]">AI Assistant</h4>
            <span className="text-[16px] font-semibold text-white tracking-tight">Sentienl AI</span>
            </div>

            <Sparkles size={18} className="ml-auto text-white/20 group-hover:text-[#FF9900] transition-colors" />
        </button>
        ) : (
        <div className="bg-white w-[420px] h-[600px] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-[#252F3E] p-5 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FF9900]/20 rounded-xl">
                <Bot size={22} className="text-[#FF9900]" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-widest uppercase">SentinelAI</h3>
                <p className="text-[10px] text-[#FF9900] font-black uppercase tracking-tighter">Security Co-Pilot Active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X size={20} />
            </button>
          </div>

          {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-[#252F3E] text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}>
                    {/* SAFETY FIX: Ensure content is a string and handle potential Markdown render crashes */}
                    {msg.content ? (
                    <div className="markdown-container">
                        <ReactMarkdown 
                        key={`msg-${i}`}
                        components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            code: ({node, inline, ...props}) => (
                            <code className="bg-slate-100 text-red-600 px-1 rounded font-mono text-xs" {...props} />
                            )
                        }}
                        >
                        {String(msg.content)}
                        </ReactMarkdown>
                    </div>
                    ) : (
                    <span className="text-slate-400 italic">No content available</span>
                    )}
                </div>
                </div>
            ))}
            {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest ml-2">
                <Sparkles size={14} className="animate-spin text-[#FF9900]" />
                Analyzing Infrastructure...
                </div>
            )}
            </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query security rules..."
              className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#FF9900] outline-none"
            />
            <button type="submit" disabled={loading} className="bg-[#252F3E] text-[#FF9900] p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50">
              <Send size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SentinelChat;