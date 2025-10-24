// dashboard.js - Código mejorado y optimizado para móviles

// Elementos DOM específicos del dashboard
const userDisplayName = document.getElementById('user-display-name');
const userPoints = document.getElementById('user-points');
const logoutBtn = document.getElementById('logout-btn');
const spinsRemaining = document.getElementById('spins-remaining');

// Referencias a elementos de recompensas
const watchAdBtn = document.getElementById('watch-ad-btn');

// Referencias a modales
const rewardModal = document.getElementById('reward-modal');
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const confirmTitle = document.getElementById('confirm-title');
const confirmDescription = document.getElementById('confirm-description');

// Estado de la aplicación
let currentUser = null;
let userData = {};
let adInterval = null;
let confirmCallback = null;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initApplication();
});

function initApplication() {
    initEventListeners();
    initCollapsibleSections();
    verifyAuthentication();
}

// Inicializar event listeners
function initEventListeners() {
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Botón de ver anuncio
    if (watchAdBtn) {
        watchAdBtn.addEventListener('click', () => handleRewardAction('ad', 25, 'Ver Anuncio'));
    }

    // Botones de canjeo
    const redeemButtons = document.querySelectorAll('.btn-redeem');
    redeemButtons.forEach(btn => {
        btn.addEventListener('click', handleRedeemClick);
    });

    // Cerrar modales
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal confirmations
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmAccept = document.getElementById('confirm-accept');
    const modalConfirm = document.getElementById('modal-confirm');

    if (confirmCancel) confirmCancel.addEventListener('click', closeAllModals);
    if (confirmAccept) confirmAccept.addEventListener('click', handleConfirmAccept);
    if (modalConfirm) modalConfirm.addEventListener('click', closeAllModals);

    // Clic fuera del modal para cerrar
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // Tecla Escape para cerrar modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Prevenir zoom en inputs en iOS
    preventZoomOnFocus();
}

function preventZoomOnFocus() {
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                document.body.style.zoom = '0.8';
            });
            input.addEventListener('blur', () => {
                document.body.style.zoom = '1';
            });
        });
    }
}

// Inicializar secciones colapsables
function initCollapsibleSections() {
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    sectionHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            toggleCollapsibleSection(this);
        });
        
        header.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCollapsibleSection(this);
            }
        });
    });

    // NO abrir ninguna sección por defecto - todas colapsadas
}

function toggleCollapsibleSection(header, forceOpen = false) {
    const section = header.parentElement;
    const content = section.querySelector('.collapsible-content');
    const icon = header.querySelector('.toggle-icon');
    const isExpanded = section.getAttribute('aria-expanded') === 'true';
    const shouldExpand = forceOpen ? true : !isExpanded;

    // Actualizar atributos ARIA
    section.setAttribute('aria-expanded', shouldExpand);
    header.setAttribute('aria-expanded', shouldExpand);

    // Animación suave
    if (content) {
        if (shouldExpand) {
            content.style.maxHeight = content.scrollHeight + 'px';
        } else {
            content.style.maxHeight = '0';
        }
    }

    // Rotar ícono
    if (icon) {
        icon.style.transform = shouldExpand ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    // Feedback táctil para móviles
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
}

// Verificar autenticación
function verifyAuthentication() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            if (!user.emailVerified) {
                showNotification('Por favor, verifica tu email para acceder al dashboard', true);
                setTimeout(() => {
                    auth.signOut().then(() => {
                        window.location.href = 'index.html';
                    });
                }, 2000);
                return;
            }
            loadUserData(user);
        } else {
            window.location.href = 'index.html';
        }
    });
}

// Cargar datos del usuario
function loadUserData(user) {
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                userData = doc.data();
                updateUIWithUserData();
                hideLoadingOverlay();
                loadRewardsStore();
            } else {
                createInitialUserData(user);
            }
        })
        .catch(error => {
            console.error('Error al obtener datos del usuario:', error);
            showNotification('Error al cargar datos del usuario', true);
            createInitialUserData(user); // Crear datos por defecto
        });
}

