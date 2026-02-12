import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { auth } from "../config/firebase";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";
import GeofencePickerScreen from "../screens/settings/GeofencePickerScreen";

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  GeofencePicker: {
    petId: string;
    center: { lat: number; lng: number };
    radiusMeters: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  if (initializing) return null; // or splash

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            {/* Only include this here if GeofencePicker isn't already in SettingsStack */}
            <Stack.Screen name="GeofencePicker" component={GeofencePickerScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
