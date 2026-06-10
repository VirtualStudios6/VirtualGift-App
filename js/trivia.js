'use strict';

// ── Question bank ──────────────────────────────────────────────────────────
// cat: emoji category  |  diff: 0=Fácil  1=Medio  2=Difícil
const QUESTIONS = [
  // ── 🎮 GAMING ──────────────────────────────────────────────────────────────
  { q:"¿Cuál es el personaje principal de The Legend of Zelda?",         opts:["Zelda","Link","Ganondorf","Epona"],                           a:1, cat:"🎮", diff:0 },
  { q:"¿En qué año salió Minecraft (versión completa)?",                  opts:["2009","2011","2013","2015"],                                   a:1, cat:"🎮", diff:0 },
  { q:"¿Cómo se llama la moneda de Fortnite?",                            opts:["Gemas","Robux","V-Bucks","Coins"],                             a:2, cat:"🎮", diff:0 },
  { q:"¿Quién es el antagonista principal de Super Mario?",               opts:["Wario","Bowser","Donkey Kong","Waluigi"],                      a:1, cat:"🎮", diff:0 },
  { q:"¿Cuántos jugadores pueden sobrevivir al final en PUBG?",           opts:["1","2","3","5"],                                               a:0, cat:"🎮", diff:0 },
  { q:"¿Qué tipo de Pokémon es Pikachu?",                                 opts:["Fuego","Agua","Eléctrico","Planta"],                           a:2, cat:"🎮", diff:0 },
  { q:"¿Cómo se llama la ciudad principal de GTA V?",                     opts:["Liberty City","Vice City","Los Santos","San Fierro"],          a:2, cat:"🎮", diff:0 },
  { q:"¿Cuántos jugadores hay por equipo en League of Legends?",          opts:["3","4","5","6"],                                               a:2, cat:"🎮", diff:0 },
  { q:"¿Qué empresa creó PlayStation?",                                   opts:["Microsoft","Nintendo","Sony","Sega"],                          a:2, cat:"🎮", diff:0 },
  { q:"¿Cuál es el nombre del protagonista de God of War?",               opts:["Zeus","Ares","Kratos","Poseidón"],                             a:2, cat:"🎮", diff:0 },
  { q:"¿Cuántas estrellas tiene Super Mario 64?",                         opts:["70","90","120","150"],                                         a:2, cat:"🎮", diff:1 },
  { q:"¿Qué empresa desarrolló Red Dead Redemption 2?",                   opts:["Ubisoft","Rockstar Games","EA","Bethesda"],                    a:1, cat:"🎮", diff:0 },
  { q:"¿En qué año se lanzó Fortnite Battle Royale?",                     opts:["2016","2017","2018","2019"],                                   a:1, cat:"🎮", diff:1 },
  { q:"¿Cuál es el nombre del fantasma rojo en Pac-Man?",                 opts:["Blinky","Pinky","Inky","Clyde"],                               a:0, cat:"🎮", diff:1 },
  { q:"¿Cuál es el primer Pokémon del Pokédex Nacional?",                 opts:["Bulbasaur","Charmander","Squirtle","Pikachu"],                 a:0, cat:"🎮", diff:0 },
  { q:"¿Qué juego tiene el personaje Lara Croft?",                        opts:["Uncharted","Tomb Raider","God of War","Devil May Cry"],        a:1, cat:"🎮", diff:0 },
  { q:"¿Cuál es el nombre del protagonista de Cyberpunk 2077?",           opts:["Johnny","V","Adam","Alt"],                                     a:1, cat:"🎮", diff:1 },
  { q:"¿Cuántas leyendas había al lanzamiento de Apex Legends?",          opts:["6","8","10","12"],                                             a:1, cat:"🎮", diff:2 },
  { q:"¿Qué significa RPG en los videojuegos?",                           opts:["Real Player Game","Role Playing Game","Rapid Play Game","Racing Pro Game"], a:1, cat:"🎮", diff:0 },
  { q:"¿Cuál es el battle royale creado por EA Games?",                   opts:["Fortnite","Warzone","Apex Legends","PUBG"],                    a:2, cat:"🎮", diff:0 },
  { q:"¿En qué año salió el primer Call of Duty?",                        opts:["2001","2003","2005","2007"],                                   a:1, cat:"🎮", diff:1 },
  { q:"¿Cuál es el nombre del protagonista de The Last of Us?",           opts:["Joel","Ellie","Tommy","Riley"],                                a:0, cat:"🎮", diff:0 },
  { q:"¿En qué mundo transcurre Elden Ring?",                             opts:["Lordran","The Lands Between","Yharnam","Hallownest"],          a:1, cat:"🎮", diff:1 },
  { q:"¿Cuántos jugadores hay por equipo en Valorant?",                   opts:["4","5","6","3"],                                               a:1, cat:"🎮", diff:0 },
  { q:"¿Qué personaje dice 'It's-a me, Mario!'?",                        opts:["Luigi","Mario","Toad","Yoshi"],                                a:1, cat:"🎮", diff:0 },
  { q:"¿Cuántos Chaos Emeralds hay en la saga Sonic?",                    opts:["5","6","7","8"],                                               a:2, cat:"🎮", diff:1 },
  { q:"¿En qué año salió el primer FIFA de EA Sports?",                   opts:["1990","1993","1996","1999"],                                   a:1, cat:"🎮", diff:1 },
  { q:"¿Cuántos jugadores tiene un equipo en CS:GO / CS2?",               opts:["4","5","6","3"],                                               a:1, cat:"🎮", diff:0 },
  { q:"¿Qué tipo de juego es Stardew Valley?",                            opts:["Battle Royale","Shooter","Simulación de granja","MOBA"],       a:2, cat:"🎮", diff:0 },
  { q:"¿Cuál es el nombre de la IA que acompaña a Master Chief en Halo?", opts:["Serina","Cortana","Spark","Iris"],                             a:1, cat:"🎮", diff:1 },
  { q:"¿Cómo se llama el mundo principal en Minecraft?",                  opts:["Nether","The End","Overworld","Jungle"],                       a:2, cat:"🎮", diff:0 },
  { q:"¿Qué es un 'headshot' en los shooters?",                           opts:["Disparo a la cabeza","Disparo al pecho","Kill streak","Headset"], a:0, cat:"🎮", diff:0 },
  { q:"¿Cuál es la moneda oficial de Roblox?",                            opts:["Robux","Linden","V-Bucks","Minecoins"],                        a:0, cat:"🎮", diff:0 },
  { q:"¿Quién es el gran rival y villano clásico de Sonic?",              opts:["Shadow","Silver","Dr. Eggman","Knuckles"],                     a:2, cat:"🎮", diff:0 },
  { q:"¿Qué empresa desarrolló Grand Theft Auto?",                        opts:["EA","Ubisoft","Rockstar Games","2K"],                          a:2, cat:"🎮", diff:0 },
  { q:"¿Qué empresa desarrolló The Witcher 3: Wild Hunt?",                opts:["Ubisoft","CD Projekt Red","Bethesda","Square Enix"],           a:1, cat:"🎮", diff:0 },
  { q:"¿En qué año salió Pokémon GO?",                                    opts:["2014","2015","2016","2017"],                                   a:2, cat:"🎮", diff:0 },
  { q:"¿Cuántos Pokémon había en la primera generación?",                 opts:["100","151","152","200"],                                       a:1, cat:"🎮", diff:1 },
  { q:"¿Qué empresa desarrolló la saga Dark Souls?",                      opts:["Activision","CD Projekt Red","FromSoftware","Capcom"],         a:2, cat:"🎮", diff:1 },
  { q:"¿Cuántos jugadores entran en una partida de Fall Guys?",           opts:["40","50","60","100"],                                          a:2, cat:"🎮", diff:1 },
  { q:"¿Qué significa 'GG' en gaming?",                                   opts:["Good Game","Get Going","Go Go","Game Goal"],                   a:0, cat:"🎮", diff:0 },
  { q:"¿Qué significa 'AFK' en gaming?",                                  opts:["All From Kill","Away From Keyboard","Attack From Kingdom","Always Fight Killers"], a:1, cat:"🎮", diff:0 },
  { q:"¿Cuál es la espada legendaria de Link en la saga Zelda?",          opts:["Espada Oscura","Excalibur","Master Sword","Thunder Blade"],    a:2, cat:"🎮", diff:0 },
  { q:"¿En qué plataforma salió originalmente God of War (2018)?",        opts:["PC","Xbox One","PS4","Nintendo Switch"],                       a:2, cat:"🎮", diff:0 },
  { q:"¿Cómo se llama la princesa que rescata Mario?",                    opts:["Daisy","Pauline","Peach","Rosalina"],                          a:2, cat:"🎮", diff:0 },
  { q:"¿En qué año salió Cyberpunk 2077?",                                opts:["2018","2019","2020","2022"],                                   a:2, cat:"🎮", diff:0 },
  { q:"¿Qué significa 'FPS' como género de videojuego?",                  opts:["Fast Player Speed","First Person Shooter","Full Play Score","Free Play System"], a:1, cat:"🎮", diff:0 },
  { q:"¿Cómo se llama el personaje enmascarado de Persona 5?",            opts:["Yu Narukami","Makoto Yuki","Joker","Akira Narukami"],          a:2, cat:"🎮", diff:2 },
  { q:"¿Cuántos jugadores tiene un equipo en Overwatch 2?",               opts:["4","5","6","7"],                                               a:1, cat:"🎮", diff:1 },
  { q:"¿Qué personaje usa el Keyblade en Kingdom Hearts?",                opts:["Riku","Kairi","Sora","Mickey"],                                a:2, cat:"🎮", diff:1 },
  { q:"¿En qué juego puedes construir estructuras para cubrirte en batalla?", opts:["PUBG","Warzone","Fortnite","Apex Legends"],                a:2, cat:"🎮", diff:0 },
  { q:"¿Qué tipo de juego es Dota 2?",                                    opts:["Battle Royale","MOBA","RPG","Simulador"],                      a:1, cat:"🎮", diff:0 },
  { q:"¿Qué empresa creó la consola Xbox?",                               opts:["Sony","Nintendo","Microsoft","Sega"],                          a:2, cat:"🎮", diff:0 },
  { q:"¿Cuántos jugadores máximos tiene Among Us por partida?",           opts:["8","10","15","20"],                                            a:1, cat:"🎮", diff:1 },
  { q:"¿Cuál es el mapa más icónico de CS:GO con bombas?",                opts:["de_aztec","de_dust2","de_nuke","de_inferno"],                  a:1, cat:"🎮", diff:1 },
  { q:"¿Qué juego tiene el modo Battle Royale llamado Warzone?",          opts:["Battlefield","Call of Duty","Halo","Titanfall"],               a:1, cat:"🎮", diff:0 },
  { q:"¿Cuántos personajes jugables tiene Super Smash Bros. Ultimate en total?", opts:["74","80","89","96"],                                   a:2, cat:"🎮", diff:2 },
  { q:"¿Qué empresa desarrolló los juegos de la saga Resident Evil?",     opts:["Konami","Capcom","Namco","Square Enix"],                       a:1, cat:"🎮", diff:0 },
  { q:"¿Cuántos mapas de batalla había en el lanzamiento de Valorant?",   opts:["4","5","6","7"],                                               a:0, cat:"🎮", diff:2 },
  { q:"¿Cómo se llama la organización terrorista en CS:GO / CS2?",        opts:["SWAT","CT","Terrorist Team","Special Force"],                  a:2, cat:"🎮", diff:1 },
  { q:"¿Qué tipo de juego es 'Hollow Knight'?",                           opts:["Battle Royale","Metroidvania","MOBA","Shooter"],               a:1, cat:"🎮", diff:1 },
  { q:"¿Cuántos jugadores máximos tiene una partida de Minecraft en modo multijugador básico?", opts:["8","20","100","Sin límite fijo"],        a:3, cat:"🎮", diff:1 },

  // ── 💻 TECNOLOGÍA ──────────────────────────────────────────────────────────
  { q:"¿Qué empresa creó el sistema operativo Android?",                  opts:["Apple","Microsoft","Google","Samsung"],                        a:2, cat:"💻", diff:0 },
  { q:"¿Qué significa 'www' en una dirección web?",                       opts:["World Wide Web","World Web Website","Wide World Web","Web World Wide"], a:0, cat:"💻", diff:0 },
  { q:"¿Cuántos bits tiene un byte?",                                     opts:["4","6","8","16"],                                              a:2, cat:"💻", diff:0 },
  { q:"¿Qué empresa desarrolló el iPhone?",                               opts:["Samsung","Microsoft","Apple","Sony"],                          a:2, cat:"💻", diff:0 },
  { q:"¿En qué año se fundó Google?",                                     opts:["1994","1996","1998","2000"],                                   a:2, cat:"💻", diff:1 },
  { q:"¿Qué lenguaje de programación es el principal del front-end web?", opts:["Python","Java","JavaScript","C++"],                           a:2, cat:"💻", diff:0 },
  { q:"¿Qué significa 'CPU'?",                                            opts:["Central Processing Unit","Computer Personal Unit","Core Processing Utility","Central Program Unit"], a:0, cat:"💻", diff:0 },
  { q:"¿Qué empresa creó Windows?",                                       opts:["Apple","IBM","Microsoft","Linux"],                             a:2, cat:"💻", diff:0 },
  { q:"¿Qué significa 'RAM' en informática?",                             opts:["Random Access Memory","Read And Modify","Real Active Memory","Remote Access Module"], a:0, cat:"💻", diff:0 },
  { q:"¿Qué empresa desarrolló el procesador M1?",                        opts:["Intel","AMD","Qualcomm","Apple"],                              a:3, cat:"💻", diff:1 },
  { q:"¿Cuál fue la primera red social masiva del mundo?",                opts:["Facebook","MySpace","Hi5","Twitter"],                          a:1, cat:"💻", diff:1 },
  { q:"¿Qué significa 'GPU'?",                                            opts:["General Processing Unit","Graphics Processing Unit","Global Program Unit","Game Processing Unit"], a:1, cat:"💻", diff:0 },
  { q:"¿En qué año se lanzó el primer iPhone?",                           opts:["2005","2006","2007","2008"],                                   a:2, cat:"💻", diff:1 },
  { q:"¿Qué lenguaje de programación creó Python?",                       opts:["Dennis Ritchie","Guido van Rossum","James Gosling","Brendan Eich"], a:1, cat:"💻", diff:2 },
  { q:"¿Cuánto almacena un gigabyte (GB)?",                               opts:["1,000 MB","1,024 MB","512 MB","2,048 MB"],                    a:1, cat:"💻", diff:1 },

  // ── 🎬 CINE & SERIES ───────────────────────────────────────────────────────
  { q:"¿Qué personaje protagoniza la saga Star Wars original?",           opts:["Han Solo","Obi-Wan Kenobi","Luke Skywalker","Darth Vader"],    a:2, cat:"🎬", diff:0 },
  { q:"¿En qué serie aparece el personaje Walter White?",                 opts:["Narcos","Breaking Bad","Ozark","Dexter"],                      a:1, cat:"🎬", diff:0 },
  { q:"¿Qué película fue la primera del MCU (Marvel)?",                   opts:["Thor","Iron Man","Captain America","The Avengers"],            a:1, cat:"🎬", diff:0 },
  { q:"¿Quién interpreta a Tony Stark / Iron Man?",                       opts:["Chris Evans","Chris Hemsworth","Robert Downey Jr.","Mark Ruffalo"], a:2, cat:"🎬", diff:0 },
  { q:"¿En qué año salió la primera película de Harry Potter?",           opts:["1999","2000","2001","2002"],                                   a:2, cat:"🎬", diff:0 },
  { q:"¿Qué personaje dice 'You shall not pass!' en El Señor de los Anillos?", opts:["Aragorn","Legolas","Gandalf","Frodo"],                   a:2, cat:"🎬", diff:0 },
  { q:"¿En qué país transcurre La Casa de Papel?",                        opts:["México","Argentina","España","Colombia"],                      a:2, cat:"🎬", diff:0 },
  { q:"¿Cuántas temporadas tiene Game of Thrones?",                       opts:["6","7","8","9"],                                               a:2, cat:"🎬", diff:0 },
  { q:"¿Quién dirigió Inception (El origen)?",                            opts:["Steven Spielberg","James Cameron","Christopher Nolan","Ridley Scott"], a:2, cat:"🎬", diff:1 },
  { q:"¿Cuál es el nombre real de Batman?",                               opts:["Clark Kent","Tony Stark","Bruce Wayne","Peter Parker"],        a:2, cat:"🎬", diff:0 },
  { q:"¿Qué personaje de Stranger Things tiene poderes telekinéticos?",   opts:["Will","Joyce","Mike","Eleven"],                                a:3, cat:"🎬", diff:0 },
  { q:"¿Cómo se llama el dragón principal de Daenerys en Game of Thrones?", opts:["Rhaegal","Drogon","Viserion","Balerion"],                  a:1, cat:"🎬", diff:1 },
  { q:"¿Qué plataforma de streaming lanzó 'Squid Game'?",                 opts:["HBO","Amazon Prime","Netflix","Disney+"],                      a:2, cat:"🎬", diff:0 },
  { q:"¿Cuántos Infinitos existen en el Universo Marvel (películas)?",    opts:["4","5","6","7"],                                               a:2, cat:"🎬", diff:0 },

  // ── 🌍 CULTURA GENERAL ─────────────────────────────────────────────────────
  { q:"¿Cuál es el país más grande del mundo por superficie?",            opts:["China","Canadá","Rusia","Estados Unidos"],                     a:2, cat:"🌍", diff:0 },
  { q:"¿Cuántos continentes hay en el mundo?",                            opts:["5","6","7","8"],                                               a:2, cat:"🌍", diff:0 },
  { q:"¿Cuál es la capital de Japón?",                                    opts:["Osaka","Kioto","Tokio","Hiroshima"],                           a:2, cat:"🌍", diff:0 },
  { q:"¿Qué planeta es el más cercano al Sol?",                           opts:["Venus","Tierra","Mercurio","Marte"],                           a:2, cat:"🌍", diff:0 },
  { q:"¿Cuántos lados tiene un hexágono?",                                opts:["4","5","6","7"],                                               a:2, cat:"🌍", diff:0 },
  { q:"¿Cuál es el océano más grande del mundo?",                         opts:["Atlántico","Índico","Ártico","Pacífico"],                      a:3, cat:"🌍", diff:0 },
  { q:"¿Cuántos colores tiene el arcoíris?",                              opts:["5","6","7","8"],                                               a:2, cat:"🌍", diff:0 },
  { q:"¿Cuál es el idioma más hablado del mundo como lengua nativa?",     opts:["Inglés","Español","Mandarín","Hindi"],                         a:2, cat:"🌍", diff:1 },
  { q:"¿Cuántos huesos tiene el cuerpo humano adulto?",                   opts:["186","206","226","246"],                                       a:1, cat:"🌍", diff:1 },
  { q:"¿Cuál es el animal terrestre más rápido del mundo?",               opts:["León","Guepardo","Puma","Antílope"],                           a:1, cat:"🌍", diff:0 },

  // ── ⚽ DEPORTES ────────────────────────────────────────────────────────────
  { q:"¿Cuántos jugadores hay en un equipo de fútbol en cancha?",         opts:["9","10","11","12"],                                            a:2, cat:"⚽", diff:0 },
  { q:"¿Qué país ganó el Mundial de Fútbol 2022?",                        opts:["Francia","Brasil","Argentina","Portugal"],                     a:2, cat:"⚽", diff:0 },
  { q:"¿Cuántos puntos vale un touchdown en fútbol americano?",           opts:["3","4","6","7"],                                               a:2, cat:"⚽", diff:1 },
  { q:"¿En qué deporte se usa un 'puck' (disco de goma)?",                opts:["Fútbol","Baloncesto","Hockey sobre hielo","Polo"],             a:2, cat:"⚽", diff:0 },
  { q:"¿Qué equipo de fútbol ha ganado más Copas del Mundo?",             opts:["Alemania","Argentina","Brasil","Italia"],                      a:2, cat:"⚽", diff:1 },
  { q:"¿Cuántos metros mide una piscina olímpica?",                       opts:["25","50","75","100"],                                          a:1, cat:"⚽", diff:0 },
  { q:"¿En qué deporte se usa la canasta o aro para anotar?",             opts:["Voleibol","Baloncesto","Balonmano","Fútbol sala"],             a:1, cat:"⚽", diff:0 },
  { q:"¿Cuántos jugadores hay en un equipo de básquetbol en cancha?",     opts:["4","5","6","7"],                                               a:1, cat:"⚽", diff:0 },
  { q:"¿Cuántos sets gana antes un tenista en Grand Slam masculino?",     opts:["2","3","4","5"],                                               a:1, cat:"⚽", diff:2 },
  { q:"¿En qué país nació Lionel Messi?",                                 opts:["Brasil","Uruguay","Chile","Argentina"],                        a:3, cat:"⚽", diff:0 },
];

