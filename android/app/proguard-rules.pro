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

# ── OkHttp / Retrofit ─────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ── Gson ──────────────────────────────────────────────────────────────────────
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ── Unity Ads ─────────────────────────────────────────────────────────────────
-keep class com.unity3d.** { *; }
-keep class com.unity3d.services.** { *; }
-dontwarn com.unity3d.**
-dontwarn com.unity3d.services.**

# ── IronSource ────────────────────────────────────────────────────────────────
-keep class com.ironsource.** { *; }
-keep class com.ironsource.mediationsdk.** { *; }
-keep class com.ironsource.adapters.** { *; }
-dontwarn com.ironsource.**
-keepclassmembers class com.ironsource.** { *; }

# ── FCM / Push Notifications ──────────────────────────────────────────────────
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.installations.** { *; }

# ── Custom Capacitor Plugins (VirtualGift) ────────────────────────────────────
-keep class com.virtualgift.UnityAdsPlugin { *; }
-keep class com.virtualgift.IronSourcePlugin { *; }
-keep class com.virtualgift.ConsentPlugin { *; }
