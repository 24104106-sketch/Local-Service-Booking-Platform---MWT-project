import { useState } from "react";
import Avatar from "../Avatar";
import { formatJoinedDate } from "../../utils/validation";
import { useTranslation } from "../../hooks/useTranslation";

/**
 * Reusable Profile Layout Shell
 */
function ProfileLayout({
  user,
  title,
  subtitle,
  badge,
  stats = [],
  onUpdateProfile,
  editing,
  onToggleEdit,
  children,
  viewContent,
  maxWidth = 540,
  extraCard,
}) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);

  const handleAvatarChange = (dataUrl) => {
    if (typeof onUpdateProfile === "function") {
      onUpdateProfile({ avatar: dataUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div className="stat-card" style={{ flex: 1, minWidth: 320, maxWidth }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
          <Avatar user={user} size={72} editable onChange={handleAvatarChange} />
          <div>
            <h3 style={{ margin: 0 }}>{title || user?.name || "User"}</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 0" }}>
              {subtitle || user?.email}
            </p>
          </div>
        </div>

        {badge && <div style={{ marginBottom: 14 }}>{badge}</div>}

        <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          {stats.map((stat, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{stat.label}</div>
            </div>
          ))}
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {formatJoinedDate(user?.joinedDate)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("memberSince")}</div>
          </div>
        </div>

        {editing ? (
          children
        ) : (
          <>
            {viewContent}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onToggleEdit(true)}
              >
                {t("editProfile")}
              </button>
              {saved && (
                <span style={{ color: "var(--green)", fontSize: 12 }}>
                  {t("saved")}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {extraCard}
    </div>
  );
}

export default ProfileLayout;
