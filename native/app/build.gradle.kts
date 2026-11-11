plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

// The release keystore is described in ~/.gradle/gradle.properties (same keys the old
// build used). Google Drive sign-in only works for builds signed with it, because the
// OAuth client is registered against app.comma.tracker + that certificate.
val storePath = providers.gradleProperty("MYAPP_UPLOAD_STORE_FILE").orNull

android {
    namespace = "app.comma.tracker"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.comma.tracker"
        minSdk = 26
        targetSdk = 36
        // Must stay above the last React Native build (1.5.0, versionCode 11) so this
        // installs as an update over it.
        versionCode = 20
        versionName = "2.0.0"
    }

    signingConfigs {
        if (storePath != null) {
            create("release") {
                storeFile = file(storePath)
                storePassword = providers.gradleProperty("MYAPP_UPLOAD_STORE_PASSWORD").get()
                keyAlias = providers.gradleProperty("MYAPP_UPLOAD_KEY_ALIAS").get()
                keyPassword = providers.gradleProperty("MYAPP_UPLOAD_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.06.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("androidx.navigation:navigation-compose:2.9.0")

    implementation("androidx.room:room-runtime:2.7.2")
    implementation("androidx.room:room-ktx:2.7.2")
    ksp("androidx.room:room-compiler:2.7.2")

    implementation("androidx.work:work-runtime-ktx:2.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("com.google.android.gms:play-services-auth:21.4.0")
}