// Crear datos iniciales para nuevo usuario
function createInitialUserData(user) {
    const initialData = {
        username: user.displayName || 'Usuario',
        email: user.email,
        points: 100, // Puntos iniciales de bienvenida
        spins: 3, // Giros iniciales
        joined: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        level: 1
    };

    db.collection('users').doc(user.uid).set(initialData)
        .then(() => {
            userData = initialData;
            updateUIWithUserData();
            hideLoadingOverlay();
            showNotification('¡Bienvenido a VirtualGift! Tu cuenta ha sido creada.');
        })
        .catch(error => {
            console.error('Error al crear datos iniciales:', error);
            showNotification('Error al crear perfil de usuario', true);
            // Usar datos locales como fallback
            userData = initialData;
            updateUIWithUserData();
            hideLoadingOverlay();
        });
}

// Actualizar la UI con los datos del usuario
function updateUIWithUserData() {
    if (userDisplayName) {
        userDisplayName.textContent = userData.username || 'Usuario';
    }
    if (userPoints) {
        animateNumberChange(userPoints, userData.points || 0);
    }
    if (spinsRemaining) {
        spinsRemaining.textContent = userData.spins || 3;
    }
    updateRewardButtons();
}

// Animación suave para cambios de números
function animateNumberChange(element, newValue) {
    const oldValue = parseInt(element.textContent) || 0;
    if (oldValue === newValue) return;

    const difference = newValue - oldValue;
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = oldValue + (difference * easeOutQuart);

        element.textContent = Math.round(currentValue);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };

    requestAnimationFrame(animate);
}

// Actualizar estado de los botones
function updateRewardButtons() {
    const points = userData.points || 0;
    const redeemButtons = document.querySelectorAll('.btn-redeem');
    
    redeemButtons.forEach(btn => {
        const cost = parseInt(btn.getAttribute('data-cost')) || 0;
        btn.disabled = points < cost;
        btn.innerHTML = points < cost ? 
            '<i class="fas fa-lock"></i><span>Puntos insuficientes</span>' : 
            '<i class="fas fa-exchange-alt"></i><span>Canjear</span>';
    });
}

// Manejar acciones de recompensa
function handleRewardAction(type, points, description) {
    let modalTitle, modalDescription, actionFunction;

    if (type === 'ad') {
        modalTitle = 'Ver Anuncio';
        modalDescription = `Al ver este anuncio ganarás ${points} puntos. ¿Quieres continuar?`;
        actionFunction = simulateAdView;
    }

    showConfirmModal(
        modalTitle,
        modalDescription,
        actionFunction
    );
}

// Simular visualización de anuncio
function simulateAdView() {
    const points = 25;
    
    // Deshabilitar botón temporalmente
    if (watchAdBtn) {
        watchAdBtn.disabled = true;
        watchAdBtn.classList.add('loading');
        watchAdBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Reproduciendo...</span>';
    }

    // Simular progreso de anuncio
    let progress = 0;
    const duration = 5000; // 5 segundos para móviles (más rápido)
    
    const progressInterval = setInterval(() => {
        progress += 100;
        if (progress >= duration) {
            clearInterval(progressInterval);
            
            // Recompensar al usuario
            addUserPoints(points, 'Viste un anuncio');
            
            // Restaurar botón
            if (watchAdBtn) {
                setTimeout(() => {
                    watchAdBtn.disabled = false;
                    watchAdBtn.classList.remove('loading');
                    watchAdBtn.innerHTML = '<i class="fas fa-play"></i><span>Ver Anuncio</span>';
                }, 1000);
            }

            // Feedback táctil
            if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    }, 100);
}

// Manejar clic en canjear
function handleRedeemClick(event) {
    const button = event.currentTarget;
    const cost = parseInt(button.getAttribute('data-cost'));
    const reward = button.getAttribute('data-reward');
    const rewardName = getRewardName(reward);

    if ((userData.points || 0) < cost) {
        showNotification(`Necesitas ${cost} puntos para canjear este premio`, true);
        return;
    }

    showConfirmModal(
        'Confirmar Canje',
        `¿Quieres canjear "${rewardName}" por ${cost} puntos?`,
        () => processRedeem(reward, cost, rewardName)
    );
}

// Procesar canje de premio
function processRedeem(reward, cost, rewardName) {
    addUserPoints(-cost, `Canjeaste: ${rewardName}`);
    showNotification(`¡Felicidades! Canjeaste ${rewardName}`, false);
    
    // Aquí podrías agregar lógica específica para cada tipo de premio
    switch (reward) {
        case 'paypal':
            // Procesar transferencia PayPal
            break;
        case 'amazon':
            // Enviar gift card de Amazon
            break;
        case 'gift-card':
            // Procesar tarjeta de regalo
            break;
    }
}

// Obtener nombre del premio
function getRewardName(rewardType) {
    const rewards = {
        'paypal': 'PayPal $5',
        'amazon': 'Gift Card Amazon $10',
        'gift-card': 'Tarjeta de Regalo'
    };
    return rewards[rewardType] || 'Premio';
}

// Añadir/quitar puntos al usuario
function addUserPoints(points, activityDescription) {
    const newPoints = Math.max(0, (userData.points || 0) + points);
    userData.points = newPoints;

    // Actualizar Firebase
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            points: newPoints,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch(error => {
            console.error('Error al actualizar puntos:', error);
            // Continuar con actualización local aunque falle Firebase
        });
    }

    // Actualizar UI inmediatamente
    updateUIWithUserData();
    
    // Mostrar notificación de éxito
    if (points > 0) {
        showRewardModal(points, activityDescription);
    }
}

