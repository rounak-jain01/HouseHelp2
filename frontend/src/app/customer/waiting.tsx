import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  Timestamp,
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";

const auth = getAuth();
const db = getFirestore();

type BookingStatus =
  | "pending"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_maid_found";

type MaidDetails = {
  name?: string;
  phoneNumber?: string;
  photoUrl?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  serviceCategories?: string[];
  serviceArea?: string;
};

type BookingData = {
  categories?: string[];
  duration?: number;
  totalPrice?: number;
  status?: BookingStatus;
  scheduledDateTime?: Timestamp;
  customerName?: string;
  maidId?: string | null;
  maidDetails?: MaidDetails | null;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: Timestamp;
};

const CANCELLATION_REASONS = [
  "Changed my plans",
  "Found another helper",
  "Helper is taking too long",
  "Booking details are incorrect",
  "Price is too high",
  "Other",
];

const ACTIVE_STATUSES: BookingStatus[] = [
  "pending",
  "assigned",
  "confirmed",
  "in_progress",
];

const getStatusTitle = (status?: BookingStatus) => {
  switch (status) {
    case "assigned":
      return "Helper Assigned";

    case "confirmed":
      return "Booking Confirmed";

    case "in_progress":
      return "Job In Progress";

    case "completed":
      return "Job Completed";

    case "cancelled":
      return "Booking Cancelled";

    case "no_maid_found":
      return "No Helper Found";

    case "pending":
    default:
      return "Finding a Helper";
  }
};

const getStatusDescription = (status?: BookingStatus) => {
  switch (status) {
    case "assigned":
      return "A helper has been assigned to your booking.";

    case "confirmed":
      return "Your helper has accepted the booking.";

    case "in_progress":
      return "Your helper has started the job.";

    case "completed":
      return "This booking has been completed successfully.";

    case "cancelled":
      return "This booking has been cancelled.";

    case "no_maid_found":
      return "We could not find an available helper for this booking.";

    case "pending":
    default:
      return "We're looking for an available helper for you.";
  }
};

const getStatusIcon = (status?: BookingStatus) => {
  switch (status) {
    case "assigned":
      return "✓";

    case "confirmed":
      return "✓";

    case "in_progress":
      return "●";

    case "completed":
      return "✓";

    case "cancelled":
      return "×";

    case "no_maid_found":
      return "!";

    case "pending":
    default:
      return "⌛";
  }
};

/**
 * IMPORTANT:
 * This function is ONLY for the View background.
 * Do not put `color` here because ViewStyle doesn't support color.
 */
const getStatusIconBackgroundStyle = (status?: BookingStatus) => {
  switch (status) {
    case "assigned":
    case "confirmed":
    case "completed":
      return styles.statusIconSuccess;

    case "in_progress":
      return styles.statusIconInfo;

    case "cancelled":
    case "no_maid_found":
      return styles.statusIconDanger;

    case "pending":
    default:
      return styles.statusIconPending;
  }
};

/**
 * This function is ONLY for Text color.
 */
const getStatusIconTextStyle = (status?: BookingStatus) => {
  switch (status) {
    case "assigned":
    case "confirmed":
    case "completed":
      return styles.heroIconSuccess;

    case "in_progress":
      return styles.heroIconInfo;

    case "cancelled":
    case "no_maid_found":
      return styles.heroIconDanger;

    case "pending":
    default:
      return styles.heroIconPending;
  }
};

const getStepState = (
  status: BookingStatus | undefined,
  step: number
): "completed" | "active" | "pending" => {
  if (status === "cancelled" || status === "no_maid_found") {
    return "pending";
  }

  switch (status) {
    case "pending":
      return step === 1 ? "active" : "pending";

    case "assigned":
      if (step <= 2) return step === 2 ? "active" : "completed";
      return "pending";

    case "confirmed":
      if (step <= 2) return "completed";
      if (step === 3) return "active";
      return "pending";

    case "in_progress":
      if (step <= 3) return "completed";
      if (step === 4) return "active";
      return "pending";

    case "completed":
      return "completed";

    default:
      return "pending";
  }
};

