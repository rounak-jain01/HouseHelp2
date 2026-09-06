import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { sendOTP } from "@/services/auth";

export default function LoginScreen() {
  const { role } = useLocalSearchParams<{
    role: "customer" | "maid";
  }>();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCustomer = role === "customer";

  const handleContinue = async () => {
    try {
      setError("");

      if (phone.length !== 10) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }

      setLoading(true);

      const fullPhone = `+91${phone}`;

      await sendOTP(fullPhone);

      router.push({
        pathname: "/auth/otp",
        params: {
          phone: fullPhone,
          role: role || "customer",
        },
      });
    } catch (err: any) {
      console.error("SEND OTP ERROR:", err);

      setError(
        err?.message ||
          "Unable to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View style={styles.container}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>H</Text>
          </View>

          <Text style={styles.title}>
            {isCustomer
              ? "Book a Helper"
              : "Join as a Helper"}
          </Text>

          <Text style={styles.subtitle}>
            {isCustomer
              ? "Enter your phone number to get started."
              : "Enter your phone number to create your helper account."}
          </Text>
        </View>

        {/* Phone */}
        <Text style={styles.label}>
          Phone number
        </Text>

        <View
          style={[
            styles.phoneContainer,
            error && styles.phoneError,
          ]}
        >
          <Text style={styles.countryCode}>
            +91
          </Text>

          <TextInput
            value={phone}
            onChangeText={(text) => {
              setError("");

              const numbersOnly =
                text.replace(/\D/g, "");

              setPhone(
                numbersOnly.slice(0, 10)
              );
            }}
            placeholder="Enter phone number"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={10}
            style={styles.phoneInput}
            editable={!loading}
          />
        </View>

        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        {/* Continue */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            (phone.length !== 10 || loading) &&
              styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={
            phone.length !== 10 || loading
          }
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueText}>
              Continue
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms
          & Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
  },

  backText: {
    fontSize: 30,
    lineHeight: 30,
    color: "#111827",
  },

  backLabel: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  header: {
    marginTop: 55,
    alignItems: "center",
  },

  logo: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    marginBottom: 22,
  },

  logoText: {
    fontSize: 31,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 9,
    paddingHorizontal: 20,
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    textAlign: "center",
  },

  label: {
    marginTop: 50,
    marginBottom: 9,
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },

  phoneContainer: {
    height: 58,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  phoneError: {
    borderColor: "#EF4444",
  },

  countryCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    paddingRight: 13,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },

  phoneInput: {
    flex: 1,
    marginLeft: 13,
    fontSize: 16,
    color: "#111827",
  },

  error: {
    marginTop: 9,
    fontSize: 13,
    color: "#EF4444",
  },

  continueButton: {
    height: 58,
    marginTop: 25,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },

  disabledButton: {
    opacity: 0.4,
  },

  continueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  terms: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#9CA3AF",
  },
});