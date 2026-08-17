# Insta Mini

Open-source Expo app that wraps Instagram’s website in a WebView. Tabs load Instagram’s own pages and hide extra chrome (nav, Explore, Reels, suggestions).

This is **not** an official Instagram client. It is not published on the Play Store or App Store. Use it for your own account.

## Install (Android)

One universal APK covers phones, tablets, and emulators on **Android 7+** (API 24). You do not need a different APK per Android version.

1. Open the latest GitHub **Releases** page for this repo.
2. Download `insta-mini-*.apk`.
3. On your phone, allow installs from this source if Android asks.
4. Open the APK and install.

## Login

Log in on Instagram’s own page inside the app.

- **Instagram username and password** usually works.
- **Continue with Facebook** may work (Facebook login hosts are allowed).
- **Continue with Google** often fails inside WebViews. Google blocks OAuth in embedded browsers. Use Instagram’s own login instead.

Login and checkpoint pages are left unstyled so Instagram’s security UI still works.

## Tabs

| Tab | Instagram page |
| --- | --- |
| Following | `https://www.instagram.com/?variant=following` |
| Stories | Same following page, with the post feed hidden so the stories tray stays |
| Messages | `https://www.instagram.com/direct/inbox/` |
| Activity | `https://www.instagram.com/accounts/activity/` |
| Search | `https://www.instagram.com/explore/search/` (Explore grid is blocked) |
| Profile | `https://www.instagram.com/{username}/` from the nav profile link |
| More | Native lists from your Following and Followers dialogs |

## Develop

Requires Node 18+.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or run a native APK build (below).

## Release an APK

Builds run on [EAS Build](https://docs.expo.dev/build/introduction/) and attach the APK to a GitHub Release. Nothing is submitted to Google Play.

### One-time setup

1. Create a free [Expo](https://expo.dev) account.
2. From this repo:

   ```bash
   npx eas-cli login
   npx eas-cli init
   ```

   That writes `extra.eas.projectId` into `app.json`. Commit that change.
3. Create an Expo access token (expo.dev → Account → Access tokens).
4. In the GitHub repo: **Settings → Secrets and variables → Actions** → add `EXPO_TOKEN`.

EAS stores the Android signing keystore on your Expo account. It is not in git. Forks need their own Expo token and keystore.

### Cut a release

```bash
git tag v1.0.1
git push origin v1.0.1
```

Or **Actions → Release APK → Run workflow**.

Locally (uploads to EAS; download the APK from the Expo build page):

```bash
npm run build:apk
```

## Limits

- Stories has no dedicated Instagram URL; that tab only filters the following page.
- The More tab reads your own Following and Followers dialogs in the WebView and compares usernames. Large accounts take time; Instagram can change those dialogs.
- Instagram can change layout, class names, or `?variant=following` at any time. Selectors live in `src/minimal.js`.
- Meta’s terms do not cover unofficial clients. Use this only for yourself. Scanning Following/Followers can look like automation, so there is a real (not guaranteed) risk of checkpoints or account restrictions — especially if you scan often.

## License

[MIT](LICENSE)
