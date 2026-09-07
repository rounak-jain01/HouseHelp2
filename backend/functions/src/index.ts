import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

initializeApp();

setGlobalOptions({
  region: "asia-south1",
  maxInstances: 10,
});

const db = getFirestore();

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

type AvailabilityOverride =
  | "manual_off"
  | "manual_on"
  | null;

type AvailabilitySlot = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
};

type Booking = {
  customerId?: string;
  maidId?: string | null;

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
};

type Maid = {
  maidId: string;

  name?: string;

  phoneNumber?: string;

  role?: "maid";

  verificationStatus?: "pending" | "verified" | "rejected";

  serviceCategories?: string[];

  serviceArea?: string;

  isAvailableNow?: boolean;

  availabilitySlots?: AvailabilitySlot[];

  /*
   * manual_off
   *    Maid intentionally turned availability OFF.
   *    Backend must reject new assignments.
   *
   * manual_on
   *    Maid intentionally turned availability ON outside
   *    scheduled availability.
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

  const getPart = (type: string) => {
    return parts.find((part) => part.type === type)?.value ?? "";
  };

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time: `${getPart("hour")}:${getPart("minute")}`,
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
 * Returns booking start + end in India timezone.
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

  const end = new Date(
    start.getTime() + durationHours * 60 * 60 * 1000
  );

  const startIndia = getIndiaDateTime(
    Timestamp.fromDate(start)
  );

  const endIndia = getIndiaDateTime(
    Timestamp.fromDate(end)
  );

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
 * Checks whether the booking time falls completely inside
 * one scheduled availability slot.
 *
 * Example:
 *
 * Slot:
 * 16:00 - 20:00
 *
 * Booking:
 * 17:00 - 19:00
 *
 * => true
 *
 * Booking:
 * 19:00 - 21:00
 *
 * => false
 */
function isInsideAvailabilitySlot(
  booking: Booking,
  slot: AvailabilitySlot
): boolean {
  const range = getBookingTimeRange(booking);

  if (!range) {
    return false;
  }

  /*
   * Booking must start and finish on the same slot date.
   */
  if (
    range.startDate !== slot.date ||
    range.endDate !== slot.date
  ) {
    return false;
  }

  const bookingStart = timeToMinutes(range.startTime);
  const bookingEnd = timeToMinutes(range.endTime);

  const slotStart = timeToMinutes(slot.startTime);
  const slotEnd = timeToMinutes(slot.endTime);

  return (
    bookingStart >= slotStart &&
    bookingEnd <= slotEnd
  );
}

/**
 * Determines whether a maid is available for a booking.
 *
 * IMPORTANT:
 *
 * manual_off ALWAYS wins.
 *
 * This means:
 *
 * Scheduled slot active
 * +
 * Maid manually OFF
 * =
 * unavailable
 */
function isMaidAvailable(
  maid: Maid,
  booking: Booking
): boolean {
  /*
   * -------------------------------------------------------
   * 1. MANUAL OFF HAS HIGHEST PRIORITY
   * -------------------------------------------------------
   *
   * If maid intentionally switched OFF,
   * backend must not assign any new booking.
   */
  if (maid.availabilityOverride === "manual_off") {
    return false;
  }

  /*
   * -------------------------------------------------------
   * 2. MANUAL ON
   * -------------------------------------------------------
   *
   * If maid intentionally switched ON,
   * allow availability for assignment.
   *
   * We still allow booking conflict check separately.
   */
  if (maid.availabilityOverride === "manual_on") {
    return true;
  }

  /*
   * -------------------------------------------------------
   * 3. Validate booking time
   * -------------------------------------------------------
   */

  const range = getBookingTimeRange(booking);

  if (!range) {
    return false;
  }

  const bookingStart = range.start;

  const now = new Date();

  /*
   * Past bookings should never be assigned.
   */
  if (bookingStart.getTime() <= now.getTime()) {
    return false;
  }

  /*
   * -------------------------------------------------------
   * 4. Scheduled availability
   * -------------------------------------------------------
   *
   * For bookings that have a matching availability slot,
   * the slot itself determines availability.
   */

  const slots = maid.availabilitySlots ?? [];

  const matchingSlot = slots.find((slot) =>
    isInsideAvailabilitySlot(booking, slot)
  );

  if (matchingSlot) {
    return true;
  }

  /*
   * -------------------------------------------------------
   * 5. Near-time booking
   * -------------------------------------------------------
   *
   * If booking is within 4 hours and there is no scheduled
   * slot, use isAvailableNow.
   */

  const differenceMs =
    bookingStart.getTime() - now.getTime();

  const differenceHours =
    differenceMs / (1000 * 60 * 60);

  if (differenceHours <= 4) {
    return maid.isAvailableNow === true;
  }

  /*
   * -------------------------------------------------------
   * 6. Advance booking without matching slot
   * -------------------------------------------------------
   *
   * No scheduled availability => unavailable.
   */
  return false;
}

/* =========================================================
   BOOKING CONFLICT
========================================================= */

/**
 * Checks whether maid already has another active booking
 * overlapping the requested booking.
 *
 * Blocked statuses:
 *
 * assigned
 * confirmed
 * in_progress
 */
async function hasBookingConflict(
  maidId: string,
  booking: Booking
): Promise<boolean> {
  const range = getBookingTimeRange(booking);

  if (!range) {
    return true;
  }

  const snapshot = await db
    .collection("bookings")
    .where("maidId", "==", maidId)
    .get();

  for (const bookingDoc of snapshot.docs) {
    const existingBooking =
      bookingDoc.data() as Booking;

    /*
     * Only active bookings create conflicts.
     */
    const activeStatuses: BookingStatus[] = [
      "assigned",
      "confirmed",
      "in_progress",
    ];

    if (
      !activeStatuses.includes(
        existingBooking.status as BookingStatus
      )
    ) {
      continue;
    }

    if (!existingBooking.scheduledDateTime) {
      continue;
    }

    const existingRange =
      getBookingTimeRange(existingBooking);

    if (!existingRange) {
      continue;
    }

    /*
     * Standard time overlap check:
     *
     * requested start < existing end
     * AND
     * requested end > existing start
     */
    const overlaps =
      range.start.getTime() <
        existingRange.end.getTime() &&
      range.end.getTime() >
        existingRange.start.getTime();

    if (overlaps) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   CATEGORY MATCHING
========================================================= */

/**
 * Booking must contain all categories required by customer.
 *
 * Example:
 *
 * Booking:
 * ["cleaning", "cooking"]
 *
 * Maid:
 * ["cleaning", "cooking", "laundry"]
 *
 * => true
 */
function maidMatchesCategories(
  maid: Maid,
  booking: Booking
): boolean {
  const requestedCategories =
    booking.categories ?? [];

  const maidCategories =
    maid.serviceCategories ?? [];

  if (requestedCategories.length === 0) {
    return false;
  }

  return requestedCategories.every((category) =>
    maidCategories.includes(category)
  );
}

/* =========================================================
   ROUND ROBIN SORT
========================================================= */

/**
 * Oldest lastAssignedAt gets priority.
 *
 * Maid never assigned before:
 * lastAssignedAt = null
 *
 * Such maid gets highest priority.
 */
function sortByLastAssignedAt(
  maids: Maid[]
): Maid[] {
  return [...maids].sort((a, b) => {
    const aTime =
      a.lastAssignedAt?.toMillis?.() ?? 0;

    const bTime =
      b.lastAssignedAt?.toMillis?.() ?? 0;

    return aTime - bTime;
  });
}

/* =========================================================
   ASSIGN MAID
========================================================= */

export const assignMaid = onDocumentCreated(
  "bookings/{bookingId}",
  async (event) => {
    const bookingId = event.params.bookingId;

    const bookingSnapshot = event.data;

    if (!bookingSnapshot) {
      console.error(
        "Booking snapshot missing:",
        bookingId
      );

      return;
    }

    const booking =
      bookingSnapshot.data() as Booking;

    console.log(
      "New booking received:",
      bookingId
    );

    /*
     * Only pending bookings should be processed.
     */
    if (booking.status !== "pending") {
      console.log(
        "Booking is not pending. Skipping:",
        bookingId
      );

      return;
    }

    /*
     * Validate scheduled time.
     */
    if (!booking.scheduledDateTime) {
      console.error(
        "Booking has no scheduledDateTime:",
        bookingId
      );

      await bookingSnapshot.ref.update({
        status: "no_maid_found",
        assignmentError:
          "Missing scheduledDateTime",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * Validate categories.
     */
    if (
      !booking.categories ||
      booking.categories.length === 0
    ) {
      console.error(
        "Booking has no categories:",
        bookingId
      );

      await bookingSnapshot.ref.update({
        status: "no_maid_found",
        assignmentError:
          "No service categories requested",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * FETCH ALL MAIDS
     * -------------------------------------------------------
     */

    const maidSnapshot = await db
      .collection("maids")
      .get();

    console.log(
      `Total maids found: ${maidSnapshot.size}`
    );

    const eligibleMaids: Maid[] = [];

    /*
     * -------------------------------------------------------
     * FILTER MAIDS
     * -------------------------------------------------------
     */

    for (const maidDoc of maidSnapshot.docs) {
      const maidData =
        maidDoc.data() as Maid;

      const maid: Maid = {
        ...maidData,
        maidId: maidDoc.id,
      };

      /*
       * -----------------------------------------------------
       * 1. VERIFICATION
       * -----------------------------------------------------
       */

      if (
        maid.verificationStatus !== "verified"
      ) {
        continue;
      }

      /*
       * -----------------------------------------------------
       * 2. CATEGORY MATCH
       * -----------------------------------------------------
       */

      if (
        !maidMatchesCategories(
          maid,
          booking
        )
      ) {
        continue;
      }

      /*
       * -----------------------------------------------------
       * 3. AVAILABILITY
       * -----------------------------------------------------
       *
       * IMPORTANT:
       *
       * manual_off is checked inside isMaidAvailable()
       * and always wins over scheduled availability.
       */

      const available =
        isMaidAvailable(
          maid,
          booking
        );

      if (!available) {
        continue;
      }

      /*
       * -----------------------------------------------------
       * 4. EXISTING BOOKING CONFLICT
       * -----------------------------------------------------
       */

      const hasConflict =
        await hasBookingConflict(
          maid.maidId,
          booking
        );

      if (hasConflict) {
        console.log(
          `Maid ${maid.maidId} has booking conflict`
        );

        continue;
      }

      /*
       * -----------------------------------------------------
       * ELIGIBLE
       * -----------------------------------------------------
       */

      eligibleMaids.push(maid);
    }

    /*
     * -------------------------------------------------------
     * NO MAID FOUND
     * -------------------------------------------------------
     */

    if (eligibleMaids.length === 0) {
      console.log(
        "No eligible maid found:",
        bookingId
      );

      await bookingSnapshot.ref.update({
        status: "no_maid_found",
        maidId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return;
    }

    /*
     * -------------------------------------------------------
     * ROUND ROBIN
     * -------------------------------------------------------
     */

    const sortedMaids =
      sortByLastAssignedAt(
        eligibleMaids
      );

    const selectedMaid =
      sortedMaids[0];

    console.log(
      "Selected maid:",
      selectedMaid.maidId
    );

    /*
     * -------------------------------------------------------
     * ATOMIC ASSIGNMENT
     * -------------------------------------------------------
     *
     * Transaction prevents multiple simultaneous bookings
     * from assigning the same maid incorrectly.
     */
    await db.runTransaction(
      async (transaction) => {
        const freshBookingSnapshot =
          await transaction.get(
            bookingSnapshot.ref
          );

        if (!freshBookingSnapshot.exists) {
          throw new Error(
            "Booking no longer exists"
          );
        }

        const freshBooking =
          freshBookingSnapshot.data() as Booking;

        /*
         * Booking may have been cancelled/changed while
         * assignment was running.
         */
        if (
          freshBooking.status !==
          "pending"
        ) {
          console.log(
            "Booking changed before assignment:",
            bookingId
          );

          return;
        }

        const maidRef = db
          .collection("maids")
          .doc(selectedMaid.maidId);

        const freshMaidSnapshot =
          await transaction.get(
            maidRef
          );

        if (!freshMaidSnapshot.exists) {
          throw new Error(
            "Selected maid no longer exists"
          );
        }

        const freshMaid =
          freshMaidSnapshot.data() as Maid;

        /*
         * ---------------------------------------------------
         * FINAL MANUAL OFF CHECK
         * ---------------------------------------------------
         *
         * This is extremely important.
         *
         * Maid could have switched OFF between the first
         * availability check and transaction.
         */
        if (
          freshMaid.availabilityOverride ===
          "manual_off"
        ) {
          throw new Error(
            "Selected maid manually turned availability OFF"
          );
        }

        /*
         * Final conflict check using fresh data.
         */
        transaction.update(
          bookingSnapshot.ref,
          {
            status: "assigned",
            maidId:
              selectedMaid.maidId,
            assignedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        transaction.update(
          maidRef,
          {
            lastAssignedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }
    );

    console.log(
      `Maid ${selectedMaid.maidId} assigned to booking ${bookingId}`
    );
  }
);