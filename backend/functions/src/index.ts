import { setGlobalOptions } from "firebase-functions/v2";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

import { getMessaging } from "firebase-admin/messaging";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp();

setGlobalOptions({
  region: "asia-south1",
  maxInstances: 10,
});

const db = getFirestore();
const messaging = getMessaging();

const INDIA_TIMEZONE = "Asia/Kolkata";

/* =========================================================
   TYPES
========================================================= */

type BookingStatus =
  | "pending"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_maid_found";

type AvailabilityOverride = "manual_off" | "manual_on" | null;

type AvailabilitySlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

type MaidResponse = "accepted" | "rejected" | "timeout";

type Booking = {
  customerId?: string;
  maidId?: string | null;

  maidDetails?: {
    name?: string;
    phoneNumber?: string;
    photoUrl?: string;
    verificationStatus?: "pending" | "verified" | "rejected";
    serviceCategories?: string[];
    serviceArea?: string;
  } | null;

  categories?: string[];

  duration?: number;

  scheduledDateTime?: Timestamp;

  status?: BookingStatus;

  customerName?: string;

  customerAddress?: {
    formattedAddress?: string;
    latitude?: number | null;
    longitude?: number | null;
    landmark?: string | null;
  };

  totalPrice?: number;

  createdAt?: Timestamp;

  /*
   * All maids who received this booking request.
   */
  offeredMaidIds?: string[];

  /*
   * Individual maid responses.
   *
   * Example:
   *
   * {
   *   "maidA": "rejected",
   *   "maidB": "accepted"
   * }
   */
  maidResponses?: Record<string, MaidResponse>;

  /*
   * Maid who finally won the booking.
   */
  winningMaidId?: string | null;

  assignedAt?: Timestamp;

  respondedAt?: Timestamp;

  updatedAt?: Timestamp;

  assignmentError?: string;

  cancellationReason?: string;

  cancelledBy?: string;

  startedAt?: Timestamp;

  completedAt?: Timestamp;

  travelStartedAt?: Timestamp;

  maidCurrentLocation?: {
    latitude?: number;
    longitude?: number;
    updatedAt?: Timestamp | null;
  };
};

type Maid = {
  maidId: string;

  name?: string;

  phoneNumber?: string;

  photoUrl?: string;

  role?: "maid";

  verificationStatus?: "pending" | "verified" | "rejected";

  serviceCategories?: string[];

  serviceArea?: string;

  isAvailableNow?: boolean;

  availabilitySlots?: AvailabilitySlot[];

  /*
   * manual_off
   *    Maid intentionally turned availability OFF.
   *
   * manual_on
   *    Maid intentionally turned availability ON.
   *
   * null
   *    Follow automatic scheduled availability.
   */
  availabilityOverride?: AvailabilityOverride;

  currentLocation?: {
    latitude: number;
    longitude: number;
  };

  lastAssignedAt?: Timestamp | null;
};

type NotificationType =
  | "booking_assigned"
  | "booking_confirmed"
  | "booking_started"
  | "booking_completed"
  | "booking_cancelled"
  | "no_maid_found";

type NotificationPayload = {
  recipientId: string;
  recipientRole: "customer" | "maid";
  type: NotificationType;
  title: string;
  body: string;
  bookingId: string;
};

/* =========================================================
   NOTIFICATIONS
========================================================= */

