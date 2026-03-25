/* ============================================
   CipherGuard — app.js
   Frontend logic: entropy calc, UI updates,
   API calls to Flask backend
   ============================================ */

const API_BASE = "http://localhost:5000";

/* ─── Utility ─── */
const $ = id => document.getElementById(id);

function maskPassword(pwd) {
  if (!pwd) return "";
  const visible = pwd.slice(0, 2);
  return visible + "•".repeat(Math.max(0, pwd.length - 2));
}

function getScoreColor(score) {
  if (score >= 80) return "#00ff88";
  if (score >= 60) return "#ffaa00";
  if (score >= 40) return "#ff7c40";
  return "#ff3c6e";
}

function getStrengthLabel(score) {
  if (score >= 80) return "Very Strong";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Weak";
  return "Very Weak";
}

function getCrackTime(entropy) {
  // Rough estimate: 10^9 guesses/sec
  const guesses = Math.pow(2, entropy);
  const seconds = guesses / 1e9;
  if (seconds < 1)       return "< 1 second to crack";
  if (seconds < 60)      return `~${Math.round(seconds)}s to crack`;
  if (seconds < 3600)    return `~${Math.round(seconds/60)} min to crack`;
  if (seconds < 86400)   return `~${Math.round(seconds/3600)} hours to crack`;
  if (seconds < 31536000) return `~${Math.round(seconds/86400)} days to crack`;
  if (seconds < 3.15e9)  return `~${Math.round(seconds/31536000)} years to crack`;
  return "Centuries to crack";
}

function calcEntropy(password) {
  let charSet = 0;
  if (/[a-z]/.test(password)) charSet += 26;
  if (/[A-Z]/.test(password)) charSet += 26;
  if (/[0-9]/.test(password)) charSet += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) charSet += 32;
  return charSet > 0 ? Math.log2(charSet) * password.length : 0;
}

/* ─── Toggle Password Visibility ─── */
function toggleVisibility() {
  const input = $("password");
  const icon = $("eyeIcon");
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = "password";
    icon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>`;
  }
}

/* ─── Live Strength Bar (client-side) ─── */
$("password").addEventListener("input", function () {
  const pwd = this.value;
  if (!pwd) { resetUI(); return; }

  const entropy = calcEntropy(pwd);
  let score = 0;
  if (pwd.length >= 8)  score += 15;
  if (pwd.length >= 12) score += 15;
  if (pwd.length >= 16) score += 10;
  if (/[A-Z]/.test(pwd)) score += 15;
  if (/[a-z]/.test(pwd)) score += 10;
  if (/[0-9]/.test(pwd)) score += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
  if (entropy > 50) score += 5;
  score = Math.min(100, score);

  const bar = $("strengthBar");
  bar.style.width = score + "%";
  bar.style.background = getScoreColor(score);
});

/* ─── Reset UI ─── */
function resetUI() {
  $("strengthBar").style.width = "0%";
  $("scoreNumber").textContent = "—";
  $("scoreArc").style.strokeDashoffset = "314";
  $("scoreArc").style.stroke = "var(--accent)";
  $("strengthLabel").textContent = "Awaiting Input";
  $("strengthLabel").style.color = "var(--text)";
  $("scoreSub").textContent = "Enter a password to begin analysis";
  $("crackTime").textContent = "";
  $("aiResponse").innerHTML = "<em>AI feedback will appear here after analysis...</em>";
  $("aiSection").classList.remove("active");
  $("suggestionsList").innerHTML = "";
  ["m-length","m-entropy","m-upper","m-lower","m-numbers","m-symbols"].forEach(id => {
    const el = $(id);
    el.classList.remove("pass","fail");
    el.querySelector(".metric-value").textContent = "—";
  });
}

/* ─── Update Score Circle ─── */
function updateScoreCircle(score) {
  const arc = $("scoreArc");
  const circumference = 314;
  const offset = circumference - (score / 100) * circumference;
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = getScoreColor(score);
  $("scoreNumber").textContent = score;
  $("strengthLabel").textContent = getStrengthLabel(score);
  $("strengthLabel").style.color = getScoreColor(score);
}

/* ─── Update Metrics ─── */
function updateMetrics(data) {
  const setMetric = (id, valId, value, pass) => {
    const el = $(id);
    el.classList.toggle("pass", pass);
    el.classList.toggle("fail", !pass);
    $(valId).textContent = value;
  };

  setMetric("m-length",  "mv-length",  data.length + " chars",  data.length >= 8);
  setMetric("m-entropy", "mv-entropy", data.entropy.toFixed(1) + " bits", data.entropy >= 40);
  setMetric("m-upper",   "mv-upper",   data.has_uppercase ? "✓ Yes" : "✗ No",  data.has_uppercase);
  setMetric("m-lower",   "mv-lower",   data.has_lowercase ? "✓ Yes" : "✗ No",  data.has_lowercase);
  setMetric("m-numbers", "mv-numbers", data.has_numbers   ? "✓ Yes" : "✗ No",  data.has_numbers);
  setMetric("m-symbols", "mv-symbols", data.has_symbols   ? "✓ Yes" : "✗ No",  data.has_symbols);
}

/* ─── Update Suggestions ─── */
function updateSuggestions(suggestions) {
  const list = $("suggestionsList");
  list.innerHTML = "";
  if (!suggestions || !suggestions.length) return;

  suggestions.forEach((s, i) => {
    const li = document.createElement("li");
    const isGood = s.startsWith("✓") || s.toLowerCase().includes("good") || s.toLowerCase().includes("great");
    li.className = isGood ? "good" : "warn";
    li.setAttribute("data-icon", isGood ? "✓" : "⚠");
    li.textContent = s.replace(/^[✓⚠]\s*/, "");
    li.style.animationDelay = (i * 0.06) + "s";
    list.appendChild(li);
  });
}

/* ─── History ─── */
let history = JSON.parse(localStorage.getItem("cg_history") || "[]");

function saveHistory(pwd, score, label) {
  const item = {
    masked: maskPassword(pwd),
    score,
    label,
    time: new Date().toLocaleTimeString()
  };
  history.unshift(item);
  if (history.length > 8) history = history.slice(0, 8);
  localStorage.setItem("cg_history", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = $("historyList");
  if (!history.length) {
    list.innerHTML = '<div class="empty-history">No analyses yet</div>';
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item">
      <span class="history-masked">${item.masked}</span>
      <span class="history-score" style="background:${getScoreColor(item.score)}22;color:${getScoreColor(item.score)}">${item.score}/100</span>
      <span class="history-time">${item.time}</span>
    </div>
  `).join("");
}

