import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth, signOut } from "@react-native-firebase/auth";

import { createMaidProfile } from "@/services/maid";

const auth = getAuth();

const CATEGORIES = [
  {
    id: "cleaning",
    label: "Cleaning",
    icon: "🧹",
  },
  {
    id: "cooking",
    label: "Cooking",
    icon: "🍳",
  },
  {
    id: "laundry",
    label: "Laundry",
    icon: "🧺",
  },
  {
    id: "dishwashing",
    label: "Dishwashing",
    icon: "🍽️",
  },
];

export default function MaidProfileScreen() {
  const { phone } = useLocalSearchParams<{
    phone: string;
  }>();

  const [name, setName] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [selectedCategories, setSelectedCategories] =
    useState<string[]>([]);

  const [profilePhotoUri, setProfilePhotoUri] =
    useState<string | null>(null);

  const [idProofUri, setIdProofUri] =
    useState<string | null>(null);

  const [uploadingImage, setUploadingImage] =
    useState(false);

  const [saving, setSaving] = useState(false);

  // ----------------------------------------
  // Toggle Services
  // ----------------------------------------

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((current) => {
      if (current.includes(categoryId)) {
        return current.filter(
          (item) => item !== categoryId
        );
      }

      return [...current, categoryId];
    });
  };

  // ----------------------------------------
  // Profile Photo - Gallery
  // ----------------------------------------

  const handlePickProfilePhoto = async () => {
    try {
      setUploadingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to upload your profile photo."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (!selectedAsset?.uri) {
        return;
      }

      setProfilePhotoUri(selectedAsset.uri);
    } catch (error) {
      console.error(
        "PROFILE PHOTO PICK ERROR:",
        error
      );

      Alert.alert(
        "Unable to select image",
        "Please try again."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ----------------------------------------
  // Profile Photo - Camera
  // ----------------------------------------

  const handleTakeProfilePhoto = async () => {
    try {
      setUploadingImage(true);

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow camera access to take your profile photo."
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (!selectedAsset?.uri) {
        return;
      }

      setProfilePhotoUri(selectedAsset.uri);
    } catch (error) {
      console.error(
        "PROFILE PHOTO CAMERA ERROR:",
        error
      );

      Alert.alert(
        "Unable to take photo",
        "Please try again."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ----------------------------------------
  // Profile Photo - Choose Camera/Gallery
  // ----------------------------------------

  const handleProfilePhotoUpload = () => {
    Alert.alert(
      "Add Profile Photo",
      "Choose how you want to add your profile photo.",
      [
        {
          text: "Camera",
          onPress: handleTakeProfilePhoto,
        },
        {
          text: "Gallery",
          onPress: handlePickProfilePhoto,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  // ----------------------------------------
  // ID Proof - Gallery
  // ----------------------------------------

  const handlePickIdProof = async () => {
    try {
      setUploadingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to upload your ID proof."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (!selectedAsset?.uri) {
        return;
      }

      setIdProofUri(selectedAsset.uri);
    } catch (error) {
      console.error(
        "ID PROOF PICK ERROR:",
        error
      );

      Alert.alert(
        "Unable to select image",
        "Please try again."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ----------------------------------------
  // ID Proof - Camera
  // ----------------------------------------

  const handleTakePhoto = async () => {
    try {
      setUploadingImage(true);

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow camera access to take a photo of your ID."
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];

      if (!selectedAsset?.uri) {
        return;
      }

      setIdProofUri(selectedAsset.uri);
    } catch (error) {
      console.error(
        "ID PROOF CAMERA ERROR:",
        error
      );

      Alert.alert(
        "Unable to take photo",
        "Please try again."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ----------------------------------------
  // ID Proof - Choose Camera/Gallery
  // ----------------------------------------

  const handleIdProofUpload = () => {
    Alert.alert(
      "Upload ID Proof",
      "Choose how you want to add your ID proof.",
      [
        {
          text: "Camera",
          onPress: handleTakePhoto,
        },
        {
          text: "Gallery",
          onPress: handlePickIdProof,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  // ----------------------------------------
  // Submit Profile
  // ----------------------------------------

  const handleSubmit = async () => {
    try {
      // Name validation
      if (name.trim().length < 2) {
        Alert.alert(
          "Name Required",
          "Please enter your name."
        );
        return;
      }

      // Profile photo validation
      if (!profilePhotoUri) {
        Alert.alert(
          "Profile Photo Required",
          "Please add your profile photo."
        );
        return;
      }

      // ID proof validation
      if (!idProofUri) {
        Alert.alert(
          "ID Proof Required",
          "Please upload your ID proof."
        );
        return;
      }

      // Services validation
      if (selectedCategories.length === 0) {
        Alert.alert(
          "Select Services",
          "Please select at least one service."
        );
        return;
      }

      // Service area validation
      if (serviceArea.trim().length < 2) {
        Alert.alert(
          "Service Area Required",
          "Please enter the area where you want to work."
        );
        return;
      }

      // Phone validation
      if (!phone) {
        Alert.alert(
          "Phone Number Missing",
          "Please login again."
        );

        router.replace("/auth/login");
        return;
      }

      setSaving(true);

      await createMaidProfile({
        name: name.trim(),
        phoneNumber: phone,
        serviceCategories: selectedCategories,
        serviceArea: serviceArea.trim(),
        profilePhotoUri,
        idProofUri,
      });

      Alert.alert(
        "Profile Submitted",
        "Your profile is submitted for verification.",
        [
          {
            text: "Continue",
            onPress: () => {
              router.replace("/maid");
            },
          },
        ]
      );
    } catch (error: any) {
      console.error(
        "MAID PROFILE ERROR:",
        error
      );

      Alert.alert(
        "Unable to Save Profile",
        error?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------
  // Sign Out
  // ----------------------------------------

  const handleSignOut = async () => {
    try {
      const currentUser = auth.currentUser;

      if (currentUser) {
        await signOut(auth);
      }

      router.replace("/");
    } catch (error) {
      console.error(
        "MAID SIGN OUT ERROR:",
        error
      );

      router.replace("/");
    }
  };

  // ----------------------------------------
  // Form Validation
  // ----------------------------------------

  const isValid =
    name.trim().length >= 2 &&
    profilePhotoUri !== null &&
    idProofUri !== null &&
    selectedCategories.length > 0 &&
    serviceArea.trim().length >= 2;

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}

        <Text style={styles.title}>
          Set up your helper profile
        </Text>

        <Text style={styles.subtitle}>
          Complete your profile to start the verification
          process.
        </Text>

        {/* Phone */}

        {phone ? (
          <View style={styles.phoneCard}>
            <Text style={styles.phoneLabel}>
              Phone number
            </Text>

            <Text style={styles.phone}>
              {phone}
            </Text>
          </View>
        ) : null}

        {/* Name */}

        <Text style={styles.label}>
          Your name *
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="words"
          editable={!saving}
        />

        {/* Profile Photo */}

        <Text style={styles.label}>
          Profile photo *
        </Text>

        <TouchableOpacity
          style={styles.profilePhotoCard}
          onPress={handleProfilePhotoUpload}
          disabled={uploadingImage || saving}
          activeOpacity={0.8}
        >
          {profilePhotoUri ? (
            <View style={styles.profilePhotoPreview}>
              <Image
                source={{ uri: profilePhotoUri }}
                style={styles.profilePhotoImage}
              />

              <View style={styles.profilePhotoContent}>
                <Text style={styles.profilePhotoTitle}>
                  Profile photo added
                </Text>

                <Text style={styles.profilePhotoSubtitle}>
                  Tap to replace photo
                </Text>
              </View>

              <Text style={styles.changeText}>
                Change
              </Text>
            </View>
          ) : uploadingImage ? (
            <View style={styles.loadingUpload}>
              <ActivityIndicator size="small" />

              <Text style={styles.uploadLoadingText}>
                Opening...
              </Text>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>
                  +
                </Text>
              </View>

              <View style={styles.uploadText}>
                <Text style={styles.uploadTitle}>
                  Add profile photo
                </Text>

                <Text style={styles.uploadSubtitle}>
                  Use a clear photo of yourself
                </Text>
              </View>

              <Text style={styles.chevron}>
                ›
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ID Proof */}

        <Text style={styles.label}>
          ID proof *
        </Text>

        <TouchableOpacity
          style={styles.uploadCard}
          onPress={handleIdProofUpload}
          disabled={
            uploadingImage || saving
          }
          activeOpacity={0.8}
        >
          {idProofUri ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: idProofUri }}
                style={styles.previewImage}
              />

              <View style={styles.previewContent}>
                <Text style={styles.previewTitle}>
                  ID proof added
                </Text>

                <Text style={styles.previewSubtitle}>
                  Tap to replace document
                </Text>
              </View>

              <Text style={styles.changeText}>
                Change
              </Text>
            </View>
          ) : uploadingImage ? (
            <View style={styles.loadingUpload}>
              <ActivityIndicator size="small" />

              <Text style={styles.uploadLoadingText}>
                Opening...
              </Text>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>
                  +
                </Text>
              </View>

              <View style={styles.uploadText}>
                <Text style={styles.uploadTitle}>
                  Upload ID proof
                </Text>

                <Text style={styles.uploadSubtitle}>
                  Add a clear photo of your ID
                </Text>
              </View>

              <Text style={styles.chevron}>
                ›
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Services */}

        <Text style={styles.label}>
          Services you provide *
        </Text>

        <Text style={styles.helperText}>
          Select all the services you are comfortable
          providing.
        </Text>

        <View style={styles.categoryContainer}>
          {CATEGORIES.map((category) => {
            const selected =
              selectedCategories.includes(
                category.id
              );

            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selected &&
                    styles.categoryChipSelected,
                ]}
                onPress={() =>
                  toggleCategory(category.id)
                }
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryIcon}>
                  {category.icon}
                </Text>

                <Text
                  style={[
                    styles.categoryText,
                    selected &&
                      styles.categoryTextSelected,
                  ]}
                >
                  {category.label}
                </Text>

                <View
                  style={[
                    styles.checkbox,
                    selected &&
                      styles.checkboxSelected,
                  ]}
                >
                  {selected ? (
                    <Text style={styles.checkmark}>
                      ✓
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Service Area */}

        <Text style={styles.label}>
          Service area *
        </Text>

        <TextInput
          value={serviceArea}
          onChangeText={setServiceArea}
          placeholder="Example: Lalghati"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={styles.areaHint}>
          Enter the main area where you want to receive
          bookings.
        </Text>

        {/* Verification Info */}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>
              i
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Verification required
            </Text>

            <Text style={styles.infoText}>
              Your profile will remain pending until the
              HouseHelp team verifies you.
            </Text>
          </View>
        </View>

        {/* Submit */}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isValid || saving) &&
              styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <View style={styles.savingContent}>
              <ActivityIndicator color="#FFFFFF" />

              <Text style={styles.savingText}>
                Submitting...
              </Text>
            </View>
          ) : (
            <Text style={styles.submitText}>
              Submit for Verification
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Out */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
          disabled={
            saving || uploadingImage
          }
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>
            Sign Out
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          By submitting, you confirm that the information
          provided is correct.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 45,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },

  phoneCard: {
    padding: 14,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  phoneLabel: {
    fontSize: 12,
    color: "#64748B",
  },

  phone: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },

  input: {
    height: 54,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#111827",
  },

  // ----------------------------------------
  // Profile Photo
  // ----------------------------------------

  profilePhotoCard: {
    minHeight: 88,
    marginBottom: 25,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },

  profilePhotoPreview: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
  },

  profilePhotoImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },

  profilePhotoContent: {
    flex: 1,
    marginLeft: 12,
  },

  profilePhotoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },

  profilePhotoSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  // ----------------------------------------
  // ID Proof
  // ----------------------------------------

  uploadCard: {
    minHeight: 88,
    marginBottom: 25,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },

  uploadContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadIconText: {
    fontSize: 28,
    color: "#334155",
    fontWeight: "300",
  },

  uploadText: {
    flex: 1,
    marginLeft: 13,
  },

  uploadTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  uploadSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  chevron: {
    fontSize: 28,
    color: "#94A3B8",
  },

  loadingUpload: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  uploadLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#64748B",
  },

  previewContainer: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
  },

  previewImage: {
    width: 58,
    height: 58,
    borderRadius: 10,
  },

  previewContent: {
    flex: 1,
    marginLeft: 12,
  },

  previewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },

  previewSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  changeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  // ----------------------------------------
  // Services
  // ----------------------------------------

  helperText: {
    marginTop: -2,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },

  categoryContainer: {
    marginBottom: 25,
  },

  categoryChip: {
    minHeight: 58,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },

  categoryChipSelected: {
    borderColor: "#111827",
    backgroundColor: "#F8FAFC",
  },

  categoryIcon: {
    fontSize: 22,
  },

  categoryText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },

  categoryTextSelected: {
    color: "#111827",
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelected: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },

  checkmark: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ----------------------------------------
  // Service Area
  // ----------------------------------------

  areaHint: {
    marginTop: -12,
    marginBottom: 24,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },

  // ----------------------------------------
  // Verification Info
  // ----------------------------------------

  infoCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
  },

  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  infoIconText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  infoContent: {
    flex: 1,
    marginLeft: 10,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E3A8A",
  },

  infoText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#1D4ED8",
  },

  // ----------------------------------------
  // Submit
  // ----------------------------------------

  submitButton: {
    height: 56,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.4,
  },

  submitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  savingContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  savingText: {
    marginLeft: 9,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // ----------------------------------------
  // Sign Out
  // ----------------------------------------

  logoutButton: {
    height: 52,
    marginTop: 18,
    marginBottom: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },

  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },

  footer: {
    marginTop: 14,
    paddingHorizontal: 10,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#94A3B8",
  },
});