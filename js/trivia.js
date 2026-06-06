'use strict';

// ── Question bank ──────────────────────────────────────────────────────────
const QUESTIONS = [
  { q: "¿Cuál es el personaje principal de The Legend of Zelda?", opts: ["Zelda","Link","Ganondorf","Epona"], a: 1 },
  { q: "¿En qué año salió Minecraft?", opts: ["2009","2011","2013","2015"], a: 1 },
  { q: "¿Cómo se llama la moneda en Fortnite?", opts: ["Gemas","Robux","V-Bucks","Coins"], a: 2 },
  { q: "¿Quién es el antagonista principal de Super Mario?", opts: ["Wario","Bowser","Donkey Kong","Waluigi"], a: 1 },
  { q: "¿En qué planeta transcurre Destiny?", opts: ["Marte","La Luna","La Tierra","Todos los anteriores"], a: 3 },
  { q: "¿Cuántos jugadores pueden sobrevivir al final en PUBG?", opts: ["1","2","3","5"], a: 0 },
  { q: "¿Qué tipo de personaje es Pikachu?", opts: ["Fuego","Agua","Eléctrico","Planta"], a: 2 },
  { q: "¿Cómo se llama la ciudad principal de GTA V?", opts: ["Liberty City","Vice City","Los Santos","San Fierro"], a: 2 },
  { q: "¿Cuántos jugadores tiene un equipo en League of Legends?", opts: ["3","4","5","6"], a: 2 },
  { q: "¿Qué arma icónica usa Master Chief en Halo?", opts: ["Rifle de asalto","Pistola Magnum","Escopeta","Battle Rifle"], a: 0 },
  { q: "¿En qué año se lanzó Fortnite Battle Royale?", opts: ["2016","2017","2018","2019"], a: 1 },
  { q: "¿Cuál es el nombre del fantasma en Pac-Man que es rojo?", opts: ["Blinky","Pinky","Inky","Clyde"], a: 0 },
  { q: "¿Qué empresa creó PlayStation?", opts: ["Microsoft","Nintendo","Sony","Sega"], a: 2 },
  { q: "¿Cuál es el nombre del protagonista de God of War?", opts: ["Zeus","Ares","Kratos","Poseidón"], a: 2 },
  { q: "¿Qué juego tiene el modo 'Among Us' de impostores?", opts: ["Fall Guys","Among Us","Fortnite","Roblox"], a: 1 },
  { q: "¿Cuántas estrellas tiene Super Mario 64?", opts: ["70","90","120","150"], a: 2 },
  { q: "¿Qué empresa desarrolló Red Dead Redemption 2?", opts: ["Ubisoft","Rockstar Games","EA","Bethesda"], a: 1 },
  { q: "¿Cómo se llama la mascota de Crash Bandicoot?", opts: ["Crash","Cortex","Aku Aku","Tiny"], a: 2 },
  { q: "¿En qué juego construyes con bloques para sobrevivir?", opts: ["Terraria","Roblox","Minecraft","Fortnite"], a: 2 },
  { q: "¿Qué color es la capa de Superman en DC Universe Online?", opts: ["Azul","Roja","Amarilla","Verde"], a: 1 },
  { q: "¿Cuál es el nivel máximo base en Diablo 4?", opts: ["50","75","100","150"], a: 2 },
  { q: "¿Qué personaje dice 'It's-a me, Mario!'?", opts: ["Luigi","Mario","Toad","Yoshi"], a: 1 },
  { q: "¿Cuántas regiones hay en Pokémon original (Gen 1)?", opts: ["1","2","3","4"], a: 0 },
  { q: "¿Qué juego tiene el personaje llamado 'The Mandalorian' como skin?", opts: ["Apex Legends","Call of Duty","Fortnite","Valorant"], a: 2 },
  { q: "¿Cuál es la moneda oficial de Roblox?", opts: ["Robux","Linden","V-Bucks","Minecoins"], a: 0 },
  { q: "¿En qué juego debes escapar de una isla desierta con otros jugadores?", opts: ["Rust","Stranded Deep","The Forest","Ark"], a: 0 },
  { q: "¿Quién es el rival de Sonic the Hedgehog?", opts: ["Shadow","Silver","Dr. Eggman","Knuckles"], a: 2 },
  { q: "¿Qué significa RPG en los videojuegos?", opts: ["Real Player Game","Role Playing Game","Rapid Play Game","Rocket Propelled Game"], a: 1 },
  { q: "¿Cuántos personajes iniciales hay en Super Smash Bros. Ultimate?", opts: ["8","12","66","89"], a: 3 },
  { q: "¿En qué año salió el primer Call of Duty?", opts: ["2001","2003","2005","2007"], a: 1 },
  { q: "¿Cómo se llama el dragón de Spyro?", opts: ["Crash","Spyro","Sparx","Gnasty"], a: 1 },
  { q: "¿Cuál es el nombre del protagonista de The Last of Us?", opts: ["Joel","Ellie","Tommy","Riley"], a: 0 },
  { q: "¿Qué empresa hizo Grand Theft Auto?", opts: ["EA","Ubisoft","Rockstar Games","2K"], a: 2 },
  { q: "¿En qué mundo transcurre Elden Ring?", opts: ["Lordran","The Lands Between","Yharnam","Hallownest"], a: 1 },
  { q: "¿Cuántos jugadores hay por equipo en Valorant?", opts: ["4","5","6","3"], a: 1 },
  { q: "¿Qué personaje tiene la habilidad 'Blooket' en Among Us?", opts: ["Impostor","Crewmate","Ghost","Ninguno"], a: 3 },
  { q: "¿Cómo se llama el mundo en Minecraft?", opts: ["Nether","The End","Overworld","Jungle"], a: 2 },
  { q: "¿Cuál es el battle royale de EA Games con legends?", opts: ["Fortnite","Warzone","Apex Legends","PUBG"], a: 2 },
  { q: "¿Qué es el 'headshot' en los shooters?", opts: ["Disparo a la cabeza","Disparo al pecho","Kill streak","Headset"], a: 0 },
  { q: "¿Cuántos Chaos Emeralds hay en Sonic?", opts: ["5","6","7","8"], a: 2 },
  { q: "¿Qué personaje es el arquero de Fortnite Season 1?", opts: ["Jonesy","Raven","Robin Hood","Ninguno"], a: 3 },
  { q: "¿Cuál es el primer Pokémon del Pokédex Nacional?", opts: ["Bulbasaur","Charmander","Squirtle","Pikachu"], a: 0 },
  { q: "¿En qué año salió el primer FIFA de EA Sports?", opts: ["1990","1993","1996","1999"], a: 1 },
  { q: "¿Qué juego tiene el personaje 'Lara Croft'?", opts: ["Uncharted","Tomb Raider","God of War","Devil May Cry"], a: 1 },
  { q: "¿Cuántos jugadores tiene un partido de CS:GO por equipo?", opts: ["4","5","6","3"], a: 1 },
  { q: "¿Qué tipo de juego es Stardew Valley?", opts: ["Battle Royale","Shooter","Simulación de granja","MOBA"], a: 2 },
  { q: "¿Cuál es el nombre del protagonista de Cyberpunk 2077?", opts: ["Johnny","V","Adam","Alt"], a: 1 },
  { q: "¿Qué personaje es el mascot de Xbox?", opts: ["Master Chief","Marcus Fenix","Banjo","No tiene"], a: 0 },
  { q: "¿En qué juego hay que 'completar el anillo' para ganar?", opts: ["Dark Souls","Halo","Hollow Knight","Elden Ring"], a: 3 },
  { q: "¿Cuántas leyendas había al lanzamiento de Apex Legends?", opts: ["6","8","10","12"], a: 1 },
];