function clearHistory() {
  history = [];
  localStorage.removeItem("cg_history");
  renderHistory();
}

/* ─── Main Analyze Function ─── */
async function analyzePassword() {
  const pwd = $("password").value;
  if (!pwd) {
    $("aiResponse").innerHTML = "<span style='color:var(--accent-2)'>Please enter a password first.</span>";
    return;
  }

  const btn = $("analyzeBtn");
  btn.classList.add("loading");
  btn.querySelector(".btn-text").textContent = "Analyzing...";
  $("aiLoader").classList.add("active");
  $("aiResponse").innerHTML = "<em>Processing with AI...</em>";

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd })
    });

    if (!res.ok) throw new Error("API error: " + res.status);
    const data = await res.json();

    // Update Score Circle
    updateScoreCircle(data.score);

    // Update Crack Time
    const entropy = data.entropy || calcEntropy(pwd);
    $("crackTime").textContent = getCrackTime(entropy);
    $("scoreSub").textContent = `Entropy: ${entropy.toFixed(1)} bits · ${pwd.length} characters`;

    // Update Metrics
    updateMetrics(data);

    // Update Strength Bar
    const bar = $("strengthBar");
    bar.style.width = data.score + "%";
    bar.style.background = getScoreColor(data.score);

    // AI Feedback
    $("aiSection").classList.add("active");
    if (data.ai_feedback) {
      $("aiResponse").textContent = data.ai_feedback;
    } else {
      $("aiResponse").innerHTML = "<em>AI analysis not available. Check backend.</em>";
    }

    // Suggestions
    updateSuggestions(data.suggestions);

    // Save to history
    saveHistory(pwd, data.score, getStrengthLabel(data.score));

  } catch (err) {
    // Fallback: client-side analysis only
    console.warn("Backend unavailable, running client-side analysis:", err);
    runClientSideAnalysis(pwd);
  } finally {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Analyze Password";
    $("aiLoader").classList.remove("active");
  }
}

/* ─── Client-Side Fallback Analysis ─── */
function runClientSideAnalysis(pwd) {
  const entropy = calcEntropy(pwd);
  let score = 0;
  const suggestions = [];

  if (pwd.length >= 8)  { score += 15; }
  else { suggestions.push("Use at least 8 characters"); }
  if (pwd.length >= 12) { score += 15; }
  else if (pwd.length >= 8) { suggestions.push("Consider using 12+ characters for better security"); }
  if (pwd.length >= 16) { score += 10; }
  if (/[A-Z]/.test(pwd)) { score += 15; }
  else { suggestions.push("Add uppercase letters (A–Z)"); }
  if (/[a-z]/.test(pwd)) { score += 10; }
  else { suggestions.push("Add lowercase letters (a–z)"); }
  if (/[0-9]/.test(pwd)) { score += 10; }
  else { suggestions.push("Include at least one number (0–9)"); }
  if (/[^A-Za-z0-9]/.test(pwd)) { score += 20; }
  else { suggestions.push("Add special characters (!@#$%^&*)"); }
  if (entropy > 50) { score += 5; }

  score = Math.min(100, score);
  if (score >= 80) suggestions.push("✓ Great overall password structure");
  if (score >= 60 && !/(.)\1{2,}/.test(pwd)) suggestions.push("✓ No obvious repeated patterns detected");

  updateScoreCircle(score);
  $("crackTime").textContent = getCrackTime(entropy);
  $("scoreSub").textContent = `Entropy: ${entropy.toFixed(1)} bits · ${pwd.length} characters (offline mode)`;

  updateMetrics({
    length: pwd.length, entropy,
    has_uppercase: /[A-Z]/.test(pwd), has_lowercase: /[a-z]/.test(pwd),
    has_numbers: /[0-9]/.test(pwd), has_symbols: /[^A-Za-z0-9]/.test(pwd)
  });

  $("strengthBar").style.width = score + "%";
  $("strengthBar").style.background = getScoreColor(score);

  $("aiResponse").innerHTML = `<span style="color:var(--warning)">⚠ Backend offline — running local analysis. Score: ${score}/100. ${getStrengthLabel(score)} password.</span>`;
  updateSuggestions(suggestions);
  saveHistory(pwd, score, getStrengthLabel(score));
}

/* ─── Enter Key Trigger ─── */
$("password").addEventListener("keydown", e => {
  if (e.key === "Enter") analyzePassword();
});

/* ─── Init ─── */
renderHistory();