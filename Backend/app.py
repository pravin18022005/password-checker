"""
CipherGuard — Flask Backend
AI-Powered Password Strength Analyzer
Routes: /api/analyze, /api/history, /api/stats
"""

import os
import re
import math
import hashlib
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import anthropic

# ─── App Setup ───────────────────────────────────────────
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:5500", "*"])

# ─── MongoDB Connection ───────────────────────────────────
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["cipherguard"]
analyses_collection = db["analyses"]
stats_collection = db["stats"]

# ─── Anthropic Client ─────────────────────────────────────
anthropic_client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY", "")
)

# ─── Common Weak Passwords ────────────────────────────────
COMMON_PASSWORDS = {
    "password", "123456", "password1", "qwerty", "abc123",
    "111111", "iloveyou", "admin", "letmein", "monkey",
    "1234567890", "sunshine", "princess", "welcome", "dragon",
    "master", "login", "hello", "pass", "test123"
}


# ─── Password Analysis Logic ──────────────────────────────
def calculate_entropy(password: str) -> float:
    char_set = 0
    if re.search(r"[a-z]", password): char_set += 26
    if re.search(r"[A-Z]", password): char_set += 26
    if re.search(r"[0-9]", password): char_set += 10
    if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password): char_set += 32
    return math.log2(char_set) * len(password) if char_set > 0 else 0


def analyze_password_metrics(password: str) -> dict:
    entropy = calculate_entropy(password)
    has_upper = bool(re.search(r"[A-Z]", password))
    has_lower = bool(re.search(r"[a-z]", password))
    has_numbers = bool(re.search(r"[0-9]", password))
    has_symbols = bool(re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password))
    has_spaces = " " in password
    has_repeats = bool(re.search(r"(.)\1{2,}", password))
    has_sequences = bool(re.search(r"(012|123|234|345|456|567|678|789|abc|bcd|cde)", password.lower()))
    is_common = password.lower() in COMMON_PASSWORDS

    # Score calculation
    score = 0
    if len(password) >= 8:  score += 15
    if len(password) >= 12: score += 15
    if len(password) >= 16: score += 10
    if has_upper:           score += 15
    if has_lower:           score += 10
    if has_numbers:         score += 10
    if has_symbols:         score += 20
    if entropy > 50:        score += 5
    if has_repeats:         score -= 10
    if has_sequences:       score -= 8
    if is_common:           score -= 40
    score = max(0, min(100, score))

    # Generate rule-based suggestions
    suggestions = []
    if len(password) < 8:
        suggestions.append("Password must be at least 8 characters long")
    elif len(password) < 12:
        suggestions.append("Consider extending to 12+ characters")
    if not has_upper:
        suggestions.append("Add uppercase letters (A–Z)")
    if not has_lower:
        suggestions.append("Add lowercase letters (a–z)")
    if not has_numbers:
        suggestions.append("Include at least one number (0–9)")
    if not has_symbols:
        suggestions.append("Add special characters like !@#$%^&*")
    if has_repeats:
        suggestions.append("Avoid repeating the same character 3+ times")
    if has_sequences:
        suggestions.append("Avoid sequential patterns (123, abc, etc.)")
    if is_common:
        suggestions.append("This is a commonly known password — choose something unique!")
    if score >= 80:
        suggestions.append("✓ Excellent password structure overall")
    elif score >= 60:
        suggestions.append("✓ Good foundation — a few tweaks will make it stronger")

    return {
        "score": score,
        "entropy": round(entropy, 2),
        "length": len(password),
        "has_uppercase": has_upper,
        "has_lowercase": has_lower,
        "has_numbers": has_numbers,
        "has_symbols": has_symbols,
        "has_repeats": has_repeats,
        "has_sequences": has_sequences,
        "is_common": is_common,
        "suggestions": suggestions
    }


