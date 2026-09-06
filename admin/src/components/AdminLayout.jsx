import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  const linkClass = ({ isActive }) =>
    `block px-4 py-3 rounded-lg text-sm font-medium ${
      isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 p-5">
        <h1 className="text-xl font-bold text-gray-900 mb-8">HouseHelp</h1>

        <nav className="space-y-2">
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>

          <NavLink to="/maids" className={linkClass}>
            Maid Verification
          </NavLink>

          <NavLink to="/categories" className={linkClass}>
            Categories
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