const FREE_PLAYS   = 5;
const COINS_REWARD = 75;
const TIMER_SECS   = 15;

let currentUser     = null;
let playsUsed       = 0;
let playsTotal      = FREE_PLAYS;
let score           = 0;
let currentQ        = null;
let answered        = false;
let timerInterval   = null;
let timerLeft       = TIMER_SECS;
let usedIndexes     = [];
let waitingResult   = false;

// ── Utils ──────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showToast(msg, dur) {
  const t = $('gameToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), dur || 2500);
}

function setBalance(pts) {
  const el = $('balanceVal');
  if (el) el.textContent = Number(pts).toLocaleString();
}

function updatePlaysUI() {
  const label = $('playsLabel');
  const pips  = $('playsPips');
  if (label) label.textContent = `${Math.max(playsTotal - playsUsed, 0)} preguntas restantes`;
  if (!pips) return;
  pips.innerHTML = '';
  for (let i = 0; i < playsTotal; i++) {
    const d = document.createElement('div');
    d.className = 'plays-pip' + (i < playsUsed ? ' used' : '');
    pips.appendChild(d);
  }
}

function pickQuestion() {
  if (usedIndexes.length >= QUESTIONS.length) usedIndexes = [];
  let idx;
  do { idx = Math.floor(Math.random() * QUESTIONS.length); }
  while (usedIndexes.includes(idx));
  usedIndexes.push(idx);
  return { ...QUESTIONS[idx], idx };
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  timerLeft = TIMER_SECS;
  updateTimerUI();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerLeft--;
    updateTimerUI();
    if (timerLeft <= 0) { clearInterval(timerInterval); onTimeout(); }
  }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

