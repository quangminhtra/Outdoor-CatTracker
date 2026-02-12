import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import MapScreen from "../screens/map/MapScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import SettingsStack from "./SettingsStack";


const Tab = createBottomTabNavigator();
function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{title}</Text>
    </View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 4
        }
      }}
    >
     <Tab.Screen name="Dashboard" component={DashboardScreen} />
      
     <Tab.Screen name="Map" component={MapScreen} />

     <Tab.Screen name="Alerts" component={AlertsScreen} />

     <Tab.Screen name="Settings" component={SettingsStack} />

    </Tab.Navigator>
  );
}

