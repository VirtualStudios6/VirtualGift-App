// Elementos DOM específicos del dashboard
const userDisplayName = document.getElementById('user-display-name');
const userPoints = document.getElementById('user-points');
const userLevel = document.getElementById('user-level');
const userRank = document.getElementById('user-rank');
const levelProgress = document.getElementById('level-progress');
const progressText = document.getElementById('progress-text');
const logoutBtn = document.getElementById('logout-btn');

// Referencias a elementos de recompensas
const watchAdBtn = document.getElementById('watch-ad-btn');
const installAppBtn = document.getElementById('install-app-btn');
const referFriendBtn = document.getElementById('refer-friend-btn');
const adProgress = document.getElementById('ad-progress');
const adTimer = document.getElementById('ad-timer');

// Referencias al modal
const rewardModal = document.getElementById('reward-modal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

// Overlay para modales
const overlay = document.createElement('div');
overlay.className = 'overlay';
document.body.appendChild(overlay);

// Estado de la aplicación
let currentUser = null;
let userData = {};
let adInterval = null;

// Mostrar notificación (crear elemento si no existe)
let notification = document.getElementById('notification');
if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    document.body.appendChild(notification);
}

// Mostrar notificación
function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.className = 'notification';
    
    if (isError) {
        notification.classList.add('error');
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Mostrar modal
function showModal(title, description, onConfirm) {
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    
    // Configurar acción de confirmación
    modalConfirm.onclick = onConfirm;
    
    // Mostrar modal y overlay
    rewardModal.classList.add('show');
    overlay.style.display = 'block';
    
    // Añadir clase para animación
    setTimeout(() => {
        rewardModal.style.display = 'block';
    }, 10);
}

// Ocultar modal
function hideModal() {
    rewardModal.classList.remove('show');
    overlay.style.display = 'none';
    
    setTimeout(() => {
        rewardModal.style.display = 'none';
    }, 300);
}

// Cargar datos del usuario
function loadUserData(user) {
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                userData = doc.data();
                
                // Mostrar el nombre de usuario real
                if (userDisplayName) {
                    userDisplayName.textContent = userData.username || user.displayName || 'Usuario';
                }
                
                // Mostrar puntos
                if (userPoints) {
                    userPoints.textContent = userData.points || 0;
                }
                
                // Mostrar nivel
                if (userLevel) {
                    userLevel.textContent = userData.level || 1;
                }
                
                // Mostrar progreso de nivel
                if (levelProgress && progressText) {
                    const experience = userData.experience || 0;
                    const nextLevel = userData.nextLevel || 200;
                    const progressPercent = (experience / nextLevel) * 100;
                    
                    levelProgress.style.width = Math.min(progressPercent, 100) + '%';
                    progressText.textContent = `${experience}/${nextLevel} puntos`;
                }
                
                // Calcular ranking (esto es un ejemplo, necesitarías una colección de usuarios ordenada)
                if (userRank) {
                    // Esto es temporal - en una implementación real necesitarías consultar todos los usuarios
                    userRank.textContent = '#0'; 
                }
                
                // Actualizar estado de botones basado en puntos
                updateRewardButtons();
            } else {
                // Si no existe en Firestore, usar datos básicos
                if (userDisplayName) {
                    userDisplayName.textContent = user.displayName || 'Usuario';
                }
                
                // Crear documento inicial para el usuario
                createInitialUserData(user);
            }
        })
        .catch(error => {
            console.error('Error al obtener datos del usuario:', error);
            showNotification('Error al cargar datos del usuario', true);
            
            // Mostrar datos básicos si falla Firestore
            if (userDisplayName) {
                userDisplayName.textContent = user.displayName || 'Usuario';
            }
        });
}

