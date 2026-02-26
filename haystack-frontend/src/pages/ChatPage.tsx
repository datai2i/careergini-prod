import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const ChatPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    // `sending` = blocks send button briefly during initial network request
    // `streaming` = AI is typing; input is FREE so user can compose next message
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [sessionId] = useState(() => {
        const stored = localStorage.getItem('careergini_session_id');
        if (stored) return stored;
        const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('careergini_session_id', newId);
        return newId;
    });

    const userId = user?.id || `user_${sessionId}`;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load messages from localStorage on mount
    useEffect(() => {
        const storedMessages = localStorage.getItem('careergini_chat_messages');
        if (storedMessages) {
            try {
                setMessages(JSON.parse(storedMessages));
            } catch (e) {
                console.error('Failed to load messages:', e);
            }
        }
    }, []);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('careergini_chat_messages', JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || sending) return;

        const userMessage: Message = { role: 'user', content: input };
        const userInput = input;
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setSending(true); // briefly block re-send while request initiates

        // Add placeholder for assistant message
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const response = await fetch('/api/ai/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    session_id: sessionId,
                    message: userInput
                })
            });

            if (!response.body) throw new Error('No response body');

            // Stream is starting — immediately unblock the input so user can type next message
            setSending(false);
            setStreaming(true);
            // Re-focus the input field without delay
            setTimeout(() => inputRef.current?.focus(), 0);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let streamedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'complete') {
                                // Cached response
                                streamedContent = data.data.response;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].content = streamedContent;
                                    return newMessages;
                                });
                            } else if (data.type === 'chunk') {
                                // Stream chunk
                                streamedContent += data.content;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].content = streamedContent;
                                    return newMessages;
                                });
                            } else if (data.type === 'done') {
                                // Final response
                                streamedContent = data.data.response;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].content = streamedContent;
                                    return newMessages;
                                });
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setSending(false);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = 'Error: Could not connect to AI service.';
                return newMessages;
            });
            showToast('Failed to get GINI response', 'error');
        } finally {
            setStreaming(false);
        }
    }, [input, sending, userId, sessionId, showToast]);


    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn">
            <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                                <Bot size={32} className="text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">How can GINI help you today?</h3>
                            <p className="max-w-md">Ask GINI to review your resume, suggest career paths, or find job openings relevant to your skills.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={clsx('flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                            <div className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                            )}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>

                            <div className={clsx(
                                'max-w-[80%] p-4 rounded-2xl',
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-gray-100 text-gray-900 rounded-tl-none'
                            )}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator: only shows when streaming AND last message is still empty placeholder */}
                    {streaming && messages[messages.length - 1]?.content === '' && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
                                <Bot size={16} />
                            </div>
                            <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin text-gray-500" />
                                <span className="text-sm text-gray-500">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !sending && sendMessage()}
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder={streaming ? 'GINI is responding — type your next message...' : 'Type your message...'}
                            disabled={sending}
                            autoFocus
                        />
                        <button
                            onClick={sendMessage}
                            disabled={sending || !input.trim()}
                            className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={20} />
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Clear all chat history?')) {
                                    setMessages([]);
                                    localStorage.removeItem('careergini_chat_messages');
                                }
                            }}
                            className="bg-red-600 text-white px-4 py-3 rounded-xl hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">Powered by Local LLMs (Ollama)</p>
                        <p className="text-xs text-gray-400">Session: {sessionId.slice(0, 16)}...</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
