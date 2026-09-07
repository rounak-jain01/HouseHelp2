import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";

import { getAuth } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "@react-native-firebase/firestore";

type AvailabilitySlot = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
};

const auth = getAuth();
const db = getFirestore();

const generateSlotId = () => {
  return `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}`;
};

const pad = (value: number) => {
  return value.toString().padStart(2, "0");
};

const formatDateKey = (date: Date) => {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getTimeValue = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const getDateTimeFromSlot = (
  dateString: string,
  timeString: string
) => {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const [hours, minutes] = timeString
    .split(":")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    hours,
    minutes,
    0,
    0
  );

  return date;
};

const formatSlotTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function MaidAvailabilityScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [startTime, setStartTime] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return date;
  });

  const [endTime, setEndTime] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 2, 0, 0, 0);
    return date;
  });

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [showStartPicker, setShowStartPicker] =
    useState(false);

  const [showEndPicker, setShowEndPicker] =
    useState(false);

  const [editingSlotId, setEditingSlotId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const user = auth.currentUser;

  /**
   * Show professional inline feedback.
   */
  const showMessage = (
    text: string,
    type: "success" | "error"
  ) => {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  /**
   * Load availability slots from Firestore.
   */
  useEffect(() => {
    const loadAvailability = async () => {
      if (!user) {
        setLoading(false);
        router.replace("/");
        return;
      }

      try {
        const maidRef = doc(db, "maids", user.uid);
        const maidSnapshot = await getDoc(maidRef);

        if (!maidSnapshot.exists()) {
          setSlots([]);
          return;
        }

        const data = maidSnapshot.data();

        const firestoreSlots =
          Array.isArray(data.availabilitySlots)
            ? data.availabilitySlots
            : [];

        const validSlots: AvailabilitySlot[] =
          firestoreSlots
            .filter(
              (slot: any) =>
                slot &&
                typeof slot.date === "string" &&
                typeof slot.startTime === "string" &&
                typeof slot.endTime === "string"
            )
            .map((slot: any) => ({
              id:
                typeof slot.id === "string"
                  ? slot.id
                  : generateSlotId(),
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
            }));

        setSlots(validSlots);
      } catch (error) {
        console.log(
          "LOAD AVAILABILITY ERROR:",
          error
        );

        showMessage(
          "Unable to load availability. Please try again.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, []);

  /**
   * Slots for currently selected date.
   */
  const selectedDateSlots = useMemo(() => {
    const dateKey = formatDateKey(selectedDate);

    return slots
      .filter((slot) => slot.date === dateKey)
      .sort(
        (a, b) =>
          getTimeValue(a.startTime) -
          getTimeValue(b.startTime)
      );
  }, [slots, selectedDate]);

  /**
   * Reset time picker values.
   */
  const resetForm = () => {
    const start = new Date();
    start.setHours(
      start.getHours() + 1,
      0,
      0,
      0
    );

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    setStartTime(start);
    setEndTime(end);
    setEditingSlotId(null);
  };

  /**
   * Date selected.
   *
   * IMPORTANT:
   * We close the DateTimePicker immediately.
   * This fixes the Android picker reopening issue.
   */
  const handleDateChange = (
    event: any,
    date?: Date
  ) => {
    setShowDatePicker(false);

    if (event?.type === "dismissed") {
      return;
    }

    if (!date) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);

    if (selected < today) {
      showMessage(
        "You cannot select a past date.",
        "error"
      );
      return;
    }

    setSelectedDate(date);

    /**
     * If selected date is today,
     * make sure start/end times are not in the past.
     */
    if (formatDateKey(date) === formatDateKey(new Date())) {
      const now = new Date();

      if (startTime <= now) {
        const newStart = new Date();
        newStart.setMinutes(
          newStart.getMinutes() + 30
        );
        newStart.setSeconds(0);
        newStart.setMilliseconds(0);

        setStartTime(newStart);

        const newEnd = new Date(newStart);
        newEnd.setHours(
          newEnd.getHours() + 1
        );

        setEndTime(newEnd);
      }
    }
  };

  /**
   * Start time selected.
   */
  const handleStartTimeChange = (
    event: any,
    date?: Date
  ) => {
    setShowStartPicker(false);

    if (event?.type === "dismissed") {
      return;
    }

    if (!date) {
      return;
    }

    setStartTime(date);

    /**
     * Automatically keep end time after start time.
     */
    if (date >= endTime) {
      const newEnd = new Date(date);
      newEnd.setHours(
        newEnd.getHours() + 1
      );

      setEndTime(newEnd);
    }
  };

  /**
   * End time selected.
   */
  const handleEndTimeChange = (
    event: any,
    date?: Date
  ) => {
    setShowEndPicker(false);

    if (event?.type === "dismissed") {
      return;
    }

    if (!date) {
      return;
    }

    setEndTime(date);
  };

  /**
   * Check whether two time ranges overlap.
   */
  const slotsOverlap = (
    startA: number,
    endA: number,
    startB: number,
    endB: number
  ) => {
    return (
      startA < endB &&
      endA > startB
    );
  };

  /**
   * Add / Update availability.
   */
  const handleSaveSlot = async () => {
    if (!user) {
      showMessage(
        "Your session has expired. Please login again.",
        "error"
      );
      router.replace("/");
      return;
    }

    if (saving) {
      return;
    }

    const dateKey = formatDateKey(selectedDate);

    const startMinutes =
      startTime.getHours() * 60 +
      startTime.getMinutes();

    const endMinutes =
      endTime.getHours() * 60 +
      endTime.getMinutes();

    /**
     * Basic time validation.
     */
    if (endMinutes <= startMinutes) {
      showMessage(
        "End time must be after start time.",
        "error"
      );
      return;
    }

    /**
     * Minimum 30 minute slot.
     */
    if (
      endMinutes - startMinutes <
      30
    ) {
      showMessage(
        "Availability slot must be at least 30 minutes.",
        "error"
      );
      return;
    }

    /**
     * If selected date is today,
     * don't allow past time.
     */
    const now = new Date();

    if (
      dateKey === formatDateKey(now) &&
      getDateTimeFromSlot(
        dateKey,
        `${pad(startTime.getHours())}:${pad(
          startTime.getMinutes()
        )}`
      ) <= now
    ) {
      showMessage(
        "Start time must be in the future.",
        "error"
      );
      return;
    }

    /**
     * Check overlapping slots.
     */
    const hasOverlap = slots.some((slot) => {
      if (slot.date !== dateKey) {
        return false;
      }

      /**
       * Ignore the slot currently being edited.
       */
      if (
        editingSlotId &&
        slot.id === editingSlotId
      ) {
        return false;
      }

      const existingStart =
        getTimeValue(slot.startTime);

      const existingEnd =
        getTimeValue(slot.endTime);

      return slotsOverlap(
        startMinutes,
        endMinutes,
        existingStart,
        existingEnd
      );
    });

    if (hasOverlap) {
      showMessage(
        "This time overlaps with an existing availability slot.",
        "error"
      );
      return;
    }

    const startTimeString = `${pad(
      startTime.getHours()
    )}:${pad(startTime.getMinutes())}`;

    const endTimeString = `${pad(
      endTime.getHours()
    )}:${pad(endTime.getMinutes())}`;

    try {
      setSaving(true);

      let updatedSlots: AvailabilitySlot[];

      if (editingSlotId) {
        /**
         * UPDATE EXISTING SLOT
         */
        updatedSlots = slots.map((slot) => {
          if (slot.id !== editingSlotId) {
            return slot;
          }

          return {
            ...slot,
            date: dateKey,
            startTime: startTimeString,
            endTime: endTimeString,
          };
        });
      } else {
        /**
         * ADD NEW SLOT
         */
        const newSlot: AvailabilitySlot = {
          id: generateSlotId(),
          date: dateKey,
          startTime: startTimeString,
          endTime: endTimeString,
        };

        updatedSlots = [
          ...slots,
          newSlot,
        ];
      }

      await updateDoc(
        doc(db, "maids", user.uid),
        {
          availabilitySlots: updatedSlots,
        }
      );

      setSlots(updatedSlots);

      showMessage(
        editingSlotId
          ? "Availability updated successfully."
          : "Availability added successfully.",
        "success"
      );

      resetForm();
    } catch (error) {
      console.log(
        "SAVE AVAILABILITY ERROR:",
        error
      );

      showMessage(
        "Could not save availability. Please try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Edit slot.
   */
  const handleEditSlot = (
    slot: AvailabilitySlot
  ) => {
    const slotDate = new Date(
      getDateTimeFromSlot(
        slot.date,
        slot.startTime
      )
    );

    const slotEndDate = new Date(
      getDateTimeFromSlot(
        slot.date,
        slot.endTime
      )
    );

    setSelectedDate(slotDate);
    setStartTime(slotDate);
    setEndTime(slotEndDate);
    setEditingSlotId(slot.id);

    showMessage(
      "Availability loaded for editing.",
      "success"
    );
  };

  /**
   * Delete slot.
   */
  const handleDeleteSlot = async (
    slotId: string
  ) => {
    if (!user || saving) {
      return;
    }

    try {
      setSaving(true);

      const updatedSlots = slots.filter(
        (slot) => slot.id !== slotId
      );

      await updateDoc(
        doc(db, "maids", user.uid),
        {
          availabilitySlots: updatedSlots,
        }
      );

      setSlots(updatedSlots);

      if (editingSlotId === slotId) {
        resetForm();
      }

      showMessage(
        "Availability removed successfully.",
        "success"
      );
    } catch (error) {
      console.log(
        "DELETE AVAILABILITY ERROR:",
        error
      );

      showMessage(
        "Could not remove this availability.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancel edit mode.
   */
  const handleCancelEdit = () => {
    resetForm();

    showMessage(
      "Edit cancelled.",
      "success"
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading availability...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <Text style={styles.backIcon}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              Availability
            </Text>

            <Text style={styles.headerSubtitle}>
              Plan your upcoming work hours
            </Text>
          </View>
        </View>

        {/* MESSAGE */}
        {message ? (
          <View
            style={[
              styles.messageBox,
              messageType === "success"
                ? styles.successMessage
                : styles.errorMessage,
            ]}
          >
            <View
              style={[
                styles.messageIconCircle,
                messageType === "success"
                  ? styles.successIconCircle
                  : styles.errorIconCircle,
              ]}
            >
              <Text
                style={[
                  styles.messageIcon,
                  messageType === "success"
                    ? styles.successIcon
                    : styles.errorIcon,
                ]}
              >
                {messageType === "success"
                  ? "✓"
                  : "!"}
              </Text>
            </View>

            <Text
              style={[
                styles.messageText,
                messageType === "success"
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {message}
            </Text>
          </View>
        ) : null}

        {/* DATE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Select Date
          </Text>

          <Pressable
            style={styles.selectionBox}
            onPress={() =>
              setShowDatePicker(true)
            }
          >
            <View style={styles.selectionIconBox}>
              <Text style={styles.selectionIcon}>
                📅
              </Text>
            </View>

            <View style={styles.selectionContent}>
              <Text style={styles.selectionLabel}>
                Work Date
              </Text>

              <Text style={styles.selectionValue}>
                {formatDisplayDate(
                  selectedDate
                )}
              </Text>
            </View>

            <Text style={styles.chevron}>
              ›
            </Text>
          </Pressable>

          {showDatePicker ? (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : null}
        </View>

        {/* TIME */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Select Time
          </Text>

          {/* START TIME */}
          <Pressable
            style={styles.selectionBox}
            onPress={() =>
              setShowStartPicker(true)
            }
          >
            <View style={styles.selectionIconBox}>
              <Text style={styles.selectionIcon}>
                🕐
              </Text>
            </View>

            <View style={styles.selectionContent}>
              <Text style={styles.selectionLabel}>
                Start Time
              </Text>

              <Text style={styles.selectionValue}>
                {formatTime(startTime)}
              </Text>
            </View>

            <Text style={styles.chevron}>
              ›
            </Text>
          </Pressable>

          {showStartPicker ? (
            <DateTimePicker
              value={startTime}
              mode="time"
              display="default"
              onChange={
                handleStartTimeChange
              }
            />
          ) : null}

          <View style={styles.timeDivider} />

          {/* END TIME */}
          <Pressable
            style={styles.selectionBox}
            onPress={() =>
              setShowEndPicker(true)
            }
          >
            <View style={styles.selectionIconBox}>
              <Text style={styles.selectionIcon}>
                🕑
              </Text>
            </View>

            <View style={styles.selectionContent}>
              <Text style={styles.selectionLabel}>
                End Time
              </Text>

              <Text style={styles.selectionValue}>
                {formatTime(endTime)}
              </Text>
            </View>

            <Text style={styles.chevron}>
              ›
            </Text>
          </Pressable>

          {showEndPicker ? (
            <DateTimePicker
              value={endTime}
              mode="time"
              display="default"
              onChange={
                handleEndTimeChange
              }
            />
          ) : null}
        </View>

        {/* SAVE */}
        <View style={styles.saveSection}>
          <Pressable
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            disabled={saving}
            onPress={handleSaveSlot}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Text style={styles.saveIcon}>
                  {editingSlotId
                    ? "✓"
                    : "+"}
                </Text>

                <Text style={styles.saveButtonText}>
                  {editingSlotId
                    ? "Update Availability"
                    : "Add Availability"}
                </Text>
              </>
            )}
          </Pressable>

          {editingSlotId ? (
            <Pressable
              style={styles.cancelEditButton}
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Text
                style={styles.cancelEditText}
              >
                Cancel Edit
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* SAVED SLOTS */}
        <View style={styles.savedHeader}>
          <View>
            <Text style={styles.savedTitle}>
              Saved Availability
            </Text>

            <Text style={styles.savedSubtitle}>
              {selectedDateSlots.length === 0
                ? "No slots for this date"
                : `${selectedDateSlots.length} slot${
                    selectedDateSlots.length >
                    1
                      ? "s"
                      : ""
                  } available`}
            </Text>
          </View>

          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {selectedDate.toLocaleDateString(
                "en-IN",
                {
                  day: "numeric",
                  month: "short",
                }
              )}
            </Text>
          </View>
        </View>

        {selectedDateSlots.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>
                🗓
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No availability yet
            </Text>

            <Text style={styles.emptyText}>
              Add a time slot above to let the
              system know when you are available.
            </Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {selectedDateSlots.map(
              (slot) => (
                <View
                  key={slot.id}
                  style={[
                    styles.slotCard,
                    editingSlotId ===
                      slot.id &&
                      styles.editingSlotCard,
                  ]}
                >
                  <View style={styles.slotTimeBox}>
                    <Text
                      style={styles.slotTime}
                    >
                      {formatSlotTime(
                        slot.startTime
                      )}
                    </Text>

                    <Text
                      style={styles.slotTo}
                    >
                      to
                    </Text>

                    <Text
                      style={styles.slotTime}
                    >
                      {formatSlotTime(
                        slot.endTime
                      )}
                    </Text>
                  </View>

                  <View style={styles.slotActions}>
                    <Pressable
                      style={styles.editButton}
                      onPress={() =>
                        handleEditSlot(
                          slot
                        )
                      }
                      disabled={saving}
                    >
                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        Edit
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.deleteButton
                      }
                      onPress={() =>
                        handleDeleteSlot(
                          slot.id
                        )
                      }
                      disabled={saving}
                    >
                      <Text
                        style={
                          styles.deleteButtonText
                        }
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            )}
          </View>
        )}

        {/* INFO */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Text style={styles.infoIcon}>
              i
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              How availability works
            </Text>

            <Text style={styles.infoText}>
              Add the time slots when you can
              accept bookings. You can update or
              remove them anytime.
            </Text>
          </View>
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#6B7280",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    color: "#111827",
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#111827",
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    color: "#6B7280",
  },

  messageBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },

  successMessage: {
    backgroundColor: "#ECFDF3",
  },

  errorMessage: {
    backgroundColor: "#FEF2F2",
  },

  messageIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  successIconCircle: {
    backgroundColor: "#D1FAE5",
  },

  errorIconCircle: {
    backgroundColor: "#FEE2E2",
  },

  messageIcon: {
    fontSize: 15,
    fontWeight: "900",
  },

  successIcon: {
    color: "#059669",
  },

  errorIcon: {
    color: "#DC2626",
  },

  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },

  successText: {
    color: "#047857",
  },

  errorText: {
    color: "#B91C1C",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 13,
  },

  selectionBox: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  selectionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  selectionIcon: {
    fontSize: 19,
  },

  selectionContent: {
    flex: 1,
  },

  selectionLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 3,
  },

  selectionValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  chevron: {
    fontSize: 25,
    color: "#9CA3AF",
    marginLeft: 8,
  },

  timeDivider: {
    height: 10,
  },

  saveSection: {
    marginBottom: 26,
  },

  saveButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#111827",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveIcon: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "500",
    marginRight: 8,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  cancelEditButton: {
    alignItems: "center",
    paddingVertical: 13,
  },

  cancelEditText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },

  savedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  savedTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
  },

  savedSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#6B7280",
  },

  dateBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },

  dateBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  slotsContainer: {
    gap: 10,
    marginBottom: 18,
  },

  slotCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  editingSlotCard: {
    borderColor: "#111827",
    borderWidth: 1.5,
  },

  slotTimeBox: {
    marginBottom: 13,
  },

  slotTime: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  slotTo: {
    fontSize: 12,
    color: "#9CA3AF",
    marginVertical: 2,
  },

  slotActions: {
    flexDirection: "row",
    gap: 10,
  },

  editButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  editButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },

  deleteButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },

  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    marginBottom: 18,
  },

  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 13,
  },

  emptyIcon: {
    fontSize: 25,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  emptyText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
  },

  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 15,
  },

  infoIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  infoIcon: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2563EB",
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E3A8A",
    marginBottom: 4,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
});