# Outdoor Cat Tracker

Mobile application built with **Expo (React Native) + TypeScript + Firebase (Firestore)**.  
This guide explains how to run the project from a blank computer on **Android and iOS**.

---

## Prerequisites (Install libraries and dependencies)

### 1. Install Git ( JUST TO MAKE SURE)
Verify installation:
```bash
git --version
```

### 2. Install Node.js (LTS)

Download from https://nodejs.org

Verify:
```bash
node -v
npm -v
```
### Common Issues & Fixes in this part
PowerShell: “running scripts is disabled”

Run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
### 3. Expo Tooling
Expo is run using npx (no global install required):
```bash
npx expo --version
```
### Clone the Repository
```bash
git clone https://github.com/quangminhtra/Outdoor-CatTracker.git
cd Outdoor-CatTracker
```
### Install Dependencies
From the project root:
```bash
npm install
```
### Run the App
```bash
npx expo start
```

### Run on Android
Physical Device

- Install Expo Go from Google Play

- Scan the QR code from the terminal

- Emulator

- Install Android Studio

- Start an Android Virtual Device (AVD)

- Press a in the Expo terminal

### Run on iOS
Physical Device

- Install Expo Go from the App Store

- Scan the QR code using the Camera app

#### Simulator (Mac only)

- Install Xcode

- Press i in the Expo terminal

## Common Issues & Fixes
PowerShell: “running scripts is disabled”

## Run PowerShell as Administrator:

``` bash
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### TypeScript Error: expo/tsconfig.base not found

Run:

```bash
npm install
```
Then restart VS Code or run TypeScript: Restart TS Server

### School Internet Timeouts (Expo not connecting)

Try one of the following:

```bash
npx expo start --tunnel
```

or
```bash
npx expo start --lan
```


### Expo Cache Issues
```bash
npx expo start -c
```


### Map Not Showing
```bash
npx expo install react-native-maps
npx expo start -c
```



