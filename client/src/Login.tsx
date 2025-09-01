import React, { useState } from 'react';
import './Login.css';
import { API_BASE_URL } from './config';

interface LoginProps {
  onLogin: (email: string, rememberMe: boolean) => void;
}

function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (response.ok) {
        setStep('verify');
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await response.json();
      
      if (response.ok) {
        onLogin(email, rememberMe);
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🔐 Login</h2>
        
        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">📧 Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="checkbox-group">
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember-me">
                  💾 Remember me
                </label>
              </div>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? '📧 Sending...' : '📧 Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifySubmit} className="login-form">
            <p className="verify-message">
              We sent a verification code to <strong>{email}</strong>
            </p>
            
            <div className="form-group">
              <label htmlFor="code">🔢 Verification Code</label>
              <input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? '✅ Verifying...' : '✅ Verify'}
            </button>
            
            <button 
              type="button" 
              onClick={() => { setStep('email'); setError(''); }}
              className="back-button"
            >
              ← Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;