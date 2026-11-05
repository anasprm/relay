VALIYAKATH ANDROID APP PROJECT
==============================

This is an Android Studio project for an app that opens the official Valiyakath website:
https://valiyakath.vercel.app/

It does not change the original website project. It uses Android WebView and accepts website cookies / local storage so the original website can maintain a session if its authentication implementation supports it. The app does not save or collect passwords itself.

IMPORTANT
---------
This ZIP is Android source code, not a compiled APK. This environment does not have the Android build toolchain installed, so I cannot honestly label this file as an APK. To install on a phone, build the APK using one of the methods below.

BUILD USING ANDROID STUDIO
1. Install Android Studio on a Windows computer.
2. Extract this ZIP.
3. In Android Studio choose Open and select the extracted folder.
4. Let Gradle sync and install any requested Android SDK (API 35).
5. Select Build > Build Bundle(s) / APK(s) > Build APK(s).
6. Find the APK at app/build/outputs/apk/debug/app-debug.apk.
7. Transfer the APK to your Android phone and tap it to install. Android may ask you to allow installation from that source.

BUILD USING GITHUB ACTIONS
1. Create a new GitHub repository and upload all files from this project.
2. Open the repository's Actions tab.
3. Select "Build Valiyakath APK" and run the workflow, or push to main.
4. When it finishes, open the workflow run and download the "Valiyakath-Android-APK" artifact.
5. Extract the artifact ZIP to get app-debug.apk.

LOGIN SESSION
-------------
The app keeps WebView cookies and website storage. Whether it opens directly into the signed-in account depends on Valiyakath's server-side authentication and session expiry rules. It cannot bypass those rules.

SECURITY
--------
Only enter credentials on the official Valiyakath domain. This app is a simple website wrapper; it does not provide an independent login system.
