import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";

const auth = getAuth();
const db = getFirestore();

type BookingData = {
  categories?: string[];
  duration?: number;
  totalPrice?: number;
  status?: string;
  scheduledDateTime?: any;
  customerName?: string;
};

export default function CustomerWaiting() {
  const { bookingId } =
    useLocalSearchParams<{
      bookingId: string;
    }>();

  const [booking, setBooking] =
    useState<BookingData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [cancelling, setCancelling] =
    useState(false);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    const bookingRef = doc(
      db,
      "bookings",
      bookingId
    );

    const unsubscribe = onSnapshot(
      bookingRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLoading(false);
          return;
        }

        const data =
          snapshot.data() as BookingData;

        setBooking(data);
        setLoading(false);

        // Assignment will be connected next.
        if (data.status === "assigned") {
          Alert.alert(
            "Helper Found!",
            "A helper has been assigned to your booking."
          );
        }

        if (data.status === "no_maid_found") {
          Alert.alert(
            "No Helper Available",
            "We couldn't find a helper for this booking.",
            [
              {
                text: "Go Back",
                onPress: () =>
                  router.replace(
                    "/customer"
                  ),
              },
            ]
          );
        }

        if (data.status === "cancelled") {
          router.replace("/customer");
        }
      },
      (error) => {
        console.error(
          "WAITING SNAPSHOT ERROR:",
          error
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, [bookingId]);

  const loadBooking = async () => {
    if (!bookingId) return;

    try {
      const bookingRef = doc(
        db,
        "bookings",
        bookingId
      );

      const snapshot =
        await getDoc(bookingRef);

      if (snapshot.exists()) {
        setBooking(
          snapshot.data() as BookingData
        );
      }
    } catch (error) {
      console.error(
        "LOAD BOOKING ERROR:",
        error
      );
    }
  };

  const cancelSearch = async () => {
    if (!bookingId || cancelling) {
      return;
    }

    try {
      setCancelling(true);

      const user = auth.currentUser;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const bookingRef = doc(
        db,
        "bookings",
        bookingId
      );

      await updateDoc(bookingRef, {
        status: "cancelled",
        cancelledAt: new Date(),
      });

      router.replace("/customer");
    } catch (error) {
      console.error(
        "CANCEL SEARCH ERROR:",
        error
      );

      Alert.alert(
        "Unable to Cancel",
        "Please try again."
      );
    } finally {
      setCancelling(false);
    }
  };

  const formatDateTime = (
    timestamp: any
  ) => {
    if (!timestamp?.toDate) {
      return "Time unavailable";
    }

    return timestamp
      .toDate()
      .toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your booking...
        </Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <Text style={styles.errorTitle}>
          Booking not found
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.replace("/customer")
          }
        >
          <Text style={styles.backButtonText}>
            Go Home
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
      >
        {/* Loader */}
        <View style={styles.loaderSection}>
          <View style={styles.loaderCircle}>
            <ActivityIndicator
              size="large"
            />
          </View>

          <Text style={styles.title}>
            Finding a helper for you...
          </Text>

          <Text style={styles.subtitle}>
            This usually takes a minute
          </Text>
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusDot} />

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              We're looking for an available helper
            </Text>

            <Text style={styles.statusText}>
              Your booking has been received and
              we're checking verified helpers in your
              area.
            </Text>
          </View>
        </View>

        {/* Booking Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Booking Summary
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>
                Services
              </Text>

              <Text style={styles.value}>
                {booking.categories?.join(
                  ", "
                ) || "Not available"}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.label}>
                Duration
              </Text>

              <Text style={styles.value}>
                {booking.duration || 0} hr
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.label}>
                Date & Time
              </Text>

              <Text style={styles.value}>
                {formatDateTime(
                  booking.scheduledDateTime
                )}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.label}>
                Total
              </Text>

              <Text style={styles.totalValue}>
                ₹{booking.totalPrice || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.currentStatusCard}>
          <Text style={styles.currentStatusLabel}>
            Current Status
          </Text>

          <Text style={styles.currentStatusValue}>
            {booking.status || "pending"}
          </Text>
        </View>

        {/* Cancel */}
        {booking.status === "pending" && (
          <Pressable
            style={[
              styles.cancelButton,
              cancelling &&
                styles.cancelButtonDisabled,
            ]}
            disabled={cancelling}
            onPress={cancelSearch}
          >
            {cancelling ? (
              <ActivityIndicator />
            ) : (
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Cancel Search
              </Text>
            )}
          </Pressable>
        )}

        <Text style={styles.footerText}>
          We'll notify you as soon as a helper accepts
          your booking.
        </Text>
      </ScrollView>
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
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  backButton: {
    marginTop: 18,
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loaderSection: {
    alignItems: "center",
    paddingTop: 35,
    paddingBottom: 30,
  },

  loaderCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
    elevation: 2,
  },

  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 7,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },

  statusCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 28,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F59E0B",
    marginTop: 4,
    marginRight: 12,
  },

  statusContent: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  statusText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 11,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
  },

  label: {
    fontSize: 12,
    color: "#6B7280",
  },

  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },

  totalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 14,
  },

  currentStatusCard: {
    backgroundColor: "#FFF7E8",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },

  currentStatusLabel: {
    fontSize: 11,
    color: "#92400E",
    textTransform: "uppercase",
    fontWeight: "700",
  },

  currentStatusValue: {
    marginTop: 5,
    fontSize: 15,
    color: "#92400E",
    fontWeight: "700",
    textTransform: "capitalize",
  },

  cancelButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonDisabled: {
    opacity: 0.5,
  },

  cancelButtonText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },

  footerText: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#9CA3AF",
  },
});