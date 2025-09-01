const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'emoji_generator.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database:', dbPath);
  }
});

// Initialize database schema
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        tokens INTEGER DEFAULT 25,
        total_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createTokenTransactionsTable = `
      CREATE TABLE IF NOT EXISTS token_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('purchase', 'usage', 'refund', 'bonus')),
        amount INTEGER NOT NULL,
        description TEXT,
        stripe_session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users (email)
      )
    `;

    db.serialize(() => {
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          return reject(err);
        }
        console.log('Users table ready');
      });

      db.run(createTokenTransactionsTable, (err) => {
        if (err) {
          console.error('Error creating token_transactions table:', err);
          return reject(err);
        }
        console.log('Token transactions table ready');
        resolve();
      });
    });
  });
};

// Get or create user tokens
const getUserTokens = (email) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM users WHERE email = ?';
    
    db.get(query, [email], (err, row) => {
      if (err) {
        return reject(err);
      }
      
      if (row) {
        // User exists, return their data
        resolve({
          balance: row.tokens,
          totalUsed: row.total_used,
          createdAt: new Date(row.created_at).getTime()
        });
      } else {
        // New user, create with 25 free tokens
        const insertQuery = `
          INSERT INTO users (email, tokens, total_used) 
          VALUES (?, 25, 0)
        `;
        
        db.run(insertQuery, [email], function(err) {
          if (err) {
            return reject(err);
          }
          
          // Log the bonus transaction
          logTokenTransaction(email, 'bonus', 25, 'Welcome bonus - 25 free tokens')
            .catch(console.error);
          
          resolve({
            balance: 25,
            totalUsed: 0,
            createdAt: Date.now()
          });
        });
      }
    });
  });
};

// Deduct tokens from user
const deductToken = (email) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Check current balance
      db.get('SELECT tokens FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        
        if (!row || row.tokens <= 0) {
          db.run('ROLLBACK');
          return resolve(false);
        }
        
        // Deduct token
        const updateQuery = `
          UPDATE users 
          SET tokens = tokens - 1, 
              total_used = total_used + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE email = ? AND tokens > 0
        `;
        
        db.run(updateQuery, [email], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return resolve(false);
          }
          
          db.run('COMMIT');
          
          // Log the usage transaction
          logTokenTransaction(email, 'usage', -1, 'Emoji generation')
            .catch(console.error);
          
          resolve(true);
        });
      });
    });
  });
};

// Add tokens to user
const addTokens = (email, amount, description = 'Token purchase', stripeSessionId = null) => {
  return new Promise((resolve, reject) => {
    const updateQuery = `
      UPDATE users 
      SET tokens = tokens + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `;
    
    db.run(updateQuery, [amount, email], function(err) {
      if (err) {
        return reject(err);
      }
      
      // Log the purchase transaction
      logTokenTransaction(email, 'purchase', amount, description, stripeSessionId)
        .then(() => {
          // Return updated user data
          return getUserTokens(email);
        })
        .then(resolve)
        .catch(reject);
    });
  });
};

// Log token transaction
const logTokenTransaction = (userEmail, type, amount, description, stripeSessionId = null) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO token_transactions (user_email, type, amount, description, stripe_session_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(query, [userEmail, type, amount, description, stripeSessionId], function(err) {
      if (err) {
        return reject(err);
      }
      resolve(this.lastID);
    });
  });
};

// Get user transaction history
const getUserTransactions = (email, limit = 50) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM token_transactions 
      WHERE user_email = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    db.all(query, [email, limit], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
};

// Close database connection
const closeDatabase = () => {
  return new Promise((resolve) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
      resolve();
    });
  });
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing database...');
  closeDatabase().then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing database...');
  closeDatabase().then(() => {
    process.exit(0);
  });
});

module.exports = {
  initDatabase,
  getUserTokens,
  deductToken,
  addTokens,
  logTokenTransaction,
  getUserTransactions,
  closeDatabase
};