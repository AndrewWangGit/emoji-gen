const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const GeminiService = require('./gemini');
const { Resend } = require('resend');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { 
  initDatabase, 
  getUserTokens, 
  deductToken, 
  addTokens, 
  logTokenTransaction 
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// Initialize Gemini service
let geminiService;
try {
  geminiService = new GeminiService();
  console.log('Gemini service initialized successfully');
} catch (error) {
  console.error('Failed to initialize Gemini service:', error.message);
}

// Initialize Resend service
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('Resend service initialized successfully');
} else {
  console.warn('RESEND_API_KEY not found. Email verification will be disabled.');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Helper function to create user directory
const createUserDirectory = (email) => {
  const safeEmail = email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  const userDir = path.join('uploads', safeEmail);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.post('/api/generate-emoji', upload.single('image'), async (req, res) => {
  try {
    const { description, userEmail } = req.body;
    
    if (!req.file && !description?.trim()) {
      return res.status(400).json({ error: 'Please provide either an image file or a description' });
    }
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Check if user has tokens
    const userTokenData = await getUserTokens(userEmail);
    if (userTokenData.balance <= 0) {
      return res.status(402).json({ 
        error: 'Insufficient tokens. Please purchase more tokens to continue generating emojis.',
        tokensNeeded: true
      });
    }

    // Deduct token before generation
    const tokenDeducted = await deductToken(userEmail);
    if (!tokenDeducted) {
      return res.status(402).json({ 
        error: 'Failed to deduct token. Please try again.',
        tokensNeeded: true
      });
    }

    if (!geminiService) {
      return res.status(500).json({ error: 'Gemini service not available. Please check your API key configuration.' });
    }

    const { removeBackground, emojify } = req.body;
    
    console.log('Generating emoji with:', {
      filename: req.file?.filename || 'text-only',
      description,
      userEmail,
      removeBackground: removeBackground === 'true',
      emojify: emojify === 'true'
    });

    // Use Gemini to generate the emoji
    const imagePath = req.file?.path || null;
    const result = await geminiService.generateEmoji(
      imagePath, 
      description, 
      removeBackground === 'true', 
      emojify === 'true',
      userEmail
    );

    const updatedTokens = await getUserTokens(userEmail);
    res.json({
      success: true,
      message: 'Emoji generated successfully!',
      originalImage: req.file ? `/${req.file.filename}` : null,
      generatedImage: `/${result.userPath}`,
      filename: result.filename,
      prompt: result.prompt,
      tokensRemaining: updatedTokens.balance
    });

  } catch (error) {
    console.error('Error generating emoji:', error);
    // Refund token if generation failed
    if (userEmail) {
      try {
        await addTokens(userEmail, 1, 'Refund - Generation failed');
      } catch (refundError) {
        console.error('Error refunding token:', refundError);
      }
    }
    res.status(500).json({ 
      error: 'Failed to generate emoji: ' + error.message 
    });
  }
});

// Get user's emojis endpoint
app.get('/api/my-emojis/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const safeEmail = email.replace(/[^a-zA-Z0-9@.-]/g, '_');
    const userDir = path.join('uploads', safeEmail);
    
    if (!fs.existsSync(userDir)) {
      return res.json({ emojis: [] });
    }

    // Read all files in user directory
    const files = fs.readdirSync(userDir);
    const emojiFiles = files.filter(file => file.startsWith('emoji-') && file.endsWith('.png'));
    
    const emojis = [];
    
    for (const file of emojiFiles) {
      const timestamp = file.replace('emoji-', '').replace('.png', '');
      const metadataFile = `emoji-${timestamp}.json`;
      const metadataPath = path.join(userDir, metadataFile);
      
      let metadata = {
        filename: file,
        description: 'Generated emoji',
        timestamp: parseInt(timestamp) || Date.now(),
        prompt: '',
        removeBackground: false,
        emojify: false,
        originalImage: null
      };
      
      // Read metadata if it exists
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          metadata = { ...metadata, ...JSON.parse(metadataContent) };
        } catch (error) {
          console.error('Error reading metadata:', error);
        }
      }
      
      emojis.push({
        ...metadata,
        url: `/${safeEmail}/${file}`,
        createdAt: new Date(metadata.timestamp).toISOString()
      });
    }
    
    // Sort by timestamp, newest first
    emojis.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({ emojis });

  } catch (error) {
    console.error('Error fetching user emojis:', error);
    res.status(500).json({ 
      error: 'Failed to fetch emojis: ' + error.message 
    });
  }
});

