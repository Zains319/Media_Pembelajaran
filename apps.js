// ===== DOM ELEMENTS =====
const sections = ["home","materi","flashcards","game"];
const goMateri = document.getElementById("goMateri");
const goFlashcard = document.getElementById("goFlashcard");
const goGame = document.getElementById("goGame");

const nameFormEl = document.getElementById("nameForm");
const playerNameInput = document.getElementById("playerName");
const startBtn = document.getElementById("startBtn");

const countdownEl = document.getElementById("countdown");
const countNum = document.getElementById("countNum");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
// tambahkan di awal file (setelah deklarasi ctx)
const playerImg = new Image();
playerImg.src = "images/hero.png"; // ganti sesuai lokasi gambarmu

function drawPlayer() {
  if (!ctx || !player) return;
  if (playerImg.complete) {
    ctx.drawImage(playerImg, player.x, player.y - player.h, player.w, player.h);
  } else {
    playerImg.onload = () => {
      ctx.drawImage(playerImg, player.x, player.y - player.h, player.w, player.h);
    };
  }
}


const questionOverlay = document.getElementById("questionOverlay");
const qPrompt = document.getElementById("qPrompt");
const qTimerEl = document.getElementById("qTimer");
const choiceA = document.getElementById("choiceA");
const choiceB = document.getElementById("choiceB");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const loseInfo = document.getElementById("loseInfo");
const retryBtn = document.getElementById("retryBtn");
const giveUpBtn = document.getElementById("giveUpBtn");

const winOverlay = document.getElementById("winOverlay");
const winInfo = document.getElementById("winInfo");
const winDetail = document.getElementById("winDetail");
const winRestartBtn = document.getElementById("winRestartBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

document.querySelectorAll(".backBtn").forEach(b =>
  b.addEventListener("click", () => {
    resetAll();
    show("home");
  })
);

// ===== QUESTIONS =====
const QUESTIONS = [
  { prompt: "Bawah", correct: "した", wrong: "うえ" },
  { prompt: "Atas", correct: "うえ", wrong: "した" },
  { prompt: "Kiri", correct: "ひだり", wrong: "みぎ" },
  { prompt: "Kanan", correct: "みぎ", wrong: "ひだり" },
  { prompt: "Depan", correct: "まえ", wrong: "うしろ" },
  { prompt: "Belakang", correct: "うしろ", wrong: "まえ" },
  { prompt: "Dalam", correct: "なか", wrong: "そと" },
  { prompt: "Luar", correct: "そと", wrong: "なか" },
  { prompt: "Sebelah", correct: "となり", wrong: "よこ" },
  { prompt: "Samping", correct: "よこ", wrong: "となり" }
];

const TOTAL_QUESTIONS = 10;
const ANSWER_TIME = 5;
const TRIGGER_X = 300;

// ===== STATE =====
let raf = null;
let lastTime = 0;
let gameRunning = false;
let gameStarted = false;
let questionActive = false;

let player = null;
let obstacle = null;

let questionSeq = [];
let qAsked = 0;
let correctCount = 0;

let qTimerInterval = null;
let qTimeout = null;

// ===== HELPERS =====
function show(id) {
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add("hidden");
  });
  const t = document.getElementById(id);
  if (t) t.classList.remove("hidden");
}

if (goMateri) goMateri.addEventListener("click", () => show("materi"));
if (goFlashcard) goFlashcard.addEventListener("click", () => show("flashcards"));
if (goGame) goGame.addEventListener("click", () => {
  resetAll();
  show("game");
});

function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickQuestions(n) {
  return shuffle(QUESTIONS).slice(0, Math.min(n, QUESTIONS.length));
}

