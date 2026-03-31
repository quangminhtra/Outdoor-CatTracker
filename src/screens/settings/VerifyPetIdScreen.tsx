import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "../../components/ui/AppText";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { auth } from "../../config/firebase";
import { spacing } from "../../theme";
import { checkDeviceIdAvailability } from "../../services/petAccountService";
import { getDeviceIdValidationError, normalizeDeviceId } from "../../utils/deviceId";

export default function VerifyPetIdScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;

  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function continueToPetSetup() {
    if (!uid) {
      setError("You need to be logged in to add a pet.");
      return;
    }

    const normalized = normalizeDeviceId(deviceId);
    const validationError = getDeviceIdValidationError(normalized);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setChecking(true);
      setError(null);

      const result = await checkDeviceIdAvailability(uid, normalized);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      navigation.navigate("EditPet", {
        mode: "create",
        deviceId: result.normalizedDeviceId,
      });
    } catch (err) {
      console.log("Device verification failed", err);
      setError("Could not verify this device right now. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.page}>
      <ScreenHeader title="Verify Device" onBack={() => navigation.goBack()} />

      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <KeyboardAvoidingView
          style={styles.contentSafe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <AppText style={styles.title}>Enter the tracker device ID</AppText>
              <AppText style={styles.subtext}>
                Use the exact hardware ID format. Example: RAK-001 or RAK-002.
              </AppText>

              <View style={{ height: spacing.md }} />

              <TextInput
                value={deviceId}
                onChangeText={(value) => {
                  setDeviceId(normalizeDeviceId(value));
                  if (error) setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                placeholder="RAK-001"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={[styles.input, error ? styles.inputError : null]}
              />

              {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

              <View style={{ height: spacing.lg }} />

              <TouchableOpacity
                style={[styles.primaryButton, checking && styles.buttonDisabled]}
                onPress={continueToPetSetup}
                activeOpacity={0.85}
                disabled={checking}
              >
                {checking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <AppText style={styles.primaryButtonText}>Continue</AppText>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.tipCard}>
              <AppText style={styles.tipTitle}>Where to find it</AppText>
              <AppText style={styles.tipLine}>The ID should be printed as `RAK-###`.</AppText>
              <AppText style={styles.tipLine}>Check the tracker body, packaging, or purchase email.</AppText>
              <AppText style={styles.tipLine}>The app only verifies devices that already exist in Firestore `devices`.</AppText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentSafe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    color: "#111",
    fontWeight: "900",
    fontSize: 18,
  },
  subtext: {
    color: "rgba(0,0,0,0.65)",
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inputError: {
    borderColor: "#C62828",
  },
  errorText: {
    color: "#C62828",
    marginTop: spacing.sm,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: "#2F855A",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  tipCard: {
    marginTop: spacing.md,
    backgroundColor: "#F4D35E",
    borderRadius: 18,
    padding: spacing.md,
  },
  tipTitle: {
    color: "#111",
    fontWeight: "900",
  },
  tipLine: {
    color: "#111",
    marginTop: spacing.xs,
  },
});
