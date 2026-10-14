import { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useReviews } from "../../hooks/useReviews";
import { useServices } from "../../hooks/useServices";
import { useTranslation } from "../../hooks/useTranslation";
import { validatePhone } from "../../utils/validation";
import Layout from "../../components/Layout";
import Avatar from "../../components/Avatar";
import ProfileLayout from "../../components/profile/ProfileLayout";

function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { bookings } = useBookings();
  const { reviewsForProvider } = useReviews();
  const { categories } = useServices();

  const [editing, setEditing] = useState(false);
  const [businessName, setBusinessName] = useState(user?.businessName || user?.name || "");
  const [category, setCategory] = useState(user?.category || categories[0]?.name || "Home Appliances");
  const [experience, setExperience] = useState(user?.experience ?? 5);
  const [bio, setBio] = useState(
    user?.bio || "Reliable, background-checked professional serving your local area."
  );
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [serviceArea, setServiceArea] = useState(user?.serviceArea || "");
  const [phoneError, setPhoneError] = useState("");
  const [saved, setSaved] = useState(false);

  const myBookings = useMemo(() => bookings.filter((b) => b.provider === user?.name), [bookings, user?.name]);
  const completedJobs = useMemo(() => myBookings.filter((b) => b.status === "Completed").length, [myBookings]);
  const myReviews = reviewsForProvider(user?.name);
  const avgRating = myReviews.length
    ? (myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length).toFixed(1)
    : null;

  const isVerified = user?.verified !== false;

  const handleSave = (e) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !validatePhone(trimmedPhone)) {
      setPhoneError(t("invalidPhone"));
      return;
    }
    setPhoneError("");
    updateProfile({
      businessName,
      category,
      experience: Number(experience),
      bio,
      phone: trimmedPhone,
      address: address.trim(),
      serviceArea: serviceArea.trim(),
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const stats = [
    { label: avgRating ? `${myReviews.length} ${myReviews.length === 1 ? t("review") : t("reviews")}` : t("noRatingYet"), value: avgRating ? `★ ${avgRating}` : "—" },
    { label: t("completedJobsStat"), value: completedJobs },
    { label: "yrs experience", value: experience },
  ];

  const badge = isVerified ? (
    <span className="badge active">✓ {t("verifiedProvider")}</span>
  ) : (
    <span className="badge pending" title={t("pendingVerificationHint")}>
      {t("pendingVerification")}
    </span>
  );

  const viewContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
      <p style={{ margin: "0 0 4px", lineHeight: 1.5 }}>{bio}</p>
      <p style={{ margin: 0 }}>
        <strong>{t("phone")}:</strong> {phone || <span style={{ color: "var(--faint)" }}>{t("addPhone")}</span>}
      </p>
      <p style={{ margin: 0 }}>
        <strong>{t("address")}:</strong> {address || <span style={{ color: "var(--faint)" }}>{t("addAddress")}</span>}
      </p>
      <p style={{ margin: 0 }}>
        <strong>{t("serviceArea")}:</strong> {serviceArea || <span style={{ color: "var(--faint)" }}>{t("addServiceArea")}</span>}
      </p>
    </div>
  );

  const previewCard = (
    <div className="stat-card" style={{ flex: 1, minWidth: 260, maxWidth: 320 }}>
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>{t("howCustomersSeeYou")}</h4>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <Avatar user={user} size={44} />
        <div>
          <strong style={{ fontSize: 13 }}>{businessName}</strong>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>{category}</p>
        </div>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        {isVerified ? `✓ ${t("verifiedProvider")}` : t("pendingVerification")} · {experience} yrs experience
      </p>
      {avgRating && (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          {"★".repeat(Math.round(avgRating))} {avgRating} ({myReviews.length})
        </p>
      )}
    </div>
  );

  return (
    <Layout title={t("profile")}>
      <ProfileLayout
        user={user}
        title={businessName}
        subtitle={user?.email}
        badge={badge}
        stats={stats}
        onUpdateProfile={updateProfile}
        editing={editing}
        onToggleEdit={setEditing}
        viewContent={viewContent}
        extraCard={previewCard}
      >
        <form onSubmit={handleSave}>
          <div className="field">
            <label>{t("businessName")}</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("primaryCategory")}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("yearsExperience")}</label>
            <input type="number" min="0" value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
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
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Workshop / office address" />
          </div>
          <div className="field">
            <label>{t("serviceArea")}</label>
            <input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Tenkasi, 627811 (10km radius)" />
          </div>
          <div className="field">
            <label>{t("bio")}</label>
            <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
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
