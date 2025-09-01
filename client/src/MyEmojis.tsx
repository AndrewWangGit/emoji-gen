import React, { useState, useEffect, useCallback } from 'react';
import './MyEmojis.css';
import { API_BASE_URL } from './config';

interface Emoji {
  filename: string;
  description: string;
  timestamp: number;
  prompt: string;
  removeBackground: boolean;
  emojify: boolean;
  originalImage: string | null;
  url: string;
  createdAt: string;
}

interface MyEmojisProps {
  userEmail: string;
}

function MyEmojis({ userEmail }: MyEmojisProps) {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchMyEmojis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/my-emojis/${encodeURIComponent(userEmail)}`);
      const data = await response.json();

      if (response.ok) {
        setEmojis(data.emojis);
      } else {
        setError(data.error || 'Failed to fetch emojis');
      }
    } catch (error) {
      console.error('Error fetching emojis:', error);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchMyEmojis();
  }, [fetchMyEmojis]);

  const handleDownload = (emoji: Emoji) => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}${emoji.url}`;
    link.download = `${emoji.description.replace(/[^a-zA-Z0-9]/g, '_')}_${emoji.filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="my-emojis-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading your emojis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-emojis-container">
        <div className="error-message">{error}</div>
        <button onClick={fetchMyEmojis} className="retry-button">
          🔄 Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="my-emojis-container">
      <div className="my-emojis-header">
        <h2>📚 My Emojis ({emojis.length})</h2>
        <button onClick={fetchMyEmojis} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {emojis.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">😔</div>
          <h3>No emojis yet</h3>
          <p>Start creating some emojis and they'll appear here!</p>
        </div>
      ) : (
        <div className="emojis-grid">
          {emojis.map((emoji, index) => (
            <div key={`${emoji.filename}-${index}`} className="emoji-card">
              <div className="emoji-image-container">
                <img 
                  src={`${API_BASE_URL}${emoji.url}`} 
                  alt={emoji.description}
                  className="emoji-image"
                />
              </div>
              
              <div className="emoji-details">
                <h4 className="emoji-title">{emoji.description}</h4>
                <p className="emoji-date">{formatDate(emoji.timestamp)}</p>
                
                {emoji.prompt && (
                  <p className="emoji-prompt" title={emoji.prompt}>
                    💬 {emoji.prompt.substring(0, 100)}{emoji.prompt.length > 100 ? '...' : ''}
                  </p>
                )}
                
                <div className="emoji-tags">
                  {emoji.emojify && <span className="tag">😊 Emojified</span>}
                  {emoji.removeBackground && <span className="tag">🎭 No BG</span>}
                  {emoji.originalImage && <span className="tag">📷 From Image</span>}
                </div>
                
                <button 
                  onClick={() => handleDownload(emoji)}
                  className="download-button"
                >
                  💾 Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyEmojis;