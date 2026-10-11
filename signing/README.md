# Signing

Android installs an update over an existing app only when both APKs are signed with the same key. Every release is signed with `palais-mental.keystore`.

- **How:** the build (`.github/workflows/android-release.yml`) copies it over `android/app/debug.keystore`, the key Expo's template signs release builds with, then checks the APK's certificate and fails if it isn't this one.
- **Which key:** React Native's standard debug key (alias `androiddebugkey`, passwords `android`). It is public, which is fine for sideloaded builds.
  - SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
  - SHA-1 `5e:8f:16:06:2e:a3:cd:2c:4a:0d:54:78:76:ba:a6:f3:8c:ab:f6:25`
- **Changing it:** possible, but Android treats a new key as a different app, so that one update needs an uninstall. Export a backup first.