// Get user tokens endpoint
app.get('/api/user-tokens/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const tokens = await getUserTokens(email);
    res.json({ 
      balance: tokens.balance,
      totalUsed: tokens.totalUsed,
      isNewUser: tokens.totalUsed === 0
    });

  } catch (error) {
    console.error('Error fetching user tokens:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tokens: ' + error.message 
    });
  }
});

// Create Stripe checkout session for token purchase
app.post('/api/purchase-tokens', async (req, res) => {
  try {
    const { userEmail, tokenPackage = '25' } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment processing not configured' });
    }

    // Token packages (25 tokens = $1.00)
    const packages = {
      '25': { tokens: 25, price: 100, name: '25 Tokens' },      // $1.00
      '100': { tokens: 100, price: 400, name: '100 Tokens' },   // $4.00 (save $0)
      '250': { tokens: 250, price: 900, name: '250 Tokens' },   // $9.00 (save $1)
      '500': { tokens: 500, price: 1700, name: '500 Tokens' }   // $17.00 (save $3)
    };

    const selectedPackage = packages[tokenPackage];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Invalid token package' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${selectedPackage.name} - Emoji Generator`,
              description: `Generate ${selectedPackage.tokens} custom emojis with AI`,
              images: ['https://via.placeholder.com/300x300?text=🎨'],
            },
            unit_amount: selectedPackage.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?purchase=cancelled`,
      client_reference_id: userEmail,
      metadata: {
        userEmail: userEmail,
        tokens: selectedPackage.tokens.toString(),
        package: tokenPackage
      }
    });

    res.json({ 
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create payment session: ' + error.message 
    });
  }
});

// Stripe webhook to handle successful payments
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userEmail = session.metadata.userEmail;
      const tokensToAdd = parseInt(session.metadata.tokens);
      
      if (userEmail && tokensToAdd) {
        try {
          await addTokens(
            userEmail, 
            tokensToAdd, 
            `Stripe purchase - ${session.metadata.package} package`,
            session.id
          );
          console.log(`Added ${tokensToAdd} tokens to ${userEmail}`);
        } catch (error) {
          console.error('Error adding tokens after payment:', error);
        }
      }
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Simple in-memory storage for verification codes (in production, use a database)
const verificationCodes = new Map();

// Send verification code endpoint
app.post('/api/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration (10 minutes)
    verificationCodes.set(email, {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    if (resend) {
      try {
        await resend.emails.send({
          from: 'Emoji Generator <onboarding@resend.dev>',
          to: [email],
          subject: 'Your Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #667eea;">🔐 Email Verification</h2>
              <p>Your verification code is:</p>
              <div style="background: #f8f9fa; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="font-size: 32px; margin: 0; color: #667eea; letter-spacing: 4px;">${code}</h1>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
          `
        });
        console.log(`Email sent to ${email} with code: ${code}`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Still log to console as fallback
        console.log(`Verification code for ${email}: ${code}`);
      }
    } else {
      // Fallback: log to console
      console.log(`Verification code for ${email}: ${code}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Verification code sent successfully' 
    });

  } catch (error) {
    console.error('Error sending code:', error);
    res.status(500).json({ 
      error: 'Failed to send verification code' 
    });
  }
});

// Verify code endpoint
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email address and code are required' });
    }

    const storedData = verificationCodes.get(email);
    
    if (!storedData) {
      return res.status(400).json({ error: 'No verification code found for this email' });
    }

    if (Date.now() > storedData.expires) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Code is valid, remove it
    verificationCodes.delete(email);
    
    res.json({ 
      success: true, 
      message: 'Email verified successfully',
      email 
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ 
      error: 'Failed to verify code' 
    });
  }
});

// Catch-all handler: send back React's index.html file for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});