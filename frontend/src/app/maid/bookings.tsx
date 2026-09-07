import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from "@react-native-firebase/firestore";

type BookingStatus =
  | "pending"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_maid_found";

type Booking = {
  customerName?: string;
  categories?: string[];
  duration?: number;
  totalPrice?: number;
  status?: BookingStatus;
  scheduledDateTime?: any;
  createdAt?: any;
  maidResponse?: string;
};

type BookingItem = Booking & {
  id: string;
};

const auth = getAuth();
const db = getFirestore();

export default function MaidBookings() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("maidId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const list: BookingItem[] = snapshot.docs
          .map((bookingDoc) => ({
            id: bookingDoc.id,
            ...(bookingDoc.data() as Booking),
          }))
          .filter((booking) => {
            return (
              booking.status === "assigned" ||
              booking.status === "confirmed" ||
              booking.status === "in_progress" ||
              booking.status === "completed" ||
              booking.status === "cancelled"
            );
          });

        list.sort((a, b) => {
          const aTime =
            a.scheduledDateTime?.toMillis?.() ??
            a.createdAt?.toMillis?.() ??
            0;

          const bTime =
            b.scheduledDateTime?.toMillis?.() ??
            b.createdAt?.toMillis?.() ??
            0;

          return bTime - aTime;
        });

        setBookings(list);
        setLoading(false);
      },
      (error) => {
        console.error("MAID BOOKINGS ERROR:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return "Date not available";
    }

    try {
      return timestamp.toDate().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "Date not available";
    }
  };

  const formatCategory = (category: string) => {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getStatusText = (status?: BookingStatus) => {
    switch (status) {
      case "assigned":
        return "New Request";

      case "confirmed":
        return "Accepted";

      case "in_progress":
        return "In Progress";

      case "completed":
        return "Completed";

      case "cancelled":
        return "Cancelled";

      default:
        return "Booking";
    }
  };

  const getStatusBadgeStyle = (status?: BookingStatus) => {
    switch (status) {
      case "assigned":
        return styles.assignedBadge;

      case "confirmed":
        return styles.confirmedBadge;

      case "in_progress":
        return styles.progressBadge;

      case "completed":
        return styles.completedBadge;

      case "cancelled":
        return styles.cancelledBadge;

      default:
        return styles.defaultBadge;
    }
  };

  const getStatusTextStyle = (status?: BookingStatus) => {
    switch (status) {
      case "assigned":
        return styles.assignedText;

      case "confirmed":
        return styles.confirmedText;

      case "in_progress":
        return styles.progressText;

      case "completed":
        return styles.completedText;

      case "cancelled":
        return styles.cancelledText;

      default:
        return styles.defaultText;
    }
  };

  const openBooking = (bookingId: string) => {
    router.push({
      pathname: "/maid/active-booking",
      params: {
        bookingId,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading bookings...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Bookings</Text>

            <Text style={styles.subtitle}>
              Manage your customer bookings
            </Text>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>
              Total Bookings
            </Text>

            <Text style={styles.summaryValue}>
              {bookings.length}
            </Text>
          </View>

          <Text style={styles.summaryIcon}>📋</Text>
        </View>

        {/* EMPTY STATE */}
        {bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>

            <Text style={styles.emptyTitle}>
              No Bookings Yet
            </Text>

            <Text style={styles.emptyText}>
              Your assigned and accepted customer bookings
              will appear here.
            </Text>

            <Pressable
              style={styles.homeButton}
              onPress={() => router.replace("/maid")}
            >
              <Text style={styles.homeButtonText}>
                Back to Home
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            {bookings.map((booking) => (
              <Pressable
                key={booking.id}
                style={styles.bookingCard}
                onPress={() => openBooking(booking.id)}
              >
                {/* TOP */}
                <View style={styles.topRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {booking.customerName
                        ? booking.customerName
                            .charAt(0)
                            .toUpperCase()
                        : "C"}
                    </Text>
                  </View>

                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>
                      {booking.customerName || "Customer"}
                    </Text>

                    <Text style={styles.bookingDate}>
                      {formatDate(
                        booking.scheduledDateTime ||
                          booking.createdAt
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      getStatusBadgeStyle(
                        booking.status
                      ),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextStyle(
                          booking.status
                        ),
                      ]}
                    >
                      {getStatusText(booking.status)}
                    </Text>
                  </View>
                </View>

                {/* DIVIDER */}
                <View style={styles.divider} />

                {/* SERVICES */}
                <Text style={styles.label}>
                  Services
                </Text>

                <View style={styles.categoryContainer}>
                  {booking.categories &&
                  booking.categories.length > 0 ? (
                    booking.categories.map(
                      (category, index) => (
                        <View
                          key={`${category}-${index}`}
                          style={styles.categoryChip}
                        >
                          <Text
                            style={styles.categoryText}
                          >
                            {formatCategory(category)}
                          </Text>
                        </View>
                      )
                    )
                  ) : (
                    <Text style={styles.noDataText}>
                      No services listed
                    </Text>
                  )}
                </View>

                {/* DETAILS */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>
                      ⏱
                    </Text>

                    <View>
                      <Text style={styles.detailLabel}>
                        Duration
                      </Text>

                      <Text style={styles.detailValue}>
                        {booking.duration
                          ? `${booking.duration} hr${
                              booking.duration > 1
                                ? "s"
                                : ""
                            }`
                          : "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>
                      ₹
                    </Text>

                    <View>
                      <Text style={styles.detailLabel}>
                        Earnings
                      </Text>

                      <Text style={styles.detailValue}>
                        ₹{booking.totalPrice || 0}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* OPEN */}
                <View style={styles.openRow}>
                  <Text style={styles.openText}>
                    View Booking Details
                  </Text>

                  <Text style={styles.arrow}>
                    ›
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <Pressable
          style={styles.navItem}
          onPress={() => router.replace("/maid")}
        >
          <Text style={styles.navIcon}>⌂</Text>
          <Text style={styles.navText}>Home</Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navIconActive}>📋</Text>
          <Text style={styles.navTextActive}>
            Bookings
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/maid/profile")}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
        </Pressable>
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
    fontSize: 14,
    color: "#6B7280",
  },

  content: {
    padding: 20,
    paddingBottom: 110,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  backText: {
    fontSize: 30,
    color: "#111827",
    lineHeight: 32,
    marginTop: -3,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#111827",
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#6B7280",
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 27,
    fontWeight: "900",
    color: "#111827",
  },

  summaryIcon: {
    fontSize: 30,
  },

  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#3730A3",
  },

  customerInfo: {
    flex: 1,
  },

  customerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  bookingDate: {
    fontSize: 12,
    color: "#6B7280",
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  assignedBadge: {
    backgroundColor: "#FEF3C7",
  },

  confirmedBadge: {
    backgroundColor: "#DBEAFE",
  },

  progressBadge: {
    backgroundColor: "#E0E7FF",
  },

  completedBadge: {
    backgroundColor: "#DCFCE7",
  },

  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },

  defaultBadge: {
    backgroundColor: "#F1F5F9",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  assignedText: {
    color: "#92400E",
  },

  confirmedText: {
    color: "#1D4ED8",
  },

  progressText: {
    color: "#4338CA",
  },

  completedText: {
    color: "#15803D",
  },

  cancelledText: {
    color: "#B91C1C",
  },

  defaultText: {
    color: "#475569",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 15,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
  },

  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  categoryChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  categoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },

  noDataText: {
    fontSize: 13,
    color: "#94A3B8",
  },

  detailsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  detailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
  },

  detailIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  detailLabel: {
    fontSize: 10,
    color: "#64748B",
    marginBottom: 2,
  },

  detailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },

  openRow: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  openText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  arrow: {
    fontSize: 24,
    color: "#94A3B8",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 7,
  },

  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },

  homeButton: {
    backgroundColor: "#111827",
    borderRadius: 13,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  homeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 8,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },

  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },

  navIconActive: {
    fontSize: 20,
    marginBottom: 4,
  },

  navText: {
    fontSize: 11,
    color: "#6B7280",
  },

  navTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
});