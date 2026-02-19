// js/validators.js
// ==================== VALIDATORS ====================
// Validaciones reutilizables para formularios VirtualGift
// =====================================================

window.Validators = {

  /**
   * Valida correo electrónico
   * @param {string} email
   * @returns {{ valid: boolean, message: string }}
   */
  email(email) {
    const e = String(email || "").trim();
    if (!e) return { valid: false, message: "El correo es requerido" };

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(e)) return { valid: false, message: "Correo electrónico inválido" };

    return { valid: true, message: "" };
  },

  /**
   * Valida nombre de usuario (login/registro)
   * Reglas: 3–20 chars, solo letras/números/guion/guion-bajo, no inicia con número
   * @param {string} username
   * @returns {{ valid: boolean, message: string }}
   */
  username(username) {
    const u = String(username || "").trim();
    if (!u)          return { valid: false, message: "El nombre de usuario es requerido" };
    if (u.length < 3)  return { valid: false, message: "Mínimo 3 caracteres" };
    if (u.length > 20) return { valid: false, message: "Máximo 20 caracteres" };

    if (!/^[a-zA-Z0-9_-]+$/.test(u))
      return { valid: false, message: "Solo letras, números, guiones y guión bajo" };

    if (/^[0-9]/.test(u))
      return { valid: false, message: "No puede empezar con número" };

    return { valid: true, message: "" };
  },

  /**
   * Valida nombre para mostrar (displayName / perfil)
   * Reglas: 2–40 chars, permite cualquier carácter excepto < > { }
   * @param {string} name
   * @returns {{ valid: boolean, message: string }}
   */
  displayName(name) {
    const n = String(name || "").trim();
    if (!n)           return { valid: false, message: "El nombre es requerido" };
    if (n.length < 2)  return { valid: false, message: "Mínimo 2 caracteres" };
    if (n.length > 40) return { valid: false, message: "Máximo 40 caracteres" };

    if (/[<>{}]/.test(n))
      return { valid: false, message: "El nombre contiene caracteres no permitidos" };

    return { valid: true, message: "" };
  },

  /**
   * Valida contraseña
   * Calcula strength (0–100) e indica el primer requisito que falla
   * @param {string} password
   * @returns {{ valid: boolean, message: string, strength: number }}
   */
  password(password) {
    const p = String(password || "");

    if (!p)          return { valid: false, message: "La contraseña es requerida", strength: 0 };
    if (p.length < 8) return { valid: false, message: "Mínimo 8 caracteres",         strength: 0 };

    // Calcular fortaleza (0–100)
    let strength = 0;
    if (/[a-z]/.test(p)) strength += 25;
    if (/[A-Z]/.test(p)) strength += 25;
    if (/[0-9]/.test(p)) strength += 25;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) strength += 25;

    // Requisitos mínimos obligatorios
    if (!/[a-z]/.test(p)) return { valid: false, message: "Debe incluir minúsculas", strength };
    if (!/[A-Z]/.test(p)) return { valid: false, message: "Debe incluir mayúsculas", strength };
    if (!/[0-9]/.test(p)) return { valid: false, message: "Debe incluir números",    strength };

    return { valid: true, message: "", strength };
  },

  /**
   * Valida que las contraseñas coincidan
   * @param {string} password
   * @param {string} confirmPassword
   * @returns {{ valid: boolean, message: string }}
   */
  passwordsMatch(password, confirmPassword) {
    if (!confirmPassword)      return { valid: false, message: "Confirma tu contraseña" };
    if (password !== confirmPassword) return { valid: false, message: "Las contraseñas no coinciden" };
    return { valid: true, message: "" };
  },

};
