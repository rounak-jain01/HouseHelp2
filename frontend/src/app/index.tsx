import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
} from "@react-native-firebase/firestore";

const auth = getAuth();
const db = getFirestore();

type Role = "customer" | "maid";

export default function Landing() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [selectedRole, setSelectedRole] =
    useState<Role>("customer");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setCheckingSession(false);
          return;
        }

        try {
          // Check customer profile
          const customerRef = doc(
            db,
            "users",
            user.uid
          );

          const customerSnapshot = await getDoc(
            customerRef
          );

          if (customerSnapshot.exists()) {
            router.replace("/customer");
            return;
          }

          // Check maid profile
          const maidRef = doc(
            db,
            "maids",
            user.uid
          );

          const maidSnapshot = await getDoc(
            maidRef
          );

          if (maidSnapshot.exists()) {
            router.replace("/maid");
            return;
          }

          // Authenticated but profile not created yet.
          // Keep landing visible so the user can continue.
          setCheckingSession(false);
        } catch (error) {
          console.error(
            "SESSION CHECK ERROR:",
            error
          );

          setCheckingSession(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  const handleContinue = () => {
    router.push({
      pathname: "/auth/login",
      params: {
        role: selectedRole,
      },
    });
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Checking your session...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>HH</Text>
        </View>

        <Text style={styles.title}>
          HouseHelp
        </Text>

        <Text style={styles.subtitle}>
          Trusted household help, when you need it.
        </Text>

        {/* Role selection */}
        <View style={styles.roleSection}>
          <Text style={styles.question}>
            What brings you here?
          </Text>

          {/* Customer */}
          <Pressable
            onPress={() =>
              setSelectedRole("customer")
            }
            style={[
              styles.roleCard,
              selectedRole === "customer" &&
                styles.roleCardSelected,
            ]}
          >
            <View style={styles.roleIcon}>
              <Text style={styles.roleEmoji}>
                🏠
              </Text>
            </View>

            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>
                I need a Helper
              </Text>

              <Text style={styles.roleDescription}>
                Book trusted household help.
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                selectedRole === "customer" &&
                  styles.radioSelected,
              ]}
            >
              {selectedRole === "customer" && (
                <View style={styles.radioInner} />
              )}
            </View>
          </Pressable>

          {/* Maid */}
          <Pressable
            onPress={() =>
              setSelectedRole("maid")
            }
            style={[
              styles.roleCard,
              selectedRole === "maid" &&
                styles.roleCardSelected,
            ]}
          >
            <View style={styles.roleIcon}>
              <Text style={styles.roleEmoji}>
                👩
              </Text>
            </View>

            <View style={styles.roleContent}>
              <Text style={styles.roleTitle}>
                I am a Helper
              </Text>

              <Text style={styles.roleDescription}>
                Find work and manage bookings.
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                selectedRole === "maid" &&
                  styles.radioSelected,
              ]}
            >
              {selectedRole === "maid" && (
                <View style={styles.radioInner} />
              )}
            </View>
          </Pressable>
        </View>

        <Pressable
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>
            Continue
          </Text>
        </Pressable>

        <Text style={styles.footer}>
          Lalghati • Bhopal
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 60,
  },

  logo: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#111827",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    maxWidth: 320,
  },

  roleSection: {
    marginTop: 50,
  },

  question: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },

  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  roleCardSelected: {
    borderColor: "#111827",
    borderWidth: 2,
  },

  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  roleEmoji: {
    fontSize: 22,
  },

  roleContent: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  roleDescription: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: "#111827",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },

  continueButton: {
    marginTop: 24,
    height: 54,
    borderRadius: 15,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  continueText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    marginTop: "auto",
    marginBottom: 20,
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 11,
  },
});