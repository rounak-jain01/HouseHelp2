import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth, signOut } from "@react-native-firebase/auth";

import { createCustomerProfile } from "@/services/user";

const auth = getAuth();

export default function CustomerProfileScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUseCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Please allow location access to use your current location.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      setLatitude(latitude);
      setLongitude(longitude);

      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result.length > 0) {
        const place = result[0];

        const parts = [
          place.name,
          place.street,
          place.district,
          place.city,
          place.region,
          place.postalCode,
        ].filter(Boolean);

        setAddress(parts.join(", "));
      }

      Alert.alert("Location Added", "Your current location has been added.");
    } catch (error) {
      console.error("LOCATION ERROR:", error);

      Alert.alert("Location Error", "Unable to detect your location.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (name.trim().length < 2) {
        Alert.alert("Name Required", "Please enter your name.");
        return;
      }

      if (address.trim().length < 5) {
        Alert.alert("Address Required", "Please enter your full address.");
        return;
      }

      if (latitude === null || longitude === null) {
        Alert.alert(
          "Confirm Location",
          "Please use current location to confirm your service address.",
        );
        return;
      }

      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Session Expired", "Please login again.");

        router.replace("/auth/login");
        return;
      }

      setSaving(true);

      await createCustomerProfile({
        uid: user.uid,
        phoneNumber: phone || user.phoneNumber || "",
        name: name.trim(),
        formattedAddress: address.trim(),
        latitude,
        longitude,
        landmark: landmark.trim(),
      });

      console.log("CUSTOMER PROFILE CREATED:", user.uid);

      router.replace("/customer");
    } catch (error: any) {
      console.error("CUSTOMER PROFILE ERROR:", error);

      Alert.alert(
        "Unable to Save",
        error?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);

    // Manual editing invalidates the previous GPS confirmation.
    setLatitude(null);
    setLongitude(null);
  };


  const handleSignOut = async () => {
  try {
    const currentUser = auth.currentUser;

    if (currentUser) {
      await signOut(auth);
    }

    router.replace("/");
  } catch (error) {
    console.error("CUSTOMER SIGN OUT ERROR:", error);

    // Even if Firebase says no current user,
    // send the user back to login/landing.
    router.replace("/");
  }
};

  const isValid =
    name.trim().length >= 2 &&
    address.trim().length >= 5 &&
    latitude !== null &&
    longitude !== null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Set up your profile</Text>

        <Text style={styles.subtitle}>
          Just a few details before you book a helper.
        </Text>

        {phone ? (
          <View style={styles.phoneCard}>
            <Text style={styles.phoneLabel}>Phone number</Text>

            <Text style={styles.phoneText}>{phone}</Text>
          </View>
        ) : null}

        {/* Name */}
        <Text style={styles.label}>Your name *</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="words"
          editable={!saving}
        />

        {/* Address */}
        <Text style={styles.label}>Service address *</Text>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUseCurrentLocation}
          disabled={locationLoading || saving}
          activeOpacity={0.8}
        >
          {locationLoading ? (
            <ActivityIndicator />
          ) : (
            <>
              <View style={styles.locationIcon}>
                <Text style={styles.locationIconText}>⌖</Text>
              </View>

              <View style={styles.locationContent}>
                <Text style={styles.locationTitle}>Use current location</Text>

                <Text style={styles.locationSubtitle}>
                  Detect your address automatically
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <TextInput
          value={address}
          onChangeText={handleAddressChange}
          placeholder="Enter your full address"
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.addressInput]}
          multiline
          textAlignVertical="top"
          editable={!saving}
        />

        <Text style={styles.helperText}>
          For now, use your current location to confirm the service address.
        </Text>

        {/* Landmark */}
        <Text style={styles.label}>Landmark</Text>

        <TextInput
          value={landmark}
          onChangeText={setLandmark}
          placeholder="Example: Near Lalghati Square"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          editable={!saving}
        />

        {/* Location Status */}
        {latitude !== null && longitude !== null ? (
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <Text style={styles.tick}>✓</Text>
            </View>

            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Location confirmed</Text>

              <Text style={styles.successAddress}>{address}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Confirm your location to continue.
            </Text>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isValid || saving) && styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={!isValid || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Save & Continue</Text>
          )}
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
          disabled={saving || locationLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },

  phoneCard: {
    padding: 14,
    marginBottom: 24,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  phoneLabel: {
    fontSize: 12,
    color: "#64748B",
  },

  phoneText: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },

  input: {
    height: 54,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontSize: 16,
  },

  addressInput: {
    height: 100,
    paddingTop: 14,
    paddingBottom: 14,
  },

  locationButton: {
    minHeight: 72,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },

  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  locationIconText: {
    fontSize: 24,
    color: "#111827",
  },

  locationContent: {
    flex: 1,
    marginLeft: 12,
  },

  locationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  locationSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  chevron: {
    fontSize: 27,
    color: "#94A3B8",
  },

  orText: {
    marginVertical: 14,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },

  helperText: {
    marginTop: -10,
    marginBottom: 20,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },

  successBox: {
    marginTop: 2,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    flexDirection: "row",
  },

  successIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },

  tick: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  successContent: {
    flex: 1,
    marginLeft: 10,
  },

  successTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },

  successAddress: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#166534",
  },

  infoBox: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },

  infoText: {
    fontSize: 12,
    color: "#1D4ED8",
  },


  logoutButton: {
    height: 52,
    marginTop: 14,
    marginBottom: 30,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },

  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },

  saveButton: {
    height: 56,
    marginTop: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },

  disabledButton: {
    opacity: 0.4,
  },

  saveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