// Crear datos iniciales para un nuevo usuario
function createInitialUserData(user) {
    const initialData = {
        username: user.displayName || 'Usuario',
        email: user.email,
        points: 0,
        level: 1,
        experience: 0,
        nextLevel: 100,
        joined: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('users').doc(user.uid).set(initialData)
        .then(() => {
            userData = initialData;
            updateUIWithUserData();
            showNotification('¡Bienvenido a VirtualGIF! Tu cuenta ha sido creada.');
        })
        .catch(error => {
            console.error('Error al crear datos iniciales:', error);
            showNotification('Error al crear perfil de usuario', true);
        });
}

// Actualizar la UI con los datos del usuario
function updateUIWithUserData() {
    if (userDisplayName) {
        userDisplayName.textContent = userData.username || 'Usuario';
    }
    
    if (userPoints) {
        userPoints.textContent = userData.points || 0;
    }
    
    if (userLevel) {
        userLevel.textContent = userData.level || 1;
    }
    
    if (levelProgress && progressText) {
        const experience = userData.experience || 0;
        const nextLevel = userData.nextLevel || 200;
        const progressPercent = (experience / nextLevel) * 100;
        
        levelProgress.style.width = Math.min(progressPercent, 100) + '%';
        progressText.textContent = `${experience}/${nextLevel} puntos`;
    }
    
    updateRewardButtons();
}

// Actualizar estado de los botones de recompensas
function updateRewardButtons() {
    // Aquí puedes añadir lógica para habilitar/deshabilitar botones
    // basado en los puntos del usuario o otros criterios
}

// Añadir puntos al usuario
function addUserPoints(points, activityDescription) {
    const newPoints = (userData.points || 0) + points;
    const newExperience = (userData.experience || 0) + points;
    
    // Verificar si subió de nivel
    let levelUp = false;
    let newLevel = userData.level || 1;
    let newNextLevel = userData.nextLevel || 100;
    
    if (newExperience >= newNextLevel) {
        levelUp = true;
        newLevel++;
        newNextLevel = newNextLevel * 2; // Doblamos la experiencia necesaria para el siguiente nivel
    }
    
    // Actualizar datos locales
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
        // Registrar actividad
        registerActivity(activityDescription, points);
        
        // Actualizar UI
        updateUIWithUserData();
        
        // Mostrar notificación
        if (levelUp) {
            showNotification(`¡Felicidades! Has subido al nivel ${newLevel}`, false);
        } else {
            showNotification(`+${points} puntos! ${activityDescription}`, false);
        }
    })
    .catch(error => {
        console.error('Error al actualizar puntos:', error);
        showNotification('Error al actualizar puntos', true);
    });
}

// Registrar actividad
function registerActivity(description, points) {
    const activity = {
        description: description,
        points: points,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('users').doc(currentUser.uid).collection('activities').add(activity)
        .then(() => {
            // Actualizar lista de actividades
            loadRecentActivities();
        })
        .catch(error => {
            console.error('Error al registrar actividad:', error);
        });
}

// Cargar actividades recientes
function loadRecentActivities() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    db.collection('users').doc(currentUser.uid).collection('activities')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then(snapshot => {
            activityList.innerHTML = ''; // Limpiar lista
            
            if (snapshot.empty) {
                activityList.innerHTML = '<div class="activity-item">No hay actividades recientes</div>';
                return;
            }
            
            snapshot.forEach(doc => {
                const activity = doc.data();
                const date = activity.timestamp ? activity.timestamp.toDate() : new Date();
                const formattedDate = formatDate(date);
                
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-content">
                        <div class="activity-icon">${getActivityIcon(activity.description)}</div>
                        <div class="activity-text">${activity.description}</div>
                    </div>
                    <div class="activity-points ${activity.points > 0 ? 'positive' : 'negative'}">
                        ${activity.points > 0 ? '+' : ''}${activity.points}
                    </div>
                    <div class="activity-date">${formattedDate}</div>
                `;
                
                activityList.appendChild(activityItem);
            });
        })
        .catch(error => {
            console.error('Error al cargar actividades:', error);
            activityList.innerHTML = '<div class="activity-item">Error al cargar actividades</div>';
        });
}

// Obtener icono para la actividad
function getActivityIcon(description) {
    if (description.includes('anuncio')) return '📺';
    if (description.includes('referido')) return '👥';
    if (description.includes('app')) return '📱';
    if (description.includes('canje')) return '🎁';
    return '✅';
}

// Formatear fecha
function formatDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Hoy';
    } else if (diffDays === 1) {
        return 'Ayer';
    } else if (diffDays < 7) {
        return `Hace ${diffDays} días`;
    } else {
        return date.toLocaleDateString();
    }
}

// Simular visualización de anuncio
function simulateAdView() {
    if (adInterval) {
        clearInterval(adInterval);
    }
    
    // Mostrar contador de progreso
    const adProgressContainer = document.querySelector('.ad-progress-container');
    if (adProgressContainer) {
        adProgressContainer.style.display = 'block';
    }
    
    let timeLeft = 30;
    adTimer.textContent = `${timeLeft}s`;
    adProgress.style.width = '0%';
    
    // Deshabilitar botón durante la reproducción
    if (watchAdBtn) {
        watchAdBtn.disabled = true;
        watchAdBtn.textContent = 'Reproduciendo...';
    }
    
    adInterval = setInterval(() => {
        timeLeft--;
        
        // Actualizar progreso
        const progressPercent = ((30 - timeLeft) / 30) * 100;
        adProgress.style.width = `${progressPercent}%`;
        adTimer.textContent = `${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(adInterval);
            
            // Ocultar contador de progreso
            if (adProgressContainer) {
                adProgressContainer.style.display = 'none';
            }
            
            // Rehabilitar botón
            if (watchAdBtn) {
                watchAdBtn.disabled = false;
                watchAdBtn.textContent = 'Ver Anuncio';
            }
            
            // Añadir puntos
            addUserPoints(25, 'Viste un anuncio');
        }
    }, 1000);
}

// Cerrar sesión
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        showModal(
            'Cerrar sesión', 
            '¿Estás seguro de que quieres cerrar tu sesión?',
            function() {
                auth.signOut()
                    .then(() => {
                        showNotification('Sesión cerrada correctamente');
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1500);
                    })
                    .catch((error) => {
                        console.error('Error al cerrar sesión:', error);
                        showNotification('Error al cerrar sesión', true);
                    });
                
                hideModal();
            }
        );
    });
}

