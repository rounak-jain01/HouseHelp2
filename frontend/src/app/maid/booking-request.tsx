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
  onSnapshot,
} from "@react-native-firebase/firestore";
import {
  getAuth,
} from "@react-native-firebase/auth";
import {
  getFunctions,
  httpsCallable,
} from "@react-native-firebase/functions";

const app = getApp();

const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, "asia-south1");

type Booking = {
  customerId?: string;
  maidId?: string | null;

  categories?: string[];

  duration?: number;

  scheduledDateTime?: any;

  status?: string;

  customerName?: string;

  customerAddress?: {
    formattedAddress?: string;
    latitude?: number | null;
    longitude?: number | null;
    landmark?: string | null;
  };

  totalPrice?: number;

  offeredMaidIds?: string[];

  maidResponses?: Record<
    string,
    "accepted" | "rejected" | "timeout"
  >;

  winningMaidId?: string | null;

  createdAt?: any;
};

type CallableResponse = {
  success?: boolean;
  bookingId?: string;
  message?: string;
};

export default function BookingRequestScreen() {
  const { bookingId } =
    useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] =
    useState<Booking | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [responding, setResponding] =
    useState(false);

  const [secondsLeft, setSecondsLeft] =
    useState(180);

  const [requestClosed, setRequestClosed] =
    useState(false);

  const maidId = auth.currentUser?.uid;

  /*
   * =========================================================
   * LOAD + REALTIME BOOKING LISTENER
   * =========================================================
   *
   * Important:
   *
   * All eligible maids receive the same booking request.
   *
   * If another maid accepts first:
   *
   * booking.status = confirmed
   * booking.maidId = another maid
   *
   * This screen detects that change and closes the request.
   */
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

          Alert.alert(
            "Booking Not Found",
            "This booking request is no longer available.",
            [
              {
                text: "OK",
                onPress: () => router.back(),
              },
            ]
          );

          return;
        }

        const data =
          snapshot.data() as Booking;

        setBooking(data);
        setLoading(false);

        /*
         * -----------------------------------------------------
         * REQUEST NO LONGER AVAILABLE
         * -----------------------------------------------------
         *
         * If another maid accepted first, booking becomes
         * confirmed and maidId belongs to that maid.
         */
        if (
          data.status === "confirmed" &&
          data.maidId &&
          data.maidId !== maidId
        ) {
          setRequestClosed(true);
          setResponding(true);
          return;
        }

        /*
         * If booking was cancelled or no maid was found,
         * this request should also close.
         */
        if (
          data.status === "cancelled" ||
          data.status === "no_maid_found"
        ) {
          setRequestClosed(true);
          setResponding(true);
        }

        /*
         * If current maid already responded, prevent
         * duplicate response.
         */
        const myResponse =
          maidId
            ? data.maidResponses?.[maidId]
            : undefined;

        if (
          myResponse === "accepted" ||
          myResponse === "rejected" ||
          myResponse === "timeout"
        ) {
          setRequestClosed(true);
          setResponding(true);
        }
      },
      (error) => {
        console.log(
          "Booking realtime listener error:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Error",
          "Unable to load booking request."
        );
      }
    );

    return () => unsubscribe();
  }, [bookingId, maidId]);

  /*
   * =========================================================
   * 3-MINUTE COUNTDOWN
   * =========================================================
   */
  useEffect(() => {
    if (
      !booking ||
      responding ||
      requestClosed
    ) {
      return;
    }

    if (secondsLeft <= 0) {
      handleReject(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    secondsLeft,
    booking,
    responding,
    requestClosed,
  ]);

  /*
   * =========================================================
   * FORMAT TIMER
   * =========================================================
   */
  const formatTime = (
    seconds: number
  ) => {
    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  /*
   * =========================================================
   * FORMAT BOOKING TIME
   * =========================================================
   */
  const formatBookingTime = () => {
    if (
      !booking?.scheduledDateTime
    ) {
      return "Not available";
    }

    try {
      const date =
        booking.scheduledDateTime.toDate();

      return date.toLocaleString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch (error) {
      console.log(
        "Date formatting error:",
        error
      );

      return "Not available";
    }
  };

  /*
   * =========================================================
   * ACCEPT BOOKING
   * =========================================================
   *
   * IMPORTANT:
   *
   * We DO NOT update Firestore directly.
   *
   * Backend callable function handles:
   *
   * pending check
   * maid eligibility
   * conflict check
   * transaction
   * first-accept-wins logic
   */
  const handleAccept = async () => {
    if (
      !bookingId ||
      !maidId ||
      responding ||
      requestClosed
    ) {
      return;
    }

    try {
      setResponding(true);

      const acceptBooking =
        httpsCallable<
          { bookingId: string },
          CallableResponse
        >(
          functions,
          "acceptBooking"
        );

      const result =
        await acceptBooking({
          bookingId,
        });

      console.log(
        "Accept booking result:",
        result.data
      );

      /*
       * Backend accepted this maid.
       *
       * Navigate to active booking.
       */
      router.replace({
        pathname:
          "/maid/active-booking",
        params: {
          bookingId,
        },
      });
    } catch (error: any) {
      console.log(
        "Accept booking error:",
        error
      );

      setResponding(false);

      /*
       * If another maid accepted first,
       * backend will reject this accept.
       *
       * Do not show another Alert.
       * Just close this request.
       */
      setRequestClosed(true);
    }
  };

  /*
   * =========================================================
   * REJECT / TIMEOUT
   * =========================================================
   *
   * Rejecting this maid does NOT change booking status.
   *
   * It only records:
   *
   * maidResponses[maidId] = rejected
   *
   * or
   *
   * maidResponses[maidId] = timeout
   */
  const handleReject = async (
    isTimeout = false
  ) => {
    if (
      !bookingId ||
      !maidId ||
      responding ||
      requestClosed
    ) {
      return;
    }

    try {
      setResponding(true);

      const rejectBooking =
        httpsCallable<
          {
            bookingId: string;
            response:
              | "rejected"
              | "timeout";
          },
          CallableResponse
        >(
          functions,
          "rejectBooking"
        );

      const result =
        await rejectBooking({
          bookingId,
          response: isTimeout
            ? "timeout"
            : "rejected",
        });

      console.log(
        "Reject booking result:",
        result.data
      );

      setRequestClosed(true);

      router.replace("/maid");
    } catch (error: any) {
      console.log(
        "Reject booking error:",
        error
      );

      setResponding(false);
    }
  };

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.loadingText}>
          Loading booking request...
        </Text>
      </View>
    );
  }

  /*
   * =========================================================
   * REQUEST CLOSED
   * =========================================================
   */
  if (
    requestClosed &&
    booking?.status === "confirmed" &&
    booking.maidId !== maidId
  ) {
    return (
      <View style={styles.center}>
        <View
          style={styles.closedCard}
        >
          <Text
            style={styles.closedIcon}
          >
            ✓
          </Text>

          <Text
            style={styles.closedTitle}
          >
            Booking Taken
          </Text>

          <Text
            style={styles.closedMessage}
          >
            Another helper accepted this
            booking first.
          </Text>

          <Pressable
            style={styles.closedButton}
            onPress={() =>
              router.replace("/maid")
            }
          >
            <Text
              style={
                styles.closedButtonText
              }
            >
              Go to Home
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!booking) {
    return null;
  }

  /*
   * =========================================================
   * CURRENT MAID RESPONSE
   * =========================================================
   */
  const myResponse =
    maidId
      ? booking.maidResponses?.[maidId]
      : undefined;

  /*
   * =========================================================
   * REQUEST NOT OFFERED TO THIS MAID
   * =========================================================
   */
  const isOfferedToMe =
    maidId
      ? booking.offeredMaidIds?.includes(
          maidId
        )
      : false;

  if (
    !isOfferedToMe &&
    booking.status === "pending"
  ) {
    return (
      <View style={styles.center}>
        <View
          style={styles.closedCard}
        >
          <Text
            style={styles.closedIcon}
          >
            !
          </Text>

          <Text
            style={styles.closedTitle}
          >
            Request Unavailable
          </Text>

          <Text
            style={styles.closedMessage}
          >
            This booking request is not
            available for your account.
          </Text>

          <Pressable
            style={styles.closedButton}
            onPress={() =>
              router.replace("/maid")
            }
          >
            <Text
              style={
                styles.closedButtonText
              }
            >
              Go to Home
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const categories =
    booking.categories || [];

  /*
   * =========================================================
   * MAIN UI
   * =========================================================
   */
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>
            New Booking Request
          </Text>

          <View style={styles.timer}>
            <Text
              style={styles.timerLabel}
            >
              Respond within
            </Text>

            <Text
              style={styles.timerValue}
            >
              {formatTime(secondsLeft)}
            </Text>
          </View>
        </View>

        {/* CUSTOMER */}
        <View
          style={styles.customerCard}
        >
          <Text
            style={styles.sectionLabel}
          >
            CUSTOMER
          </Text>

          <Text
            style={styles.customerName}
          >
            {booking.customerName ||
              "Customer"}
          </Text>

          <Text
            style={styles.address}
          >
            {booking.customerAddress
              ?.formattedAddress ||
              "Address not available"}
          </Text>

          {booking.customerAddress
            ?.landmark ? (
            <Text
              style={styles.landmark}
            >
              Landmark:{" "}
              {
                booking
                  .customerAddress
                  .landmark
              }
            </Text>
          ) : null}
        </View>

        {/* BOOKING DETAILS */}
        <View style={styles.card}>
          <Text
            style={styles.sectionLabel}
          >
            BOOKING DETAILS
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>
              Date & Time
            </Text>

            <Text style={styles.value}>
              {formatBookingTime()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>
              Duration
            </Text>

            <Text style={styles.value}>
              {booking.duration || 0} hour
              {booking.duration &&
              booking.duration > 1
                ? "s"
                : ""}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>
              Distance
            </Text>

            <Text style={styles.value}>
              Not available yet
            </Text>
          </View>
        </View>

        {/* REQUESTED SERVICES */}
        <View style={styles.card}>
          <Text
            style={styles.sectionLabel}
          >
            REQUESTED SERVICES
          </Text>

          {categories.map(
            (
              category: string,
              index: number
            ) => (
              <View
                key={`${category}-${index}`}
                style={styles.category}
              >
                <Text
                  style={
                    styles.categoryText
                  }
                >
                  {category}
                </Text>
              </View>
            )
          )}
        </View>

        {/* EARNING */}
        <View
          style={styles.earningCard}
        >
          <Text
            style={styles.earningLabel}
          >
            YOUR EARNING
          </Text>

          <Text
            style={styles.earningAmount}
          >
            ₹{booking.totalPrice || 0}
          </Text>

          <Text
            style={styles.earningNote}
          >
            Earnings for this booking
          </Text>
        </View>

        {/* ALREADY RESPONDED */}
        {myResponse ? (
          <View
            style={styles.responseCard}
          >
            <Text
              style={styles.responseTitle}
            >
              {myResponse === "accepted"
                ? "Booking Accepted"
                : myResponse ===
                    "timeout"
                  ? "Request Expired"
                  : "Booking Rejected"}
            </Text>

            <Text
              style={
                styles.responseMessage
              }
            >
              {myResponse ===
              "accepted"
                ? "Opening your active booking..."
                : "This booking request is no longer available."}
            </Text>
          </View>
        ) : null}

        {/* ACTIONS */}
        {!requestClosed &&
        !myResponse ? (
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.acceptButton,
                responding &&
                  styles.disabledButton,
              ]}
              disabled={responding}
              onPress={handleAccept}
            >
              {responding ? (
                <ActivityIndicator
                  color="#fff"
                />
              ) : (
                <Text
                  style={styles.acceptText}
                >
                  Accept Booking
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.rejectButton,
                responding &&
                  styles.disabledButton,
              ]}
              disabled={responding}
              onPress={() =>
                handleReject(false)
              }
            >
              <Text
                style={styles.rejectText}
              >
                Reject
              </Text>
            </Pressable>
          </View>
        ) : null}
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
    padding: 20,
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

  responseCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    alignItems: "center",
  },

  responseTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1D4ED8",
  },

  responseMessage: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
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

  closedCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 25,
    alignItems: "center",
  },

  closedIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E8F7EE",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 30,
    fontWeight: "800",
    color: "#16A34A",
    marginBottom: 15,
    overflow: "hidden",
  },

  closedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  closedMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },

  closedButton: {
    width: "100%",
    height: 52,
    borderRadius: 15,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },

  closedButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});