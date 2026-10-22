# FotoAI Android: phone checklist

Core-loop testing on the phone is manual for v1 (spec section 5.13). Tick each item on the APK
build named at the top of the section, and report any failure with the step number.

## 3A: foundation

Build: first preview APK, 20 Oct 2026: https://expo.dev/accounts/topues/projects/fotoai-coach/builds/61ffb00d-9a6f-43e6-b9bb-170250397446

1. Install the APK from the EAS link (allow installs from this source if Android asks).
2. Open FotoAI. The sign-in screen shows, in the Golden light look (or Golden dark if the phone is in dark mode).
3. Create an account with a second email address. The app shows "Check your email".
4. Open the email on the phone and tap the link. The web page confirms the address.
5. Back in the app, sign in with the new account. Today shows, with 5 tabs at the bottom.
6. Tap each tab: Today, Explore, Shoot, Photos, Me. The round Coach button is on every one and opens a sheet.
7. On Me, the email shows. Switch Appearance to Golden dark, then Camera body, then Auto. The colours change each time.
8. Close the app fully and open it again. You are still signed in and the theme choice is kept.
9. Turn on airplane mode and pull Today again (or switch tabs). The offline note shows, not a crash.
10. Turn airplane mode off. Sign out on Me. The sign-in screen shows.
11. Tap "Forgot password?", send the link, open it on the phone. Until 3B ships the App Link file, it opens the web reset page: finish it there, then sign in in the app with the new password.
12. Sign in with a wrong password. "Wrong email or password." shows.

## 3B: server gaps

Build: the 3A preview APK, reinstalled after the 3B deploy (Android checks App Links at install). Passed 20 Oct 2026.

1. Reinstall the APK. Sign out, tap "Forgot password?" and send the link.
2. Tap the link in the email on the phone. The app opens on the New password screen (not the web page).

## 3C: Today and Me

Build: the 3C preview APK (link added when it is built).

1. Install the APK over the old one. Sign in with an account that has gear. Today opens (no onboarding).
2. Today without a home area: allow location when asked. The light card says "Light at Where you are", with a countdown and the light times.
3. The weather shows in °C, with "Weather data by …" under it. If the weather is down, "Weather unavailable" shows.
4. With no active challenge, tap New challenge. A new challenge shows on Today.
5. Tap Continue. Accept the challenge, then Complete it. The status says Completed.
6. Open Me. The challenges count and the XP bar went up. Open Skills: the skills show by category.
7. Me > My gear > Add from the catalog: search "fuji", add one lens. It shows "Owned". Remove it again (the app asks first).
8. Me > My gear > Add custom gear: a lens with smallest aperture f/2 and widest f/2.8. The app says the aperture range is not possible.
9. Me > Loadout: pick the Nikon FE2 with a Fujifilm lens. The misfit message shows under the picker. Pick a fitting lens, add a film stock and box ISO, save.
10. Me > Settings: choose Camera body. Close the app fully and open it: Camera body shows at once, with no flash of another theme.
11. Settings: switch to Imperial. Today shows °F and mph.
12. Settings > Home area > Use my location, name it, save. Today now says "Light at <name>".
13. Turn on airplane mode and reopen Today and Me. The saved answers show with "Last updated <time>".
14. Sign out on Settings. Sign in with a new account with no gear. Onboarding shows: add one camera, skip the home area. Today opens. Sign out and in again: onboarding does not come back.