const FREE_PLAYS   = 5;
const COINS_REWARD = 75;
const TIMER_SECS   = 15;

const DIFF_LABEL = ["Fácil", "Medio", "Difícil"];
const DIFF_CLASS = ["easy",  "medium","hard"];
const OPT_LABELS = ["A", "B", "C", "D"];

let currentUser   = null;
let playsUsed     = 0;
let playsTotal    = FREE_PLAYS;
let currentQ      = null;
let answered      = false;
let timerInterval = null;
let timerLeft     = TIMER_SECS;
let timerLeftAtAnswer = TIMER_SECS;
let usedIndexes   = [];
let waitingResult = false;

let sessionCoins  = 0;
let correctCount  = 0;
let streak        = 0;
let bestStreak    = 0;

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
  const sCoins = $('sessionCoinsVal');
  const sStreak = $('sessionStreakVal');

  const remaining = Math.max(playsTotal - playsUsed, 0);
  if (label) label.textContent = `${remaining} pregunta${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`;

  if (pips) {
    pips.innerHTML = '';
    for (let i = 0; i < playsTotal; i++) {
      const d = document.createElement('div');
      d.className = 'plays-pip' + (i < playsUsed ? ' used' : '');
      pips.appendChild(d);
    }
  }

  if (sCoins) sCoins.textContent = `+${sessionCoins}`;
  if (sStreak && streak > 0) {
    sStreak.textContent = '🔥'.repeat(Math.min(streak, 5));
    sStreak.style.display = '';
  } else if (sStreak) {
    sStreak.style.display = 'none';
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

function stopTimer() {
  timerLeftAtAnswer = timerLeft;
  clearInterval(timerInterval);
}

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
  timerLeftAtAnswer = 0;
  revealAnswer(false, -1);
  submitAnswer(false);
}

