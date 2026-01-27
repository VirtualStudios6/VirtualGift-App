// ==================== ERROR HANDLER ====================
// Manejo centralizado de errores
// ======================================================

window.ErrorHandler = {
  /**
   * Maneja cualquier error y muestra mensaje apropiado al usuario
   */
  handle: function(error, context, showToUser) {
    context = context || '';
    showToUser = showToUser !== false; // por defecto true

    // Log para desarrolladores
    console.error('[' + context + ']', error);

    // Obtener mensaje para el usuario
    var userMessage = this.getUserMessage(error);

    // Mostrar al usuario si es necesario
    if (showToUser && typeof NotificationManager !== 'undefined') {
      NotificationManager.show(userMessage, 'error');
    }

    return userMessage;
  },

  /**
   * Convierte errores técnicos en mensajes amigables
   */
  getUserMessage: function(error) {
    // Errores de Firebase Auth
    if (error.code && error.code.indexOf('auth/') === 0) {
      return this.getAuthErrorMessage(error.code);
    }

    // Errores de Firestore
    if (error.code === 'permission-denied') {
      return 'No tienes permiso para realizar esta acción';
    }

    if (error.code === 'unavailable') {
      return 'Servicio no disponible. Intenta de nuevo en unos momentos';
    }

    // Error genérico
    return error.message || 'Ha ocurrido un error. Por favor, intenta de nuevo';
  },

  /**
   * Mensajes de error de Firebase Auth en español
   */
  getAuthErrorMessage: function(code) {
    var messages = {
      // Registro
      'auth/email-already-in-use': 'Este correo ya está registrado',
      'auth/invalid-email': 'Correo electrónico inválido',
      'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres)',

      // Login
      'auth/user-not-found': 'No existe una cuenta con este correo',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',

      // Red
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos',

      // OAuth
      'auth/popup-blocked': 'Permite ventanas emergentes en tu navegador',
      'auth/popup-closed-by-user': 'Cerraste la ventana de inicio de sesión',
      'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este correo',
      'auth/unauthorized-domain': 'Dominio no autorizado. Contacta al administrador',
      'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado',

      // Otros
      'auth/invalid-action-code': 'El código de verificación no es válido',
      'auth/expired-action-code': 'El código de verificación ha expirado',
      'auth/requires-recent-login': 'Por seguridad, inicia sesión de nuevo'
    };

    return messages[code] || 'Error: ' + code;
  }
};

console.log('✅ ErrorHandler cargado');
