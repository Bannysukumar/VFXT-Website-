# VFXT Wallet release keep rules — keys/signing must never be broken by shrinking.

-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, AnnotationDefault
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Kotlin / serialization
-dontwarn kotlin.**
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class ** {
    @kotlinx.serialization.Serializable <fields>;
}
-keep @kotlinx.serialization.Serializable class ** { *; }

# Hilt / Dagger
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Web3j crypto / RLP / ABI — used for signing and encoding
-keep class org.web3j.** { *; }
-dontwarn org.web3j.**
-dontwarn org.bouncycastle.**
-keep class org.bouncycastle.** { *; }

# App domain models & blockchain types referenced reflectively / via serialization
-keep class com.vfxt.wallet.domain.models.** { *; }
-keep class com.vfxt.wallet.data.local.** { *; }
-keep class com.vfxt.wallet.blockchain.networks.** { *; }

# Keep Parcelables / enums
-keepclassmembers enum * { *; }