// ── Question UI ───────────────────────────────────────────────────────────
function showQuestion(q) {
  currentQ = q;
  answered = false;

  $('questionText').textContent = q.q;
  $('questionNum').textContent  = `${playsUsed + 1} / ${playsTotal}`;

  // category & difficulty
  const catEl  = $('qCatBadge');
  const diffEl = $('qDiffBadge');
  if (catEl)  catEl.textContent = q.cat || '🎮';
  if (diffEl) {
    diffEl.textContent  = DIFF_LABEL[q.diff ?? 0];
    diffEl.className    = 'q-diff ' + DIFF_CLASS[q.diff ?? 0];
  }

  const opts = document.querySelectorAll('.opt-btn');
  opts.forEach((btn, i) => {
    btn.innerHTML  = `<span class="opt-label">${OPT_LABELS[i]}</span><span class="opt-text">${q.opts[i]}</span>`;
    btn.className  = 'opt-btn';
    btn.disabled   = false;
    btn.onclick    = () => onAnswer(i, btn);
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
    if (i === currentQ.a)    btn.classList.add('correct');
    else if (i === chosen)   btn.classList.add('wrong');
  });
}

// ── Firebase call ──────────────────────────────────────────────────────────
async function submitAnswer(correct) {
  waitingResult = true;
  try {
    const fn  = firebase.functions().httpsCallable('answerTrivia');
    const res = await fn({ correct });
    const d   = res.data;
    playsUsed  = d.playsUsed;
    playsTotal = playsUsed + d.playsRemaining;
    setBalance(d.points);

    if (correct) {
      streak++;
      bestStreak   = Math.max(bestStreak, streak);
      correctCount++;
      sessionCoins += d.coins || COINS_REWARD;
    } else {
      streak = 0;
    }
    updatePlaysUI();

    setTimeout(() => showResult(correct, d.coins || 0, d.playsRemaining), 1000);
  } catch (err) {
    if ((err.code || '') === 'resource-exhausted') {
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

  $('resultEmoji').textContent = correct ? '🎉' : '😞';
  $('resultTitle').textContent = correct ? '¡Correcto!' : 'Incorrecto';

  const coinsEl = $('resultCoins');
  if (coinsEl) {
    coinsEl.innerHTML   = correct
      ? `+${coins} <img src="images/coin.png" class="coin-img" alt="coin">`
      : `0 <img src="images/coin.png" class="coin-img" alt="coin">`;
    coinsEl.className   = 'result-coins ' + (correct ? 'win' : 'miss');
  }

  // streak badge
  const streakBadge = $('resultStreakBadge');
  if (streakBadge) {
    if (correct && streak >= 2) {
      streakBadge.textContent = `🔥 Racha ×${streak}`;
      streakBadge.style.display = '';
    } else {
      streakBadge.style.display = 'none';
    }
  }

  // speed badge
  const speedBadge = $('resultSpeedBadge');
  if (speedBadge) {
    if (correct && timerLeftAtAnswer >= TIMER_SECS - 5) {
      speedBadge.style.display = '';
    } else {
      speedBadge.style.display = 'none';
    }
  }

  $('resultAnswer').textContent = correct ? '' : `Respuesta correcta: ${currentQ.opts[currentQ.a]}`;

  const nextBtn = $('nextBtn');
  if (remaining > 0) {
    nextBtn.textContent = remaining === 1
      ? `Última pregunta →`
      : `Siguiente (${remaining} restantes) →`;
    nextBtn.onclick = () => showQuestion(pickQuestion());
  } else {
    nextBtn.textContent = '📊 Ver resultado final';
    nextBtn.onclick = showSessionSummary;
  }
}

function showSessionSummary() {
  $('resultScreen').classList.add('hidden');
  $('triviaCard').classList.add('hidden');
  const ss = $('sessionScreen');
  ss.classList.remove('hidden');

  const pct = correctCount / playsTotal;
  const stars = pct >= 0.8 ? 3 : pct >= 0.6 ? 2 : pct >= 0.2 ? 1 : 0;

  $('summaryStars').innerHTML = ['⭐','⭐','⭐'].map((s, i) =>
    `<span class="summary-star ${i < stars ? 'lit' : ''}">${s}</span>`
  ).join('');

  const msgs = [
    '¡No te rindas! Inténtalo mañana 💪',
    '¡Sigue practicando! Cada día mejor 🎯',
    '¡Buen intento! Te va saliendo 🎮',
    '¡Muy bien! Eres todo un gamer 🔥',
    '¡PERFECTO! Experto total 🏆',
  ];
  $('summaryMsg').textContent = msgs[correctCount] ?? msgs[0];

  $('summaryCorrect').textContent  = `${correctCount}/${playsTotal}`;
  $('summaryCoins').innerHTML      = `+${sessionCoins} <img src="images/coin.png" class="coin-img" alt="coin">`;
  $('summaryStreak').textContent   = `${bestStreak} 🔥`;
}

function showNoPlays() {
  $('triviaCard')?.classList.add('hidden');
  $('resultScreen')?.classList.add('hidden');
  $('sessionScreen')?.classList.add('hidden');
  $('noPlaysScreen').classList.remove('hidden');

  // countdown to midnight
  const now  = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.round((midnight - now) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const cdEl = $('noPlaysCountdown');
  if (cdEl) cdEl.textContent = `Vuelve en ${h}h ${m}m`;
}

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        window.location.href = typeof withAppFlag === 'function' ? withAppFlag('login.html') : 'login.html';
        return;
      }
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
      } catch (e) {
        playsUsed = 0; playsTotal = FREE_PLAYS;
      }

      updatePlaysUI();

      if (playsUsed >= playsTotal) {
        showNoPlays();
      } else {
        showQuestion(pickQuestion());
      }
    });
  });
});
