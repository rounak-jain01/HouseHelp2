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
};

type HistoryItem = Booking & {
  id: string;
};

const auth = getAuth();
const db = getFirestore();

export default function MaidJobHistory() {
  const [jobs, setJobs] = useState<HistoryItem[]>([]);
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
        const history: HistoryItem[] = snapshot.docs
          .map((bookingDoc) => ({
            id: bookingDoc.id,
            ...(bookingDoc.data() as Booking),
          }))
          .filter(
            (booking) =>
              booking.status === "completed" ||
              booking.status === "cancelled"
          );

        history.sort((a, b) => {
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

        setJobs(history);
        setLoading(false);
      },
      (error) => {
        console.log("JOB HISTORY ERROR:", error);
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
      const date = timestamp.toDate();

      return date.toLocaleString("en-IN", {
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
    if (status === "completed") {
      return "Completed";
    }

    if (status === "cancelled") {
      return "Cancelled";
    }

    return status || "Unknown";
  };

  const getStatusStyle = (status?: BookingStatus) => {
    if (status === "completed") {
      return styles.completedBadge;
    }

    return styles.cancelledBadge;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading job history...
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>Job History</Text>

            <Text style={styles.subtitle}>
              View your previous jobs
            </Text>
          </View>
        </View>

        {/* Job Count */}
        {jobs.length > 0 && (
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>
                Total Jobs
              </Text>

              <Text style={styles.summaryValue}>
                {jobs.length}
              </Text>
            </View>

            <Text style={styles.summaryIcon}>📜</Text>
          </View>
        )}

        {/* Empty State */}
        {jobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>

            <Text style={styles.emptyTitle}>
              No Jobs Yet
            </Text>

            <Text style={styles.emptyText}>
              Your completed and cancelled jobs will
              appear here.
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
            {jobs.map((job) => (
              <View
                key={job.id}
                style={styles.jobCard}
              >
                {/* Top Row */}
                <View style={styles.jobTopRow}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.avatarText}>
                      {job.customerName
                        ? job.customerName
                            .charAt(0)
                            .toUpperCase()
                        : "C"}
                    </Text>
                  </View>

                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>
                      {job.customerName || "Customer"}
                    </Text>

                    <Text style={styles.jobDate}>
                      {formatDate(
                        job.scheduledDateTime ||
                          job.createdAt
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(job.status),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        job.status === "completed"
                          ? styles.completedStatusText
                          : styles.cancelledStatusText,
                      ]}
                    >
                      {getStatusText(job.status)}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Services */}
                <Text style={styles.sectionLabel}>
                  Services
                </Text>

                <View style={styles.categoryContainer}>
                  {job.categories &&
                  job.categories.length > 0 ? (
                    job.categories.map(
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

                {/* Details */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailIcon}>
                      ⏱
                    </Text>

                    <View>
                      <Text
                        style={styles.detailLabel}
                      >
                        Duration
                      </Text>

                      <Text
                        style={styles.detailValue}
                      >
                        {job.duration
                          ? `${job.duration} hr${
                              job.duration > 1
                                ? "s"
                                : ""
                            }`
                          : "N/A"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailBox}>
                    <Text style={styles.detailIcon}>
                      ₹
                    </Text>

                    <View>
                      <Text
                        style={styles.detailLabel}
                      >
                        Earning
                      </Text>

                      <Text
                        style={styles.detailValue}
                      >
                        ₹{job.totalPrice || 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
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
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    elevation: 1,
  },

  backText: {
    fontSize: 30,
    color: "#111827",
    lineHeight: 32,
    marginTop: -3,
  },

  headerText: {
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
    elevation: 1,
  },

  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },

  summaryIcon: {
    fontSize: 30,
  },

  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,
    elevation: 1,
  },

  jobTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  customerAvatar: {
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

  jobDate: {
    fontSize: 12,
    color: "#6B7280",
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  completedBadge: {
    backgroundColor: "#DCFCE7",
  },

  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  completedStatusText: {
    color: "#15803D",
  },

  cancelledStatusText: {
    color: "#B91C1C",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 15,
  },

  sectionLabel: {
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
    marginTop: 16,
    gap: 12,
  },

  detailBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 11,
  },

  detailIcon: {
    fontSize: 19,
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

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    marginTop: 20,
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
});