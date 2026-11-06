import AdminApp from "@/components/admin/admin-app";
import "./admin.css";
export const metadata = {
  title: "BellaPelle | Gestão da clínica",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <AdminApp />;
}
