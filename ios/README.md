# Soon for iPhone

A native SwiftUI app with Home Screen and Lock Screen widgets and an "on the way" Live Activity.
It talks to the website's `/api/v1`, so the website stays the one source of truth.

```
ios/
  project.yml      Xcode project, generated with XcodeGen (brew install xcodegen)
  Soon/            the app: screens, notifications, sign-in
  SoonWidgets/     widgets and the Live Activity
  Shared/          used by both: look, sunflower, API client, widget faces
  Fonts/           Newsreader, Instrument Sans and Caveat (SIL Open Font License)
```

## Run it

```sh
cd ios
xcodegen generate
open Soon.xcodeproj
```

Launch arguments for looking around without signing in:

- `-demo tachi` or `-demo annie`: sample data, no network
- `-screen weekend|calendar|plans|ask|settings`: open on that screen
- `-gallery home|lock|road`: every widget face and the Live Activity at real sizes

Every push to `main` that touches `ios/` builds the app on GitHub's Macs, runs it in the simulator
and pushes screenshots to the `ci/shots` branch.

## Push notifications

The server needs an Apple push key (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY`, `APNS_BUNDLE_ID`).
Without it the app still works; it just can't buzz the other phone or start the Live Activity there.