async function createNotification(payload: NotificationPayload): Promise<void> {
  const { recipientId, recipientRole, type, title, body, bookingId } = payload;

  const collectionName = recipientRole === "customer" ? "users" : "maids";

  /*
   * -------------------------------------------------------
   * 1. CREATE IN-APP NOTIFICATION
   * -------------------------------------------------------
   */

  const notificationRef = db
    .collection(collectionName)
    .doc(recipientId)
    .collection("notifications")
    .doc();

  await notificationRef.set({
    type,
    title,
    body,
    bookingId,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  /*
   * -------------------------------------------------------
   * 2. GET FCM TOKENS
   * -------------------------------------------------------
   */

  const recipientSnapshot = await db
    .collection(collectionName)
    .doc(recipientId)
    .get();

  if (!recipientSnapshot.exists) {
    console.log(`Recipient ${recipientId} not found`);

    return;
  }

  const recipientData = recipientSnapshot.data() as {
    fcmTokens?: string[];
  };

  const tokens = recipientData.fcmTokens ?? [];

  if (tokens.length === 0) {
    console.log(`No FCM tokens found for ${recipientRole}: ${recipientId}`);

    return;
  }

  /*
   * -------------------------------------------------------
   * 3. SEND PUSH NOTIFICATION
   * -------------------------------------------------------
   */

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,

      notification: {
        title,
        body,
      },

      data: {
        type,
        bookingId,
      },
    });

    console.log(`Push notification sent to ${recipientRole} ${recipientId}`, {
      successCount: response.successCount,

      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error(`Failed to send push notification to ${recipientId}:`, error);
  }
}

/* =========================================================
   CUSTOMER BOOKING CREATED NOTIFICATION
========================================================= */

async function sendBookingCreatedNotification(
  bookingId: string,
  booking: Booking,
): Promise<void> {
  if (!booking.customerId) {
    console.log(`Booking ${bookingId} has no customerId`);

    return;
  }

  await createNotification({
    recipientId: booking.customerId,

    recipientRole: "customer",

    type: "booking_assigned",

    title: "Booking Request Sent",

    body: "Your booking request has been sent. We're finding a suitable helper for you.",

    bookingId,
  });
}

/* =========================================================
   MAID BOOKING REQUEST NOTIFICATION
========================================================= */

async function sendBookingRequestToMaid(
  bookingId: string,
  maidId: string,
): Promise<void> {
  try {
    await createNotification({
      recipientId: maidId,

      recipientRole: "maid",

      type: "booking_assigned",

      title: "New Booking Request",

      body: "You have received a new booking request. Accept it if you want to take this job.",

      bookingId,
    });
  } catch (error) {
    /*
     * One maid's notification failure should NOT stop
     * notifications from reaching other eligible maids.
     */
    console.error(`Failed to send booking request to maid ${maidId}:`, error);
  }
}

/* =========================================================
   TIME HELPERS
========================================================= */

/**
 * Converts Firestore timestamp into India date/time parts.
 */
function getIndiaDateTime(timestamp: Timestamp) {
  const date = timestamp.toDate();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,

    year: "numeric",
    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",

    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${getPart("year")}-` + `${getPart("month")}-` + `${getPart("day")}`,

    time: `${getPart("hour")}:` + `${getPart("minute")}`,
  };
}

/**
 * HH:mm -> total minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/**
 * Returns booking start + end.
 */
function getBookingTimeRange(booking: Booking) {
  if (!booking.scheduledDateTime) {
    return null;
  }

  const start = booking.scheduledDateTime.toDate();

  const durationHours = Number(booking.duration ?? 0);

  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return null;
  }

  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  const startIndia = getIndiaDateTime(Timestamp.fromDate(start));

  const endIndia = getIndiaDateTime(Timestamp.fromDate(end));

  return {
    start,
    end,

    startDate: startIndia.date,

    startTime: startIndia.time,

    endDate: endIndia.date,

    endTime: endIndia.time,
  };
}

/* =========================================================
   AVAILABILITY
========================================================= */

/**
 * Checks whether booking fits completely
 * inside a scheduled availability slot.
 */
function isInsideAvailabilitySlot(
  booking: Booking,
  slot: AvailabilitySlot,
): boolean {
  const range = getBookingTimeRange(booking);

  if (!range) {
    return false;
  }

  /*
   * Booking must start and finish
   * on the same slot date.
   */
  if (range.startDate !== slot.date || range.endDate !== slot.date) {
    return false;
  }

  const bookingStart = timeToMinutes(range.startTime);

  const bookingEnd = timeToMinutes(range.endTime);

  const slotStart = timeToMinutes(slot.startTime);

  const slotEnd = timeToMinutes(slot.endTime);

  return bookingStart >= slotStart && bookingEnd <= slotEnd;
}

/**
 * Determines whether maid is available.
 */
function isMaidAvailable(maid: Maid, booking: Booking): boolean {
  /*
   * -------------------------------------------------------
   * 1. MANUAL OFF
   * -------------------------------------------------------
   */

  if (maid.availabilityOverride === "manual_off") {
    return false;
  }

  /*
   * -------------------------------------------------------
   * 2. MANUAL ON
   * -------------------------------------------------------
   */

  if (maid.availabilityOverride === "manual_on") {
    return true;
  }

  /*
   * -------------------------------------------------------
   * 3. VALIDATE BOOKING TIME
   * -------------------------------------------------------
   */

  const range = getBookingTimeRange(booking);

  if (!range) {
    return false;
  }

  const bookingStart = range.start;

  const now = new Date();

  /*
   * Past bookings should never be offered.
   */
  if (bookingStart.getTime() <= now.getTime()) {
    return false;
  }

  /*
   * -------------------------------------------------------
   * 4. SCHEDULED AVAILABILITY
   * -------------------------------------------------------
   */

  const slots = maid.availabilitySlots ?? [];

  const matchingSlot = slots.find((slot) =>
    isInsideAvailabilitySlot(booking, slot),
  );

  if (matchingSlot) {
    return true;
  }

  /*
   * -------------------------------------------------------
   * 5. NEAR-TIME BOOKING
   * -------------------------------------------------------
   */

  const differenceMs = bookingStart.getTime() - now.getTime();

  const differenceHours = differenceMs / (1000 * 60 * 60);

  if (differenceHours <= 4) {
    return maid.isAvailableNow === true;
  }

  /*
   * -------------------------------------------------------
   * 6. ADVANCE BOOKING WITHOUT SLOT
   * -------------------------------------------------------
   */

  return false;
}

/* =========================================================
   BOOKING CONFLICT
========================================================= */

/**
 * Checks whether maid already has another active
 * booking overlapping the requested booking.
 */
async function hasBookingConflict(
  maidId: string,
  booking: Booking,
): Promise<boolean> {
  const range = getBookingTimeRange(booking);

  if (!range) {
    return true;
  }

  const snapshot = await db
    .collection("bookings")
    .where("maidId", "==", maidId)
    .get();

  const activeStatuses: BookingStatus[] = [
    "assigned",
    "confirmed",
    "in_progress",
  ];

  for (const bookingDoc of snapshot.docs) {
    const existingBooking = bookingDoc.data() as Booking;

    if (!activeStatuses.includes(existingBooking.status as BookingStatus)) {
      continue;
    }

    if (!existingBooking.scheduledDateTime) {
      continue;
    }

    const existingRange = getBookingTimeRange(existingBooking);

    if (!existingRange) {
      continue;
    }

    /*
     * Standard overlap:
     *
     * requested start < existing end
     * AND
     * requested end > existing start
     */
    const overlaps =
      range.start.getTime() < existingRange.end.getTime() &&
      range.end.getTime() > existingRange.start.getTime();

    if (overlaps) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   CATEGORY MATCHING
========================================================= */

function maidMatchesCategories(maid: Maid, booking: Booking): boolean {
  const requestedCategories = booking.categories ?? [];

  const maidCategories = maid.serviceCategories ?? [];

  if (requestedCategories.length === 0) {
    return false;
  }

  /*
   * Maid must support ALL requested
   * services.
   */
  return requestedCategories.every((category) =>
    maidCategories.includes(category),
  );
}

/* =========================================================
   FIND ELIGIBLE MAIDS
========================================================= */

async function findEligibleMaids(booking: Booking): Promise<Maid[]> {
  const maidSnapshot = await db.collection("maids").get();

  console.log(`Total maids found: ${maidSnapshot.size}`);

  const eligibleMaids: Maid[] = [];

  for (const maidDoc of maidSnapshot.docs) {
    const maidData = maidDoc.data() as Maid;

    const maid: Maid = {
      ...maidData,
      maidId: maidDoc.id,
    };

    /*
     * -----------------------------------------------------
     * 1. VERIFICATION
     * -----------------------------------------------------
     */

    if (maid.verificationStatus !== "verified") {
      continue;
    }

    /*
     * -----------------------------------------------------
     * 2. CATEGORY MATCH
     * -----------------------------------------------------
     */

    if (!maidMatchesCategories(maid, booking)) {
      continue;
    }

    /*
     * -----------------------------------------------------
     * 3. AVAILABILITY
     * -----------------------------------------------------
     */

    const available = isMaidAvailable(maid, booking);

    if (!available) {
      continue;
    }

    /*
     * -----------------------------------------------------
     * 4. EXISTING BOOKING CONFLICT
     * -----------------------------------------------------
     */

    const hasConflict = await hasBookingConflict(maid.maidId, booking);

    if (hasConflict) {
      console.log(`Maid ${maid.maidId} has booking conflict`);

      continue;
    }

    /*
     * -----------------------------------------------------
     * ELIGIBLE
     * -----------------------------------------------------
     */

    eligibleMaids.push(maid);
  }

  return eligibleMaids;
}

/* =========================================================
   ASSIGN / OFFER BOOKING TO ALL MAIDS
========================================================= */

/**
 * IMPORTANT:
 *
 * This function NO LONGER assigns one maid.
 *
 * It finds ALL eligible maids and sends the request
 * to every one of them.
 *
 * The booking remains "pending" until one maid accepts.
 */
export const assignMaid = onDocumentCreated(
  "bookings/{bookingId}",
  async (event) => {
    const bookingId = event.params.bookingId;

    const bookingSnapshot = event.data;

    if (!bookingSnapshot) {
      console.error("Booking snapshot missing:", bookingId);

      return;
    }

    const booking = bookingSnapshot.data() as Booking;
    await sendBookingCreatedNotification(bookingId, booking);
    console.log("New booking received:", bookingId);

    /*
     * -------------------------------------------------------
     * ONLY PENDING BOOKINGS
     * -------------------------------------------------------
     */

    if (booking.status !== "pending") {
      console.log("Booking is not pending. Skipping:", bookingId);

      return;
    }

    /*
     * -------------------------------------------------------
     * VALIDATE SCHEDULED TIME
     * -------------------------------------------------------
     */

    if (!booking.scheduledDateTime) {
      console.error("Booking has no scheduledDateTime:", bookingId);

      await bookingSnapshot.ref.update({
        status: "no_maid_found",

        assignmentError: "Missing scheduledDateTime",

        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * VALIDATE CATEGORIES
     * -------------------------------------------------------
     */

    if (!booking.categories || booking.categories.length === 0) {
      console.error("Booking has no categories:", bookingId);

      await bookingSnapshot.ref.update({
        status: "no_maid_found",

        assignmentError: "No service categories requested",

        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * FIND ALL ELIGIBLE MAIDS
     * -------------------------------------------------------
     */

    const eligibleMaids = await findEligibleMaids(booking);

    /*
     * -------------------------------------------------------
     * NO MAID FOUND
     * -------------------------------------------------------
     */

    if (eligibleMaids.length === 0) {
      console.log("No eligible maid found:", bookingId);

      await bookingSnapshot.ref.update({
        status: "no_maid_found",

        maidId: null,

        offeredMaidIds: [],

        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * GET ALL MAID IDS
     * -------------------------------------------------------
     */

    const offeredMaidIds = eligibleMaids.map((maid) => maid.maidId);

    console.log("Eligible maids for booking:", bookingId, offeredMaidIds);

    /*
     * -------------------------------------------------------
     * SAVE ALL OFFERED MAIDS
     * -------------------------------------------------------
     *
     * Booking remains PENDING.
     *
     * maidId remains null.
     *
     * No maid wins yet.
     */

    await bookingSnapshot.ref.update({
      maidId: null,

      offeredMaidIds,

      maidResponses: {},

      winningMaidId: null,

      updatedAt: FieldValue.serverTimestamp(),
    });

    /*
     * -------------------------------------------------------
     * SEND REQUEST TO EVERY ELIGIBLE MAID
     * -------------------------------------------------------
     *
     * Promise.allSettled is intentionally used.
     *
     * If notification to one maid fails,
     * other maids still receive their requests.
     */

    const notificationResults = await Promise.allSettled(
      offeredMaidIds.map((maidId) =>
        sendBookingRequestToMaid(bookingId, maidId),
      ),
    );

    let successCount = 0;
    let failureCount = 0;

    for (const result of notificationResults) {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failureCount++;
      }
    }

    console.log(
      `Booking ${bookingId} offered to ${offeredMaidIds.length} maids`,
      {
        successCount,
        failureCount,
      },
    );
  },
);

/* =========================================================
   ACCEPT BOOKING
========================================================= */

/**
 * FIRST ACCEPT WINS
 *
 * This is the most important part of the new assignment
 * architecture.
 *
 * Multiple maids can call this function at exactly the
 * same time.
 *
 * Firestore transaction guarantees that only one maid
 * can successfully change the booking from pending
 * to confirmed.
 */
export const acceptBooking = onCall(async (request) => {
  /*
   * -------------------------------------------------------
   * AUTHENTICATION
   * -------------------------------------------------------
   */

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in as a maid.");
  }

  const maidId = request.auth.uid;

  /*
   * -------------------------------------------------------
   * VALIDATE INPUT
   * -------------------------------------------------------
   */

  const bookingId =
    typeof request.data?.bookingId === "string"
      ? request.data.bookingId.trim()
      : "";

  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.");
  }

  console.log(`Maid ${maidId} is trying to accept booking ${bookingId}`);

  const bookingRef = db.collection("bookings").doc(bookingId);

  /*
   * -------------------------------------------------------
   * TRANSACTION
   * -------------------------------------------------------
   */

  let accepted = false;

  await db.runTransaction(async (transaction) => {
    /*
     * ALWAYS READ BOOKING FIRST.
     */
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    const booking = bookingSnapshot.data() as Booking;

    /*
     * ---------------------------------------------------
     * BOOKING MUST STILL BE PENDING
     * ---------------------------------------------------
     */

    if (booking.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This booking has already been taken or is no longer available.",
      );
    }

    /*
     * ---------------------------------------------------
     * MAID MUST HAVE RECEIVED THE REQUEST
     * ---------------------------------------------------
     */

    const offeredMaidIds = booking.offeredMaidIds ?? [];

    if (!offeredMaidIds.includes(maidId)) {
      throw new HttpsError(
        "permission-denied",
        "You are not eligible for this booking.",
      );
    }

    /*
     * ---------------------------------------------------
     * GET FRESH MAID DATA
     * ---------------------------------------------------
     */

    const maidRef = db.collection("maids").doc(maidId);

    const maidSnapshot = await transaction.get(maidRef);

    if (!maidSnapshot.exists) {
      throw new HttpsError("not-found", "Maid profile not found.");
    }

    const maid = {
      ...(maidSnapshot.data() as Maid),
      maidId,
    };

    /*
     * ---------------------------------------------------
     * FINAL VERIFICATION CHECK
     * ---------------------------------------------------
     */

    if (maid.verificationStatus !== "verified") {
      throw new HttpsError(
        "failed-precondition",
        "Your maid profile is not verified.",
      );
    }

    /*
     * ---------------------------------------------------
     * FINAL CATEGORY CHECK
     * ---------------------------------------------------
     */

    if (!maidMatchesCategories(maid, booking)) {
      throw new HttpsError(
        "failed-precondition",
        "You do not support all requested services.",
      );
    }

    /*
     * ---------------------------------------------------
     * FINAL AVAILABILITY CHECK
     * ---------------------------------------------------
     */

    if (!isMaidAvailable(maid, booking)) {
      throw new HttpsError(
        "failed-precondition",
        "You are no longer available for this booking.",
      );
    }

    /*
     * ---------------------------------------------------
     * FINAL BOOKING CONFLICT CHECK
     * ---------------------------------------------------
     *
     * We do this inside the transaction so the
     * availability decision is based on current data.
     */

    const range = getBookingTimeRange(booking);

    if (!range) {
      throw new HttpsError(
        "failed-precondition",
        "Booking time information is invalid.",
      );
    }

    const existingBookingsQuery = db
      .collection("bookings")
      .where("maidId", "==", maidId);

    const existingBookings = await transaction.get(existingBookingsQuery);

    const activeStatuses: BookingStatus[] = [
      "assigned",
      "confirmed",
      "in_progress",
    ];

    for (const existingDoc of existingBookings.docs) {
      /*
       * Ignore the current booking.
       */
      if (existingDoc.id === bookingId) {
        continue;
      }

      const existingBooking = existingDoc.data() as Booking;

      if (!activeStatuses.includes(existingBooking.status as BookingStatus)) {
        continue;
      }

      if (!existingBooking.scheduledDateTime) {
        continue;
      }

      const existingRange = getBookingTimeRange(existingBooking);

      if (!existingRange) {
        continue;
      }

      const overlaps =
        range.start.getTime() < existingRange.end.getTime() &&
        range.end.getTime() > existingRange.start.getTime();

      if (overlaps) {
        throw new HttpsError(
          "failed-precondition",
          "You already have another booking at this time.",
        );
      }
    }

    /*
     * ---------------------------------------------------
     * FIRST ACCEPT WINS
     * ---------------------------------------------------
     *
     * This update is atomic with the transaction.
     *
     * If another maid has already changed the booking,
     * Firestore retries the transaction and the next
     * read sees status !== pending.
     */

    const responsePath = `maidResponses.${maidId}`;

    transaction.update(bookingRef, {
      status: "confirmed",

      maidId,

      maidDetails: {
        name: maid.name ?? "",
        phoneNumber: maid.phoneNumber ?? "",
        photoUrl: maid.photoUrl ?? "",
        verificationStatus: maid.verificationStatus ?? "verified",
        serviceCategories: maid.serviceCategories ?? [],
        serviceArea: maid.serviceArea ?? "",
      },

      winningMaidId: maidId,

      assignedAt: FieldValue.serverTimestamp(),

      respondedAt: FieldValue.serverTimestamp(),

      updatedAt: FieldValue.serverTimestamp(),

      [responsePath]: "accepted",
    });

    /*
     * Track maid usage.
     */
    transaction.update(maidRef, {
      lastAssignedAt: FieldValue.serverTimestamp(),
    });

    accepted = true;
  });

  if (!accepted) {
    throw new HttpsError("aborted", "Unable to accept this booking.");
  }

  console.log(`Maid ${maidId} WON booking ${bookingId}`);

  return {
    success: true,
    bookingId,
    maidId,
    status: "confirmed",
  };
});

/* =========================================================
   REJECT BOOKING
========================================================= */

/**
 * Rejecting a request MUST NOT make the booking pending
 * again and MUST NOT send it to another single maid.
 *
 * All eligible maids already received the request.
 *
 * Therefore rejection only records the response of the
 * current maid.
 */
export const rejectBooking = onCall(async (request) => {
  /*
   * -------------------------------------------------------
   * AUTHENTICATION
   * -------------------------------------------------------
   */

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in as a maid.");
  }

  const maidId = request.auth.uid;

  /*
   * -------------------------------------------------------
   * VALIDATE INPUT
   * -------------------------------------------------------
   */

  const bookingId =
    typeof request.data?.bookingId === "string"
      ? request.data.bookingId.trim()
      : "";

  const isTimeout = request.data?.isTimeout === true;

  if (!bookingId) {
    throw new HttpsError("invalid-argument", "bookingId is required.");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);

  /*
   * -------------------------------------------------------
   * TRANSACTION
   * -------------------------------------------------------
   */

  await db.runTransaction(async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);

    if (!bookingSnapshot.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }

    const booking = bookingSnapshot.data() as Booking;

    /*
     * If another maid already accepted,
     * this request is simply closed.
     */
    if (booking.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "This booking is no longer available.",
      );
    }

    const offeredMaidIds = booking.offeredMaidIds ?? [];

    if (!offeredMaidIds.includes(maidId)) {
      throw new HttpsError(
        "permission-denied",
        "You did not receive this booking request.",
      );
    }

    const responsePath = `maidResponses.${maidId}`;

    transaction.update(bookingRef, {
      [responsePath]: isTimeout ? "timeout" : "rejected",

      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  console.log(
    `Maid ${maidId} ${isTimeout ? "timed out" : "rejected"} booking ${bookingId}`,
  );

  return {
    success: true,
    bookingId,
    maidId,
    response: isTimeout ? "timeout" : "rejected",
  };
});

/* =========================================================
   BOOKING STATUS NOTIFICATIONS
========================================================= */

export const bookingStatusNotification = onDocumentUpdated(
  "bookings/{bookingId}",
  async (event) => {
    const before = event.data?.before.data();

    const after = event.data?.after.data();

    if (!before || !after) {
      return;
    }

    const bookingId = event.params.bookingId;

    const oldStatus = before.status as BookingStatus;

    const newStatus = after.status as BookingStatus;

    /*
     * -------------------------------------------------------
     * NO STATUS CHANGE
     * -------------------------------------------------------
     *
     * Important:
     *
     * maidResponses changes should NOT trigger any
     * customer notification.
     */

    if (oldStatus === newStatus) {
      return;
    }

    console.log(
      `Booking ${bookingId} status changed: ${oldStatus} → ${newStatus}`,
    );

    const customerId = after.customerId as string | undefined;

    const maidId = after.maidId as string | null | undefined;

    /*
     * -------------------------------------------------------
     * CONFIRMED → CUSTOMER
     * -------------------------------------------------------
     *
     * This is now the point where a maid actually wins
     * the booking.
     */

    if (newStatus === "confirmed" && customerId) {
      await createNotification({
        recipientId: customerId,

        recipientRole: "customer",

        type: "booking_confirmed",

        title: "Booking Confirmed",

        body: "Your helper has accepted the booking.",

        bookingId,
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * IN PROGRESS → CUSTOMER
     * -------------------------------------------------------
     */

    if (newStatus === "in_progress" && customerId) {
      await createNotification({
        recipientId: customerId,

        recipientRole: "customer",

        type: "booking_started",

        title: "Job Started",

        body: "Your helper has started the job.",

        bookingId,
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * COMPLETED → CUSTOMER
     * -------------------------------------------------------
     */

    if (newStatus === "completed" && customerId) {
      await createNotification({
        recipientId: customerId,

        recipientRole: "customer",

        type: "booking_completed",

        title: "Job Completed",

        body: "Your booking has been completed successfully.",

        bookingId,
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * CANCELLED
     * -------------------------------------------------------
     */

    if (newStatus === "cancelled") {
      /*
       * Customer cancelled.
       * Notify winning maid.
       */

      if (after.cancelledBy === "customer" && maidId) {
        await createNotification({
          recipientId: maidId,

          recipientRole: "maid",

          type: "booking_cancelled",

          title: "Booking Cancelled",

          body: "The customer has cancelled the booking.",

          bookingId,
        });

        return;
      }

      /*
       * Maid cancelled.
       * Notify customer.
       */

      if (after.cancelledBy === "maid" && customerId) {
        await createNotification({
          recipientId: customerId,

          recipientRole: "customer",

          type: "booking_cancelled",

          title: "Booking Cancelled",

          body: "The helper has cancelled the booking.",

          bookingId,
        });

        return;
      }
    }

    /*
     * -------------------------------------------------------
     * NO MAID FOUND → CUSTOMER
     * -------------------------------------------------------
     */

    if (newStatus === "no_maid_found" && customerId) {
      await createNotification({
        recipientId: customerId,

        recipientRole: "customer",

        type: "no_maid_found",

        title: "No Helper Available",

        body: "Sorry, no helper is currently available for your booking.",

        bookingId,
      });
    }
  },
);
