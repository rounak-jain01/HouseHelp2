import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Location from "expo-location";

import { getAuth } from "@react-native-firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  updateDoc,
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

type CustomerAddress = {
  formattedAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  landmark?: string | null;
};

type Booking = {
  customerId?: string;
  customerName?: string;

  maidId?: string | null;

  categories?: string[];

  duration?: number;

  totalPrice?: number;

  status?: BookingStatus;

  scheduledDateTime?: Timestamp | null;

  customerAddress?: CustomerAddress;

  createdAt?: Timestamp | null;

  maidResponse?: string;

  respondedAt?: Timestamp | null;

  travelStartedAt?: Timestamp | null;

  maidCurrentLocation?: {
    latitude?: number;
    longitude?: number;
    updatedAt?: Timestamp | null;
  };

  startedAt?: Timestamp | null;

  completedAt?: Timestamp | null;

  cancelledAt?: Timestamp | null;

  cancellationReason?: string;

  cancelledBy?: string;
};

const auth = getAuth();
const db = getFirestore();

export default function MaidActiveBooking() {
  const params = useLocalSearchParams<{
    bookingId?: string | string[];
  }>();

  const bookingIdFromParams = Array.isArray(params.bookingId)
    ? params.bookingId[0]
    : params.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);

  const [currentBookingId, setCurrentBookingId] = useState<
    string | null
  >(bookingIdFromParams || null);

  const [loading, setLoading] = useState(true);

  const [updating, setUpdating] = useState(false);

  const [navigationStarted, setNavigationStarted] =
    useState(false);

  const [error, setError] = useState("");

  /**
   * Listen to booking in realtime.
   */
  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupListener = () => {
      try {
        setLoading(true);
        setError("");

        /**
         * If bookingId was passed from Booking Request screen,
         * listen directly to that booking.
         */
        if (bookingIdFromParams) {
          const bookingRef = doc(
            db,
            "bookings",
            bookingIdFromParams
          );

          unsubscribe = onSnapshot(
            bookingRef,
            (snapshot) => {
              if (!snapshot.exists()) {
                setBooking(null);
                setLoading(false);
                setError("Booking not found.");
                return;
              }

              const data = snapshot.data() as Booking;

              setBooking(data);
              setCurrentBookingId(bookingIdFromParams);

              setNavigationStarted(
                Boolean(data.travelStartedAt)
              );

              setLoading(false);
            },
            (listenerError) => {
              console.log(
                "ACTIVE BOOKING LISTENER ERROR:",
                listenerError
              );

              setLoading(false);
              setError(
                "Unable to load booking. Please try again."
              );
            }
          );

          return;
        }

        /**
         * If no bookingId was passed,
         * find the maid's active booking.
         */
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("maidId", "==", user.uid)
        );

        unsubscribe = onSnapshot(
          bookingsQuery,
          (snapshot) => {
            const activeDocs = snapshot.docs.filter((item) => {
              const data = item.data() as Booking;

              return (
                data.status === "confirmed" ||
                data.status === "in_progress"
              );
            });

            if (activeDocs.length === 0) {
              setBooking(null);
              setCurrentBookingId(null);
              setNavigationStarted(false);
              setLoading(false);
              return;
            }

            /**
             * Latest active booking.
             */
            activeDocs.sort((a, b) => {
              const aData = a.data() as Booking;
              const bData = b.data() as Booking;

              const aTime =
                aData.createdAt?.toMillis?.() ?? 0;

              const bTime =
                bData.createdAt?.toMillis?.() ?? 0;

              return bTime - aTime;
            });

            const activeBooking = activeDocs[0];

            const data =
              activeBooking.data() as Booking;

            setBooking(data);
            setCurrentBookingId(activeBooking.id);

            setNavigationStarted(
              Boolean(data.travelStartedAt)
            );

            setLoading(false);
          },
          (listenerError) => {
            console.log(
              "ACTIVE BOOKINGS LISTENER ERROR:",
              listenerError
            );

            setLoading(false);
            setError(
              "Unable to load active booking."
            );
          }
        );
      } catch (listenerSetupError) {
        console.log(
          "ACTIVE BOOKING SETUP ERROR:",
          listenerSetupError
        );

        setLoading(false);
        setError(
          "Something went wrong while loading booking."
        );
      }
    };

    setupListener();

    return () => {
      unsubscribe?.();
    };
  }, [bookingIdFromParams]);

  /**
   * Format scheduled date/time.
   */
  const formatBookingTime = () => {
    if (!booking?.scheduledDateTime) {
      return "Not available";
    }

    try {
      const date =
        booking.scheduledDateTime.toDate();

      return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "Not available";
    }
  };

  /**
   * Convert category IDs/names into readable text.
   */
  const formatCategory = (category: string) => {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  /**
   * GO TO JOB
   *
   * 1. Ask maid for location permission.
   * 2. Get maid's current GPS location.
   * 3. Get customer's coordinates.
   * 4. Save travelStartedAt and maidCurrentLocation.
   * 5. Open Google Maps directions.
   */
  const handleGoToJob = async () => {
    if (!booking || !currentBookingId) {
      Alert.alert(
        "Booking Not Found",
        "Unable to find the active booking."
      );
      return;
    }

    const customerLat =
      booking.customerAddress?.latitude;

    const customerLng =
      booking.customerAddress?.longitude;

    /**
     * Customer coordinates are required
     * for proper navigation.
     */
    if (
      typeof customerLat !== "number" ||
      typeof customerLng !== "number"
    ) {
      Alert.alert(
        "Location Not Available",
        "Customer's location is not available for navigation."
      );

      return;
    }

    try {
      setUpdating(true);

      /**
       * Request foreground location permission.
       */
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Location Permission Required",
          "Please allow location access so we can start navigation from your current location."
        );

        setUpdating(false);
        return;
      }

      /**
       * Get current maid location.
       */
      const currentPosition =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const maidLat =
        currentPosition.coords.latitude;

      const maidLng =
        currentPosition.coords.longitude;

      /**
       * Timestamp for this navigation session.
       */
      const navigationStartedAt =
        Timestamp.now();

      /**
       * Save navigation state in Firestore.
       *
       * This is useful because local React state can reset
       * when the app is reopened.
       */
      await updateDoc(
        doc(db, "bookings", currentBookingId),
        {
          travelStartedAt: navigationStartedAt,

          maidCurrentLocation: {
            latitude: maidLat,
            longitude: maidLng,
            updatedAt: navigationStartedAt,
          },
        }
      );

      setNavigationStarted(true);

      /**
       * Google Maps universal directions URL.
       *
       * Origin:
       * Maid's current location
       *
       * Destination:
       * Customer's location
       */
      const mapsUrl =
        `https://www.google.com/maps/dir/?api=1` +
        `&origin=${maidLat},${maidLng}` +
        `&destination=${customerLat},${customerLng}` +
        `&travelmode=driving`;

      await Linking.openURL(mapsUrl);
    } catch (navigationError) {
      console.log(
        "GO TO JOB ERROR:",
        navigationError
      );

      Alert.alert(
        "Navigation Error",
        "Unable to start navigation. Please try again."
      );
    } finally {
      setUpdating(false);
    }
  };

  /**
   * START JOB
   *
   * Only available after Go To Job.
   */
  const handleStartJob = async () => {
    if (!currentBookingId || !booking) {
      return;
    }

    if (booking.status !== "confirmed") {
      Alert.alert(
        "Unable to Start",
        "This booking is no longer ready to start."
      );

      return;
    }

    if (!navigationStarted) {
      Alert.alert(
        "Go To Job First",
        "Please start navigation before starting the job."
      );

      return;
    }

    Alert.alert(
      "Start Job",
      "Have you reached the customer location?",
      [
        {
          text: "Not Yet",
          style: "cancel",
        },
        {
          text: "Yes, Start",
          onPress: async () => {
            try {
              setUpdating(true);

              await updateDoc(
                doc(db, "bookings", currentBookingId),
                {
                  status: "in_progress",
                  startedAt: Timestamp.now(),
                }
              );
            } catch (startError) {
              console.log(
                "START JOB ERROR:",
                startError
              );

              Alert.alert(
                "Error",
                "Could not start the job. Please try again."
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  /**
   * COMPLETE JOB
   */
  const handleCompleteJob = async () => {
    if (!currentBookingId || !booking) {
      return;
    }

    if (booking.status !== "in_progress") {
      return;
    }

    Alert.alert(
      "Complete Job",
      "Are you sure the job has been completed?",
      [
        {
          text: "Not Yet",
          style: "cancel",
        },
        {
          text: "Complete",
          onPress: async () => {
            try {
              setUpdating(true);

              await updateDoc(
                doc(db, "bookings", currentBookingId),
                {
                  status: "completed",
                  completedAt: Timestamp.now(),
                }
              );

              Alert.alert(
                "Job Completed",
                "The booking has been marked as completed.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/maid");
                    },
                  },
                ]
              );
            } catch (completeError) {
              console.log(
                "COMPLETE JOB ERROR:",
                completeError
              );

              Alert.alert(
                "Error",
                "Could not complete the job. Please try again."
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  /**
   * CANCEL BOOKING
   *
   * Kept here because the current active-booking screen
   * already supports the existing cancellation flow.
   */
  const handleCancelJob = async () => {
    if (!currentBookingId || !booking) {
      return;
    }

    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdating(true);

              await updateDoc(
                doc(db, "bookings", currentBookingId),
                {
                  status: "cancelled",
                  cancellationReason:
                    "Cancelled by maid",
                  cancelledBy: "maid",
                  cancelledAt: Timestamp.now(),
                }
              );

              Alert.alert(
                "Booking Cancelled",
                "The booking has been cancelled.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/maid");
                    },
                  },
                ]
              );
            } catch (cancelError) {
              console.log(
                "CANCEL BOOKING ERROR:",
                cancelError
              );

              Alert.alert(
                "Error",
                "Could not cancel the booking. Please try again."
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Loading screen.
   */
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading active booking...
        </Text>
      </View>
    );
  }

  /**
   * Error screen.
   */
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>
          ⚠️
        </Text>

        <Text style={styles.errorTitle}>
          Something went wrong
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  /**
   * Empty state.
   */
  if (!booking || !currentBookingId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>
          📋
        </Text>

        <Text style={styles.emptyTitle}>
          No Active Booking
        </Text>

        <Text style={styles.emptyText}>
          You currently don't have an active job.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/maid")}
        >
          <Text style={styles.backButtonText}>
            Back to Home
          </Text>
        </Pressable>
      </View>
    );
  }

  const isConfirmed =
    booking.status === "confirmed";

  const isInProgress =
    booking.status === "in_progress";

  const isCompleted =
    booking.status === "completed";

  const isCancelled =
    booking.status === "cancelled";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerBack}
            onPress={() => router.back()}
          >
            <Text style={styles.headerBackText}>
              ‹
            </Text>
          </Pressable>

          <View>
            <Text style={styles.headerTitle}>
              Active Booking
            </Text>

            <Text style={styles.headerSubtitle}>
              Job details
            </Text>
          </View>
        </View>

        {/* STATUS CARD */}
        <View style={styles.statusCard}>
          <View style={styles.statusIconBox}>
            <Text style={styles.statusIcon}>
              {isConfirmed
                ? "📍"
                : isInProgress
                ? "🔧"
                : isCompleted
                ? "✓"
                : isCancelled
                ? "✕"
                : "📋"}
            </Text>
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusLabel}>
              Booking Status
            </Text>

            <Text style={styles.statusValue}>
              {isConfirmed
                ? "Confirmed"
                : isInProgress
                ? "Job In Progress"
                : isCompleted
                ? "Completed"
                : isCancelled
                ? "Cancelled"
                : booking.status || "Unknown"}
            </Text>
          </View>
        </View>

        {/* CUSTOMER */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Customer
          </Text>

          <View style={styles.customerRow}>
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
                {booking.customerName ||
                  "Customer"}
              </Text>

              <Text style={styles.customerSubtext}>
                Customer
              </Text>
            </View>
          </View>
        </View>

        {/* SERVICES */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Services
          </Text>

          {booking.categories &&
          booking.categories.length > 0 ? (
            <View style={styles.categoryContainer}>
              {booking.categories.map(
                (category, index) => (
                  <View
                    key={`${category}-${index}`}
                    style={styles.categoryChip}
                  >
                    <Text
                      style={
                        styles.categoryChipText
                      }
                    >
                      {formatCategory(category)}
                    </Text>
                  </View>
                )
              )}
            </View>
          ) : (
            <Text style={styles.mutedText}>
              No services listed
            </Text>
          )}
        </View>

        {/* BOOKING DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Booking Details
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>
              ⏱
            </Text>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Duration
              </Text>

              <Text style={styles.detailValue}>
                {booking.duration
                  ? `${booking.duration} hour${
                      booking.duration > 1
                        ? "s"
                        : ""
                    }`
                  : "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>
              📅
            </Text>

            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>
                Scheduled For
              </Text>

              <Text style={styles.detailValue}>
                {formatBookingTime()}
              </Text>
            </View>
          </View>
        </View>

        {/* CUSTOMER LOCATION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Customer Location
          </Text>

          <View style={styles.locationBox}>
            <Text style={styles.locationIcon}>
              📍
            </Text>

            <View style={styles.locationContent}>
              <Text style={styles.addressText}>
                {booking.customerAddress
                  ?.formattedAddress ||
                  "Address not available"}
              </Text>

              {booking.customerAddress
                ?.landmark ? (
                <Text
                  style={styles.landmarkText}
                >
                  Landmark:{" "}
                  {
                    booking.customerAddress
                      .landmark
                  }
                </Text>
              ) : null}
            </View>
          </View>

          {typeof booking.customerAddress
            ?.latitude === "number" &&
          typeof booking.customerAddress
            ?.longitude === "number" ? (
            <Text style={styles.coordinatesText}>
              Location coordinates available
            </Text>
          ) : (
            <Text style={styles.coordinatesWarning}>
              Customer coordinates unavailable
            </Text>
          )}
        </View>

        {/* EARNINGS */}
        <View style={styles.earningCard}>
          <View>
            <Text style={styles.earningLabel}>
              Your Earnings
            </Text>

            <Text style={styles.earningSubtext}>
              Booking amount
            </Text>
          </View>

          <Text style={styles.earningAmount}>
            ₹{booking.totalPrice || 0}
          </Text>
        </View>

        {/* PROGRESS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Job Progress
          </Text>

          <View style={styles.progressContainer}>
            {/* CONFIRMED */}
            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressCircle,
                  (isConfirmed ||
                    isInProgress ||
                    isCompleted) &&
                    styles.progressCircleActive,
                ]}
              >
                <Text
                  style={[
                    styles.progressCircleText,
                    (isConfirmed ||
                      isInProgress ||
                      isCompleted) &&
                      styles.progressCircleTextActive,
                  ]}
                >
                  1
                </Text>
              </View>

              <Text
                style={[
                  styles.progressText,
                  (isConfirmed ||
                    isInProgress ||
                    isCompleted) &&
                    styles.progressTextActive,
                ]}
              >
                Confirmed
              </Text>
            </View>

            <View
              style={[
                styles.progressLine,
                (isInProgress ||
                  isCompleted) &&
                  styles.progressLineActive,
              ]}
            />

            {/* IN PROGRESS */}
            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressCircle,
                  (isInProgress ||
                    isCompleted) &&
                    styles.progressCircleActive,
                ]}
              >
                <Text
                  style={[
                    styles.progressCircleText,
                    (isInProgress ||
                      isCompleted) &&
                      styles.progressCircleTextActive,
                  ]}
                >
                  2
                </Text>
              </View>

              <Text
                style={[
                  styles.progressText,
                  (isInProgress ||
                    isCompleted) &&
                    styles.progressTextActive,
                ]}
              >
                In Progress
              </Text>
            </View>

            <View
              style={[
                styles.progressLine,
                isCompleted &&
                  styles.progressLineActive,
              ]}
            />

            {/* COMPLETED */}
            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressCircle,
                  isCompleted &&
                    styles.progressCircleActive,
                ]}
              >
                <Text
                  style={[
                    styles.progressCircleText,
                    isCompleted &&
                      styles.progressCircleTextActive,
                  ]}
                >
                  3
                </Text>
              </View>

              <Text
                style={[
                  styles.progressText,
                  isCompleted &&
                    styles.progressTextActive,
                ]}
              >
                Completed
              </Text>
            </View>
          </View>
        </View>

        {/* ACTIONS */}
        {!isCompleted && !isCancelled ? (
          <View style={styles.actions}>
            {/* GO TO JOB */}
            {isConfirmed &&
            !navigationStarted ? (
              <>
                <Pressable
                  style={[
                    styles.goButton,
                    updating &&
                      styles.disabledButton,
                  ]}
                  onPress={handleGoToJob}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Text
                        style={styles.actionIcon}
                      >
                        📍
                      </Text>

                      <Text
                        style={
                          styles.goButtonText
                        }
                      >
                        Go To Job
                      </Text>
                    </>
                  )}
                </Pressable>

                <Text style={styles.helperText}>
                  Google Maps will open with
                  directions from your current
                  location to the customer.
                </Text>
              </>
            ) : null}

            {/* NAVIGATION STARTED */}
            {isConfirmed &&
            navigationStarted ? (
              <>
                <View
                  style={
                    styles.navigationInfo
                  }
                >
                  <Text
                    style={
                      styles.navigationTitle
                    }
                  >
                    🚗 On The Way
                  </Text>

                  <Text
                    style={
                      styles.navigationText
                    }
                  >
                    Navigation has started.
                    Reach the customer and
                    then start the job.
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.startButton,
                    updating &&
                      styles.disabledButton,
                  ]}
                  onPress={handleStartJob}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Text
                        style={styles.actionIcon}
                      >
                        ▶
                      </Text>

                      <Text
                        style={
                          styles.startButtonText
                        }
                      >
                        Start Job
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}

            {/* IN PROGRESS */}
            {isInProgress ? (
              <View>
                <View
                  style={
                    styles.jobProgressInfo
                  }
                >
                  <Text
                    style={
                      styles.jobProgressTitle
                    }
                  >
                    🔧 Job In Progress
                  </Text>

                  <Text
                    style={
                      styles.jobProgressText
                    }
                  >
                    Complete the work and then
                    mark the booking as completed.
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.completeButton,
                    updating &&
                      styles.disabledButton,
                  ]}
                  onPress={handleCompleteJob}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Text
                        style={styles.actionIcon}
                      >
                        ✓
                      </Text>

                      <Text
                        style={
                          styles.completeButtonText
                        }
                      >
                        Complete Job
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* CANCEL */}
            <Pressable
              style={[
                styles.cancelButton,
                updating &&
                  styles.disabledButton,
              ]}
              onPress={handleCancelJob}
              disabled={updating}
            >
              <Text
                style={styles.cancelButtonText}
              >
                Cancel Booking
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* COMPLETED */}
        {isCompleted ? (
          <View style={styles.completedCard}>
            <Text
              style={styles.completedIcon}
            >
              ✓
            </Text>

            <Text
              style={styles.completedTitle}
            >
              Job Completed
            </Text>

            <Text
              style={styles.completedText}
            >
              This booking has been successfully
              completed.
            </Text>

            <Pressable
              style={styles.homeButton}
              onPress={() =>
                router.replace("/maid")
              }
            >
              <Text
                style={styles.homeButtonText}
              >
                Back to Home
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* CANCELLED */}
        {isCancelled ? (
          <View style={styles.cancelledCard}>
            <Text
              style={styles.cancelledIcon}
            >
              ✕
            </Text>

            <Text
              style={styles.cancelledTitle}
            >
              Booking Cancelled
            </Text>

            <Text
              style={styles.cancelledText}
            >
              This booking is no longer active.
            </Text>

            <Pressable
              style={styles.homeButton}
              onPress={() =>
                router.replace("/maid")
              }
            >
              <Text
                style={styles.homeButtonText}
              >
                Back to Home
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  content: {
    padding: 20,
    paddingTop: 12,
  },

  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#64748B",
  },

  errorIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  errorTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },

  errorText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  headerBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  headerBackText: {
    fontSize: 30,
    color: "#0F172A",
    lineHeight: 32,
    marginTop: -3,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748B",
  },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  statusIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  statusIcon: {
    fontSize: 24,
  },

  statusContent: {
    flex: 1,
  },

  statusLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 3,
  },

  statusValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 15,
  },

  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#334155",
  },

  customerInfo: {
    flex: 1,
  },

  customerName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },

  customerSubtext: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748B",
  },

  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoryChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  categoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  mutedText: {
    color: "#64748B",
    fontSize: 14,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  detailRowLast: {
    marginBottom: 0,
  },

  detailIcon: {
    width: 36,
    fontSize: 21,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 3,
  },

  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },

  locationBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },

  locationIcon: {
    fontSize: 21,
    marginRight: 10,
  },

  locationContent: {
    flex: 1,
  },

  addressText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#334155",
  },

  landmarkText: {
    marginTop: 7,
    fontSize: 13,
    color: "#64748B",
  },

  coordinatesText: {
    marginTop: 10,
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "600",
  },

  coordinatesWarning: {
    marginTop: 10,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },

  earningCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },

  earningLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#065F46",
  },

  earningSubtext: {
    marginTop: 3,
    fontSize: 12,
    color: "#047857",
  },

  earningAmount: {
    fontSize: 25,
    fontWeight: "900",
    color: "#047857",
  },

  progressContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  progressItem: {
    alignItems: "center",
    width: 80,
  },

  progressCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCircleActive: {
    backgroundColor: "#16A34A",
  },

  progressCircleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
  },

  progressCircleTextActive: {
    color: "#FFFFFF",
  },

  progressText: {
    marginTop: 7,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },

  progressTextActive: {
    color: "#16A34A",
    fontWeight: "800",
  },

  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#E2E8F0",
    marginTop: 15,
    marginHorizontal: 2,
  },

  progressLineActive: {
    backgroundColor: "#16A34A",
  },

  actions: {
    gap: 12,
  },

  goButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  goButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  actionIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    marginRight: 9,
  },

  helperText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 15,
  },

  navigationInfo: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 15,
    padding: 15,
  },

  navigationTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#C2410C",
    marginBottom: 5,
  },

  navigationText: {
    fontSize: 13,
    color: "#7C2D12",
    lineHeight: 19,
  },

  startButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  startButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  jobProgressInfo: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },

  jobProgressTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1D4ED8",
    marginBottom: 5,
  },

  jobProgressText: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 19,
  },

  completeButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.6,
  },

  completedCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginTop: 4,
  },

  completedIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#16A34A",
    color: "#FFFFFF",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 30,
    fontWeight: "900",
    overflow: "hidden",
    paddingTop: 9,
  },

  completedTitle: {
    marginTop: 13,
    fontSize: 20,
    fontWeight: "900",
    color: "#065F46",
  },

  completedText: {
    marginTop: 6,
    fontSize: 13,
    color: "#047857",
    textAlign: "center",
    lineHeight: 19,
  },

  cancelledCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    marginTop: 4,
  },

  cancelledIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 28,
    fontWeight: "900",
    overflow: "hidden",
    paddingTop: 10,
  },

  cancelledTitle: {
    marginTop: 13,
    fontSize: 20,
    fontWeight: "900",
    color: "#991B1B",
  },

  cancelledText: {
    marginTop: 6,
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
    lineHeight: 19,
  },

  backButton: {
    minWidth: 140,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  homeButton: {
    marginTop: 18,
    minWidth: 170,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  homeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  bottomSpace: {
    height: 30,
  },
});