const formatDateTime = (timestamp?: Timestamp) => {
  if (!timestamp) return "Not available";

  const date = timestamp.toDate();

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function WaitingScreen() {
  const { bookingId } = useLocalSearchParams<{
    bookingId?: string;
  }>();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [maidDetails, setMaidDetails] = useState<MaidDetails | null>(null);
  const [maidLoading, setMaidLoading] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      Alert.alert(
        "Booking Not Found",
        "Booking ID is missing.",
        [
          {
            text: "Go Home",
            onPress: () => router.replace("/customer"),
          },
        ]
      );

      return;
    }

    const bookingRef = doc(db, "bookings", bookingId);

    const unsubscribe = onSnapshot(
      bookingRef,
      async (snapshot) => {
        if (!snapshot.exists) {
          setLoading(false);

          Alert.alert(
            "Booking Not Found",
            "This booking does not exist.",
            [
              {
                text: "Go Home",
                onPress: () => router.replace("/customer"),
              },
            ]
          );

          return;
        }

        const data = snapshot.data() as BookingData;

        setBooking(data);

        if (
          data.maidId &&
          (data.status === "assigned" ||
            data.status === "confirmed" ||
            data.status === "in_progress")
        ) {
          setMaidDetails(data.maidDetails ?? null);
        } else {
          setMaidDetails(null);
        }

        setMaidLoading(false);
        setLoading(false);
      },
      (error) => {
        console.error("WAITING SCREEN SNAPSHOT ERROR:", error);

        setLoading(false);

        Alert.alert(
          "Something went wrong",
          "Unable to load your booking.",
          [
            {
              text: "Go Back",
              onPress: () => router.replace("/customer"),
            },
          ]
        );
      }
    );

    return unsubscribe;
  }, [bookingId]);

  const status = booking?.status || "pending";

  const canCancel = useMemo(() => {
    return ACTIVE_STATUSES.includes(status);
  }, [status]);

  const openCancelModal = () => {
    setSelectedReason("");
    setOtherReason("");
    setCancelModalVisible(true);
  };

  const closeCancelModal = () => {
    if (cancelling) return;

    setCancelModalVisible(false);
    setSelectedReason("");
    setOtherReason("");
  };

  const confirmCancellation = async () => {
    if (!bookingId) return;

    if (!selectedReason) {
      Alert.alert("Select a reason", "Please select a cancellation reason.");
      return;
    }

    let finalReason = selectedReason;

    if (selectedReason === "Other") {
      finalReason = otherReason.trim();

      if (!finalReason) {
        Alert.alert(
          "Enter a reason",
          "Please tell us why you want to cancel the booking."
        );
        return;
      }
    }

    try {
      setCancelling(true);

      const bookingRef = doc(db, "bookings", bookingId);

      await updateDoc(bookingRef, {
        status: "cancelled",
        cancellationReason: finalReason,
        cancelledBy: "customer",
        cancelledAt: Timestamp.now(),
      });

      setCancelModalVisible(false);

      Alert.alert(
        "Booking Cancelled",
        "Your booking has been cancelled successfully.",
        [
          {
            text: "Go to Bookings",
            onPress: () => router.replace("/customer/bookings"),
          },
        ]
      );
    } catch (error) {
      console.error("CANCEL BOOKING ERROR:", error);

      Alert.alert(
        "Cancellation Failed",
        "We couldn't cancel your booking. Please try again."
      );
    } finally {
      setCancelling(false);
    }
  };

  const goToBookings = () => {
    router.replace("/customer/bookings");
  };

  const goToHome = () => {
    router.replace("/customer");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading booking...
        </Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.emptyTitle}>
          Booking not found
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={goToHome}
        >
          <Text style={styles.primaryButtonText}>
            Go Home
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={goToBookings}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Booking Status
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Hero */}
        <View style={styles.heroCard}>
          <View
            style={[
              styles.heroIcon,
              getStatusIconBackgroundStyle(status),
            ]}
          >
            <Text
              style={[
                styles.heroIconText,
                getStatusIconTextStyle(status),
              ]}
            >
              {getStatusIcon(status)}
            </Text>
          </View>

          <Text style={styles.heroTitle}>
            {getStatusTitle(status)}
          </Text>

          <Text style={styles.heroDescription}>
            {getStatusDescription(status)}
          </Text>

          {status === "pending" && (
            <ActivityIndicator
              size="small"
              style={styles.heroLoader}
            />
          )}
        </View>

        {/* Progress */}
        {!["cancelled", "no_maid_found"].includes(status) && (
          <View style={styles.progressCard}>
            <Text style={styles.sectionTitle}>
              Booking Progress
            </Text>

            <View style={styles.progressContainer}>
              {[
                {
                  step: 1,
                  title: "Finding Helper",
                },
                {
                  step: 2,
                  title: "Helper Assigned",
                },
                {
                  step: 3,
                  title: "Booking Confirmed",
                },
                {
                  step: 4,
                  title: "Job Started",
                },
              ].map((item, index) => {
                const state = getStepState(status, item.step);

                return (
                  <View
                    key={item.step}
                    style={styles.progressRow}
                  >
                    <View style={styles.progressLeft}>
                      <View
                        style={[
                          styles.stepCircle,
                          state === "completed" &&
                            styles.stepCircleCompleted,
                          state === "active" &&
                            styles.stepCircleActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumber,
                            (state === "completed" ||
                              state === "active") &&
                              styles.stepNumberActive,
                          ]}
                        >
                          {state === "completed"
                            ? "✓"
                            : item.step}
                        </Text>
                      </View>

                      {index < 3 && (
                        <View
                          style={[
                            styles.stepLine,
                            state === "completed" &&
                              styles.stepLineCompleted,
                          ]}
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.stepTitle,
                        state === "active" &&
                          styles.stepTitleActive,
                        state === "completed" &&
                          styles.stepTitleCompleted,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Booking Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>
            Booking Details
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Categories
            </Text>

            <Text style={styles.detailValue}>
              {booking.categories?.length
                ? booking.categories
                    .map((item) =>
                      item
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) =>
                          char.toUpperCase()
                        )
                    )
                    .join(", ")
                : "Not available"}
            </Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Duration
            </Text>

            <Text style={styles.detailValue}>
              {booking.duration
                ? `${booking.duration} ${
                    booking.duration === 1
                      ? "hour"
                      : "hours"
                  }`
                : "Not available"}
            </Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Scheduled For
            </Text>

            <Text style={styles.detailValue}>
              {formatDateTime(
                booking.scheduledDateTime
              )}
            </Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Total Price
            </Text>

            <Text style={styles.priceValue}>
              ₹{booking.totalPrice || 0}
            </Text>
          </View>
        </View>

        {/* Assigned helper info */}
        {(status === "assigned" ||
          status === "confirmed" ||
          status === "in_progress") && (
          <View style={styles.helperCard}>
            {maidLoading ? (
              <View style={styles.helperLoading}>
                <ActivityIndicator size="small" />
                <Text style={styles.helperSubtitle}>
                  Loading helper details...
                </Text>
              </View>
            ) : maidDetails ? (
              <>
                <View style={styles.helperTopRow}>
                  {maidDetails.photoUrl ? (
                    <Image
                      source={{ uri: maidDetails.photoUrl }}
                      style={styles.helperPhoto}
                    />
                  ) : (
                    <View style={styles.helperIcon}>
                      <Text style={styles.helperIconText}>👤</Text>
                    </View>
                  )}

                  <View style={styles.helperInfo}>
                    <View style={styles.helperNameRow}>
                      <Text style={styles.helperTitle}>
                        {maidDetails.name || "Your Helper"}
                      </Text>

                      {maidDetails.verificationStatus === "verified" && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.helperSubtitle}>
                      Your helper has accepted this booking.
                    </Text>
                  </View>
                </View>

                {maidDetails.phoneNumber ? (
                  <View style={styles.helperDetailRow}>
                    <Text style={styles.helperDetailIcon}>☎</Text>
                    <Text style={styles.helperDetailText}>
                      {maidDetails.phoneNumber}
                    </Text>
                  </View>
                ) : null}

                {maidDetails.serviceCategories?.length ? (
                  <View style={styles.helperDetailRow}>
                    <Text style={styles.helperDetailIcon}>🧹</Text>
                    <Text style={styles.helperDetailText}>
                      {maidDetails.serviceCategories
                        .map((item) =>
                          item
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (char) => char.toUpperCase())
                        )
                        .join(", ")}
                    </Text>
                  </View>
                ) : null}

                {maidDetails.serviceArea ? (
                  <View style={styles.helperDetailRow}>
                    <Text style={styles.helperDetailIcon}>📍</Text>
                    <Text style={styles.helperDetailText}>
                      {maidDetails.serviceArea}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.helperTopRow}>
                <View style={styles.helperIcon}>
                  <Text style={styles.helperIconText}>👤</Text>
                </View>
                <View style={styles.helperInfo}>
                  <Text style={styles.helperTitle}>Your Helper</Text>
                  <Text style={styles.helperSubtitle}>
                    Your helper has been assigned to this booking.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Cancellation info */}
        {status === "cancelled" &&
          booking.cancellationReason && (
            <View style={styles.cancelledCard}>
              <Text style={styles.cancelledTitle}>
                Cancellation Reason
              </Text>

              <Text style={styles.cancelledReason}>
                {booking.cancellationReason}
              </Text>

              {booking.cancelledBy && (
                <Text style={styles.cancelledBy}>
                  Cancelled by{" "}
                  {booking.cancelledBy === "customer"
                    ? "you"
                    : booking.cancelledBy}
                </Text>
              )}
            </View>
          )}

        {/* No helper */}
        {status === "no_maid_found" && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>
              No helper is available right now
            </Text>

            <Text style={styles.warningText}>
              You can go back and try booking again
              for another time.
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.actions}>
          {canCancel && (
            <Pressable
              style={styles.cancelButton}
              onPress={openCancelModal}
              disabled={cancelling}
            >
              <Text style={styles.cancelButtonText}>
                Cancel Booking
              </Text>
            </Pressable>
          )}

          {status === "completed" && (
            <Pressable
              style={styles.primaryButton}
              onPress={goToBookings}
            >
              <Text style={styles.primaryButtonText}>
                View My Bookings
              </Text>
            </Pressable>
          )}

          {status === "cancelled" && (
            <Pressable
              style={styles.primaryButton}
              onPress={goToBookings}
            >
              <Text style={styles.primaryButtonText}>
                View My Bookings
              </Text>
            </Pressable>
          )}

          {status === "no_maid_found" && (
            <Pressable
              style={styles.primaryButton}
              onPress={goToHome}
            >
              <Text style={styles.primaryButtonText}>
                Back to Home
              </Text>
            </Pressable>
          )}

          {(status === "assigned" ||
            status === "confirmed" ||
            status === "in_progress") && (
            <Pressable
              style={styles.secondaryButton}
              onPress={goToBookings}
            >
              <Text style={styles.secondaryButtonText}>
                View All Bookings
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Cancellation Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Cancel Booking
            </Text>

            <Text style={styles.modalSubtitle}>
              Please select a reason for cancelling this
              booking.
            </Text>

            <ScrollView
              style={styles.reasonList}
              showsVerticalScrollIndicator={false}
            >
              {CANCELLATION_REASONS.map((reason) => {
                const selected =
                  selectedReason === reason;

                return (
                  <Pressable
                    key={reason}
                    style={[
                      styles.reasonOption,
                      selected &&
                        styles.reasonOptionSelected,
                    ]}
                    onPress={() =>
                      setSelectedReason(reason)
                    }
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        selected &&
                          styles.radioOuterSelected,
                      ]}
                    >
                      {selected && (
                        <View
                          style={styles.radioInner}
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.reasonText,
                        selected &&
                          styles.reasonTextSelected,
                      ]}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}

              {selectedReason === "Other" && (
                <TextInput
                  value={otherReason}
                  onChangeText={setOtherReason}
                  placeholder="Enter your reason"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  style={styles.otherInput}
                  textAlignVertical="top"
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalBackButton}
                onPress={closeCancelModal}
                disabled={cancelling}
              >
                <Text style={styles.modalBackText}>
                  Keep Booking
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalCancelButton,
                  cancelling &&
                    styles.modalCancelButtonDisabled,
                ]}
                onPress={confirmCancellation}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.modalCancelText}>
                    Cancel Booking
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  backButtonText: {
    fontSize: 30,
    lineHeight: 32,
    color: "#111827",
    marginTop: -2,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  headerSpacer: {
    width: 42,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },

  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  statusIconSuccess: {
    backgroundColor: "#DCFCE7",
  },

  statusIconInfo: {
    backgroundColor: "#DBEAFE",
  },

  statusIconDanger: {
    backgroundColor: "#FEE2E2",
  },

  statusIconPending: {
    backgroundColor: "#FEF3C7",
  },

  heroIconText: {
    fontSize: 34,
    fontWeight: "800",
  },

  heroIconSuccess: {
    color: "#15803D",
  },

  heroIconInfo: {
    color: "#2563EB",
  },

  heroIconDanger: {
    color: "#DC2626",
  },

  heroIconPending: {
    color: "#B45309",
  },

  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  heroDescription: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },

  heroLoader: {
    marginTop: 16,
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 18,
  },

  progressContainer: {
    marginTop: 2,
  },

  progressRow: {
    flexDirection: "row",
    minHeight: 56,
  },

  progressLeft: {
    width: 34,
    alignItems: "center",
  },

  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },

  stepCircleCompleted: {
    backgroundColor: "#16A34A",
  },

  stepCircleActive: {
    backgroundColor: "#2563EB",
  },

  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },

  stepNumberActive: {
    color: "#FFFFFF",
  },

  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: "#E5E7EB",
  },

  stepLineCompleted: {
    backgroundColor: "#16A34A",
  },

  stepTitle: {
    flex: 1,
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
    paddingTop: 7,
    paddingLeft: 12,
  },

  stepTitleActive: {
    color: "#2563EB",
    fontWeight: "700",
  },

  stepTitleCompleted: {
    color: "#16A34A",
    fontWeight: "600",
  },

  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
  },

  detailLabel: {
    fontSize: 14,
    color: "#64748B",
    flex: 1,
  },

  detailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    flex: 1.5,
    textAlign: "right",
  },

  priceValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "800",
  },

  detailDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 15,
  },

  helperCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 16,
  },

  helperTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  helperLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  helperPhoto: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#DBEAFE",
    marginRight: 14,
  },

  helperNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  verifiedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  verifiedBadgeText: {
    color: "#15803D",
    fontSize: 11,
    fontWeight: "700",
  },

  helperDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
  },

  helperDetailIcon: {
    width: 28,
    fontSize: 16,
    textAlign: "center",
  },

  helperDetailText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },

  helperCardOld: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 16,
  },

  helperIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  helperIconText: {
    fontSize: 23,
  },

  helperInfo: {
    flex: 1,
  },

  helperTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E3A8A",
  },

  helperSubtitle: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
    lineHeight: 19,
  },

  cancelledCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 16,
  },

  cancelledTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991B1B",
  },

  cancelledReason: {
    fontSize: 14,
    color: "#7F1D1D",
    marginTop: 8,
    lineHeight: 20,
  },

  cancelledBy: {
    fontSize: 12,
    color: "#991B1B",
    marginTop: 8,
  },

  warningCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 16,
  },

  warningTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400E",
  },

  warningText: {
    fontSize: 14,
    color: "#78350F",
    marginTop: 6,
    lineHeight: 20,
  },

  actions: {
    gap: 12,
    marginTop: 4,
  },

  primaryButton: {
    backgroundColor: "#111827",
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  secondaryButton: {
    backgroundColor: "#FFFFFF",
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },

  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  cancelButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  cancelButtonText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "85%",
  },

  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 20,
  },

  reasonList: {
    marginTop: 18,
  },

  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },

  reasonOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#F8FAFC",
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  radioOuterSelected: {
    borderColor: "#111827",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#111827",
  },

  reasonText: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
  },

  reasonTextSelected: {
    color: "#111827",
    fontWeight: "600",
  },

  otherInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  modalBackButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  modalBackText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },

  modalCancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },

  modalCancelButtonDisabled: {
    opacity: 0.6,
  },

  modalCancelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});