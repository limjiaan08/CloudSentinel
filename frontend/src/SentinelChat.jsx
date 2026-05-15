import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SentinelChat = ({ selectedFindingId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: "I'm **SentinelAI**, your intelligent AWS security assistant. Ask me anything about AWS security, cloud misconfigurations, or how to fix security issues. What would you like to know?" }
  ]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
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
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: userMsg,
          result_item_id: selectedFindingId
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.status === 'success') {
          setMessages(prev => [...prev, { role: 'ai', content: data.reply || "No response from Sentinel." }]);
        } else {
          setMessages(prev => [...prev, { role: 'ai', content: data.message || "Error processing request." }]);
        }
      } else {
        // Handle error responses
        if (response.status === 401) {
          setMessages(prev => [...prev, { role: 'ai', content: "⚠️ You must be logged in to use the chatbot. Please log in and try again." }]);
        } else {
          setMessages(prev => [...prev, { role: 'ai', content: data.error || data.message || "Error processing request." }]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "⚠️ Connection error. Please ensure the backend is running." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed bottom-6 left-6 z-[999] font-sans">
      {!isOpen ? (
        <button
            onClick={() => setIsOpen(true)}
            className="w-[235px] mt-4 flex items-center gap-4 bg-[#2D3848] border border-white/20 p-5 rounded-2xl transition-all duration-300 hover:border-[#FF9900]/50 group"
        >
            {/* Identity Icon */}
            <div className="relative shrink-0 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-[#FF9900] to-[#E68A00] rounded-lg shadow-lg">
            <Bot size={20} className="text-white" />
            {/* Live Pulse Indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9900] opacity-90"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            </div>

            {/* Labeling */}
            <div className="flex flex-col text-left">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF9900]">AI Assistant</h4>
            <span className="text-[16px] font-semibold text-white tracking-tight">Sentinel AI</span>
            </div>

            <Sparkles size={22} className="ml-auto text-white/20 group-hover:text-[#FF9900] transition-colors" />
        </button>
        ) : (
        <div className="bg-white w-[500px] h-[657px] rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-300 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-[#252F3E] p-5 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-[#FF9900]/20 rounded-xl">
                <Bot size={25} className="text-[#FF9900]" />
              </div>
              <div>
                <h3 className="font-bold text-[14px] tracking-widest uppercase">Sentinel AI</h3>
                <p className="text-[12px] text-[#FF9900] font-semibold uppercase tracking-widest">Security Co-Pilot Active</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X size={20} />
            </button>
          </div>

          {/* Chat Area - IMPROVED */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50 max-h-[500px]">
            {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-[#252F3E] text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}>
                    {msg.content ? (
                    <div className="markdown-container space-y-2">
                        <ReactMarkdown 
                        key={`msg-${i}`}
                        components={{
                            p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="font-bold text-slate-900 mt-2 mb-1" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-slate-700" {...props} />,
                            code: ({node, inline, ...props}) => 
                              inline ? (
                                <code className="bg-slate-100 text-red-600 px-1 rounded-md font-mono text-xs" {...props} />
                              ) : (
                                <code className="block bg-slate-800 text-green-500 p-2 rounded-md font-mono text-xs overflow-x-auto relative" {...props} />
                              ),
                            pre: ({node, ...props}) => <pre className="bg-slate-800 text-green-500 pt-0 p-3 rounded-md font-mono text-xs overflow-x-auto" {...props} />,
                            ul: ({node, ...props}) => (
                              <ul className="list-disc pl-5 space-y-1.5 my-2 text-slate-900" {...props} />
                            ),
                            ol: ({node, ...props}) => (
                              <ol className="list-decimal pl-5 space-y-1.5 my-2 text-slate-900" {...props} />
                            ),
                            li: ({node, ...props}) => (
                              <li className="leading-relaxed marker:text-[#FF9900]" {...props} />
                            ),
                        }}
                        >
                        {String(msg.content)}
                        </ReactMarkdown>
                    </div>
                    ) : (
                    <span className="text-slate-400 italic">No content available</span>
                    )}
                    
                    {/* Copy Button for Code Blocks */}
                    {msg.role === 'ai' && msg.content && msg.content.includes('```') && (
                      <button
                        onClick={() => {
                          const codeMatch = msg.content.match(/```[\s\S]*?```/);
                          if (codeMatch) {
                            copyToClipboard(codeMatch[0].replace(/```/g, ''), i);
                          }
                        }}
                        className="mt-2 text-xs bg-slate-600 hover:bg-slate-700 text-white px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                      >
                        {copiedIndex === i ? (
                          <><Check size={12} /> Copied!</>
                        ) : (
                          <><Copy size={12} /> Copy Code</>
                        )}
                      </button>
                    )}
                </div>
                </div>
            ))}
            {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-widest ml-2">
                <Sparkles size={14} className="animate-spin text-[#FF9900]" />
                Generating Response...
                </div>
            )}
            </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-5 bg-white border-t border-slate-100 flex gap-4 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query security rules..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-[1.5rem] px-4 py-3 text-sm focus:ring-2 focus:ring-[#FF9900] outline-none"
            />
            <button type="submit" disabled={loading} className=" text-slate-400 hover:text-[#FF9900]">
              <Send size={25} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SentinelChat;