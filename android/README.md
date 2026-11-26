# HealAll Android app

The Android app is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity)
(TWA): a thin Android shell that opens healallindia.com full screen, with no
browser bar, once the site proves it owns the app. Every change to the website
reaches the app straight away, with no new Play release.

`twa-manifest.json` is the whole app definition. The Android project is
generated from it by [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
in the **Android Build** workflow (`.github/workflows/android-build.yml`), so no
generated Gradle files or keys are committed here.

| Setting | Value |
| --- | --- |
| Package | `com.healallindia.app` |
| Target SDK | 36 (Bubblewrap 1.28.0), as Play requires from Aug 31 2026 |
| Notifications | on (web push from the site shows as Android notifications) |
| Fallback | Custom Tabs, if the device has no TWA-capable browser |

## Build a release for Play

1. Add four repository secrets (Settings > Secrets and variables > Actions) for
   the **upload key**:
   - `ANDROID_KEYSTORE_BASE64`: the keystore file, `base64 -w0 upload.keystore`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

   Use one key for the life of the app. If the app was ever uploaded to Play
   with another key, use that one, because Play rejects a new upload key
   unless you ask Google to reset it. Keep a backup of the keystore and its
   passwords outside GitHub.
2. Actions > **Android Build** > Run workflow, with a version code higher than
   any uploaded before (start at 1) and a version name like `1.0.0`.
3. Download the `healall-android-release` artifact and upload
   `app-release-bundle.aab` to the Play Console.

PR and push runs sign with a throwaway key. They only check that the app
builds, and their files can't go to Play.

## Digital Asset Links

The app opens without a browser bar only when
`https://healallindia.com/.well-known/assetlinks.json` lists the SHA-256 of
every certificate the installed app can be signed with. With Play App Signing
that is two values:

- the **upload key** (printed in the workflow's run summary), and
- the **app signing key** (on the App integrity page in the Play Console).

Set both, comma-separated, in Vercel as `ANDROID_SHA256_CERT_FINGERPRINTS`
for production, then redeploy the site.

## Changing the app

Edit `twa-manifest.json` (colours, icons, shortcuts, version), open a PR, and
the workflow checks that it still builds. Icons and the splash screen are taken
from the live site's icon URLs at build time.