def get_ai_feedback(password: str, metrics: dict) -> str:
    """Get AI-powered feedback from Claude via Anthropic API."""
    if not anthropic_client.api_key:
        return "AI feedback unavailable — set ANTHROPIC_API_KEY environment variable."

    try:
        prompt = f"""You are a cybersecurity expert analyzing password strength. 
Analyze this password structure (NOT the actual password — never repeat it):

Password length: {metrics['length']} characters
Entropy: {metrics['entropy']} bits
Has uppercase: {metrics['has_uppercase']}
Has lowercase: {metrics['has_lowercase']}
Has numbers: {metrics['has_numbers']}
Has symbols: {metrics['has_symbols']}
Has repeating chars: {metrics['has_repeats']}
Has sequential patterns: {metrics['has_sequences']}
Is commonly known: {metrics['is_common']}
Overall score: {metrics['score']}/100

Provide a 2-3 sentence expert analysis. Be specific, actionable, and encouraging. 
Do NOT mention or repeat the actual password. Focus on structural security."""

        message = anthropic_client.messages.create(
            model="claude-opus-4-5",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text.strip()

    except Exception as e:
        return f"AI analysis unavailable: {str(e)}"


# ─── Routes ──────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "CipherGuard API",
        "version": "2.0",
        "status": "running",
        "endpoints": ["/api/analyze", "/api/history", "/api/stats"]
    })


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    if not data or "password" not in data:
        return jsonify({"error": "Password field is required"}), 400

    password = data["password"]
    if not password or len(password) > 128:
        return jsonify({"error": "Invalid password length (1–128 chars)"}), 400

    # Analyze metrics
    metrics = analyze_password_metrics(password)

    # Get AI feedback
    ai_feedback = get_ai_feedback(password, metrics)
    metrics["ai_feedback"] = ai_feedback

    # Store in MongoDB (hash the password — NEVER store plaintext)
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    record = {
        "password_hash": pwd_hash,
        "score": metrics["score"],
        "entropy": metrics["entropy"],
        "length": metrics["length"],
        "has_uppercase": metrics["has_uppercase"],
        "has_lowercase": metrics["has_lowercase"],
        "has_numbers": metrics["has_numbers"],
        "has_symbols": metrics["has_symbols"],
        "analyzed_at": datetime.datetime.utcnow(),
        "ip": request.remote_addr
    }

    try:
        analyses_collection.insert_one(record)
        # Update global stats
        stats_collection.update_one(
            {"_id": "global"},
            {
                "$inc": {"total_analyses": 1},
                "$set": {"last_updated": datetime.datetime.utcnow()}
            },
            upsert=True
        )
    except Exception as e:
        print(f"MongoDB error: {e}")  # Non-fatal

    return jsonify(metrics)


@app.route("/api/history", methods=["GET"])
def get_history():
    """Return last 20 analysis records (no passwords)."""
    try:
        records = list(
            analyses_collection.find(
                {},
                {"_id": 0, "password_hash": 0, "ip": 0}
            ).sort("analyzed_at", -1).limit(20)
        )
        for r in records:
            r["analyzed_at"] = r["analyzed_at"].isoformat()
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return aggregate statistics."""
    try:
        total = analyses_collection.count_documents({})
        strong = analyses_collection.count_documents({"score": {"$gte": 80}})
        avg_score = list(analyses_collection.aggregate([
            {"$group": {"_id": None, "avg": {"$avg": "$score"}}}
        ]))
        return jsonify({
            "total_analyses": total,
            "strong_passwords": strong,
            "avg_score": round(avg_score[0]["avg"], 1) if avg_score else 0
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    mongo_ok = False
    try:
        mongo_client.admin.command("ping")
        mongo_ok = True
    except Exception:
        pass
    return jsonify({
        "status": "ok",
        "mongodb": "connected" if mongo_ok else "disconnected",
        "ai": "configured" if anthropic_client.api_key else "not configured"
    })


# ─── Run ─────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"\n🛡  CipherGuard API running on http://localhost:{port}")
    print(f"   MongoDB: {MONGO_URI}")
    print(f"   AI: {'configured' if anthropic_client.api_key else 'not configured (set ANTHROPIC_API_KEY)'}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)