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

Build: 3C preview APK, 22 Oct 2026: https://expo.dev/accounts/topues/projects/fotoai-coach/builds/3adbcd9a-6dcc-4543-854f-3e524dadfa09 (all 14 steps passed, 22 Oct 2026)

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

## 3D: Explore

Build: 3D preview APK with the phone fixes (PR #22), 24 Oct 2026: https://expo.dev/accounts/topues/projects/fotoai-coach/builds/0484c394-16db-4b97-ad71-bdc6b43e40ad (all 12 steps passed, 24 Oct 2026). Needs the Google server key in Dokploy and the Android Maps key in expo.dev.

1. Open Explore at home. The map shows, with nearby places and your spots in two colours. The list below is nearest first, with distances.
2. Tap Beaches, then Beaches again. The list changes, then goes back.
3. Search "pier". Results show for the text.
4. Tap a place. Its photo shows with "Photo: <name>" under it. Tapping that opens the photographer's page.
5. The place shows today's light times and weather. Tap "Best light and angles": the coach answers with best light and angles.
6. Tap "Open in Google Maps": Google Maps opens on that place.
7. Add notes and tap "Save to My spots". Tap "Add to favourites". Back on Today, it shows as the suggested spot.
8. On the map, press and hold an empty spot. Name the pin, add notes, save. It shows as "My spot".
9. Open the pin. Change its name and notes, save. Tap "Best light and angles". Then "Remove this spot" (the app asks first).
10. On a place, tap "Plan a shoot here". Shoot opens and says "Planning: <name>".
11. Turn on airplane mode and open Explore. Your spots still show; places show the offline note.
12. Away from home (or with no home area): tap "Use my location" when asked. Explore centres on you.
