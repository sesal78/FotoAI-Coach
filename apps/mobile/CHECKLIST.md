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
