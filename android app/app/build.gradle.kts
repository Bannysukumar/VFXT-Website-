import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

/**
 * Deployment settings come from local.properties (git-ignored) or -P flags, never from source.
 *   vfxt.tokenMainnet=0x...
 *   vfxt.tokenTestnet=0x...
 *   bscscan.apiKey=...
 *   vfxt.walletConnectProjectId=...
 * Production signing (required before distributing a deposit-ready APK):
 *   vfxt.storeFile=../keystore/vfxt-release.jks
 *   vfxt.storePassword=...
 *   vfxt.keyAlias=...
 *   vfxt.keyPassword=...
 */
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun deploySetting(name: String): String =
    (providers.gradleProperty(name).orNull ?: localProps.getProperty(name) ?: "").trim()

val releaseStoreFile = deploySetting("vfxt.storeFile")
val hasReleaseSigning = releaseStoreFile.isNotBlank() &&
    deploySetting("vfxt.storePassword").isNotBlank() &&
    deploySetting("vfxt.keyAlias").isNotBlank() &&
    deploySetting("vfxt.keyPassword").isNotBlank()

android {
    namespace = "com.vfxt.wallet"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.vfxt.wallet"
        minSdk = 26
        targetSdk = 37
        versionCode = 2
        versionName = "1.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "VFXT_TOKEN_MAINNET", "\"${deploySetting("vfxt.tokenMainnet")}\"")
        buildConfigField("String", "VFXT_TOKEN_TESTNET", "\"${deploySetting("vfxt.tokenTestnet")}\"")
        buildConfigField("String", "BSCSCAN_API_KEY", "\"${deploySetting("bscscan.apiKey")}\"")
        buildConfigField("String", "WALLETCONNECT_PROJECT_ID", "\"${deploySetting("vfxt.walletConnectProjectId")}\"")
        buildConfigField("boolean", "HAS_RELEASE_SIGNING", "$hasReleaseSigning")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile)
                storePassword = deploySetting("vfxt.storePassword")
                keyAlias = deploySetting("vfxt.keyAlias")
                keyPassword = deploySetting("vfxt.keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            versionNameSuffix = "-debug"
            isDebuggable = true
        }
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            optimization {
                enable = true
                packageScope = setOf("androidx.**", "kotlin.**", "kotlinx.**")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            // Duplicate metadata shipped by web3j / Bouncy Castle / Jackson jars.
            excludes += setOf(
                "META-INF/DISCLAIMER",
                "META-INF/INDEX.LIST",
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE.md",
                "META-INF/NOTICE.md",
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
                "META-INF/*-LICENSE",
                "META-INF/*-NOTICE",
            )
        }
    }
}

configurations.configureEach {
    // web3j's tuweni-bytes drags in Netty/Vert.x (also via Reown, which depends on web3j crypto).
    // They are server libraries that web3j's key/signing code never calls and conflict on Android.
    exclude(group = "io.netty")
    exclude(group = "io.vertx")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.biometric)
    // Audited BIP-39 / BIP-32 / secp256k1 / RLP code only; JSON-RPC is done over OkHttp in Phase 3.
    implementation(libs.web3j.crypto) {
        // tuweni-bytes drags in Netty/Vert.x for optional ByteBuf helpers that web3j's key and
        // signing code never calls. They are server libraries and conflict on Android.
        exclude(group = "io.netty")
        exclude(group = "io.vertx")
    }
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.zxing.core)
    implementation(libs.play.services.code.scanner)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.functions)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.messaging)

    // WalletConnect v2 (Reown WalletKit): pairing and relay only; all signing stays in-app.
    implementation(platform(libs.reown.bom))
    implementation(libs.reown.core)
    implementation(libs.reown.walletkit)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
