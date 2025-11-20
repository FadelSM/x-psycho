const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7789321645:AAEh6BiwNR6SgKI_8ZIE-SfJm3J7SFS5yvw';
const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID || '7978512548';

const users = new Map();
const executions = new Map();

const adminUser = {
  id: randomUUID(),
  username: "joocode_admin",
  password: "joodev123",
  email: "joocode.official@gmail.com",
  accessLevel: "Owner",
  ipAddress: null,
  createdAt: new Date(),
};
users.set(adminUser.id, adminUser);

function getUserByUsername(username) {
  return Array.from(users.values()).find(user => user.username === username);
}

function getLastExecution(userId) {
  const userExecutions = Array.from(executions.values())
    .filter(exec => exec.userId === userId)
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  
  return userExecutions[0];
}

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    const user = getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        accessLevel: user.accessLevel,
        ipAddress: clientIP,
        activeDays: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/api/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }
    
    const existingEmailUser = Array.from(users.values()).find(user => user.email === email);
    if (existingEmailUser) {
      return res.status(409).json({ message: "Email already exists" });
    }
    
    const newUser = {
      id: randomUUID(),
      username: username,
      password: password, 
      email: email,
      accessLevel: "Premium",
      ipAddress: null,
      createdAt: new Date(),
    };
    
    users.set(newUser.id, newUser);
    
    res.json({
      success: true,
      message: "Account created successfully"
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/api/execute', async (req, res) => {
  try {
    const { number, method, userId } = req.body;
    
    if (!number || !method || !userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!['heaven', 'funfc', 'cr7siuu'].includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    const user = users.get(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const lastExecution = getLastExecution(userId);
    if (lastExecution) {
      const timeDiff = Date.now() - new Date(lastExecution.executedAt).getTime();
      const minutesPassed = timeDiff / (1000 * 60);
      
      if (minutesPassed < 30) {
        const remainingMinutes = 30 - minutesPassed;
        return res.status(429).json({ 
          message: "Cooldown active", 
          remainingMinutes: Math.ceil(remainingMinutes)
        });
      }
    }

    const telegramMessage = `/${method} ${number}`;
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_OWNER_ID,
          text: telegramMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      const execution = {
        id: randomUUID(),
        userId,
        targetNumber: number,
        method,
        executedAt: new Date(),
      };
      executions.set(execution.id, execution);

      res.json({ success: true, message: "Command executed successfully" });
    } catch (telegramError) {
      console.error('Telegram API error:', telegramError);
      res.status(500).json({ message: "Failed to send command to Telegram" });
    }
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;