plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "np.com.laxmannepal.texttohandwriting"
    compileSdk = 36
    defaultConfig {
        applicationId = "np.com.laxmannepal.texttohandwriting"
        minSdk = 23
        targetSdk = 36
        versionCode = (System.getenv("ANDROID_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("ANDROID_VERSION_NAME") ?: "1.0.0"
    }
    signingConfigs {
        create("release") {
            val p = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!p.isNullOrBlank()) {
                storeFile = file(p)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (!System.getenv("ANDROID_KEYSTORE_PATH").isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.webkit:webkit:1.14.0")
}
