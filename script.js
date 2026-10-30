// ═══════════════════════════════════════════════════════════
//  Pattern Memory — Enhanced Stage 1
// ═══════════════════════════════════════════════════════════

// ── State Constants ─────────────────────────────────────────
const State = Object.freeze({
  START_MENU:        'START_MENU',
  PLAYING_SEQUENCE:  'PLAYING_SEQUENCE',
  WAITING_FOR_PLAYER:'WAITING_FOR_PLAYER',
  ROUND_COMPLETE:    'ROUND_COMPLETE',
  GAME_OVER:         'GAME_OVER',
});

// ── Difficulty Profiles ─────────────────────────────────────
const DIFFICULTY = Object.freeze({
  easy: {
    label:          'Easy',
    flashDuration:  700,
    pauseBetween:   400,
    inputLimit:     null,
    inputLimitType: null,
    nextRoundDelay: 1000,
    description:    'Relaxed pace \u00b7 No time limit',
  },
  medium: {
    label:          'Medium',
    flashDuration:  500,
    pauseBetween:   300,
    inputLimit:     10000,
    inputLimitType: 'round',
    nextRoundDelay: 1000,
    description:    'Moderate speed \u00b7 10 s per round',
  },
  hard: {
    label:          'Hard',
    flashDuration:  350,
    pauseBetween:   200,
    inputLimit:     5000,
    inputLimitType: 'per-click',
    nextRoundDelay: 800,
    description:    'Fast flashes \u00b7 5 s per input',
  },
  expert: {
    label:          'Expert',
    flashDuration:  200,
    pauseBetween:   150,
    inputLimit:     3000,
    inputLimitType: 'per-click',
    nextRoundDelay: 600,
    description:    'Blink and miss it \u00b7 3 s per input \u00b7 +2 tiles every 3 rounds',
  },
});

// ── DOM References ──────────────────────────────────────────
const startMenuScreen  = document.getElementById('start-menu');
const gameScreen       = document.getElementById('game-screen');
const gameOverScreen   = document.getElementById('game-over');

const diffButtons      = document.querySelectorAll('.diff-btn');
const diffDesc         = document.getElementById('diff-desc');
const startBtn         = document.getElementById('start-btn');

const tiles            = document.querySelectorAll('.tile');
const statusMsg        = document.getElementById('status-message');
const scoreDisplay     = document.getElementById('score-display');
const roundDisplay     = document.getElementById('round-display');
const difficultyLabel  = document.getElementById('difficulty-label');

const timerBarContainer = document.getElementById('timer-bar-container');
const timerBar          = document.getElementById('timer-bar');

const finalScore       = document.getElementById('final-score');
const finalRound       = document.getElementById('final-round');
const finalDifficulty  = document.getElementById('final-difficulty');
const gameOverReason   = document.getElementById('game-over-reason');
const playAgainBtn     = document.getElementById('play-again-btn');
const muteBtn          = document.getElementById('mute-btn');
const audioIconOn      = document.querySelector('.audio-icon.audio-on');
const audioIconOff     = document.querySelector('.audio-icon.audio-off');
const audioLabel       = document.querySelector('.audio-label');

// ── Audio Controller (Web Audio API Singleton) ──────────────
const TILE_FREQUENCIES = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

let audioCtx   = null;
let masterGain = null;
let isMuted    = false;

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : 1.0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
  }
}

function toggleMute() {
  initAudio();
  isMuted = !isMuted;

  if (masterGain && audioCtx) {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(isMuted ? 0.0 : 1.0, audioCtx.currentTime);
  }

  if (muteBtn) {
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute Audio' : 'Mute Audio');
    if (audioIconOn) audioIconOn.classList.toggle('hidden', isMuted);
    if (audioIconOff) audioIconOff.classList.toggle('hidden', !isMuted);
    if (audioLabel) audioLabel.textContent = isMuted ? 'AUDIO OFF' : 'AUDIO ON';
  }

  if (!isMuted) {
    playUiClickSound();
  }
}

function playUiClickSound() {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (err) {
    console.warn('UI sound error:', err);
  }
}

function playTileTone(index) {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const baseFreq = TILE_FREQUENCIES[index] || 261.63;
    const duration = 0.3; // 300ms release envelope

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.015); // Fast attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Primary Sine Oscillator
    const oscSine = audioCtx.createOscillator();
    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(baseFreq, now);

    // Subtle Triangle Overtone for Warmth
    const oscTri = audioCtx.createOscillator();
    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(baseFreq, now);

    const triGain = audioCtx.createGain();
    triGain.gain.setValueAtTime(0.12, now);

    oscSine.connect(gain);
    oscTri.connect(triGain);
    triGain.connect(gain);
    gain.connect(masterGain);

    oscSine.start(now);
    oscTri.start(now);
    oscSine.stop(now + duration + 0.05);
    oscTri.stop(now + duration + 0.05);
  } catch (err) {
    console.warn('Tile tone error:', err);
  }
}

