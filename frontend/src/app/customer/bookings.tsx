import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  doc,
} from "@react-native-firebase/firestore";

const auth = getAuth();
const db = getFirestore();

type Booking = {
  id: string;
  customerId?: string;
  maidId?: string | null;
  categories?: string[];
  duration?: number;
  totalPrice?: number;
  status?: string;
  scheduledDateTime?: any;
  customerName?: string;
  customerAddress?: {
    formattedAddress?: string;
    latitude?: number | null;
    longitude?: number | null;
    landmark?: string | null;
  };
  createdAt?: any;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: any;
};

const cancellationReasons = [
  "Changed my plans",
  "Found another helper",
  "Helper is taking too long",
  "Booking details are incorrect",
  "Price is too high",
  "Other",
];

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Cancellation states
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    setLoading(true);
    setError("");

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("customerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const loadedBookings: Booking[] = snapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...(bookingDoc.data() as Omit<Booking, "id">),
        }));

        // Newest booking first.
        loadedBookings.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;

          return bTime - aTime;
        });

        setBookings(loadedBookings);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("CUSTOMER BOOKINGS ERROR:", snapshotError);

        setError("Unable to load your bookings.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp?.toDate) {
      return "Time unavailable";
    }

    return timestamp.toDate().toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "pending":
        return "Finding Helper";

      case "assigned":
        return "Helper Assigned";

      case "confirmed":
        return "Confirmed";

      case "in_progress":
        return "In Progress";

      case "completed":
        return "Completed";

      case "cancelled":
        return "Cancelled";

      case "no_maid_found":
        return "No Helper Found";

      default:
        return "Unknown";
    }
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return styles.statusSuccess;

      case "assigned":
      case "in_progress":
        return styles.statusInfo;

      case "cancelled":
      case "no_maid_found":
        return styles.statusDanger;

      case "pending":
      default:
        return styles.statusPending;
    }
  };

  const getStatusTextStyle = (status?: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return styles.statusTextSuccess;

      case "assigned":
      case "in_progress":
        return styles.statusTextInfo;

      case "cancelled":
      case "no_maid_found":
        return styles.statusTextDanger;

      case "pending":
      default:
        return styles.statusTextPending;
    }
  };

  const handleViewStatus = (booking: Booking) => {
    const activeStatuses = [
      "pending",
      "assigned",
      "confirmed",
      "in_progress",
    ];

    if (!activeStatuses.includes(booking.status || "")) {
      return;
    }

    router.push({
      pathname: "/customer/waiting",
      params: {
        bookingId: booking.id,
      },
    });
  };

  const handleBookHelper = () => {
    router.push("/customer/booking");
  };

  // ------------------------------------------
  // OPEN CANCEL MODAL
  // ------------------------------------------
  const openCancelModal = (booking: Booking) => {
    const cancellableStatuses = [
      "pending",
      "assigned",
      "confirmed",
      "in_progress",
    ];

    if (!cancellableStatuses.includes(booking.status || "")) {
      return;
    }

    setSelectedBooking(booking);
    setSelectedReason("");
    setOtherReason("");
    setCancelModalVisible(true);
  };

  // ------------------------------------------
  // CLOSE CANCEL MODAL
  // ------------------------------------------
  const closeCancelModal = () => {
    if (cancelling) {
      return;
    }

    setCancelModalVisible(false);
    setSelectedBooking(null);
    setSelectedReason("");
    setOtherReason("");
  };

  // ------------------------------------------
  // CONFIRM CANCELLATION
  // ------------------------------------------
  const confirmCancellation = async () => {
    if (!selectedBooking || cancelling) {
      return;
    }

    let finalReason = selectedReason.trim();

    // If Other selected, use typed reason
    if (selectedReason === "Other") {
      finalReason = otherReason.trim();

      if (!finalReason) {
        Alert.alert(
          "Reason Required",
          "Please tell us why you are cancelling this booking."
        );
        return;
      }
    }

    if (!finalReason) {
      Alert.alert(
        "Select a Reason",
        "Please select a reason before cancelling the booking."
      );
      return;
    }

    Alert.alert(
      "Cancel Booking?",
      "Are you sure you want to cancel this booking?",
      [
        {
          text: "Keep Booking",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);

              const user = auth.currentUser;

              if (!user) {
                setCancelling(false);
                setCancelModalVisible(false);
                router.replace("/auth/login");
                return;
              }

              const bookingRef = doc(
                db,
                "bookings",
                selectedBooking.id
              );

              await updateDoc(bookingRef, {
                status: "cancelled",
                cancellationReason: finalReason,
                cancelledBy: "customer",
                cancelledAt: Timestamp.now(),
              });

              setCancelModalVisible(false);
              setSelectedBooking(null);
              setSelectedReason("");
              setOtherReason("");

              Alert.alert(
                "Booking Cancelled",
                "Your booking has been cancelled successfully."
              );
            } catch (error) {
              console.error(
                "CANCEL BOOKING ERROR:",
                error
              );

              Alert.alert(
                "Unable to Cancel",
                "Something went wrong while cancelling your booking. Please try again."
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const renderBookingCard = (booking: Booking) => {
    const status = booking.status || "pending";

    const isActive =
      status === "pending" ||
      status === "assigned" ||
      status === "confirmed" ||
      status === "in_progress";

    const canCancel =
      status === "pending" ||
      status === "assigned" ||
      status === "confirmed" ||
      status === "in_progress";

    return (
      <View key={booking.id} style={styles.bookingCard}>
        {/* Top Row */}
        <View style={styles.bookingTopRow}>
          <View style={styles.bookingTitleContainer}>
            <Text style={styles.bookingTitle}>
              {booking.categories?.length
                ? booking.categories
                    .map((category) =>
                      formatCategoryName(category)
                    )
                    .join(", ")
                : "Helper Service"}
            </Text>

            <Text style={styles.bookingId}>
              Booking #{booking.id.slice(0, 8)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              getStatusStyle(status),
            ]}
          >
            <Text
              style={[
                styles.statusText,
                getStatusTextStyle(status),
              ]}
            >
              {getStatusLabel(status)}
            </Text>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Text style={styles.infoIcon}>📅</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>
              Date & Time
            </Text>

            <Text style={styles.infoValue}>
              {formatDateTime(
                booking.scheduledDateTime
              )}
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Text style={styles.infoIcon}>⏱</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>
              Duration
            </Text>

            <Text style={styles.infoValue}>
              {booking.duration || 0} hour
              {booking.duration === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Text style={styles.infoIcon}>📍</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>
              Service Address
            </Text>

            <Text
              style={styles.infoValue}
              numberOfLines={2}
            >
              {booking.customerAddress
                ?.formattedAddress ||
                "Address unavailable"}
            </Text>
          </View>
        </View>

        {/* Cancellation Reason */}
        {status === "cancelled" &&
          booking.cancellationReason ? (
          <View style={styles.cancelledReasonBox}>
            <Text style={styles.cancelledReasonLabel}>
              Cancellation Reason
            </Text>

            <Text style={styles.cancelledReasonText}>
              {booking.cancellationReason}
            </Text>
          </View>
        ) : null}

        {/* Bottom */}
        <View style={styles.bookingBottom}>
          <View>
            <Text style={styles.totalLabel}>
              Total
            </Text>

            <Text style={styles.totalPrice}>
              ₹{booking.totalPrice || 0}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            {isActive && (
              <Pressable
                style={styles.viewStatusButton}
                onPress={() =>
                  handleViewStatus(booking)
                }
              >
                <Text style={styles.viewStatusText}>
                  View Status →
                </Text>
              </Pressable>
            )}

            {canCancel && (
              <Pressable
                style={styles.cancelButton}
                onPress={() =>
                  openCancelModal(booking)
                }
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading your bookings...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.replace("/customer")
          }
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            My Bookings
          </Text>

          <Text style={styles.subtitle}>
            View your booking history
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            Something went wrong
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Count */}
        {bookings.length > 0 && (
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {bookings.length} Booking
              {bookings.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}

        {/* Empty State */}
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>
                📋
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No bookings yet
            </Text>

            <Text style={styles.emptyText}>
              Your bookings will appear here once
              you book a helper.
            </Text>

            <Pressable
              style={styles.bookButton}
              onPress={handleBookHelper}
            >
              <Text style={styles.bookButtonText}>
                Book a Helper
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {bookings.map(renderBookingCard)}
          </View>
        )}
      </ScrollView>

      {/* -------------------------------------- */}
      {/* CANCELLATION MODAL */}
      {/* -------------------------------------- */}

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModal}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Cancel Booking
                </Text>

                <Text style={styles.modalSubtitle}>
                  Please tell us why you are cancelling.
                </Text>
              </View>

              <Pressable
                style={styles.modalCloseButton}
                onPress={closeCancelModal}
                disabled={cancelling}
              >
                <Text style={styles.modalCloseText}>
                  ×
                </Text>
              </Pressable>
            </View>

            {/* Reasons */}
            <ScrollView
              style={styles.reasonList}
              showsVerticalScrollIndicator={false}
            >
              {cancellationReasons.map(
                (reason) => {
                  const isSelected =
                    selectedReason === reason;

                  return (
                    <Pressable
                      key={reason}
                      style={[
                        styles.reasonOption,
                        isSelected &&
                          styles.reasonOptionSelected,
                      ]}
                      onPress={() =>
                        setSelectedReason(reason)
                      }
                      disabled={cancelling}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          isSelected &&
                            styles.radioOuterSelected,
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={
                              styles.radioInner
                            }
                          />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.reasonText,
                          isSelected &&
                            styles.reasonTextSelected,
                        ]}
                      >
                        {reason}
                      </Text>
                    </Pressable>
                  );
                }
              )}

              {/* Other Reason Input */}
              {selectedReason === "Other" && (
                <View style={styles.otherReasonContainer}>
                  <Text style={styles.otherReasonLabel}>
                    Tell us more
                  </Text>

                  <TextInput
                    value={otherReason}
                    onChangeText={setOtherReason}
                    placeholder="Enter your reason..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={200}
                    style={styles.otherReasonInput}
                    editable={!cancelling}
                  />

                  <Text style={styles.characterCount}>
                    {otherReason.length}/200
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.keepBookingButton}
                onPress={closeCancelModal}
                disabled={cancelling}
              >
                <Text style={styles.keepBookingText}>
                  Keep Booking
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmCancelButton,
                  (!selectedReason ||
                    (selectedReason === "Other" &&
                      !otherReason.trim()) ||
                    cancelling) &&
                    styles.confirmCancelButtonDisabled,
                ]}
                onPress={confirmCancellation}
                disabled={
                  !selectedReason ||
                  (selectedReason === "Other" &&
                    !otherReason.trim()) ||
                  cancelling
                }
              >
                {cancelling ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmCancelText
                    }
                  >
                    Confirm Cancellation
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.replace("/customer")
          }
        >
          <Text style={styles.navIcon}>⌂</Text>

          <Text style={styles.navText}>
            Home
          </Text>
        </Pressable>

        <Pressable style={styles.navItem}>
          <Text style={styles.navIconActive}>
            📋
          </Text>

          <Text style={styles.navTextActive}>
            Bookings
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.replace("/customer/profile")
          }
        >
          <Text style={styles.navIcon}>👤</Text>

          <Text style={styles.navText}>
            Profile
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const formatCategoryName = (
  category: string
) => {
  return category
    .replace(/_/g, " ")
    .replace(/\band\b/g, "&")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

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

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "#F7F8FA",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backText: {
    fontSize: 30,
    color: "#111827",
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },

  countRow: {
    marginBottom: 12,
  },

  countText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },

  bookingsList: {
    gap: 14,
  },

  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  bookingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  bookingTitleContainer: {
    flex: 1,
    paddingRight: 10,
  },

  bookingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 21,
  },

  bookingId: {
    marginTop: 4,
    fontSize: 10,
    color: "#9CA3AF",
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },

  statusPending: {
    backgroundColor: "#FFF7E8",
  },

  statusInfo: {
    backgroundColor: "#EFF6FF",
  },

  statusSuccess: {
    backgroundColor: "#ECFDF5",
  },

  statusDanger: {
    backgroundColor: "#FEF2F2",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },

  statusTextPending: {
    color: "#B45309",
  },

  statusTextInfo: {
    color: "#2563EB",
  },

  statusTextSuccess: {
    color: "#15803D",
  },

  statusTextDanger: {
    color: "#DC2626",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  infoIcon: {
    fontSize: 17,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "600",
    marginBottom: 3,
    textTransform: "uppercase",
  },

  infoValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
  },

  cancelledReasonBox: {
    marginTop: 2,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
  },

  cancelledReasonLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B91C1C",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  cancelledReasonText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#7F1D1D",
  },

  bookingBottom: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 3,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 2,
  },

  totalPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  viewStatusButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
  },

  viewStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  cancelButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
  },

  cancelButtonText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "700",
  },

  emptyContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 45,
    marginTop: 20,
  },

  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyIcon: {
    fontSize: 30,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },

  emptyText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 280,
  },

  bookButton: {
    marginTop: 22,
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 13,
  },

  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  errorCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
  },

  errorTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B91C1C",
  },

  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: "#B91C1C",
  },

  // ------------------------------------------
  // MODAL STYLES
  // ------------------------------------------

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },

  cancelModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: "85%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
  },

  modalSubtitle: {
    marginTop: 5,
    fontSize: 12,
    color: "#6B7280",
  },

  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    fontSize: 24,
    color: "#374151",
    marginTop: -2,
  },

  reasonList: {
    marginBottom: 12,
  },

  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 9,
  },

  reasonOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#F9FAFB",
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  radioOuterSelected: {
    borderColor: "#111827",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#111827",
  },

  reasonText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  reasonTextSelected: {
    color: "#111827",
    fontWeight: "700",
  },

  otherReasonContainer: {
    marginTop: 2,
    marginBottom: 10,
  },

  otherReasonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 7,
  },

  otherReasonInput: {
    minHeight: 85,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    color: "#111827",
    textAlignVertical: "top",
    backgroundColor: "#F9FAFB",
  },

  characterCount: {
    textAlign: "right",
    marginTop: 4,
    fontSize: 10,
    color: "#9CA3AF",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 5,
  },

  keepBookingButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  keepBookingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  confirmCancelButton: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmCancelButtonDisabled: {
    backgroundColor: "#FCA5A5",
  },

  confirmCancelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
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