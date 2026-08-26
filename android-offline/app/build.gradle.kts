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
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

