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

## 3E: Shoot and the offline field mode

Build: the 3E fix preview APK (PR link and APK link added when it is built). No server change. Before it: a film camera in Me > My gear, then Me > Loadout: pick that camera and its lens, fill in Film stock and Box ISO, and tap "Save loadout".

1. In Explore, open a place and tap "Plan a shoot here". Shoot shows New plan with the place, Today, and your loadout. Tap "Make the plan". The plan opens with its steps and their times.
2. Go back to Shoot. "My plans" lists the new plan.
3. On Shoot, tap "Load a film roll". Your loadout's film is chosen. Set Rated ISO to twice the box ISO: it says "+1 stop push". Pick 36 and tap "Load the roll". The roll screen says "Next frame 1 of 36 · 36 left".
4. Turn on airplane mode. Open the plan from "My plans": it opens with its steps. (It still shows the place name: the app has it in memory until it is closed.)
5. Tap "Done" on step 1 and "Skip" on step 2. They change at once. Shoot shows "2 changes waiting to send".
6. On step 1, tap "Log a frame". The roll opens with the step's settings filled in. Save frame. Tap "Full sun": aperture and shutter fill in. Save 2 more frames. The counter says "Next frame 4 of 36".
7. Close the app fully (swipe it away from recent apps), then open it again, still in airplane mode. You are still signed in. Shoot shows the roll card, "My plans" with the plan, and "2 changes waiting to send" (or more, with the frames). Open the plan: where the place name was, it says "Saved on this phone" (Google place names are never kept on the phone). Open the roll: its 3 frames are there.
8. Turn airplane mode off. Within a minute the badge clears (the changes are sent once). To check the server has them: Me > Settings > Sign out, sign in again, and open the plan and the roll. Step 1 is done, step 2 skipped, and the roll shows 3 frames.
9. With airplane mode on, log one frame, then tap Me > Settings > "Sign out": the app asks first ("1 change is not sent yet"). Tap Cancel.
10. Turn airplane mode off. On the roll, tap "Finish roll": it says "This roll is finished".
11. Away from your home area, with location allowed (or not yet asked): open Explore. The first time, Android asks for location; tap "While using the app". The map centres on where you are now (the blue dot), not on your home area. Tap "Don't allow" instead (on a fresh install): Explore uses your home area.
12. Stay offline for more than an hour (airplane mode), then close and reopen the app: you are still signed in and your saved plans show. Turn airplane mode off: the waiting changes send without a new sign-in.

## Today: weather pictures and sun path

Build: the preview APK from PR #29 "feat(mobile): weather pictures and sun path on Today". No server change.

1. Open Today. Without scrolling you see: the weather and light card, the challenge, the suggested spot (if you have a favourite spot) and "Plan my shoot". The weather picture grows to use the free space, so there is no large empty gap under "Plan my shoot". The round Coach button sits on the right of "Plan my shoot" and does not cover it.
2. The top of the card is a moving picture of the weather now (for example sun for "Clear", drops for "Rain"). On it, on the left: the place, the temperature, the weather word, and cloud and wind.
3. Under it: the countdown in a coloured box (golden or blue) with its times, and a small sun path beside it. In daylight a sun dot glows on the arc.
4. The table has Blue, Golden and Sun for Morning and Evening. Each cell shows a big start time with "to" and the end time under it; the Sun cells show the time with "Rise" or "Set" under it. The next (or current) golden or blue time is marked.
5. The challenge is one row with "Continue" (or "New challenge") on the right.
6. After sunset, with clear or partly cloudy weather, the picture shows the moon and stars.
7. Turn on Settings > Accessibility > Remove animations (the name can differ by phone), then open Today again. The picture shows but does not move. Turn it off again.
8. Me > Settings: try "Golden dark" and "Camera body". The card still reads well.
9. Explore: open a place. It shows the same card (without the place name, which is the page title).

## 3F: Photos and the Coach

Build: the 3F preview APK (PR link and APK link added when it is built). The server part (PR #30) is already live. Before it: a few photos from your camera's phone app (they have the camera settings and the place), a film roll on Shoot with 3 or more logged frames, and 3 film scans in the gallery.

1. Photos > "Import photos". Pick 3 photos from your camera's phone app folder. They show as "Waiting to upload", then in the grid. Open one: the camera, the settings and the time it was taken show. Write down if the lens and the place (coordinates) show too. Android's photo picker may hide them from the app; if they are missing, that becomes a fix task.
2. Turn on airplane mode. Import 2 photos: they show at once as "Waiting to upload". Close the app fully, then open it again: the 2 photos still wait. Turn airplane mode off: each photo uploads once (2 new photos in the grid, not 4).
3. Import one of the same photos again. The app says "Already imported".
4. Open a photo taken during a plan step (within 45 minutes of the step's time). It says "Near" the plan's place and links to that step.
5. Open a film roll and tap "Add scans". Pick 3 scans in frame order. The pairing screen shows scan 1 beside frame 1, and so on. Tap scan 1, then the frame of scan 2: they swap. Tap "Save pairs". The roll's Scans list shows the swapped frame numbers.
6. Open one photo. Tap "Critique": it says "Working…", then the scores and the feedback show. Then tap "Editing tips" and "How to recreate". The 3 results show newest first. Turn on airplane mode: the results still show and the buttons say "Needs a signal". Turn it off.
7. Tap the Coach button and ask "Give me a challenge for this evening". The reply has a challenge with "Open challenge". Tap it: the challenge opens.
8. In Explore, open a place. Tap the Coach button and ask "Plan a shoot here on Saturday". Tap "Plan this shoot": Shoot shows New plan with that place, and Saturday's date in "Or another date".
9. Open the Coach, tap the menu (…), then "Clear history". It asks first. Tap "Clear": the chat says "No messages yet".
10. The Coach button shows on a plan, a roll, a place and a photo screen. Sign out: the sign-in screen has no Coach button.