function clearCanvas() {
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function drawGround() {
  if (!ctx) return;
  ctx.fillStyle = "#7a4f0a";
  ctx.fillRect(0, 186, canvas.width, 14);
}
function drawPlayer() {
  if (!ctx || !player) return;
  ctx.fillStyle = "#1273f9";
  ctx.fillRect(player.x, player.y - player.h, player.w, player.h);
}
function drawObstacle() {
  if (!ctx || !obstacle) return;
  ctx.fillStyle = "#6b6b6b";
  ctx.fillRect(obstacle.x, obstacle.y - obstacle.h, obstacle.w, obstacle.h);
}
function initCanvas() {
  clearCanvas();
  drawGround();
  drawPlayer();
}

// ===== RESET =====
function resetAll() {
  if (raf) cancelAnimationFrame(raf);
  if (qTimerInterval) clearInterval(qTimerInterval);
  if (qTimeout) clearTimeout(qTimeout);

  raf = null;
  qTimerInterval = null;
  qTimeout = null;

  gameRunning = false;
  gameStarted = false;
  questionActive = false;
  lastTime = 0;
  player = { x: 80, y: 150, w: 36, h: 36, vy: 0, gravity: 0.9, jump: -14, onGround: true };
  obstacle = null;
  questionSeq = [];
  qAsked = 0;
  correctCount = 0;

  [questionOverlay, gameOverOverlay, winOverlay, countdownEl].forEach(el => el && el.classList.add("hidden"));
  if (nameFormEl) nameFormEl.classList.remove("hidden");
  if (canvas) canvas.classList.add("hidden");
  initCanvas();
}

// ===== PHYSICS LOOP =====
function updatePhysics(delta) {
  player.vy += player.gravity * (delta / 16.67);
  player.y += player.vy * (delta / 16.67);
  if (player.y >= 150) {
    player.y = 150;
    player.vy = 0;
    player.onGround = true;
  } else player.onGround = false;

  if (obstacle && !questionActive) obstacle.x -= obstacle.speed * (delta / 16.67);
}

function loop(ts) {
  if (!lastTime) lastTime = ts;
  const delta = ts - lastTime;
  lastTime = ts;

  if (gameRunning) {
    updatePhysics(delta);
    clearCanvas();
    drawGround();
    drawPlayer();
    drawObstacle();

    if (gameStarted && obstacle && !questionActive) {
      const p = { x: player.x, y: player.y - player.h, w: player.w, h: player.h };
      const o = { x: obstacle.x, y: obstacle.y - obstacle.h, w: obstacle.w, h: obstacle.h };
      if (p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y) {
        handleLose("Kamu terkena rintangan (tertabrak).");
        return;
      }
      if (obstacle.x <= TRIGGER_X && !questionActive) startQuestion();
    }
  }
  raf = requestAnimationFrame(loop);
}

// ===== START GAME =====
function spawnObstacle() {
  obstacle = { x: canvas.width + 200, y: 186, w: 28, h: 36, speed: 5 + Math.random() * 2 };
}

function beginGameAfterCountdown() {
  questionSeq = pickQuestions(TOTAL_QUESTIONS);
  qAsked = 0;
  correctCount = 0;
  spawnObstacle();
  gameRunning = true;
  gameStarted = true;
  lastTime = 0;
  if (!raf) raf = requestAnimationFrame(loop);
}

// ===== QUESTIONS =====
function startQuestion() {
  if (!gameStarted || questionActive || !obstacle) return;
  if (qAsked >= TOTAL_QUESTIONS) {
    handleWin();
    return;
  }

  questionActive = true;
  const q = questionSeq[qAsked++];
  const order = Math.random() < 0.5 ? ["correct", "wrong"] : ["wrong", "correct"];
  choiceA.textContent = q[order[0]];
  choiceB.textContent = q[order[1]];
  choiceA.dataset.correct = order[0] === "correct" ? "1" : "0";
  choiceB.dataset.correct = order[1] === "correct" ? "1" : "0";
  qPrompt.textContent = q.prompt;
  qTimerEl.textContent = ANSWER_TIME;

  questionOverlay.classList.remove("hidden");

  let remain = ANSWER_TIME;
  qTimerInterval = setInterval(() => {
    remain--;
    qTimerEl.textContent = remain;
    if (remain <= 0) {
      clearInterval(qTimerInterval);
      stopQuestion();
      handleLose("Waktu habis — rintangan tidak hilang.");
    }
  }, 1000);

  qTimeout = setTimeout(() => {
    if (questionActive) {
      stopQuestion();
      handleLose("Waktu habis — rintangan tidak hilang.");
    }
  }, (ANSWER_TIME + 0.5) * 1000);
}

function stopQuestion() {
  questionActive = false;
  questionOverlay.classList.add("hidden");
  if (qTimerInterval) clearInterval(qTimerInterval);
  if (qTimeout) clearTimeout(qTimeout);
  qTimerInterval = null;
  qTimeout = null;
}

// ===== ANSWER HANDLER =====
function onAnswerClick(e) {
  if (!questionActive) return;
  const isCorrect = e.currentTarget.dataset.correct === "1";
  stopQuestion();

  if (isCorrect) {
    correctCount++;
    obstacle = null;
    if (player.onGround) {
      player.vy = player.jump;
      player.onGround = false;
    }
    if (correctCount >= TOTAL_QUESTIONS) {
      setTimeout(() => handleWin(), 300);
      return;
    }
    setTimeout(() => spawnObstacle(), 900);
  } else {
    handleLose("Jawaban salah — kamu terkena rintangan.");
  }
}

// ===== END CONDITIONS =====
function handleWin() {
  gameRunning = false;
  gameStarted = false;
  if (raf) cancelAnimationFrame(raf);
  winInfo.textContent = "🎉 Selamat!";
  winDetail.textContent = `${playerNameInput.value}, kamu menjawab benar ${correctCount} dari ${TOTAL_QUESTIONS} pertanyaan!`;
  winOverlay.classList.remove("hidden");
}

function handleLose(msg) {
  gameRunning = false;
  gameStarted = false;
  if (raf) cancelAnimationFrame(raf);
  if (qTimerInterval) clearInterval(qTimerInterval);
  if (qTimeout) clearTimeout(qTimeout);
  loseInfo.textContent = `${msg} (Benar: ${correctCount}/${TOTAL_QUESTIONS})`;
  gameOverOverlay.classList.remove("hidden");
}

// ===== UI EVENTS =====
startBtn.addEventListener("click", () => {
  const nm = (playerNameInput.value || "").trim();
  if (!nm) {
    alert("Masukkan nama dulu ya!");
    return;
  }
  resetAll();
  nameFormEl.classList.add("hidden");
  canvas.classList.remove("hidden");

  let c = 3;
  countdownEl.classList.remove("hidden");
  countNum.textContent = c;
  const t = setInterval(() => {
    c--;
    countNum.textContent = c;
    if (c <= 0) {
      clearInterval(t);
      countdownEl.classList.add("hidden");
      beginGameAfterCountdown();
    }
  }, 1000);
});

choiceA.addEventListener("click", onAnswerClick);
choiceB.addEventListener("click", onAnswerClick);

// 🔧 FIX: ulangi game setelah kalah
retryBtn.addEventListener("click", () => {
  gameOverOverlay.classList.add("hidden");
  resetAll();
  nameFormEl.classList.add("hidden");
  canvas.classList.remove("hidden");

  let c = 3;
  countdownEl.classList.remove("hidden");
  countNum.textContent = c;

  const t = setInterval(() => {
    c--;
    countNum.textContent = c;
    if (c <= 0) {
      clearInterval(t);
      countdownEl.classList.add("hidden");
      questionSeq = pickQuestions(TOTAL_QUESTIONS);
      qAsked = 0;
      correctCount = 0;
      spawnObstacle();
      gameRunning = true;
      gameStarted = true;
      lastTime = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    }
  }, 1000);
});

giveUpBtn.addEventListener("click", () => {
  gameOverOverlay.classList.add("hidden");
  resetAll();
  playerNameInput.value = "";
  show("home");
});

winRestartBtn.addEventListener("click", () => {
  winOverlay.classList.add("hidden");
  resetAll();
  playerNameInput.value = "";
  show("game");
});

backHomeBtn.addEventListener("click", () => {
  winOverlay.classList.add("hidden");
  resetAll();
  playerNameInput.value = "";
  show("home");
});

document.addEventListener("keydown", e => {
  if ((e.code === "Space" || e.code === "ArrowUp") && player && player.onGround) {
    player.vy = player.jump;
    player.onGround = false;
  }
});

resetAll();


// ===== FLASHCARD (REPLACEMENT: full fitur mark/shuffle/reset) =====
(function(){
  const SAMPLE = [
    { image: "images/ue.jpg", hira: "うえ", romaji: "ue", meaning: "atas", desc: "Posisi di atas sesuatu." },
    { image: "images/shita.jpg", hira: "した", romaji: "shita", meaning: "bawah", desc: "Posisi di bawah sesuatu." },
    { image: "images/mae.jpg", hira: "まえ", romaji: "mae", meaning: "depan", desc: "Bagian depan." },
    { image: "images/ushiro.jpg", hira: "うしろ", romaji: "ushiro", meaning: "belakang", desc: "Bagian belakang." },
    { image: "images/naka.jpg", hira: "なか", romaji: "naka", meaning: "dalam", desc: "Di dalam." },
    { image: "images/soto.jpg", hira: "そと", romaji: "soto", meaning: "luar", desc: "Di luar." },
    { image: "images/migi.jpg", hira: "みぎ", romaji: "migi", meaning: "kanan", desc: "Di sisi kanan." },
    { image: "images/hidari.jpg", hira: "ひだり", romaji: "hidari", meaning: "kiri", desc: "Di sisi kiri." },
    { image: "images/tonari.jpg", hira: "となり", romaji: "tonari", meaning: "sebelah", desc: "Berdekatan." },
    { image: "images/yoko.jpg", hira: "よこ", romaji: "yoko", meaning: "samping", desc: "Di samping." }
  ];

  // DOM refs
  const cardEl = document.getElementById("card");
  const imgEl = document.getElementById("cardImage");
  const hiraEl = document.getElementById("hiraganaText");
  const romajiEl = document.getElementById("romajiText");
  const meaningEl = document.getElementById("meaningText");
  // descText already created in HTML; if not, create fallback
  let descEl = document.getElementById("descText");
  if(!descEl){
    descEl = document.createElement("div");
    descEl.id = "descText";
    descEl.style.marginTop = "10px";
    descEl.style.fontSize = "0.95rem";
    descEl.style.color = "#fff";
    descEl.style.textAlign = "center";
    const back = document.getElementById("card-back");
    if(back){
      const bc = back.querySelector(".back-content") || back;
      bc.appendChild(descEl);
    }
  }

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const flipBtn = document.getElementById("flipBtn");
  const markBtn = document.getElementById("markBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const resetProgressBtn = document.getElementById("resetProgressBtn");

  const learnedCountEl = document.getElementById("learnedCount");
  const totalCountEl = document.getElementById("totalCount");

  // storage key
  const STORAGE_KEY = "flash_progress_v1";

  // safety: if core elements missing, don't crash
  if(!cardEl || !imgEl || !hiraEl || !romajiEl || !meaningEl){
    console.warn("Flashcards init aborted — elemen kunci tidak ditemukan.");
    return;
  }

  // state
  let VOCAB = SAMPLE.slice();
  let idx = 0;

  // helpers
  function renderCounts(){
    const prog = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if(learnedCountEl) learnedCountEl.textContent = Object.keys(prog).length;
    if(totalCountEl) totalCountEl.textContent = VOCAB.length;
  }

  function updateMarkBtn(){
    if(!markBtn) return;
    const prog = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const cur = VOCAB[idx];
    markBtn.textContent = prog[cur.hira] ? "Unmark" : "Mark";
  }

  function renderCard(){
    const cur = VOCAB[idx];
    imgEl.src = cur.image || "images/placeholder.png";
    imgEl.alt = cur.hira || "";
    hiraEl.textContent = cur.hira;
    romajiEl.textContent = cur.romaji;
    meaningEl.textContent = cur.meaning;
    descEl.textContent = cur.desc || "";
    // always show front when changing card
    cardEl.classList.remove("flipped");
    updateMarkBtn();
  }

  // events (safe attach)
  if(flipBtn) flipBtn.addEventListener("click", ()=> cardEl.classList.toggle("flipped"));
  if(prevBtn) prevBtn.addEventListener("click", ()=>{
    idx = (idx - 1 + VOCAB.length) % VOCAB.length;
    renderCard();
  });
  if(nextBtn) nextBtn.addEventListener("click", ()=>{
    idx = (idx + 1) % VOCAB.length;
    renderCard();
  });

  if(shuffleBtn) shuffleBtn.addEventListener("click", ()=>{
    VOCAB.sort(()=>Math.random()-0.5);
    idx = 0;
    renderCard();
  });

  if(markBtn) markBtn.addEventListener("click", ()=>{
    const cur = VOCAB[idx];
    const prog = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if(prog[cur.hira]) delete prog[cur.hira]; else prog[cur.hira] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
    updateMarkBtn();
    renderCounts();
  });

  if(resetProgressBtn) resetProgressBtn.addEventListener("click", ()=>{
    if(confirm("Hapus semua progress belajar?")){
      localStorage.removeItem(STORAGE_KEY);
      renderCounts();
      updateMarkBtn();
    }
  });

  // keyboard shortcuts (optional)
  document.addEventListener("keydown", (e)=>{
    const panel = document.getElementById("flashcards");
    if(panel && panel.classList.contains("hidden")) return; // only when visible
    if(e.key === "ArrowLeft") prevBtn && prevBtn.click();
    if(e.key === "ArrowRight") nextBtn && nextBtn.click();
    if(e.code === "Space") { e.preventDefault(); flipBtn && flipBtn.click(); }
  });

  // init
  renderCounts();
  renderCard();
})();



// ===== MATERI INTERAKTIF =====
document.querySelectorAll(".toggleBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const example = btn.nextElementSibling;
    if (!example) return;
    example.classList.toggle("hidden");
    btn.textContent = example.classList.contains("hidden") ? "Lihat Contoh" : "Tutup Contoh";
  });
});

document.querySelectorAll(".posBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const hira = btn.dataset.hira;
    const romaji = btn.dataset.romaji;
    const indo = btn.dataset.indo;
    document.getElementById("posHira").textContent = hira;
    document.getElementById("posRomaji").textContent = romaji;
    document.getElementById("posIndo").textContent = indo;
    document.getElementById("posInfo").classList.remove("hidden");
  });
});
