import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../services/firebase";

export default function PendingMaids() {
  const navigate = useNavigate();

  const [maids, setMaids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPendingMaids = async () => {
    try {
      setLoading(true);
      setError("");

      const q = query(
        collection(db, "maids"),
        where("verificationStatus", "==", "pending")
      );

      const snapshot = await getDocs(q);

      const pendingMaids = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setMaids(pendingMaids);
    } catch (err) {
      console.error("PENDING MAIDS ERROR:", err);
      setError("Unable to load pending maids.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingMaids();
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Pending Maids
          </h2>

          <p className="text-gray-500 mt-2">
            Review maid profiles waiting for verification.
          </p>
        </div>

        <button
          onClick={loadPendingMaids}
          className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-600 p-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-gray-500">
            Loading pending maids...
          </p>
        </div>
      ) : maids.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-4">✓</div>

          <h3 className="text-lg font-semibold text-gray-900">
            No Pending Maids
          </h3>

          <p className="text-sm text-gray-500 mt-2">
            All maid profiles have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {maids.map((maid) => (
            <div
              key={maid.id}
              className="bg-white border border-gray-200 rounded-2xl p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-700">
                    {(maid.name || "M").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {maid.name || "Unnamed Maid"}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                      {maid.phoneNumber || "Phone not available"}
                    </p>

                    <p className="text-sm text-gray-500 mt-2">
                      {maid.serviceArea || "Service area not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(maid.serviceCategories || []).map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1 rounded-lg bg-gray-100 text-xs text-gray-700"
                    >
                      {service}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() =>
                    navigate(`/maids/${maid.id}`)
                  }
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}