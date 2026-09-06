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
import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";

import { verifyOTP, sendOTP } from "@/services/auth";

const db = getFirestore();

export default function OTPScreen() {
  const { phone, role } = useLocalSearchParams<{
    phone: string;
    role: "customer" | "maid";
  }>();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    try {
      setError("");

      if (!phone) {
        setError("Phone number is missing. Please login again.");
        return;
      }

      if (!role) {
        setError("Role information is missing. Please login again.");
        return;
      }

      if (code.length !== 6) {
        setError("Please enter the 6-digit OTP.");
        return;
      }

      setLoading(true);

      // Verify OTP with Firebase
      const firebaseUser = await verifyOTP(code);

      console.log(
        "OTP verified:",
        firebaseUser.uid,
        "Role:",
        role
      );

      // CUSTOMER FLOW
      if (role === "customer") {
        const userRef = doc(
          db,
          "users",
          firebaseUser.uid
        );

        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          console.log("Existing customer found");

          router.replace("/customer");
          return;
        }

        console.log("New customer");

        router.replace({
          pathname: "/customer/profile",
          params: {
            phone,
          },
        });

        return;
      }

      // MAID FLOW
      const maidRef = doc(
        db,
        "maids",
        firebaseUser.uid
      );

      const maidSnapshot = await getDoc(maidRef);

      if (maidSnapshot.exists()) {
        console.log("Existing maid found");

        router.replace("/maid");
        return;
      }

      console.log("New maid");

      router.replace({
        pathname: "/maid/profile",
        params: {
          phone,
        },
      });
    } catch (err: any) {
      console.error("VERIFY OTP ERROR:", err);

      if (err?.code === "auth/invalid-verification-code") {
        setError(
          "Invalid OTP. Please check the code and try again."
        );
      } else if (err?.code === "auth/code-expired") {
        setError(
          "OTP expired. Please request a new OTP."
        );
      } else if (err?.code === "firestore/permission-denied") {
        setError(
          "Unable to check your account. Please try again."
        );
      } else {
        setError(
          err?.message ||
            "Unable to verify OTP. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setError("");

      if (!phone) {
        setError("Phone number is missing.");
        return;
      }

      setResending(true);

      await sendOTP(phone);

      setCode("");

      console.log("OTP resent successfully");
    } catch (err: any) {
      console.error("RESEND OTP ERROR:", err);

      setError(
        err?.message ||
          "Unable to resend OTP. Please try again."
      );
    } finally {
      setResending(false);
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
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading || resending}
        >
          <Text style={styles.backArrow}>‹</Text>

          <Text style={styles.backText}>
            Back
          </Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>H</Text>
          </View>

          <Text style={styles.title}>
            Verify your number
          </Text>

          <Text style={styles.subtitle}>
            Enter the 6-digit OTP sent to
          </Text>

          <Text style={styles.phone}>
            {phone}
          </Text>
        </View>

        {/* OTP Input */}
        <Text style={styles.label}>
          OTP
        </Text>

        <TextInput
          value={code}
          onChangeText={(text) => {
            setError("");

            const numbersOnly =
              text.replace(/\D/g, "");

            setCode(
              numbersOnly.slice(0, 6)
            );
          }}
          placeholder="Enter OTP"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          style={[
            styles.otpInput,
            error && styles.errorInput,
          ]}
          editable={!loading && !resending}
        />

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {/* Verify Button */}
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (code.length !== 6 ||
              loading ||
              resending) &&
              styles.disabledButton,
          ]}
          onPress={handleVerify}
          disabled={
            code.length !== 6 ||
            loading ||
            resending
          }
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyText}>
              Verify OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={loading || resending}
        >
          {resending ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.resendText}>
              Resend OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* Role */}
        <Text style={styles.roleText}>
          Signing in as{" "}
          <Text style={styles.roleBold}>
            {role === "maid"
              ? "Helper"
              : "Customer"}
          </Text>
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
    paddingTop: 28,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
  },

  backArrow: {
    fontSize: 30,
    lineHeight: 30,
    color: "#111827",
  },

  backText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  header: {
    marginTop: 54,
    alignItems: "center",
  },

  logo: {
    width: 62,
    height: 62,
    borderRadius: 18,
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
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
    marginTop: 10,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  phone: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  label: {
    marginTop: 48,
    marginBottom: 9,
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },

  otpInput: {
    height: 60,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    fontSize: 23,
    fontWeight: "600",
    letterSpacing: 7,
    color: "#111827",
    textAlign: "center",
  },

  errorInput: {
    borderColor: "#EF4444",
  },

  errorText: {
    marginTop: 9,
    fontSize: 13,
    color: "#EF4444",
  },

  verifyButton: {
    height: 58,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.4,
  },

  verifyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  resendButton: {
    marginTop: 22,
    alignItems: "center",
  },

  resendText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },

  roleText: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 13,
    color: "#94A3B8",
  },

  roleBold: {
    fontWeight: "700",
    color: "#475569",
  },
});