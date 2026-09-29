#!/usr/bin/env bash
# Installs the APK, opens the app, waits, then reports whether it is still running.
set -u
APK="$1"
PKG=com.palaismental.app

adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
sleep 45
adb logcat -d > smoke-logcat.txt
adb exec-out screencap -p > smoke-screen.png || true

echo "===== crash / JS errors ====="
grep -E "FATAL|AndroidRuntime|ReactNativeJS|ReactNative|libc|DEBUG  |Exception|Error" smoke-logcat.txt | grep -v "^.*W/.*GoogleApi" | head -300

if adb shell pidof "$PKG" > /dev/null; then
  echo "===== app alive ====="
else
  echo "===== app DIED ====="
  exit 1
fi
