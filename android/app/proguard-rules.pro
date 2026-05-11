# ── Capacitor Bridge ──────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod *;
}

# ── Firebase ──────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── @capacitor-firebase/authentication ────────────────────────────────────────
-keep class io.capawesome.capacitorjs.plugins.firebase.** { *; }

# ── Facebook SDK (compileOnly — no incluido en APK, ignorar referencias) ──────
-dontwarn com.facebook.**
-dontwarn com.facebook.login.**
-dontwarn com.facebook.AccessToken
-dontwarn com.facebook.CallbackManager

# ── WebView JS Interface ───────────────────────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Mantener info de línea para crash reports legibles ────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Kotlin / Coroutines (usados por plugins nativos) ──────────────────────────
-dontwarn kotlin.**
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }

# ── Unity Ads SDK ─────────────────────────────────────────────────────────────
-keep class com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
-dontwarn com.unity3d.ads.**
-dontwarn com.unity3d.services.**

# ── Google Mobile Ads SDK (AdMob) ─────────────────────────────────────────────
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
-keepattributes *Annotation*

# ── OkHttp / Retrofit (usado por SDKs de anuncios para llamadas de red) ───────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Gson (serialización de respuestas de red en SDKs de anuncios) ─────────────
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
