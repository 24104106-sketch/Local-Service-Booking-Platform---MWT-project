import { useRef } from "react";

function getInitials(name) {
  return name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
}

const MAX_FILE_BYTES = 1024 * 1024; // 1MB — keeps the base64 string small enough for localStorage

// Reusable circular avatar. Shows the user's uploaded photo (stored as a
// base64 data URL on user.avatar — no backend needed) or falls back to
// initials, matching what the navbar already showed before this existed.
// Pass editable + onChange to turn it into an upload control (used on
// Profile pages); omit both for a plain read-only avatar (used in Navbar).
function Avatar({ user, size = 40, editable = false, onChange }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_FILE_BYTES) {
      alert("Please choose an image under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange?.(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user?.name || "Profile photo"}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            width: size, height: size, borderRadius: "50%",
            background: "var(--blue-soft)", color: "var(--blue)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: size * 0.36,
          }}
        >
          {getInitials(user?.name)}
        </div>
      )}

      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Change photo"
            style={{
              position: "absolute", bottom: -2, right: -2,
              width: Math.max(20, size * 0.3), height: Math.max(20, size * 0.3),
              borderRadius: "50%", border: "2px solid var(--surface)",
              background: "var(--blue)", color: "#fff", fontSize: Math.max(10, size * 0.16),
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", padding: 0,
            }}
          >
            ✎
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </>
      )}
    </div>
  );
}

export default Avatar;
