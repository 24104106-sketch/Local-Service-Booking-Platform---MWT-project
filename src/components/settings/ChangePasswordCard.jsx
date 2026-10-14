import { useState } from "react";
import { SectionCard, FieldRow, SavedHint } from "./fields";

// The password-change form was copy-pasted almost verbatim across all
// three SecurityTab implementations (customer/provider/admin) — same
// fields, same fake-save handler, same "Saved!" hint. Extracted into one
// component so there's a single place to eventually wire up a real
// password-change API call, instead of three.
function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    // TODO: send to backend
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SectionCard title="Change Password">
      <form onSubmit={handleSave} style={{ maxWidth: 380 }}>
        <FieldRow label="Current Password">
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </FieldRow>
        <FieldRow label="New Password">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </FieldRow>
        <button type="submit" className="btn btn-primary">Update Password</button>
        <SavedHint show={saved} />
      </form>
    </SectionCard>
  );
}

export default ChangePasswordCard;
