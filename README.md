# Outdoor Cat Tracker

Outdoor Cat Tracker is a mobile application built with Expo, React Native, TypeScript, and Firebase. It is designed to help users monitor outdoor pets with live location views, geofence-based safe zone alerts, multi-pet account support, and pet profile management.

The app currently includes:
- Firebase Authentication for account login and signup
- Firestore-backed user and pet profiles
- Multi-pet support with active pet switching
- Shared homebase / geofence management
- Live map and dashboard views powered by tracker API data
- Geofence exit and return notifications

## Tech Stack

- Expo
- React Native
- TypeScript
- Firebase Auth
- Firestore
- Firebase Storage
- React Navigation
- Expo Location
- Expo Notifications
- React Native Maps

## Project Structure

- [`App.tsx`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/App.tsx) boots the app
- [`src/navigation`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/navigation) contains auth and app navigation
- [`src/screens/auth`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/screens/auth) contains welcome, login, register, and reset screens
- [`src/screens/dashboard`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/screens/dashboard) contains the dashboard
- [`src/screens/map`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/screens/map) contains live tracking and alert logic
- [`src/screens/settings`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/screens/settings) contains profile, pet, and safe zone management
- [`src/config/firebase.ts`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/config/firebase.ts) contains Firebase client configuration

## Requirements

Install the following before running the app:

- Git
- Node.js LTS
- npm
- Expo Go on a physical device, or Android Studio / Xcode for emulator or simulator testing

Verify installation:

```bash
git --version
node -v
npm -v
npx expo --version
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/quangminhtra/Outdoor-CatTracker.git
cd Outdoor-CatTracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the Expo development server

```bash
npx expo start
```

You can also use the package scripts:

```bash
npm run start
npm run android
npm run ios
```

## Run on Android

### Physical device

1. Install Expo Go from Google Play.
2. Run:

```bash
npx expo start
```

3. Scan the QR code from the Expo terminal.

### Android emulator

1. Install Android Studio.
2. Create and start an Android Virtual Device.
3. Run:

```bash
npm run android
```

## Run on iOS

### Physical device

1. Install Expo Go from the App Store.
2. Run:

```bash
npx expo start
```

3. Scan the QR code using the Camera app.

### iOS simulator

Mac only:

1. Install Xcode.
2. Open an iOS Simulator.
3. Run:

```bash
npm run ios
```

## Firebase Notes

This project is already wired to a Firebase project through [`src/config/firebase.ts`](/E:/School%20/Winter%20term/Outdoor%20CatTracker/outdoor-cat-tracker/src/config/firebase.ts).

Important:
- Firebase client config in a mobile app is not a private secret by itself
- Firestore, Auth, and Storage rules must still be configured correctly
- If you fork this project for your own backend, update the Firebase configuration and rules accordingly

## Live Tracking Notes

The app expects tracker data from a backend API used by the Dashboard and Live Map screens.

Current behavior:
- the app reads the pet `deviceId` from Firestore
- it fetches live tracker coordinates from the backend API
- if no valid live fix is available, map behavior may fall back to homebase or cached device data depending on screen state

For full production deployment, you should replace any temporary development URLs with a stable backend endpoint or environment-based configuration.

## Common Issues

### PowerShell script execution blocked

Run PowerShell as Administrator and execute:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Expo cannot connect on school or restricted networks

Try:

```bash
npx expo start --tunnel
```

or:

```bash
npx expo start --lan
```

### Expo cache problems

```bash
npx expo start -c
```

### TypeScript or dependency errors

Reinstall dependencies:

```bash
npm install
```

Then restart the TypeScript server or restart your editor.

### Map issues

If map packages are missing or Metro cache is stale:

```bash
npx expo install react-native-maps
npx expo start -c
```

## Employer Summary

This project demonstrates mobile product development across authentication, live data integration, geofencing, notifications, and multi-entity account management. It also shows practical use of React Native UI patterns, Firebase client integration, Firestore data modeling, and Expo-based mobile tooling for both Android and iOS.
