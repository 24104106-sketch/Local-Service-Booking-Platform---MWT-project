import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import { useSettingsStore } from "../../hooks/useSettingsStore";
import { useServices } from "../../hooks/useServices";
import { useToast } from "../../hooks/useToast";

function Personalization() {
  const { categories } = useServices();
  const { showToast } = useToast();
  const [bookingPrefs, updateBookingPrefs] = useSettingsStore("bookingPrefs", {
    preferredTime: "Morning (8am–12pm)",
    preferredCategories: ["Home Appliances", "Plumbing"],
    autoRebook: false,
  });
  const [paymentPrefs, updatePaymentPrefs] = useSettingsStore("paymentPrefs", {
    defaultMethod: "upi",
    savePaymentInfo: true,
  });

  const [selectedCats, setSelectedCats] = useState(bookingPrefs.preferredCategories || []);
  const [payment, setPayment] = useState(paymentPrefs.defaultMethod || "upi");
  const [saved, setSaved] = useState(false);

  const toggleCategory = (catName) => {
    setSelectedCats((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const handleSave = () => {
    updateBookingPrefs({ preferredCategories: selectedCats });
    updatePaymentPrefs({ defaultMethod: payment });
    setSaved(true);
    showToast("Preferences saved successfully", "success");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Layout title="Personalization">
      <p className="page-intro">
        Tune how FixIt Local feels tailored to you — favourite categories and default payment.
        Looking for appearance, font size, or theme colors? You can also adjust those in{" "}
        <Link to="/customer/settings?tab=personalization">Settings &gt; Personalization</Link>.
      </p>

      <h3>Favourite Service Categories</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="btn"
            style={
              selectedCats.includes(cat.name)
                ? { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" }
                : {}
            }
            onClick={() => toggleCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <h3>Preferred Payment Method</h3>
      <select
        value={payment}
        onChange={(e) => setPayment(e.target.value)}
        style={{ marginBottom: 30, maxWidth: 260 }}
      >
        <option value="cash">Cash</option>
        <option value="upi">UPI</option>
        <option value="card">Card</option>
        <option value="wallet">Wallet</option>
      </select>

      <div>
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          Save Preferences
        </button>
        {saved && <span style={{ marginLeft: 12, color: "var(--green)", fontSize: 12 }}>Preferences saved!</span>}
      </div>
    </Layout>
  );
}

export default Personalization;
