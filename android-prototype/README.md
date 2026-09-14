# Sri Lanka Scrabble Academy Android prototype

A lightweight Android shell for the existing SLSA website:

https://prop4life.github.io/srilankascrabbleacademy/

## Prototype features

- Branded Android launcher and full-screen presentation
- Secure HTTPS-only WebView
- Internal navigation stays in the app
- WhatsApp, telephone, email and unrelated web links open in their appropriate apps
- Progress indicator and friendly connection-error screen
- Back-button browser history
- SSL errors are never bypassed
- Android 6.0+ support; target API 36

## Open and test

1. Install the current stable Android Studio.
2. Open the `android-prototype` folder as a project.
3. Allow Gradle sync to finish.
4. Run the `app` configuration on an emulator or Android phone.

Command-line build with Gradle 8.13:

```bash
gradle :app:assembleDebug
```

The debug APK will be written to:

`app/build/outputs/apk/debug/app-debug.apk`

## Before Google Play release

Replace the prototype vector launcher with production SLSA artwork in all required densities,
test on several phones and tablets, add a privacy-policy URL, create a signed release key,
and upload an Android App Bundle generated with `:app:bundleRelease`.

The app intentionally does not collect or store form data. The current website sends completed
registration details through WhatsApp.
