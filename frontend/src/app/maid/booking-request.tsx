import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
} from "@react-native-firebase/firestore";

const db = getFirestore(getApp());

export default function BookingRequestScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(180);

  useEffect(() => {
    if (!bookingId) return;

    const loadBooking = async () => {
      try {
        const bookingSnap = await getDoc(doc(db, "bookings", bookingId));

        if (!bookingSnap.exists()) {
          Alert.alert("Error", "Booking not found.");
          router.back();
          return;
        }

        const data = bookingSnap.data();

        setBooking(data);
      } catch (error) {
        console.log("Booking request error:", error);
        Alert.alert("Error", "Unable to load booking.");
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [bookingId]);

  // 3-minute countdown
  useEffect(() => {
    if (!booking || responding) return;

    if (secondsLeft <= 0) {
      handleReject(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, booking, responding]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatBookingTime = () => {
    if (!booking?.scheduledDateTime) return "Not available";

    const date = booking.scheduledDateTime.toDate();

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAccept = async () => {
  if (!bookingId || responding) return;

  try {
    setResponding(true);

    await updateDoc(doc(db, "bookings", bookingId), {
      status: "confirmed",
      maidResponse: "accepted",
      respondedAt: new Date(),
    });

    // Directly open Active Booking
    router.replace({
      pathname: "/maid/active-booking",
      params: {
        bookingId: bookingId,
      },
    });
  } catch (error) {
    console.log("Accept error:", error);

    setResponding(false);

    Alert.alert(
      "Error",
      "Could not accept this booking. Please try again."
    );
  }
};

  const handleReject = async (isTimeout = false) => {
    if (!bookingId || responding) return;

    try {
      setResponding(true);

      await updateDoc(doc(db, "bookings", bookingId), {
        status: "pending",
        maidId: null,
        maidResponse: isTimeout ? "timeout" : "rejected",
        respondedAt: new Date(),
      });

      Alert.alert(
        isTimeout ? "Request Expired" : "Booking Rejected",
        isTimeout
          ? "The response time expired."
          : "The booking will be offered to another maid.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/maid"),
          },
        ],
      );
    } catch (error) {
      console.log("Reject error:", error);

      setResponding(false);

      Alert.alert("Error", "Could not reject this booking. Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading booking request...</Text>
      </View>
    );
  }

  if (!booking) {
    return null;
  }

  const categories = booking.categories || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>New Booking Request</Text>

          <View style={styles.timer}>
            <Text style={styles.timerLabel}>Respond within</Text>
            <Text style={styles.timerValue}>{formatTime(secondsLeft)}</Text>
          </View>
        </View>

        <View style={styles.customerCard}>
          <Text style={styles.sectionLabel}>CUSTOMER</Text>

          <Text style={styles.customerName}>
            {booking.customerName || "Customer"}
          </Text>

          <Text style={styles.address}>
            {booking.customerAddress?.formattedAddress ||
              "Address not available"}
          </Text>

          {booking.customerAddress?.landmark ? (
            <Text style={styles.landmark}>
              Landmark: {booking.customerAddress.landmark}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BOOKING DETAILS</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Date & Time</Text>
            <Text style={styles.value}>{formatBookingTime()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>
              {booking.duration} hour
              {booking.duration > 1 ? "s" : ""}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.value}>Not available yet</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>REQUESTED SERVICES</Text>

          {categories.map((category: string, index: number) => (
            <View key={`${category}-${index}`} style={styles.category}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          ))}
        </View>

        <View style={styles.earningCard}>
          <Text style={styles.earningLabel}>YOUR EARNING</Text>

          <Text style={styles.earningAmount}>₹{booking.totalPrice || 0}</Text>

          <Text style={styles.earningNote}>Earnings for this booking</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.acceptButton, responding && styles.disabledButton]}
            disabled={responding}
            onPress={handleAccept}
          >
            {responding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptText}>Accept Booking</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.rejectButton, responding && styles.disabledButton]}
            disabled={responding}
            onPress={() => handleReject(false)}
          >
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },

  timer: {
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },

  timerLabel: {
    fontSize: 10,
    color: "#856404",
    fontWeight: "600",
  },

  timerValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#856404",
    marginTop: 2,
  },

  customerCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#6B7280",
    marginBottom: 10,
  },

  customerName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },

  address: {
    fontSize: 15,
    lineHeight: 21,
    color: "#E5E7EB",
  },

  landmark: {
    marginTop: 7,
    fontSize: 13,
    color: "#D1D5DB",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },

  label: {
    fontSize: 14,
    color: "#6B7280",
  },

  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  category: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginBottom: 8,
  },

  categoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    textTransform: "capitalize",
  },

  earningCard: {
    backgroundColor: "#E8F7EE",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },

  earningLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#247A45",
  },

  earningAmount: {
    fontSize: 34,
    fontWeight: "900",
    color: "#166534",
    marginTop: 5,
  },

  earningNote: {
    fontSize: 12,
    color: "#4B7C5C",
    marginTop: 2,
  },

  actions: {
    gap: 12,
  },

  acceptButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
  },

  acceptText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  rejectButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },

  rejectText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },
});
