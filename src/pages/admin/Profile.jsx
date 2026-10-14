import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useFetch } from "../../hooks/useFetch";
import { useComplaints } from "../../hooks/useComplaints";
import apiClient from "../../api/apiClient";
import { useTranslation } from "../../hooks/useTranslation";
import Layout from "../../components/Layout";
import ProfileLayout from "../../components/profile/ProfileLayout";

const fetchPendingApplications = async () => {
  try {
    const res = await apiClient.get("/admin/providers/pending");
    return res?.data || [];
  } catch {
    return [];
  }
};

function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { data: applications } = useFetch(fetchPendingApplications);
  const { complaints } = useComplaints();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [saved, setSaved] = useState(false);

  const rawApps = Array.isArray(applications?.data) ? applications.data : (Array.isArray(applications) ? applications : []);
  const pendingApprovals = rawApps.filter((a) => (a?.status || "").toLowerCase() === "pending" || a?.status === "Pending").length;
  const complaintsResolved = (complaints || []).filter((c) => (c?.status || "").toLowerCase() === "resolved" || c?.status === "Resolved").length;

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile({ name: name.trim() });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const stats = [
    { label: t("pendingApprovalsStat"), value: pendingApprovals },
    { label: t("complaintsResolvedStat"), value: complaintsResolved },
  ];

  const badge = <span className="badge active">{t("administrator")}</span>;

  const viewContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <p style={{ margin: 0 }}>
        <strong>{t("role")}:</strong> {t("administrator")}
      </p>
    </div>
  );

  return (
    <Layout title={t("profile")}>
      <ProfileLayout
        user={user}
        title={user?.name || "Admin"}
        subtitle={user?.email}
        badge={badge}
        stats={stats}
        onUpdateProfile={updateProfile}
        editing={editing}
        onToggleEdit={setEditing}
        viewContent={viewContent}
      >
        <form onSubmit={handleSave}>
          <div className="field">
            <label>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: -8, marginBottom: 14 }}>
            To change your password or security settings, use Settings from the sidebar.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary">
              {t("saveChanges")}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {saved && <span style={{ color: "var(--green)", fontSize: 12, alignSelf: "center" }}>{t("saved")}</span>}
          </div>
        </form>
      </ProfileLayout>
    </Layout>
  );
}

export default Profile;
