import * as Notifications from "expo-notifications";

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });

  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function sendGeofenceBreachNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Geofence Alert",
      body: "Your cat has left the safe zone.",
      sound: "default"
    },
    trigger: null
  });
}

export async function sendGeofenceReturnNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Safe Zone",
      body: "Your cat has returned to the safe zone.",
      sound: "default"
    },
    trigger: null
  });
}

export async function sendBatteryLowNotification(body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Low Battery",
      body,
      sound: "default"
    },
    trigger: null
  });
}

export async function sendBatteryFullNotification(body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Battery Full",
      body,
      sound: "default"
    },
    trigger: null
  });
}
