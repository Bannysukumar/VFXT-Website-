pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Reown WalletKit transitive deps that are only published on JitPack.
        maven("https://jitpack.io") {
            content {
                includeGroup("com.walletconnect.Scarlet")
                includeGroup("com.github.multiformats")
                includeGroupByRegex("com\\.github\\.komputing.*")
                includeGroupByRegex("com\\.github\\.reown-com.*")
                includeGroupByRegex("com\\.github\\.WalletConnect.*")
            }
        }
    }
}

rootProject.name = "VFXT Wallet"
include(":app")
