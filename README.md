# 🛡 CipherGuard — AI Password Strength Analyzer

A full-stack web application that uses AI (Claude by Anthropic) to analyze password strength in real time, backed by Flask, MongoDB, and a sleek brutalist-neon frontend.


---

## ⚡ Tech Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| Frontend   | HTML5, CSS3, Vanilla JS     |
| Backend    | Python 3.11, Flask          |
| AI Engine  | Claude (Anthropic API)      |
| Database   | MongoDB 7.0                 |
| Server     | Gunicorn + Nginx            |
| Container  | Docker + Docker Compose     |

---

## 🚀 STEP-BY-STEP SETUP

### STEP 1 — Prerequisites

Install these tools before starting:

```bash
# Check versions
python --version     # Need 3.10+
node --version       # Optional (for live-server)
docker --version     # For containerized deployment
mongod --version     # If running MongoDB locally
```

Install MongoDB locally (macOS):
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

Install MongoDB locally (Ubuntu/Debian):
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

---

### STEP 2 — Clone / Set Up Files

```bash
# Create project folder
mkdir password-checker && cd password-checker

# Copy all project files into their respective folders:
# frontend/  → index.html, style.css, app.js
# backend/   → app.py, requirements.txt, setup_db.py, .env.example
# root/      → docker-compose.yml, nginx.conf
```

---

### STEP 3 — Configure Environment Variables

```bash
cd backend
cp .env.example .env
nano .env   # or use any text editor
```

Fill in your values:
```env
FLASK_DEBUG=true
PORT=5000
MONGO_URI=mongodb://localhost:27017/
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx   # Get from console.anthropic.com
```

Get your Anthropic API key:
1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Navigate to API Keys → Create Key
4. Copy and paste into `.env`

---

### STEP 4 — Install Python Dependencies

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it:
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### STEP 5 — Set Up MongoDB

```bash
# Make sure MongoDB is running
mongod --version

# Run the setup script to create collections and indexes
python setup_db.py
```

Expected output:
```
🔧 Setting up CipherGuard database...
  ✓ Creating collections...
  ✓ Creating indexes...
  ✓ Seeding stats document...

📊 Database Status:
   Collections: ['analyses', 'stats']
   analyses docs: 0
   Indexes: ['_id_', 'analyzed_at_-1', 'score_-1', 'password_hash_1']

✅ Database setup complete!
```

---

### STEP 6 — Run the Backend

```bash
cd backend

# Make sure venv is active, then:
python app.py
```

Expected output:
```
🛡  CipherGuard API running on http://localhost:5000
   MongoDB: mongodb://localhost:27017/
   AI: configured
```

Test the API:
```bash
curl http://localhost:5000/api/health
# → {"status":"ok","mongodb":"connected","ai":"configured"}

curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"password": "MyP@ssw0rd!"}'
# → {"score": 85, "entropy": 52.7, "ai_feedback": "...", ...}
```

---

### STEP 7 — Run the Frontend

Option A — Using VS Code Live Server:
1. Open the `frontend/` folder in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. Visits: http://127.0.0.1:5500

Option B — Using Python's built-in server:
```bash
cd frontend
python -m http.server 5500
# Visit: http://localhost:5500
```

Option C — Open directly in browser:
```bash
open frontend/index.html   # macOS
start frontend/index.html  # Windows
```

---

### STEP 8 — Test the Full App

1. Open http://localhost:5500 in your browser
2. Type a password in the input field
3. Click **Analyze Password**
4. View: score circle, entropy, metrics, AI feedback, and suggestions

---

## 🐳 DOCKER DEPLOYMENT (Recommended for Production)

### Prerequisites
- Docker Desktop installed and running
- Docker Compose v2+

### Step 1 — Set Environment Variables
```bash
# Create a root-level .env file
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

### Step 2 — Build and Start All Services
```bash
# From the project root (where docker-compose.yml is)
docker-compose up --build
```

This starts:
- **MongoDB** on port 27017
- **Flask API** on port 5000
- **Nginx frontend** on port 3000

Visit: http://localhost:3000

### Step 3 — Set Up DB in Docker
```bash
docker-compose exec backend python setup_db.py
```

### Useful Docker Commands
```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (wipes MongoDB data)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build --force-recreate
```

---

## ☁️ CLOUD DEPLOYMENT

### Deploy to Render (Free Tier)

1. Push code to GitHub
2. Go to https://render.com → New Web Service
3. Connect your repo → select `backend/` as root
4. Settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
5. Add Environment Variables in Render dashboard:
   - `ANTHROPIC_API_KEY` = your key
   - `MONGO_URI` = your Atlas URI
6. Deploy!

### MongoDB Atlas (Cloud Database)

1. Go to https://cloud.mongodb.com
2. Create a free M0 cluster
3. Create a database user (username + password)
4. Whitelist your IP (or 0.0.0.0/0 for any)
5. Get your connection string:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
   ```
6. Set as `MONGO_URI` in your environment

### Deploy Frontend to Vercel / Netlify

```bash
# Vercel
npm install -g vercel
cd frontend
vercel

# Netlify
npm install -g netlify-cli
netlify deploy --dir=frontend --prod
```

Update `API_BASE` in `app.js` to your deployed backend URL:
```javascript
const API_BASE = "https://your-app.onrender.com";
```

---

## 🔒 Security Notes

- **Passwords are NEVER stored** — only SHA-256 hashes are saved to MongoDB
- All AI analysis is done server-side using sanitized metrics only
- CORS is configured for specific origins in production
- Rate limiting should be added for production (use Flask-Limiter)

---

## 🧪 API Reference

### POST /api/analyze
Analyze a password and return strength metrics + AI feedback.

**Request:**
```json
{ "password": "MySecretP@ss123!" }
```

**Response:**
```json
{
  "score": 90,
  "entropy": 58.4,
  "length": 16,
  "has_uppercase": true,
  "has_lowercase": true,
  "has_numbers": true,
  "has_symbols": true,
  "has_repeats": false,
  "has_sequences": false,
  "is_common": false,
  "suggestions": ["✓ Excellent password structure overall"],
  "ai_feedback": "This password demonstrates strong security practices..."
}
```

### GET /api/history
Returns last 20 analyses (no passwords stored).

### GET /api/stats
Returns aggregate stats (total analyses, avg score, strong password count).

### GET /api/health
Health check for MongoDB + AI connection status.

---

## 📄 License

MIT — Free to use, modify, and deploy.
