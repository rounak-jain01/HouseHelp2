import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);

      const snapshot = await getDocs(collection(db, "maids"));

      let pending = 0;
      let verified = 0;
      let rejected = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        if (data.verificationStatus === "pending") {
          pending++;
        } else if (data.verificationStatus === "verified") {
          verified++;
        } else if (data.verificationStatus === "rejected") {
          rejected++;
        }
      });

      setStats({
        total: snapshot.size,
        pending,
        verified,
        rejected,
      });
    } catch (error) {
      console.error("DASHBOARD STATS ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const cards = [
    {
      title: "Total Maids",
      value: stats.total,
      icon: "👥",
    },
    {
      title: "Pending Verification",
      value: stats.pending,
      icon: "⏳",
    },
    {
      title: "Verified Maids",
      value: stats.verified,
      icon: "✅",
    },
    {
      title: "Rejected Maids",
      value: stats.rejected,
      icon: "❌",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h2>

          <p className="text-gray-500 mt-2">
            Overview of HouseHelp maid accounts.
          </p>
        </div>

        <button
          onClick={loadStats}
          className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white border border-gray-200 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {card.title}
                </p>

                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? "..." : card.value}
                </p>
              </div>

              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Verification Overview
        </h3>

        <p className="text-sm text-gray-500 mt-2">
          Pending maids need to be reviewed before they can receive
          bookings.
        </p>

        {stats.pending > 0 && (
          <button
            onClick={() => {
              window.location.href = "/maids";
            }}
            className="mt-5 px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800"
          >
            Review Pending Maids
          </button>
        )}
      </div>
    </div>
  );
}