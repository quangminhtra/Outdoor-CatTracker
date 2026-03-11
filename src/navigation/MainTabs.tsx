import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DashboardScreen from "../screens/dashboard/DashboardScreen";
import MapScreen from "../screens/map/MapScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import SettingsStack from "./SettingsStack";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

type TabIconProps = {
  routeName: string;
  focused: boolean;
  color: string;
  size: number;
};

function TabIcon({ routeName, focused, color, size }: TabIconProps) {
  let iconName: keyof typeof Ionicons.glyphMap;

  switch (routeName) {
    case "Dashboard":
      iconName = focused ? "home" : "home-outline";
      break;
    case "Map":
      iconName = focused ? "map" : "map-outline";
      break;
    case "Alerts":
      iconName = focused ? "notifications" : "notifications-outline";
      break;
    case "Settings":
      iconName = focused ? "settings" : "settings-outline";
      break;
    default:
      iconName = "ellipse-outline";
  }

  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          ...styles.tabBar,
          height: 72 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon
            routeName={route.name}
            focused={focused}
            color={color}
            size={focused ? 22 : 21}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Home",
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: "Live Map",
        }}
      />

      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: "Alerts",
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsStack}
        options={{
          tabBarLabel: "Account",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
  backgroundColor: colors.card,
  borderTopWidth: 0,
  height: 60,
  paddingTop: 6,
  elevation: 12,
  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 10,
},
  tabBarItem: {
    paddingVertical: 4,
  },
  tabBarIcon: {
    marginTop: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 0,
    marginBottom: 2,
  },
  iconWrapper: {
      width: 36,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(46, 125, 50, 0.12)",
  },
});