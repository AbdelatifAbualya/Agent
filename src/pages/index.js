// src/pages/index.js
import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto', 'search', or 'direct'
  const messagesEndRef = useRef(null);

  // Automatically scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Format input based on selected mode
    let processedInput = input;
    if (mode === 'search') {
      processedInput = `/search ${input}`;
    } else if (mode === 'direct') {
      processedInput = `/ask ${input}`;
    }

    // Add user message to chat
    const userMessage = { role: 'user', content: input, mode };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send the message to our API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: processedInput }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Add assistant message to chat
      const assistantMessage = { 
        role: 'assistant', 
        content: data.response,
        context: data.context,
        searchMode: data.searchMode
      };
      
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.' 
      };
      
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>DeepSeek + Abacus Chatbot</title>
        <meta name="description" content="Chatbot powered by DeepSeek and Abacus.ai" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          DeepSeek + Abacus Chatbot
        </h1>
        
        <div className={styles.chatContainer}>
          <div className={styles.controls}>
            <div className={styles.modeSelector}>
              <label className={styles.modeLabel}>Mode:</label>
              <div className={styles.modeButtons}>
                <button 
                  className={`${styles.modeButton} ${mode === 'auto' ? styles.activeMode : ''}`}
                  onClick={() => setMode('auto')}
                  type="button"
                >
                  Auto
                </button>
                <button 
                  className={`${styles.modeButton} ${mode === 'search' ? styles.activeMode : ''}`}
                  onClick={() => setMode('search')}
                  type="button"
                >
                  Search
                </button>
                <button 
                  className={`${styles.modeButton} ${mode === 'direct' ? styles.activeMode : ''}`}
                  onClick={() => setMode('direct')}
                  type="button"
                >
                  Direct
                </button>
              </div>
            </div>
          </div>
          
          <div className={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Ask me anything!</p>
                <p className={styles.modeDescription}>
                  {mode === 'auto' && "I'll automatically use relevant documents when helpful."}
                  {mode === 'search' && "I'll search my documents for information to answer your question."}
                  {mode === 'direct' && "I'll answer directly without searching documents."}
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`${styles.message} ${
                    message.role === 'user' ? styles.userMessage : styles.assistantMessage
                  }`}
                >
                  {message.role === 'user' && message.mode && (
                    <div className={styles.messageMode}>
                      {message.mode === 'search' ? 'Search' : 
                       message.mode === 'direct' ? 'Direct' : 'Auto'}
                    </div>
                  )}
                  {message.role === 'assistant' && message.searchMode && (
                    <div className={styles.messageMode}>Used document search</div>
                  )}
                  <div className={styles.messageContent}>
                    {message.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className={`${styles.message} ${styles.assistantMessage} ${styles.loading}`}>
                <div className={styles.loadingDots}>
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Type your message... (${mode} mode)`}
              className={styles.input}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className={styles.sendButton}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