// Mostrar modal de recompensa
function showRewardModal(points, description) {
    const modal = document.getElementById('reward-modal');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-description');
    const pointsElement = document.getElementById('modal-description');

    if (modal && title && pointsElement) {
        title.textContent = '¡Recompensa Obtenida!';
        pointsElement.innerHTML = `Has ganado <span class="points-earned">${points}</span> puntos por ${description.toLowerCase()}.`;
        showModal(modal);
    }
}

// Mostrar modal de confirmación
function showConfirmModal(title, description, callback) {
    const modal = document.getElementById('confirm-modal');
    
    if (modal && confirmTitle && confirmDescription) {
        confirmTitle.textContent = title;
        confirmDescription.textContent = description;
        confirmCallback = callback;
        showModal(modal);
    }
}

// Manejar aceptación de confirmación
function handleConfirmAccept() {
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
    closeAllModals();
}

// Mostrar modal
function showModal(modal) {
    document.body.classList.add('modal-open');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.classList.add('show');
        trapFocus(modal);
    }, 10);
}

// Cerrar todos los modales
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });
    
    document.body.classList.remove('modal-open');
    confirmCallback = null;
}

// Trap focus dentro del modal para accesibilidad
function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const focusHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        modal.addEventListener('keydown', focusHandler);
        firstElement.focus();

        // Limpiar event listener cuando se cierre el modal
        modal._focusHandler = focusHandler;
    }
}

// Ocultar overlay de carga
function hideLoadingOverlay() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.classList.add('fade-out');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 500);
    }
}

// Manejar logout
function handleLogout() {
    showConfirmModal(
        'Cerrar sesión', 
        '¿Estás seguro de que quieres cerrar tu sesión?',
        () => {
            auth.signOut()
                .then(() => {
                    showNotification('Sesión cerrada correctamente');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                })
                .catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                    showNotification('Error al cerrar sesión', true);
                });
        }
    );
}

// Mostrar notificación toast
function showNotification(message, isError = false) {
    // Usar el sistema de toast del CSS mejorado
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : 'success'}`;
    toast.innerHTML = `
        <i class="fas fa-${isError ? 'exclamation-circle' : 'check-circle'}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Auto-remover después de 4 segundos
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Cargar tienda de recompensas
function loadRewardsStore() {
    const storeGrid = document.querySelector('.store-grid');
    if (!storeGrid) return;

    // Los items ya están en el HTML, solo actualizar el estado
    updateRewardButtons();
}

// Manejar cambios de orientación
function handleOrientationChange() {
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            // Reajustar alturas de secciones colapsables
            const expandedSections = document.querySelectorAll('.collapsible[aria-expanded="true"]');
            expandedSections.forEach(section => {
                const content = section.querySelector('.collapsible-content');
                if (content) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            });
        }, 300);
    });
}

// Inicializar manejo de orientación
handleOrientationChange();

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
    showNotification('Ha ocurrido un error inesperado', true);
});

// Exportar funciones para uso global (si es necesario)
window.Dashboard = {
    addUserPoints,
    showNotification,
    closeAllModals
};