import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../services/firebase";

export default function MaidReview() {
  const { maidId } = useParams();
  const navigate = useNavigate();

  const [maid, setMaid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const loadMaid = async () => {
    try {
      setLoading(true);
      setError("");

      const maidRef = doc(db, "maids", maidId);
      const snapshot = await getDoc(maidRef);

      if (!snapshot.exists()) {
        setError("Maid profile not found.");
        return;
      }

      setMaid({
        id: snapshot.id,
        ...snapshot.data(),
      });
    } catch (err) {
      console.error("MAID REVIEW ERROR:", err);
      setError("Unable to load maid profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaid();
  }, [maidId]);

  const verifyMaid = async () => {
    try {
      setActionLoading(true);

      const maidRef = doc(db, "maids", maidId);

      await updateDoc(maidRef, {
        verificationStatus: "verified",
        verificationReason: null,
        verifiedAt: new Date(),
      });

      navigate("/maids");
    } catch (err) {
      console.error("VERIFY MAID ERROR:", err);
      setError("Unable to verify maid.");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectMaid = async () => {
    if (!rejectReason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const maidRef = doc(db, "maids", maidId);

      await updateDoc(maidRef, {
        verificationStatus: "rejected",
        verificationReason: rejectReason.trim(),
        verifiedAt: null,
      });

      navigate("/maids");
    } catch (err) {
      console.error("REJECT MAID ERROR:", err);
      setError("Unable to reject maid.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-gray-500">
          Loading maid profile...
        </p>
      </div>
    );
  }

  if (!maid) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <p className="text-red-600">
          {error || "Maid profile not found."}
        </p>

        <button
          onClick={() => navigate("/maids")}
          className="mt-5 px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold"
        >
          Back to Maids
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/maids")}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50"
        >
          ← Back
        </button>

        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Review Maid
          </h2>

          <p className="text-gray-500 mt-1">
            Verify the maid profile and identity proof.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-600 p-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Maid Information */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Maid Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InfoItem
                label="Name"
                value={maid.name || "Not provided"}
              />

              <InfoItem
                label="Phone Number"
                value={maid.phoneNumber || "Not provided"}
              />

              <InfoItem
                label="Service Area"
                value={maid.serviceArea || "Not provided"}
              />

              <InfoItem
                label="Verification Status"
                value={maid.verificationStatus || "Not provided"}
              />
            </div>
          </div>

          {/* Services */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">
              Services
            </h3>

            <div className="flex flex-wrap gap-2">
              {(maid.serviceCategories || []).length > 0 ? (
                maid.serviceCategories.map((service) => (
                  <span
                    key={service}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-sm text-gray-700"
                  >
                    {service}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No services provided.
                </p>
              )}
            </div>
          </div>

          {/* ID Proof */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">
              Identity Proof
            </h3>

            {maid.idProofUrl ? (
              <div>
                <img
                  src={maid.idProofUrl}
                  alt="Maid ID proof"
                  className="w-full max-h-[600px] object-contain rounded-xl border border-gray-200 bg-gray-50"
                />

                <a
                  href={maid.idProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline"
                >
                  Open ID proof in new tab →
                </a>
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 p-8 text-center">
                <p className="text-gray-500">
                  ID proof not available.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Verification Action */}
        <div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Verification
            </h3>

            <p className="text-sm text-gray-500 mt-2 leading-5">
              Check the maid's information and identity proof before
              making a decision.
            </p>

            <div className="mt-6">
              <div className="px-4 py-3 rounded-xl bg-yellow-50 text-yellow-700 text-sm">
                Current status:{" "}
                <span className="font-semibold">
                  {maid.verificationStatus}
                </span>
              </div>
            </div>

            {!showRejectBox ? (
              <div className="mt-6 space-y-3">
                <button
                  onClick={verifyMaid}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading
                    ? "Processing..."
                    : "✓ Verify Maid"}
                </button>

                <button
                  onClick={() => {
                    setError("");
                    setShowRejectBox(true);
                  }}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-50"
                >
                  Reject Maid
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason
                </label>

                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={5}
                  placeholder="Explain why this maid verification is rejected..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowRejectBox(false);
                      setRejectReason("");
                      setError("");
                    }}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={rejectMaid}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading
                      ? "Rejecting..."
                      : "Confirm Reject"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-gray-900 break-words">
        {value}
      </p>
    </div>
  );
}