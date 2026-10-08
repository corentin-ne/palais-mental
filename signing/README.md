# Signing

Android installs an update over an existing app only when both APKs are signed with the same key.
Every Palais Mental release is signed with `palais-mental.keystore`:

- the build (`.github/workflows/android-release.yml`) copies it over `android/app/debug.keystore`, the key
  Expo's template signs release builds with, so a template change can never change it;
- the build then checks the APK's certificate and fails if it is not this one.

Certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
(SHA-1 `5e:8f:16:06:2e:a3:cd:2c:4a:0d:54:78:76:ba:a6:f3:8c:ab:f6:25`): React Native's standard debug key, which
signed every release up to 1.4.0. It is public (alias `androiddebugkey`, passwords `android`), fine for sideloaded
builds. Moving to a private key later is possible, but that one change needs an uninstall (export a backup first):
Android treats a new key as a different app.