// Configurar botones de recompensas
if (watchAdBtn) {
    watchAdBtn.addEventListener('click', simulateAdView);
}

if (installAppBtn) {
    installAppBtn.addEventListener('click', function() {
        showModal(
            'Instalar App Móvil',
            'Al instalar nuestra app móvil ganarás 100 puntos. ¿Quieres continuar?',
            function() {
                // Simular instalación (en una app real esto abriría el store)
                addUserPoints(100, 'Instalaste la app móvil');
                hideModal();
            }
        );
    });
}

if (referFriendBtn) {
    referFriendBtn.addEventListener('click', function() {
        showModal(
            'Referir Amigo',
            'Comparte tu código de referido con amigos y gana 50 puntos por cada uno que se registre. Tu código es: ' + currentUser.uid.substring(0, 8).toUpperCase(),
            function() {
                // Copiar código al portapapeles
                navigator.clipboard.writeText(currentUser.uid.substring(0, 8).toUpperCase())
                    .then(() => {
                        showNotification('Código copiado al portapapeles');
                    })
                    .catch(err => {
                        console.error('Error al copiar:', err);
                    });
                
                hideModal();
            }
        );
    });
}

// Configurar cierre del modal
if (modalCancel) {
    modalCancel.addEventListener('click', hideModal);
}

if (rewardModal) {
    const closeModalBtn = rewardModal.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideModal);
    }
}

// Cerrar modal al hacer clic fuera de él
overlay.addEventListener('click', hideModal);

// Verificar autenticación al cargar el dashboard
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        
        // Verificar si el email está verificado
        if (!user.emailVerified) {
            showNotification('Por favor, verifica tu email para acceder al dashboard', true);
            setTimeout(() => {
                auth.signOut().then(() => {
                    window.location.href = 'index.html';
                });
            }, 2000);
            return;
        }
        
        // Usuario autenticado y verificado - cargar datos
        loadUserData(user);
        loadRecentActivities();
    } else {
        // Usuario no autenticado - redirigir al login
        window.location.href = 'index.html';
    }
});

// Cargar tienda de recompensas
function loadRewardsStore() {
    const rewardsStore = document.getElementById('rewards-store');
    if (!rewardsStore) return;
    
    // Datos de ejemplo para la tienda
    const rewards = [
        { icon: '🎁', title: 'GIF Exclusivo', description: 'Desbloquea un GIF exclusivo para tu perfil', cost: 150 },
        { icon: '⭐', title: 'Estrellas Doradas', description: 'Paquete de estrellas doradas para tus GIFs', cost: 250 },
        { icon: '🚀', title: 'Boost de Visibilidad', description: 'Aumenta la visibilidad de tus GIFs por 24h', cost: 500 }
    ];
    
    rewardsStore.innerHTML = ''; // Limpiar tienda
    
    rewards.forEach(reward => {
        const canAfford = (userData.points || 0) >= reward.cost;
        
        const rewardElement = document.createElement('div');
        rewardElement.className = 'store-item';
        rewardElement.innerHTML = `
            <div class="store-item-icon">${reward.icon}</div>
            <h3>${reward.title}</h3>
            <p>${reward.description}</p>
            <div class="store-item-cost">${reward.cost} puntos</div>
            <button class="btn-redeem" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Canjear' : 'Puntos insuficientes'}
            </button>
        `;
        
        // Añadir evento de clic al botón
        const redeemBtn = rewardElement.querySelector('.btn-redeem');
        if (redeemBtn && canAfford) {
            redeemBtn.addEventListener('click', function() {
                showModal(
                    'Canjear Recompensa',
                    `¿Quieres canjear "${reward.title}" por ${reward.cost} puntos?`,
                    function() {
                        // Restar puntos
                        addUserPoints(-reward.cost, `Canjeaste: ${reward.title}`);
                        hideModal();
                    }
                );
            });
        }
        
        rewardsStore.appendChild(rewardElement);
    });
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard cargado correctamente');
    
    // Una vez que los datos del usuario estén cargados, cargar la tienda
    if (currentUser && userData.points !== undefined) {
        loadRewardsStore();
    }
});