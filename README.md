# Insta Mini

Personal Expo app that wraps Instagram’s website. Five tabs load Instagram’s own pages and hide the extra chrome (nav, Explore, Reels, suggestions).

This is for your own account. It is not an official Instagram client.

## Tabs

| Tab | Instagram page |
| --- | --- |
| Following | `https://www.instagram.com/?variant=following` |
| Stories | Same following page, with the post feed hidden so the stories tray stays |
| Messages | `https://www.instagram.com/direct/inbox/` |
| Search | `https://www.instagram.com/explore/search/` (Explore grid is blocked) |
| Profile | `https://www.instagram.com/{username}/` from the `ds_user` cookie |

## Login

Log in on Instagram’s own page inside the app.

- **Instagram username and password** usually works.
- **Continue with Facebook** may work (Facebook login hosts are allowed).
- **Continue with Google** often fails inside WebViews. Google blocks OAuth in embedded browsers. Use Instagram’s own login instead.

Login and checkpoint pages are left unstyled so Instagram’s security UI still works.

## Run

Requires Node 18+ and the Expo Go app on your phone.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android or iOS).

## Limits

- Stories has no dedicated Instagram URL; that tab only filters the following page.
- Instagram can change layout, class names, or `?variant=following` at any time. Selectors live in `src/minimal.js`.
- Meta’s terms do not cover unofficial clients. Use this only for yourself.
