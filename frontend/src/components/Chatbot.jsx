import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { api } from '../services/api'; // Or import chatApi from '../api'
import './Chatbot.css';

const INITIAL_MESSAGE = {
  id: 'welcome',
  text: "Hi! I'm your AI Revenue Assistant. I can help you understand your recovery data.",
  sender: 'ai'
};

const SUGGESTIONS = [
  "How much revenue is at risk?",
  "What should we recover first?",
  "How many critical transactions are there?",
  "Show me recent recovery attempts"
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (text) => {
    if (!text.trim()) return;
    
    setShowSuggestions(false);
    
    const userMsg = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await api.sendMessage(text);
      const aiMsg = { 
        id: (Date.now() + 1).toString(), 
        text: response.answer, 
        sender: 'ai' 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg = { 
        id: (Date.now() + 1).toString(), 
        text: "Unable to connect to the Revenue Assistant. Please try again.", 
        sender: 'ai' 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  return (
    <div className="chatbot-container">
      {isOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <span className="chatbot-header-title">AI Revenue Assistant</span>
              <span className="chatbot-header-subtitle">Ask about your recovery data</span>
            </div>
            <button className="chatbot-close-btn" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            
            {showSuggestions && messages.length === 1 && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button 
                    key={idx} 
                    className="chat-suggestion-btn"
                    onClick={() => handleSend(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            
            {isLoading && (
              <div className="chatbot-typing">
                Thinking <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-area">
            <form onSubmit={handleSubmit} className="chatbot-input-form">
              <input
                type="text"
                className="chatbot-input"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="chatbot-send-btn"
                disabled={!inputValue.trim() || isLoading}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className="chatbot-button" onClick={() => setIsOpen(true)}>
          <Bot size={28} />
        </button>
      )}
    </div>
  );
}
