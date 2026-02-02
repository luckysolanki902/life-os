# 📱 Mobile App

> *Native Android experience with Capacitor*

LifeOS is built as a web app that can be deployed as a native Android application using Capacitor. This document covers mobile-specific setup, features, and deployment.

---

## 📍 Overview

Mobile capabilities:
- **Native App Shell** - Runs in a native Android WebView
- **Haptic Feedback** - Tactile response on interactions
- **Local Storage** - Secure token storage via Preferences
- **Share Sheet** - Native sharing functionality
- **Push Notifications** - Background notifications (planned)

---

## 🛠️ Capacitor Setup

### Prerequisites

- Node.js 18+
- Android Studio (latest)
- Java JDK 17+
- Android SDK (API 33+)

### Installation

```bash
# Install Capacitor core
npm install @capacitor/core @capacitor/cli

# Install Android platform
npm install @capacitor/android

# Initialize Capacitor
npx cap init
```

### Capacitor Config

```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'LifeOS',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // For development with live reload:
    // url: 'http://192.168.1.100:3000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#121212',
      showSpinner: false,
    },
    Preferences: {
      // Secure storage for tokens
    },
    Haptics: {
      // Haptic feedback
    }
  }
};

export default config;
```

---

## 📦 Capacitor Plugins

### Installed Plugins

```bash
npm install @capacitor/preferences    # Secure storage
npm install @capacitor/haptics        # Haptic feedback
npm install @capacitor/share          # Native share
npm install @capacitor/filesystem     # File access
npm install @capacitor/push-notifications  # Push notifications
npm install @capacitor/app            # App lifecycle
```

### Plugin Usage

#### Preferences (Token Storage)

```typescript
// src/lib/auth-storage.ts
import { Preferences } from '@capacitor/preferences';

export const authStorage = {
  async setToken(token: string) {
    await Preferences.set({
      key: 'lifeos_token',
      value: token,
    });
  },
  
  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'lifeos_token' });
    return value;
  },
  
  async clearToken() {
    await Preferences.remove({ key: 'lifeos_token' });
  },
  
  async isTokenValid(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;
    // Check expiry, validate JWT, etc.
    return true;
  }
};
```

#### Haptics

```typescript
// src/lib/haptics.ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const haptics = {
  // Light tap
  async light() {
    await Haptics.impact({ style: ImpactStyle.Light });
  },
  
  // Medium tap
  async medium() {
    await Haptics.impact({ style: ImpactStyle.Medium });
  },
  
  // Heavy tap
  async heavy() {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  },
  
  // Success notification
  async success() {
    await Haptics.notification({ type: NotificationType.Success });
  },
  
  // Error notification
  async error() {
    await Haptics.notification({ type: NotificationType.Error });
  },
  
  // Selection changed
  async selection() {
    await Haptics.selectionChanged();
  }
};
```

#### Share

```typescript
// src/lib/share.ts
import { Share } from '@capacitor/share';

export async function shareContent(options: {
  title?: string;
  text?: string;
  url?: string;
  files?: string[];
}) {
  await Share.share({
    title: options.title,
    text: options.text,
    url: options.url,
    dialogTitle: 'Share with friends',
  });
}

// Usage: Share workout summary
await shareContent({
  title: 'My Workout',
  text: 'Just completed Day A - Push workout! 💪',
});
```

---

## 🏗️ Build Process

### Development

```bash
# Start Next.js dev server
npm run dev

# In capacitor.config.ts, set server URL for live reload:
server: {
  url: 'http://YOUR_LOCAL_IP:3000'
}

# Sync and open Android Studio
npx cap sync android
npx cap open android

# Run on emulator/device from Android Studio
```

### Production Build

```bash
# 1. Build Next.js static export
npm run build

# 2. Sync with Capacitor
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. Build APK/AAB in Android Studio
# Build > Generate Signed Bundle/APK
```

### NPM Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "cap:sync": "npx cap sync",
    "cap:open": "npx cap open android",
    "android:build": "npm run build && npx cap sync android"
  }
}
```

---

## 📁 Android Project Structure

```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/lifeos/app/
│   │       │   └── MainActivity.java
│   │       ├── res/
│   │       │   ├── drawable/         # Icons, splash
│   │       │   ├── layout/           # XML layouts
│   │       │   ├── mipmap-*/         # App icons
│   │       │   └── values/           # Colors, strings
│   │       └── AndroidManifest.xml
│   └── build.gradle
├── gradle/
├── build.gradle
├── settings.gradle
└── variables.gradle
```

### Key Android Files

#### AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
    
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />
</manifest>
```

#### variables.gradle

```gradle
ext {
    minSdkVersion = 22
    compileSdkVersion = 34
    targetSdkVersion = 34
    androidxActivityVersion = '1.7.0'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.10.0'
    androidxFragmentVersion = '1.5.6'
    coreSplashScreenVersion = '1.0.0'
    androidxWebkitVersion = '1.6.1'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
}
```

