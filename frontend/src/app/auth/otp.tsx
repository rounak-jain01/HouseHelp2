import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

import {
  getFirestore,
  doc,
  getDoc,
} from "@react-native-firebase/firestore";

import {
  getAuth,
} from "@react-native-firebase/auth";

import * as Location from "expo-location";

import {
  verifyOTP,
  sendOTP,
} from "@/services/auth";

import {
  createNotificationChannel,
  requestNotificationPermission,
} from "@/services/notifications";

const db = getFirestore();
const auth = getAuth();

const RESEND_COOLDOWN = 30;

export default function OTPScreen() {
  const { phone, role } =
    useLocalSearchParams<{
      phone: string;
      role: "customer" | "maid";
    }>();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] =
    useState(RESEND_COOLDOWN);

  const inputRef = useRef<TextInput>(null);

  const verifyingRef = useRef(false);

  // --------------------------------------------------
  // RESEND COUNTDOWN
  // --------------------------------------------------

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [resendCooldown]);

  // --------------------------------------------------
  // REQUEST APP PERMISSIONS AFTER LOGIN
  // --------------------------------------------------

  const requestPostLoginPermissions =
    useCallback(async () => {
      try {
        console.log(
          "POST LOGIN PERMISSIONS: STARTING"
        );

        // ----------------------------------------------
        // LOCATION
        // ----------------------------------------------

        try {
          const locationPermission =
            await Location.getForegroundPermissionsAsync();

          if (
            locationPermission.status !==
            Location.PermissionStatus.GRANTED
          ) {
            console.log(
              "LOCATION PERMISSION: REQUESTING"
            );

            const result =
              await Location.requestForegroundPermissionsAsync();

            console.log(
              "LOCATION PERMISSION:",
              result.status
            );
          } else {
            console.log(
              "LOCATION PERMISSION: ALREADY GRANTED"
            );
          }
        } catch (locationError) {
          console.error(
            "LOCATION PERMISSION ERROR:",
            locationError
          );
        }

        // ----------------------------------------------
        // NOTIFICATIONS
        // ----------------------------------------------

        try {
          console.log(
            "NOTIFICATION PERMISSION: CHECKING"
          );

          await createNotificationChannel();

          const notificationPermission =
            await requestNotificationPermission();

          console.log(
            "NOTIFICATION PERMISSION:",
            notificationPermission
          );
        } catch (notificationError) {
          console.error(
            "NOTIFICATION PERMISSION ERROR:",
            notificationError
          );
        }

        console.log(
          "POST LOGIN PERMISSIONS: COMPLETED"
        );
      } catch (error) {
        console.error(
          "POST LOGIN PERMISSIONS ERROR:",
          error
        );
      }
    }, [role]);

  // --------------------------------------------------
  // HANDLE LOGIN SUCCESS
  // --------------------------------------------------

  const continueAfterLogin =
    useCallback(
      async (
        firebaseUser: any
      ) => {
        console.log(
          "OTP verified:",
          firebaseUser.uid,
          "Role:",
          role
        );

        // ----------------------------------------------
        // ASK PERMISSIONS FIRST
        // ----------------------------------------------

        await requestPostLoginPermissions();

        // ----------------------------------------------
        // CUSTOMER FLOW
        // ----------------------------------------------

        if (role === "customer") {
          const userRef = doc(
            db,
            "users",
            firebaseUser.uid
          );

          const userSnapshot =
            await getDoc(userRef);

          if (userSnapshot.exists()) {
            console.log(
              "Existing customer found"
            );

            router.replace("/customer");
            return;
          }

          console.log(
            "New customer"
          );

          router.replace({
            pathname:
              "/customer/profile",
            params: {
              phone,
            },
          });

          return;
        }

        // ----------------------------------------------
        // MAID FLOW
        // ----------------------------------------------

        const maidRef = doc(
          db,
          "maids",
          firebaseUser.uid
        );

        const maidSnapshot =
          await getDoc(maidRef);

        if (maidSnapshot.exists()) {
          console.log(
            "Existing maid found"
          );

          router.replace("/maid");
          return;
        }

        console.log(
          "New maid"
        );

        router.replace({
          pathname:
            "/maid/profile",
          params: {
            phone,
          },
        });
      },
      [
        phone,
        role,
        requestPostLoginPermissions,
      ]
    );

  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------

  const handleVerify =
    useCallback(
      async (
        otpCode?: string
      ) => {
        try {
          setError("");

          if (!phone) {
            setError(
              "Phone number is missing. Please login again."
            );
            return;
          }

          if (!role) {
            setError(
              "Role information is missing. Please login again."
            );
            return;
          }

          const finalCode =
            (
              otpCode !== undefined
                ? otpCode
                : code
            )
              .replace(/\D/g, "")
              .slice(0, 6);

          if (finalCode.length !== 6) {
            setError(
              "Please enter the 6-digit OTP."
            );
            return;
          }

          // Prevent duplicate verification
          if (verifyingRef.current) {
            return;
          }

          verifyingRef.current = true;
          setLoading(true);

          console.log(
            "VERIFYING OTP..."
          );

          const firebaseUser =
            await verifyOTP(finalCode);

          console.log(
            "OTP verification successful"
          );

          await continueAfterLogin(
            firebaseUser
          );
        } catch (err: any) {
          console.error(
            "VERIFY OTP ERROR:",
            err
          );

          if (
            err?.code ===
            "auth/invalid-verification-code"
          ) {
            setError(
              "Invalid OTP. Please check the code and try again."
            );
          } else if (
            err?.code ===
            "auth/code-expired"
          ) {
            setError(
              "OTP expired. Please request a new OTP."
            );
          } else if (
            err?.code ===
            "firestore/permission-denied"
          ) {
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
          verifyingRef.current = false;
        }
      },
      [
        code,
        phone,
        role,
        continueAfterLogin,
      ]
    );

  // --------------------------------------------------
  // OTP INPUT
  // --------------------------------------------------

  const handleCodeChange =
    useCallback(
      (text: string) => {
        setError("");

        const numbersOnly =
          text
            .replace(/\D/g, "")
            .slice(0, 6);

        setCode(numbersOnly);

        // --------------------------------------------
        // AUTO VERIFY WHEN 6 DIGITS ARE AVAILABLE
        // --------------------------------------------

        if (
          numbersOnly.length === 6 &&
          !verifyingRef.current &&
          !loading &&
          !resending
        ) {
          console.log(
            "6 DIGIT OTP DETECTED - AUTO VERIFY"
          );

          handleVerify(numbersOnly);
        }
      },
      [
        handleVerify,
        loading,
        resending,
      ]
    );

  // --------------------------------------------------
  // RESEND OTP
  // --------------------------------------------------

  const handleResend =
    useCallback(async () => {
      try {
        setError("");

        if (!phone) {
          setError(
            "Phone number is missing."
          );
          return;
        }

        if (resendCooldown > 0) {
          return;
        }

        if (resending || loading) {
          return;
        }

        setResending(true);

        console.log(
          "RESENDING OTP..."
        );

        await sendOTP(phone);

        setCode("");

        setResendCooldown(
          RESEND_COOLDOWN
        );

        console.log(
          "OTP resent successfully"
        );

        // Focus input again
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      } catch (err: any) {
        console.error(
          "RESEND OTP ERROR:",
          err
        );

        if (
          err?.code ===
          "auth/too-many-requests"
        ) {
          setError(
            "Too many attempts. Please try again later."
          );
        } else {
          setError(
            err?.message ||
              "Unable to resend OTP. Please try again."
          );
        }
      } finally {
        setResending(false);
      }
    }, [
      phone,
      resendCooldown,
      resending,
      loading,
    ]);

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

        {/* ------------------------------------------ */}
        {/* BACK */}
        {/* ------------------------------------------ */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={
            loading || resending
          }
        >
          <Text style={styles.backArrow}>
            ‹
          </Text>

          <Text style={styles.backText}>
            Back
          </Text>
        </TouchableOpacity>

        {/* ------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------ */}

        <View style={styles.header}>

          <View style={styles.logo}>
            <Text style={styles.logoText}>
              H
            </Text>
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

        {/* ------------------------------------------ */}
        {/* OTP LABEL */}
        {/* ------------------------------------------ */}

        <Text style={styles.label}>
          OTP
        </Text>

        {/* ------------------------------------------ */}
        {/* OTP INPUT */}
        {/* ------------------------------------------ */}

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleCodeChange}
          placeholder="Enter OTP"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"

          /*
           * Android / iOS OTP autofill hints
           */
          textContentType="oneTimeCode"
          autoComplete="sms-otp"

          importantForAutofill="yes"

          maxLength={6}

          autoFocus

          style={[
            styles.otpInput,
            error &&
              styles.errorInput,
          ]}

          editable={
            !loading &&
            !resending
          }

          selectTextOnFocus
        />

        {/* ------------------------------------------ */}
        {/* ERROR */}
        {/* ------------------------------------------ */}

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {/* ------------------------------------------ */}
        {/* VERIFY */}
        {/* ------------------------------------------ */}

        <TouchableOpacity
          style={[
            styles.verifyButton,
            (
              code.length !== 6 ||
              loading ||
              resending
            ) &&
              styles.disabledButton,
          ]}
          onPress={() =>
            handleVerify()
          }
          disabled={
            code.length !== 6 ||
            loading ||
            resending
          }
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.verifyText}>
              Verify OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* ------------------------------------------ */}
        {/* RESEND */}
        {/* ------------------------------------------ */}

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={
            loading ||
            resending ||
            resendCooldown > 0
          }
          activeOpacity={0.8}
        >
          {resending ? (
            <ActivityIndicator
              color="#2563EB"
            />
          ) : resendCooldown > 0 ? (
            <Text
              style={styles.resendDisabledText}
            >
              Resend OTP in{" "}
              {resendCooldown}s
            </Text>
          ) : (
            <Text style={styles.resendText}>
              Resend OTP
            </Text>
          )}
        </TouchableOpacity>

        {/* ------------------------------------------ */}
        {/* ROLE */}
        {/* ------------------------------------------ */}

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
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  resendText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },

  resendDisabledText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#94A3B8",
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