function playStartSound() {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = [196.00, 261.63]; // G3 to C4 rising chime

    notes.forEach((freq, i) => {
      const startTime = now + (i * 0.12);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  } catch (err) {
    console.warn('Start sound error:', err);
  }
}

function playRoundCompleteSound() {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = [523.25, 783.99]; // C5 to G5 uplifting chime

    notes.forEach((freq, i) => {
      const startTime = now + (i * 0.13);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });
  } catch (err) {
    console.warn('Round complete sound error:', err);
  }
}

function playGameOverSound() {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const duration = 0.45;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + duration);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch (err) {
    console.warn('Game over sound error:', err);
  }
}

// ── Game State ──────────────────────────────────────────────
let gameState       = State.START_MENU;
let selectedMode    = 'easy';
let difficulty      = DIFFICULTY.easy;

let sequence        = [];
let playerIndex     = 0;
let score           = 0;
let round           = 0;

// Timer tracking — every setTimeout/setInterval ID is stored here
let allTimers       = [];
let inputTimerId    = null;
let timerAnimFrameId = null;
let inputDeadline   = 0;

// ── Initialisation ──────────────────────────────────────────
function initApp() {
  // Mute button
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      toggleMute();
    });
  }

  // Difficulty selection
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      playUiClickSound();
      setDifficulty(btn.dataset.mode);
    });
  });

  // Start game
  startBtn.addEventListener('click', () => {
    initAudio();
    startGame();
  });

  // Tile clicks
  tiles.forEach(tile => {
    tile.addEventListener('click', handlePlayerInput);
  });

  // Play again
  playAgainBtn.addEventListener('click', () => {
    initAudio();
    playUiClickSound();
    returnToMenu();
  });

  showScreen('start-menu');
}

// ── Screen Management ───────────────────────────────────────
function showScreen(id) {
  startMenuScreen.classList.toggle('hidden', id !== 'start-menu');
  gameScreen.classList.toggle('hidden', id !== 'game-screen');
  gameOverScreen.classList.toggle('hidden', id !== 'game-over');
}

// ── Difficulty Selection ────────────────────────────────────
function setDifficulty(mode) {
  selectedMode = mode;
  difficulty = DIFFICULTY[mode];

  diffButtons.forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === mode);
  });

  diffDesc.textContent = difficulty.description;
}

// ── Start Game ──────────────────────────────────────────────
function startGame() {
  clearAllTimers();

  playStartSound();

  sequence    = [];
  playerIndex = 0;
  score       = 0;
  round       = 0;

  difficulty = DIFFICULTY[selectedMode];

  scoreDisplay.textContent = '0';
  roundDisplay.textContent = '1';
  difficultyLabel.textContent = difficulty.label;

  showScreen('game-screen');
  hideTimerBar();

  // Allow startup sound to finish gently before launching first round
  const startDelayId = setTimeout(() => {
    nextRound();
  }, 400);
  allTimers.push(startDelayId);
}

// ── Round Progression ───────────────────────────────────────
function nextRound() {
  round++;
  roundDisplay.textContent = String(round);

  addToSequence();
  playSequence();
}

/**
 * Append tile(s) based on the difficulty's progression rule.
 * Expert: +2 tiles every 3 rounds, +1 otherwise.
 */
function addToSequence() {
  const count = (selectedMode === 'expert' && round > 1 && round % 3 === 0) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    sequence.push(Math.floor(Math.random() * 4));
  }
}

// ── Sequence Playback ───────────────────────────────────────
function playSequence() {
  gameState = State.PLAYING_SEQUENCE;
  statusMsg.textContent = 'Watch the pattern\u2026';
  hideTimerBar();

  const stepTime = difficulty.flashDuration + difficulty.pauseBetween;

  sequence.forEach((tileIndex, i) => {
    const id = setTimeout(() => {
      flashTile(tileIndex, difficulty.flashDuration);
    }, i * stepTime);
    allTimers.push(id);
  });

  // After last flash completes, switch to WAITING_FOR_PLAYER
  const totalTime = sequence.length * stepTime;
  const endId = setTimeout(() => {
    // Guard: only transition if we're still in PLAYING_SEQUENCE
    if (gameState !== State.PLAYING_SEQUENCE) return;

    gameState = State.WAITING_FOR_PLAYER;
    playerIndex = 0;
    statusMsg.textContent = 'Your turn!';
    startInputTimer();
  }, totalTime);
  allTimers.push(endId);
}

/**
 * Briefly highlight a tile and play its associated tone.
 */
