import { View, Text, ScrollView, StyleSheet } from "react-native";
import Card from "../../components/ui/Card";
import { colors, typography, spacing } from "../../theme";
import { useUserLocation } from "../../hooks/useUserLocation";


export default function DashboardScreen() {
  const { location, error, loading } = useUserLocation();

  // For now, RENDER test out put with IOS permissions
  if (loading) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Requesting location permission...</Text>
    </View>
  );
}

if (error) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{error}</Text>
    </View>
  );
}

// Main Dashboard UI
  return (
    
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
    >
      <Text style={styles.greeting}>Welcome back</Text>
      <Text style={styles.petName}>Whiskers</Text>

    {/* Screen output location data TEMPORARY */}
    {/*<View style={{ marginBottom: 16 }}>} 
      <Text>User Latitude: {location?.latitude}</Text>
      <Text>User Longitude: {location?.longitude}</Text>
      </View>*/}

      {/* Map Preview */}
      <Card>
        <Text style={styles.cardTitle}>Current Location</Text>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Map Preview</Text>
        </View>
      </Card>

      {/* Status Cards */}
      <View style={styles.statusRow}>
        <Card>
          <Text style={styles.cardTitle}>Battery</Text>
          <Text style={styles.cardValue}>82%</Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Geofence</Text>
          <Text style={styles.cardValue}>Inside Zone</Text>
        </Card>
      </View>

      {/* Activity */}
      <Card>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        <Text style={styles.activityItem}>
          • Location updated 5 minutes ago
        </Text>
        <Text style={styles.activityItem}>
          • Battery level normal
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary
  },
  petName: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.lg
  },
  cardTitle: {
    ...typography.subheading,
    marginBottom: spacing.sm
  },
  cardValue: {
    ...typography.heading,
    color: colors.primary
  },
  mapPlaceholder: {
    height: 160,
    backgroundColor: "#EAEAEA",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  mapText: {
    color: colors.textSecondary
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  activityItem: {
    ...typography.body,
    marginTop: spacing.sm
  }
});
