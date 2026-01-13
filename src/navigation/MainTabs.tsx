import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";

const Tab = createBottomTabNavigator();

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{title}</Text>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard">
        {() => <PlaceholderScreen title="Dashboard" />}
      </Tab.Screen>
      <Tab.Screen name="Map">
        {() => <PlaceholderScreen title="Map" />}
      </Tab.Screen>
      <Tab.Screen name="Alerts">
        {() => <PlaceholderScreen title="Alerts" />}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {() => <PlaceholderScreen title="Settings" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