function updateTimerUI() {
  const bar = $('timerBar');
  const num = $('timerNum');
  if (bar) bar.style.width = ((timerLeft / TIMER_SECS) * 100) + '%';
  if (num) num.textContent = timerLeft;
  if (bar) bar.className = 'timer-bar' + (timerLeft <= 5 ? ' danger' : '');
}

function onTimeout() {
  if (answered) return;
  answered = true;
  revealAnswer(false, -1);
  submitAnswer(false);
}

// ── Question UI ───────────────────────────────────────────────────────────
function showQuestion(q) {
  currentQ = q;
  answered = false;
  $('questionText').textContent = q.q;
  $('questionNum').textContent  = `${playsUsed + 1} / ${playsTotal}`;
  const opts = document.querySelectorAll('.opt-btn');
  opts.forEach((btn, i) => {
    btn.textContent  = q.opts[i];
    btn.className    = 'opt-btn';
    btn.disabled     = false;
    btn.onclick      = () => onAnswer(i, btn);
  });
  $('triviaCard').classList.remove('hidden');
  $('resultScreen').classList.add('hidden');
  startTimer();
}

function onAnswer(idx, btn) {
  if (answered || waitingResult) return;
  answered = true;
  stopTimer();
  const correct = idx === currentQ.a;
  revealAnswer(correct, idx);
  submitAnswer(correct);
}

function revealAnswer(correct, chosen) {
  document.querySelectorAll('.opt-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === currentQ.a) btn.classList.add('correct');
    else if (i === chosen) btn.classList.add('wrong');
  });
}

// ── Firebase call ──────────────────────────────────────────────────────────
async function submitAnswer(correct) {
  waitingResult = true;
  try {
    const fn  = firebase.functions().httpsCallable('answerTrivia');
    const res = await fn({ correct });
    const d   = res.data;
    playsUsed = d.playsUsed;
    playsTotal = playsUsed + d.playsRemaining;
    setBalance(d.points);
    updatePlaysUI();
    if (correct) score += COINS_REWARD;
    setTimeout(() => showResult(correct, d.coins, d.playsRemaining), 1000);
  } catch (err) {
    const code = err.code || '';
    if (code === 'resource-exhausted') {
      showNoPlays();
    } else {
      showToast('Error al enviar respuesta. Intenta de nuevo.');
    }
  } finally {
    waitingResult = false;
  }
}

function showResult(correct, coins, remaining) {
  $('triviaCard').classList.add('hidden');
  const rs = $('resultScreen');
  rs.classList.remove('hidden');
  $('resultEmoji').textContent  = correct ? '🎉' : '😞';
  $('resultTitle').textContent  = correct ? '¡Correcto!' : 'Incorrecto';
  $('resultCoins').textContent  = correct ? `+${coins} 🪙` : '0 🪙';
  $('resultCoins').className    = 'result-coins ' + (correct ? 'win' : 'miss');
  $('resultAnswer').textContent = correct ? '' : `Respuesta: ${currentQ.opts[currentQ.a]}`;

  const nextBtn = $('nextBtn');
  if (remaining > 0) {
    nextBtn.textContent = `Siguiente pregunta (${remaining} restantes)`;
    nextBtn.onclick = () => { showQuestion(pickQuestion()); };
  } else {
    nextBtn.textContent = '¡Volver al inicio!';
    nextBtn.onclick = () => { window.location.href = typeof withAppFlag === 'function' ? withAppFlag('inicio.html') : 'inicio.html'; };
  }
}

function showNoPlays() {
  $('triviaCard')?.classList.add('hidden');
  $('resultScreen')?.classList.add('hidden');
  $('noPlaysScreen').classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (fbUser) => {
      if (!fbUser) { window.location.href = typeof withAppFlag === 'function' ? withAppFlag('login.html') : 'login.html'; return; }
      currentUser = fbUser;

      try {
        const snap = await window.db.collection('users').doc(fbUser.uid).get();
        const data = snap.data() || {};
        setBalance(data.points || 0);

        const todayKey = new Date().toLocaleDateString('en-CA');
        if (data.triviaDate === todayKey) {
          playsUsed  = data.triviaPlays || 0;
          playsTotal = FREE_PLAYS + (data.triviaExtra || 0);
        } else {
          playsUsed  = 0;
          playsTotal = FREE_PLAYS;
        }
      } catch (e) { playsUsed = 0; playsTotal = FREE_PLAYS; }

      updatePlaysUI();

      if (playsUsed >= playsTotal) {
        showNoPlays();
      } else {
        showQuestion(pickQuestion());
      }
    });
  });
});
