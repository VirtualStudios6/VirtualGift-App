package com.virtualgift;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ConsentPlugin — Muestra un bottom sheet nativo de consentimiento GDPR.
 * Se renderiza ENCIMA del WebView (capa nativa Android), no dentro de él.
 * Guarda la decisión en SharedPreferences.
 */
@CapacitorPlugin(name = "Consent")
public class ConsentPlugin extends Plugin {

    private static final String PREFS_NAME = "vg_consent";
    private static final String KEY_EXISTS      = "consent_given";
    private static final String KEY_PERSONALIZED = "personalized";

    // ── Utilidad: dp → px ─────────────────────────────────
    private int dp(float value) {
        return Math.round(value * getContext().getResources().getDisplayMetrics().density);
    }

    // ── Verificar si ya se dio consentimiento ──────────────
    @PluginMethod
    public void checkConsent(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject res = new JSObject();
        res.put("exists",       prefs.getBoolean(KEY_EXISTS, false));
        res.put("personalized", prefs.getBoolean(KEY_PERSONALIZED, false));
        call.resolve(res);
    }

    // ── Mostrar bottom sheet nativo ────────────────────────
    @PluginMethod
    public void showConsentSheet(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) { call.reject("No activity"); return; }

        activity.runOnUiThread(() -> {
            Dialog dialog = new Dialog(activity);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            dialog.setCancelable(false);

            // ── Contenedor principal ───────────────────────
            LinearLayout root = new LinearLayout(activity);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setPadding(dp(20), dp(28), dp(20), dp(32));

            // Fondo oscuro con esquinas superiores redondeadas
            GradientDrawable rootBg = new GradientDrawable();
            rootBg.setColor(Color.parseColor("#0D0720"));
            rootBg.setCornerRadii(new float[]{ dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0 });
            root.setBackground(rootBg);

            // ── Handle (barra decorativa top) ─────────────
            View handle = new View(activity);
            GradientDrawable handleBg = new GradientDrawable();
            handleBg.setColor(Color.parseColor("#4A2080"));
            handleBg.setCornerRadius(dp(4));
            handle.setBackground(handleBg);
            LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(40), dp(4));
            handleParams.gravity = Gravity.CENTER_HORIZONTAL;
            handleParams.setMargins(0, 0, 0, dp(20));
            handle.setLayoutParams(handleParams);
            root.addView(handle);

            // ── Fila de título ────────────────────────────
            LinearLayout titleRow = new LinearLayout(activity);
            titleRow.setOrientation(LinearLayout.HORIZONTAL);
            titleRow.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams titleRowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            titleRowParams.setMargins(0, 0, 0, dp(14));
            titleRow.setLayoutParams(titleRowParams);

            TextView emojiView = new TextView(activity);
            emojiView.setText("🔒");
            emojiView.setTextSize(20);
            emojiView.setPadding(0, 0, dp(10), 0);

            TextView titleView = new TextView(activity);
            titleView.setText("Tu privacidad importa");
            titleView.setTextColor(Color.WHITE);
            titleView.setTextSize(17);
            titleView.setTypeface(null, Typeface.BOLD);

            titleRow.addView(emojiView);
            titleRow.addView(titleView);
            root.addView(titleRow);

            // ── Línea divisoria ───────────────────────────
            View divider = new View(activity);
            divider.setBackgroundColor(Color.parseColor("#2A1A4A"));
            LinearLayout.LayoutParams divParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
            divParams.setMargins(0, 0, 0, dp(16));
            divider.setLayoutParams(divParams);
            root.addView(divider);

            // ── Cuerpo del texto ──────────────────────────
            TextView body = new TextView(activity);
            body.setText(
                "VirtualGift usa tecnologías de seguimiento para:\n\n" +
                "  •  Anuncios personalizados (Unity Ads)\n" +
                "  •  Encuestas y ofertas (CPX Research, Offermaru)\n" +
                "  •  Análisis de uso (Firebase Analytics)\n\n" +
                "Puedes cambiar tu preferencia en cualquier momento desde tu perfil."
            );
            body.setTextColor(Color.parseColor("#B8A8D8"));
            body.setTextSize(13.5f);
            body.setLineSpacing(dp(4), 1.0f);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            bodyParams.setMargins(0, 0, 0, dp(24));
            body.setLayoutParams(bodyParams);
            root.addView(body);

            // ── Fila de botones ───────────────────────────
            LinearLayout btnRow = new LinearLayout(activity);
            btnRow.setOrientation(LinearLayout.HORIZONTAL);
            btnRow.setWeightSum(2f);

            // Botón "Solo esenciales"
            Button btnDecline = new Button(activity);
            btnDecline.setText("Solo esenciales");
            btnDecline.setTextColor(Color.parseColor("#B8A8D8"));
            btnDecline.setTextSize(13f);
            btnDecline.setTypeface(null, Typeface.BOLD);
            btnDecline.setAllCaps(false);
            GradientDrawable declineBg = new GradientDrawable();
            declineBg.setColor(Color.parseColor("#1E0A3C"));
            declineBg.setCornerRadius(dp(14));
            declineBg.setStroke(dp(1), Color.parseColor("#4A2080"));
            btnDecline.setBackground(declineBg);
            LinearLayout.LayoutParams declineParams = new LinearLayout.LayoutParams(0, dp(50), 1f);
            declineParams.setMargins(0, 0, dp(8), 0);
            btnDecline.setLayoutParams(declineParams);

            // Botón "Aceptar todo"
            Button btnAccept = new Button(activity);
            btnAccept.setText("Aceptar todo");
            btnAccept.setTextColor(Color.WHITE);
            btnAccept.setTextSize(13f);
            btnAccept.setTypeface(null, Typeface.BOLD);
            btnAccept.setAllCaps(false);
            GradientDrawable acceptBg = new GradientDrawable();
            acceptBg.setColors(new int[]{ Color.parseColor("#7C3AED"), Color.parseColor("#A855F7") });
            acceptBg.setOrientation(GradientDrawable.Orientation.LEFT_RIGHT);
            acceptBg.setCornerRadius(dp(14));
            btnAccept.setBackground(acceptBg);
            LinearLayout.LayoutParams acceptParams = new LinearLayout.LayoutParams(0, dp(50), 1f);
            acceptParams.setMargins(dp(8), 0, 0, 0);
            btnAccept.setLayoutParams(acceptParams);

            // ── Listeners ─────────────────────────────────
            btnDecline.setOnClickListener(v -> {
                saveConsent(false);
                dialog.dismiss();
                JSObject res = new JSObject();
                res.put("personalized", false);
                call.resolve(res);
            });

            btnAccept.setOnClickListener(v -> {
                saveConsent(true);
                dialog.dismiss();
                JSObject res = new JSObject();
                res.put("personalized", true);
                call.resolve(res);
            });

            btnRow.addView(btnDecline);
            btnRow.addView(btnAccept);
            root.addView(btnRow);

            dialog.setContentView(root);

            // ── Posicionar en la parte inferior ───────────
            Window window = dialog.getWindow();
            if (window != null) {
                window.setLayout(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.WRAP_CONTENT
                );
                window.setGravity(Gravity.BOTTOM);
                window.setBackgroundDrawableResource(android.R.color.transparent);
                // Animación slide-up nativa del sistema
                window.getAttributes().windowAnimations = android.R.style.Animation_InputMethod;
            }

            dialog.show();
        });
    }

    // ── Guardar decisión en SharedPreferences ──────────────
    private void saveConsent(boolean personalized) {
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_EXISTS, true)
            .putBoolean(KEY_PERSONALIZED, personalized)
            .apply();
    }
}
