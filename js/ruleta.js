// ruleta.js

// Elementos DOM
const backBtn = document.getElementById('back-btn');
const pointsDisplay = document.getElementById('points-display');
const spinBtn = document.getElementById('spin-btn');
const wheel = document.querySelector('.wheel-inner');
const spinsInfo = document.querySelector('.spins-info');

let currentUser = null;
let userData = {};
let spinning = false;

// Función de notificación
function showNotification(msg, isError = false) {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    notification.textContent = msg;
    notification.className = 'notification show';
    if (isError) notification.classList.add('error');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// Cargar datos del usuario
function loadUserData(user) {
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                userData = doc.data();
                updatePointsDisplay();
            } else {
                // Crear usuario inicial si no existe
                createInitialUserData(user);
            }
        })
        .catch(err => {
            console.error('Error cargando datos de usuario:', err);
            showNotification('Error al cargar puntos', true);
        });
}

// Crear usuario inicial en Firestore
function createInitialUserData(user) {
    const initialData = {
        username: user.displayName || 'Usuario',
        email: user.email,
        points: 100,
        level: 1,
        experience: 0,
        nextLevel: 200,
        joinDate: new Date(),
        lastLogin: new Date()
    };
    db.collection('users').doc(user.uid).set(initialData)
        .then(() => {
            userData = initialData;
            updatePointsDisplay();
        })
        .catch(err => {
            console.error('Error creando usuario:', err);
            showNotification('Error al crear perfil', true);
        });
}

// Actualizar display de puntos
function updatePointsDisplay() {
    if (pointsDisplay) {
        pointsDisplay.textContent = (userData.points || 0).toLocaleString();
    }
    if (spinsInfo) {
        spinsInfo.textContent = `Tienes ${userData.points || 0} puntos disponibles`;
    }
}

// Agregar puntos
function addUserPoints(points, activityDescription) {
    const newPoints = (userData.points || 0) + points;
    const newExperience = (userData.experience || 0) + points;

    let levelUp = false;
    let newLevel = userData.level || 1;
    let newNextLevel = userData.nextLevel || 200;

    if (newExperience >= newNextLevel) {
        levelUp = true;
        newLevel++;
        newNextLevel *= 2;
    }

    userData.points = newPoints;
    userData.experience = newExperience;
    userData.level = newLevel;
    userData.nextLevel = newNextLevel;

    // Actualizar Firestore
    db.collection('users').doc(currentUser.uid).update({
        points: newPoints,
        experience: newExperience,
        level: newLevel,
        nextLevel: newNextLevel,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        showNotification(levelUp 
            ? `¡Felicidades! Subiste al nivel ${newLevel}` 
            : `+${points} puntos! ${activityDescription}`);
        updatePointsDisplay();
    })
    .catch(err => {
        console.error('Error actualizando puntos:', err);
        showNotification('Error al actualizar puntos', true);
    });
}

// Función de la ruleta
function spinWheel() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;

    // Definir ángulo final aleatorio
    const spins = Math.floor(Math.random() * 5) + 5; // vueltas completas
    const degrees = Math.floor(Math.random() * 360);
    const totalDegrees = (spins * 360) + degrees;

    wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
    wheel.style.transform = `rotate(${totalDegrees}deg)`;

    // Determinar sección ganadora según ángulo
    const sections = [
        { name: 'Rojo', points: 50 },
        { name: 'Naranja', points: 30 },
        { name: 'Morado', points: 70 },
        { name: 'Azul Claro', points: 20 },
        { name: 'Azul', points: 40 },
        { name: 'Violeta', points: 60 }
    ];

    setTimeout(() => {
        const finalDeg = totalDegrees % 360;
        const index = Math.floor(finalDeg / 60);
        const prize = sections[index];
        handleSpinWin(prize.points, prize.name);

        // Reset ruleta
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(${finalDeg}deg)`;

        spinning = false;
        spinBtn.disabled = false;
    }, 4000);
}

// Manejar resultado de la ruleta
function handleSpinWin(points, sectionName) {
    addUserPoints(points, `Ganaste en la ruleta (${sectionName})`);
}

// Botón volver al dashboard
backBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

// Inicialización
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadUserData(user);
    } else {
        window.location.href = 'index.html';
    }
});

// Evento de spin
spinBtn.addEventListener('click', spinWheel);
