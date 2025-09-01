import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Login from './Login';
import MyEmojis from './MyEmojis';
import TokenPurchase from './TokenPurchase';
import { API_BASE_URL } from './config';

interface EmojiResult {
  success: boolean;
  message: string;
  originalImage: string;
  generatedImage: string;
  filename: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'generate' | 'my-emojis'>('generate');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userTokens, setUserTokens] = useState<number>(0);
  const [showTokenPurchase, setShowTokenPurchase] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string>('');
  const [removeBackground, setRemoveBackground] = useState<boolean>(false);
  const [emojify, setEmojify] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<EmojiResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    // Reset the file input
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!selectedFile && !description.trim()) {
      alert('Please either upload an image or provide a description');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    const formData = new FormData();
    if (selectedFile) {
      formData.append('image', selectedFile);
    }
    formData.append('description', description);
    formData.append('userEmail', userEmail);
    formData.append('removeBackground', removeBackground.toString());
    formData.append('emojify', emojify.toString());

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-emoji`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
        // Update token balance
        if (data.tokensRemaining !== undefined) {
          setUserTokens(data.tokensRemaining);
        }
      } else {
        if (data.tokensNeeded) {
          setShowTokenPurchase(true);
        } else {
          alert(data.error || 'Failed to generate emoji');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to connect to server');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (result) {
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}${result.generatedImage}`;
      link.download = `emoji-${result.filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleLogin = (email: string, rememberMe: boolean) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    fetchUserTokens(email);
    
    if (rememberMe) {
      // Store in localStorage for persistence
      localStorage.setItem('authData', JSON.stringify({ 
        email, 
        timestamp: Date.now() 
      }));
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserEmail('');
    setUserTokens(0);
    setActiveTab('generate');
    setShowTokenPurchase(false);
    setResult(null);
    setSelectedFile(null);
    setPreviewUrl('');
    setDescription('');
    
    // Clear localStorage
    localStorage.removeItem('authData');
  };

  // Fetch user tokens
  const fetchUserTokens = useCallback(async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-tokens/${encodeURIComponent(email)}`);
      const data = await response.json();
      if (response.ok) {
        setUserTokens(data.balance);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  }, []);

  // Check for existing authentication on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const storedAuth = localStorage.getItem('authData');
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          
          // Check if stored auth is less than a week old
          if (authData.timestamp > oneWeekAgo && authData.email) {
            setIsAuthenticated(true);
            setUserEmail(authData.email);
            fetchUserTokens(authData.email);
          } else {
            // Remove expired auth
            localStorage.removeItem('authData');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        localStorage.removeItem('authData');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Fetch tokens when user logs in
  useEffect(() => {
    if (isAuthenticated && userEmail) {
      fetchUserTokens(userEmail);
    }
  }, [isAuthenticated, userEmail]);

  // Check for purchase success/cancellation in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const purchaseStatus = urlParams.get('purchase');
    
    if (purchaseStatus === 'success') {
      // Refresh tokens and show success message
      if (userEmail) {
        fetchUserTokens(userEmail);
        alert('🎉 Payment successful! Your tokens have been added to your account.');
      }
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (purchaseStatus === 'cancelled') {
      alert('💔 Payment cancelled. No tokens were purchased.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [userEmail]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="App">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Protected route - redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div>
            <h1>🎨 Emoji Generator</h1>
            <p>Create custom emojis using AI</p>
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="user-email">📧 {userEmail}</span>
              <span className="user-tokens">💰 {userTokens} tokens</span>
            </div>
            <div className="header-actions">
              <button onClick={() => setShowTokenPurchase(true)} className="buy-tokens-button">
                💳 Buy Tokens
              </button>
              <button onClick={handleLogout} className="logout-button">
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          ✨ Generate Emoji
        </button>
        <button 
          className={`tab-button ${activeTab === 'my-emojis' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-emojis')}
        >
          📚 My Emojis
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'generate' ? (
        <>
          <form onSubmit={handleSubmit} className="emoji-form">
          <div className="form-group">
            <label htmlFor="image-upload">
              📁 Upload Image (Optional)
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
            />
            {previewUrl && (
              <div className="image-preview">
                <img src={previewUrl} alt="Preview" />
                <button 
                  type="button"
                  onClick={handleClearImage}
                  className="clear-image-button"
                  title="Remove image"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">
              📝 Emoji Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want your emoji to look like..."
              rows={3}
            />
          </div>

          <div className="checkbox-group">
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="remove-background"
                checked={removeBackground}
                onChange={(e) => setRemoveBackground(e.target.checked)}
              />
              <label htmlFor="remove-background">
                🎭 Remove Background
              </label>
            </div>

            <div className="checkbox-item">
              <input
                type="checkbox"
                id="emojify"
                checked={emojify}
                onChange={(e) => setEmojify(e.target.checked)}
              />
              <label htmlFor="emojify">
                😊 Emojify
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isGenerating || (!selectedFile && !description.trim())}
            className="generate-button"
          >
            {isGenerating ? '⏳ Generating...' : '✨ Turn into Emoji'}
          </button>
          </form>

          {isGenerating && (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Creating your emoji...</p>
            </div>
          )}

          {result && (
            <div className="result">
              <h3>🎉 Your Emoji is Ready!</h3>
              <div className="emoji-preview">
                <img 
                  src={`${API_BASE_URL}${result.generatedImage}`} 
                  alt="Generated emoji" 
                />
              </div>
              <button onClick={handleDownload} className="download-button">
                💾 Download Emoji
              </button>
            </div>
          )}
        </>
        ) : (
          <MyEmojis userEmail={userEmail} />
        )}
      </main>
      
      {showTokenPurchase && (
        <TokenPurchase 
          userEmail={userEmail}
          currentTokens={userTokens}
          onPurchaseComplete={() => {
            setShowTokenPurchase(false);
            fetchUserTokens(userEmail);
          }}
          onClose={() => setShowTokenPurchase(false)}
        />
      )}
    </div>
  );
}

export default App;
