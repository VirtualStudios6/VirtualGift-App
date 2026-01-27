// ==================== VALIDATORS ====================
// Validaciones mejoradas para formularios
// ====================================================

window.Validators = {
  /**
   * Valida correo electrónico
   */
  email: function(email) {
    if (!email || email.trim() === '') {
      return { valid: false, message: 'El correo es requerido' };
    }

    var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      return { valid: false, message: 'Correo electrónico inválido' };
    }

    return { valid: true, message: '' };
  },

  /**
   * Valida nombre de usuario
   */
  username: function(username) {
    if (!username || username.trim() === '') {
      return { valid: false, message: 'El nombre de usuario es requerido' };
    }

    var trimmed = username.trim();

    if (trimmed.length < 3) {
      return { valid: false, message: 'Mínimo 3 caracteres' };
    }

    if (trimmed.length > 20) {
      return { valid: false, message: 'Máximo 20 caracteres' };
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return { valid: false, message: 'Solo letras, números, guiones y guión bajo' };
    }

    if (/^[0-9]/.test(trimmed)) {
      return { valid: false, message: 'No puede empezar con número' };
    }

    return { valid: true, message: '' };
  },

  /**
   * Valida contraseña
   */
  password: function(password) {
    if (!password) {
      return { valid: false, message: 'La contraseña es requerida', strength: 0 };
    }

    if (password.length < 8) {
      return { valid: false, message: 'Mínimo 8 caracteres', strength: 0 };
    }

    var strength = 0;

    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 25;

    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Debe incluir minúsculas', strength: strength };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Debe incluir mayúsculas', strength: strength };
    }

    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Debe incluir números', strength: strength };
    }

    return { valid: true, message: '', strength: strength };
  },

  /**
   * Valida que las contraseñas coincidan
   */
  passwordsMatch: function(password, confirmPassword) {
    if (!confirmPassword) {
      return { valid: false, message: 'Confirma tu contraseña' };
    }

    if (password !== confirmPassword) {
      return { valid: false, message: 'Las contraseñas no coinciden' };
    }

    return { valid: true, message: '' };
  }
};

console.log('✅ Validators cargado');
