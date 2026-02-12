import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SettingsScreen from "../screens/settings/SettingsScreen";
import GeofencePickerScreen from "../screens/settings/GeofencePickerScreen";
import ProfileScreen from "../screens/settings/ProfileScreen";
import EditProfileScreen from "../screens/settings/EditProfileScreen";
import ManagePetsScreen from "../screens/settings/ManagePetsScreen";
import PetDetailsScreen from "../screens/settings/PetDetailsScreen";
import EditPetScreen from "../screens/settings/EditPetScreen";

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ManagePets" component={ManagePetsScreen} />
      <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
      <Stack.Screen name="EditPet" component={EditPetScreen} />
      <Stack.Screen
        name="GeofencePicker"
        component={GeofencePickerScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}