function flashTile(index, duration) {
  const tile = tiles[index];
  if (tile) {
    tile.classList.add('active');
  }
  playTileTone(index);

  const id = setTimeout(() => {
    if (tile) {
      tile.classList.remove('active');
    }
  }, duration);
  allTimers.push(id);
}

// ── Input Timer ─────────────────────────────────────────────
function startInputTimer() {
  clearInputTimer();

  if (!difficulty.inputLimit) {
    hideTimerBar();
    return;
  }

  showTimerBar();
  inputDeadline = Date.now() + difficulty.inputLimit;

  // Animate the bar
  animateTimerBar();

  // Set the actual timeout
  inputTimerId = setTimeout(() => {
    if (gameState === State.WAITING_FOR_PLAYER) {
      endGame('Time ran out!');
    }
  }, difficulty.inputLimit);
  allTimers.push(inputTimerId);
}

function resetInputTimerPerClick() {
  if (difficulty.inputLimitType !== 'per-click') return;
  startInputTimer();
}

function clearInputTimer() {
  if (inputTimerId !== null) {
    clearTimeout(inputTimerId);
    inputTimerId = null;
  }
  if (timerAnimFrameId !== null) {
    cancelAnimationFrame(timerAnimFrameId);
    timerAnimFrameId = null;
  }
}

function animateTimerBar() {
  const totalDuration = difficulty.inputLimit;

  function tick() {
    const remaining = inputDeadline - Date.now();
    const fraction = Math.max(0, remaining / totalDuration);

    timerBar.style.width = (fraction * 100) + '%';
    // No CSS transition — we drive it frame-by-frame
    timerBar.style.transition = 'none';

    // Colour shift when low
    timerBar.classList.toggle('warning', fraction < 0.3);

    if (fraction > 0 && gameState === State.WAITING_FOR_PLAYER) {
      timerAnimFrameId = requestAnimationFrame(tick);
    }
  }

  timerAnimFrameId = requestAnimationFrame(tick);
}

function showTimerBar() {
  timerBarContainer.classList.remove('hidden');
  timerBar.style.width = '100%';
  timerBar.classList.remove('warning');
}

function hideTimerBar() {
  timerBarContainer.classList.add('hidden');
  clearInputTimer();
}

// ── Player Input ────────────────────────────────────────────
function handlePlayerInput(event) {
  if (gameState !== State.WAITING_FOR_PLAYER) return;

  const clickedIndex = Number(event.currentTarget.dataset.index);

  // Visual and audio feedback
  flashTile(clickedIndex, 200);

  if (clickedIndex === sequence[playerIndex]) {
    // Correct
    playerIndex++;

    if (playerIndex === sequence.length) {
      // Full sequence matched
      triggerRoundComplete();
    } else {
      // More tiles to go — reset per-click timer if applicable
      resetInputTimerPerClick();
    }
  } else {
    // Wrong tile - trigger visual error feedback on the offending tile
    const failedTile = tiles[clickedIndex];
    if (failedTile) {
      failedTile.classList.add('error-flash');
      setTimeout(() => failedTile.classList.remove('error-flash'), 400);
    }
    endGame('Wrong tile!');
  }
}

// ── Round Complete ──────────────────────────────────────────
function triggerRoundComplete() {
  gameState = State.ROUND_COMPLETE;
  clearInputTimer();
  hideTimerBar();

  score++;
  scoreDisplay.textContent = String(score);
  statusMsg.textContent = 'Correct! \u2714';

  playRoundCompleteSound();

  const id = setTimeout(() => {
    if (gameState !== State.ROUND_COMPLETE) return;
    nextRound();
  }, difficulty.nextRoundDelay);
  allTimers.push(id);
}

// ── Game Over ───────────────────────────────────────────────
function endGame(reason) {
  if (gameState === State.GAME_OVER) return; // prevent double trigger

  gameState = State.GAME_OVER;
  clearAllTimers();

  playGameOverSound();

  // Remove lingering highlights
  tiles.forEach(t => t.classList.remove('active'));
  hideTimerBar();

  // Populate stats
  finalScore.textContent      = String(score);
  finalRound.textContent      = String(round);
  finalDifficulty.textContent = difficulty.label;
  gameOverReason.textContent  = reason || '';

  showScreen('game-over');
}

// ── Return to Menu ──────────────────────────────────────────
function returnToMenu() {
  clearAllTimers();
  gameState = State.START_MENU;
  showScreen('start-menu');
}

// ── Timer Cleanup ───────────────────────────────────────────
function clearAllTimers() {
  allTimers.forEach(id => clearTimeout(id));
  allTimers = [];
  clearInputTimer();
}

// ── Boot ────────────────────────────────────────────────────
initApp();
