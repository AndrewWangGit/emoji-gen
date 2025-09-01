import React, { useState } from 'react';
import './TokenPurchase.css';
import { API_BASE_URL } from './config';

interface TokenPurchaseProps {
  userEmail: string;
  currentTokens: number;
  onPurchaseComplete: () => void;
  onClose: () => void;
}

interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  name: string;
  savings?: string;
  popular?: boolean;
}

const tokenPackages: TokenPackage[] = [
  { id: '25', tokens: 25, price: 1.00, name: '25 Tokens' },
  { id: '100', tokens: 100, price: 4.00, name: '100 Tokens' },
  { id: '250', tokens: 250, price: 9.00, name: '250 Tokens', savings: 'Save $1', popular: true },
  { id: '500', tokens: 500, price: 17.00, name: '500 Tokens', savings: 'Save $3' }
];

function TokenPurchase({ userEmail, currentTokens, onPurchaseComplete, onClose }: TokenPurchaseProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>('250');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/purchase-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userEmail, 
          tokenPackage: selectedPackage 
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating purchase:', error);
      setError('Failed to connect to payment service');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPackageData = tokenPackages.find(pkg => pkg.id === selectedPackage);

  return (
    <div className="token-purchase-overlay">
      <div className="token-purchase-modal">
        <div className="modal-header">
          <h2>💎 Purchase Tokens</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="current-balance">
          <p>Current Balance: <strong>{currentTokens} tokens</strong></p>
        </div>

        <div className="package-grid">
          {tokenPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''} ${pkg.popular ? 'popular' : ''}`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              {pkg.popular && <div className="popular-badge">Most Popular</div>}
              <div className="package-tokens">{pkg.tokens}</div>
              <div className="package-name">Tokens</div>
              <div className="package-price">${pkg.price.toFixed(2)}</div>
              {pkg.savings && <div className="package-savings">{pkg.savings}</div>}
              <div className="package-rate">${(pkg.price / pkg.tokens).toFixed(3)} per token</div>
            </div>
          ))}
        </div>

        {selectedPackageData && (
          <div className="purchase-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>{selectedPackageData.name}</span>
              <span>${selectedPackageData.price.toFixed(2)}</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>${selectedPackageData.price.toFixed(2)}</span>
            </div>
            <div className="after-purchase">
              New Balance: <strong>{currentTokens + selectedPackageData.tokens} tokens</strong>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button 
            onClick={handlePurchase}
            disabled={isLoading}
            className="purchase-button"
          >
            {isLoading ? '💳 Processing...' : `💳 Pay $${selectedPackageData?.price.toFixed(2)}`}
          </button>
        </div>

        <div className="payment-info">
          <p>🔒 Secure payment powered by Stripe</p>
          <p>✨ Tokens are added instantly after payment</p>
        </div>
      </div>
    </div>
  );
}

export default TokenPurchase;