---

## 🎨 App Icon & Splash

### Generating Icons

```bash
# Using scripts/generate-icons.js
node scripts/generate-icons.js

# Or manually:
# 1. Create 1024x1024 master icon
# 2. Use Android Studio's Image Asset Studio
# 3. File > New > Image Asset
```

### Icon Sizes Required

| Density | Size | Location |
|---------|------|----------|
| mdpi | 48x48 | `res/mipmap-mdpi/` |
| hdpi | 72x72 | `res/mipmap-hdpi/` |
| xhdpi | 96x96 | `res/mipmap-xhdpi/` |
| xxhdpi | 144x144 | `res/mipmap-xxhdpi/` |
| xxxhdpi | 192x192 | `res/mipmap-xxxhdpi/` |

### Splash Screen

```typescript
// In capacitor.config.ts
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    launchAutoHide: true,
    backgroundColor: '#121212',
    androidSplashResourceName: 'splash',
    androidScaleType: 'CENTER_CROP',
    showSpinner: false,
  }
}
```

---

## 📲 Mobile-Specific Features

### Swipe Gestures

```typescript
// src/components/SwipeableTask.tsx
import { motion } from 'framer-motion';

function SwipeableTask({ task, onComplete, onSkip }) {
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, info) => {
        if (info.offset.x > 100) {
          haptics.success();
          onComplete();
        } else if (info.offset.x < -100) {
          haptics.light();
          onSkip();
        }
      }}
    >
      <TaskItem task={task} />
    </motion.div>
  );
}
```

### Pull to Refresh

```typescript
function RefreshableList({ onRefresh, children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    haptics.medium();
    await onRefresh();
    setIsRefreshing(false);
  };
  
  return (
    <div onPullDown={handleRefresh}>
      {isRefreshing && <Spinner />}
      {children}
    </div>
  );
}
```

### Bottom Navigation

```typescript
// Optimized for thumb reach
<nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
  <div className="flex justify-around py-2">
    <NavLink to="/" icon={Home} label="Home" />
    <NavLink to="/routine" icon={CheckSquare} label="Routine" />
    <NavLink to="/health" icon={Heart} label="Health" />
    <NavLink to="/reports" icon={BarChart} label="Reports" />
  </div>
</nav>
```

---

## 🔔 Push Notifications (Planned)

### Setup

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

async function initializePushNotifications() {
  // Request permission
  const result = await PushNotifications.requestPermissions();
  
  if (result.receive === 'granted') {
    // Register with FCM
    await PushNotifications.register();
  }
  
  // Handle registration token
  PushNotifications.addListener('registration', (token) => {
    console.log('Push token:', token.value);
    // Send to backend
  });
  
  // Handle notification received
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Notification:', notification);
  });
}
```

### Planned Notifications

| Type | Trigger |
|------|---------|
| Task Reminder | Scheduled task start time |
| Streak Warning | End of day, incomplete tasks |
| Weekly Summary | Every Sunday |
| Achievement | Points milestone reached |

---

## 🐛 Debugging

### Chrome DevTools

```bash
# 1. Run app on device/emulator
# 2. Open Chrome
# 3. Navigate to: chrome://inspect
# 4. Find your app and click "Inspect"
```

### Logcat

```bash
# View Android logs
adb logcat | grep -i capacitor
```

### Common Issues

| Issue | Solution |
|-------|----------|
| White screen | Check `webDir` in capacitor.config.ts |
| API not working | Check CORS, use `https` scheme |
| Plugins not loading | Run `npx cap sync` |
| Build fails | Update Gradle, check SDK versions |

---

## 🚀 Release

### Signing the APK

1. Generate keystore:
```bash
keytool -genkey -v -keystore lifeos.keystore -alias lifeos -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure in `app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            keyAlias 'lifeos'
            keyPassword 'your-password'
            storeFile file('lifeos.keystore')
            storePassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

3. Build signed APK in Android Studio

### Play Store Checklist

- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone, tablet)
- [ ] Privacy policy URL
- [ ] App description
- [ ] Version code increment
- [ ] Signed AAB (not APK)

---

## 📱 Device Compatibility

### Minimum Requirements

- Android 6.0 (API 23) or higher
- 2GB RAM recommended
- 50MB storage

### Tested Devices

- Pixel 4, 5, 6, 7 series
- Samsung Galaxy S21+
- OnePlus 9 Pro

---

## 🔗 Related Documentation

- [Architecture](./ARCHITECTURE.md) - Overall system design
- [Sync System](./SYNC.md) - Background sync with mobile
- [Home Dashboard](./HOME.md) - Mobile UI patterns
