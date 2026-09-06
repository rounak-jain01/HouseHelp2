import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [rate, setRate] = useState("99");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const loadCategories = async () => {
    try {
      setLoading(true);

      const snapshot = await getDocs(
        collection(db, "categories")
      );

      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setCategories(data);
    } catch (error) {
      console.error("CATEGORIES LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setName("");
    setRate("99");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const numericRate = Number(rate);

    if (!cleanName) {
      alert("Please enter category name.");
      return;
    }

    if (!numericRate || numericRate < 1) {
      alert("Please enter a valid rate.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateDoc(doc(db, "categories", editingId), {
          name: cleanName,
          ratePerHour: numericRate,
        });
      } else {
        await addDoc(collection(db, "categories"), {
          name: cleanName,
          ratePerHour: numericRate,
          isActive: true,
        });
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error("CATEGORY SAVE ERROR:", error);
      alert("Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setName(category.name || "");
    setRate(String(category.ratePerHour || 99));
  };

  const toggleActive = async (category) => {
    try {
      await updateDoc(doc(db, "categories", category.id), {
        isActive: !category.isActive,
      });

      await loadCategories();
    } catch (error) {
      console.error("CATEGORY STATUS ERROR:", error);
      alert("Unable to update category status.");
    }
  };

  const deleteCategory = async (category) => {
    const confirmed = window.confirm(
      `Delete "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "categories", category.id));
      await loadCategories();
    } catch (error) {
      console.error("CATEGORY DELETE ERROR:", error);
      alert("Unable to delete category.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">
          Categories
        </h2>

        <p className="text-gray-500 mt-2">
          Manage services and their hourly rates.
        </p>
      </div>

      {/* Add / Edit */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-5">
          {editingId ? "Edit Category" : "Add Category"}
        </h3>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name
            </label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cleaning"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate per Hour (₹)
            </label>

            <input
              type="number"
              min="1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="99"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update"
                : "Add Category"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Service Categories
          </h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500">
              No categories added yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((category) => (
              <div
                key={category.id}
                className="px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {category.name}
                  </h4>

                  <p className="text-sm text-gray-500 mt-1">
                    ₹{category.ratePerHour} / hour
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      category.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {category.isActive ? "Active" : "Inactive"}
                  </span>

                  <button
                    onClick={() => toggleActive(category)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {category.isActive ? "Disable" : "Enable"}
                  </button>

                  <button
                    onClick={() => startEdit(category)}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteCategory(category)}
                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}