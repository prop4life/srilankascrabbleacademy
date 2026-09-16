# Sri Lanka Scrabble Academy Android app

A lightweight Android shell for the existing SLSA website:

https://prop4life.github.io/srilankascrabbleacademy/

## App features

- Branded Android launcher and full-screen presentation
- Secure HTTPS-only WebView
- Internal navigation stays in the app
- WhatsApp, telephone, email and unrelated web links open in their appropriate apps
- Progress indicator and friendly connection-error screen
- Back-button browser history
- Native quick navigation for Home, Events, Membership and Privacy
- Native Android sharing
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

## Google Play release

The production package ID is `lk.slsa.academy`, version 1.0.0 targets API 36, and the
in-app Privacy button points to the public SLSA privacy-policy URL. Before uploading,
create and securely retain an upload key, generate a signed Android App Bundle with
`:app:bundleRelease`, and complete the Play Console declarations documented in
`play-store/listing.md`.

The app intentionally does not collect or store form data. The current website sends completed
registration details through WhatsApp.
