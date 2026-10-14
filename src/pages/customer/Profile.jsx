import { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useTranslation } from "../../hooks/useTranslation";
import { validatePhone } from "../../utils/validation";
import Layout from "../../components/Layout";
import ProfileLayout from "../../components/profile/ProfileLayout";

function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { bookings } = useBookings();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [phoneError, setPhoneError] = useState("");
  const [saved, setSaved] = useState(false);

  const mine = useMemo(() => bookings.filter((b) => b.customer === user?.name), [bookings, user?.name]);
  const completed = useMemo(() => mine.filter((b) => b.status === "Completed").length, [mine]);

  const handleSave = (e) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !validatePhone(trimmedPhone)) {
      setPhoneError(t("invalidPhone"));
      return;
    }
    setPhoneError("");
    updateProfile({ phone: trimmedPhone, address: address.trim() });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const stats = [
    { label: t("totalBookingsStat"), value: mine.length },
    { label: t("completedJobsStat"), value: completed },
  ];

  const viewContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <p style={{ margin: 0 }}>
        <strong>{t("phone")}:</strong> {phone || <span style={{ color: "var(--faint)" }}>{t("addPhone")}</span>}
      </p>
      <p style={{ margin: 0 }}>
        <strong>{t("address")}:</strong> {address || <span style={{ color: "var(--faint)" }}>{t("addAddress")}</span>}
      </p>
    </div>
  );

  return (
    <Layout title={t("profile")}>
      <ProfileLayout
        user={user}
        stats={stats}
        onUpdateProfile={updateProfile}
        editing={editing}
        onToggleEdit={setEditing}
        viewContent={viewContent}
      >
        <form onSubmit={handleSave}>
          <div className="field">
            <label>{t("phone")}</label>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError("");
              }}
              placeholder="9876543210"
              maxLength={10}
            />
            {phoneError && <p style={{ color: "var(--red)", fontSize: 11.5, margin: "4px 0 0" }}>{phoneError}</p>}
          </div>

          <div className="field">
            <label>{t("address")}</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House no, street, city, PIN"
            />
          </div>

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
