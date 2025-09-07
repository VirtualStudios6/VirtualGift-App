// reward.js – Funciones de recompensas

// Mostrar notificación (si no existe la función, la creamos)
function showNotification(message, isError = false) {
    // Buscar si ya existe una función showNotification global
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, isError);
        return;
    }
    
    // Crear notificación básica si no existe
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.className = 'notification' + (isError ? ' error' : '');
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Agregar puntos al usuario
function addUserPoints(points, activityDescription = "") {
    const user = auth.currentUser;
    if (!user) {
        showNotification("Debes iniciar sesión para ganar puntos", true);
        return Promise.reject("Usuario no autenticado");
    }

    return db.collection('users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                const currentPoints = userData.points || 0;
                const currentExp = userData.experience || 0;
                
                // Actualizar puntos y experiencia
                return db.collection('users').doc(user.uid).update({
                    points: currentPoints + points,
                    experience: currentExp + points
                });
            } else {
                // Crear documento si no existe
                return db.collection('users').doc(user.uid).set({
                    points: points,
                    experience: points,
                    level: 1,
                    nextLevel: 200,
                    username: user.displayName || "Usuario",
                    email: user.email,
                    joinDate: new Date()
                }, { merge: true });
            }
        })
        .then(() => {
            // Registrar actividad si se proporciona descripción
            if (activityDescription) {
                logRewardActivity('points_earned', points, activityDescription);
            }
            
            showNotification(`¡Has ganado ${points} puntos!`);
            updateUserPointsUI();
            return points;
        })
        .catch((err) => {
            console.error("Error al agregar puntos:", err);
            showNotification("Error al agregar puntos", true);
            throw err;
        });
}

// Canjear recompensa
function redeemReward(rewardId, cost, rewardName) {
    const user = auth.currentUser;
    if (!user) {
        showNotification("Debes iniciar sesión para canjear recompensas", true);
        return Promise.reject("Usuario no autenticado");
    }

    return db.collection('users').doc(user.uid).get()
        .then((doc) => {
            if (!doc.exists) {
                throw new Error("Datos de usuario no encontrados");
            }
            
            const userData = doc.data();
            if (userData.points < cost) {
                throw new Error(`Necesitas ${cost - userData.points} puntos más para canjear esta recompensa`);
            }
            
            // Actualizar puntos del usuario
            return db.collection('users').doc(user.uid).update({
                points: userData.points - cost
            });
        })
        .then(() => {
            // Registrar la recompensa canjeada
            return db.collection('user_rewards').add({
                userId: user.uid,
                rewardId: rewardId,
                rewardName: rewardName,
                cost: cost,
                claimedDate: new Date(),
                status: 'claimed'
            });
        })
        .then(() => {
            // Registrar actividad
            logRewardActivity('reward_redeemed', -cost, `Canjeó: ${rewardName}`);
            
            showNotification(`¡Has canjeado "${rewardName}" por ${cost} puntos!`);
            updateUserPointsUI();
            return true;
        })
        .catch((err) => {
            console.error("Error al canjear recompensa:", err);
            showNotification(err.message || "Error al canjear recompensa", true);
            throw err;
        });
}

// Actualizar puntos en la interfaz
function updateUserPointsUI() {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Actualizar puntos
                const pointsElement = document.getElementById('user-points');
                if (pointsElement) pointsElement.textContent = data.points || 0;
                
                // Actualizar barra de progreso (si existe)
                const levelProgress = document.getElementById('level-progress');
                const progressText = document.getElementById('progress-text');
                
                if (levelProgress && progressText) {
                    const experience = data.experience || 0;
                    const nextLevel = data.nextLevel || 200;
                    const progressPercent = Math.min((experience / nextLevel) * 100, 100);
                    
                    levelProgress.style.width = progressPercent + '%';
                    progressText.textContent = `${experience}/${nextLevel} puntos`;
                }
            }
        })
        .catch((err) => {
            console.error("Error al actualizar UI:", err);
        });
}

// Registrar actividad
function logRewardActivity(type, points, description) {
    const user = auth.currentUser;
    if (!user) return Promise.resolve();

    return db.collection('activities').add({
        userId: user.uid,
        type: type,
        points: points,
        description: description,
        timestamp: new Date()
    }).catch((err) => {
        console.error("Error al registrar actividad:", err);
    });
}

// Verificar y actualizar nivel del usuario
function checkLevelUp() {
    const user = auth.currentUser;
    if (!user) return;

    db.collection('users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const experience = data.experience || 0;
                const currentLevel = data.level || 1;
                const nextLevelExp = data.nextLevel || 200;
                
                if (experience >= nextLevelExp) {
                    // Subir de nivel
                    const newLevel = currentLevel + 1;
                    const newNextLevel = nextLevelExp * 2; // Doble de experiencia para el siguiente nivel
                    
                    return db.collection('users').doc(user.uid).update({
                        level: newLevel,
                        nextLevel: newNextLevel,
                        points: (data.points || 0) + 50 // Bonus por subir de nivel
                    }).then(() => {
                        showNotification(`¡Felicidades! Has subido al nivel ${newLevel} y ganaste 50 puntos bonus`);
                        updateUserPointsUI();
                    });
                }
            }
        })
        .catch((err) => {
            console.error("Error al verificar nivel:", err);
        });
}

// Inicializar eventos de recompensas
function initRewards() {
    // Ver anuncio
    const watchAdBtn = document.getElementById('watch-ad-btn');
    if (watchAdBtn) {
        watchAdBtn.addEventListener('click', () => {
            simulateAdWatch();
        });
    }
    
    // Instalar app
    const installAppBtn = document.getElementById('install-app-btn');
    if (installAppBtn) {
        installAppBtn.addEventListener('click', () => {
            addUserPoints(100, "Instalación de app móvil");
        });
    }
    
    // Referir amigo
    const referFriendBtn = document.getElementById('refer-friend-btn');
    if (referFriendBtn) {
        referFriendBtn.addEventListener('click', () => {
            showNotification("Función de referidos próximamente");
        });
    }
}

// Simular visualización de anuncio
function simulateAdWatch() {
    const watchAdBtn = document.getElementById('watch-ad-btn');
    const adProgress = document.getElementById('ad-progress');
    const adTimer = document.getElementById('ad-timer');
    
    if (!watchAdBtn || !adProgress || !adTimer) return;
    
    watchAdBtn.disabled = true;
    let timeLeft = 30;
    
    const interval = setInterval(() => {
        timeLeft--;
        const progressPercent = ((30 - timeLeft) / 30) * 100;
        
        adProgress.style.width = progressPercent + '%';
        adTimer.textContent = timeLeft + 's';
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            addUserPoints(25, "Visualización de anuncio");
            
            // Resetear
            setTimeout(() => {
                adProgress.style.width = '0%';
                adTimer.textContent = '30s';
                watchAdBtn.disabled = false;
            }, 1000);
        }
    }, 1000);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initRewards();
});