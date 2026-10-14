import { LinkCard, SectionCard } from "../fields";

/**
 * Shared Help & Support Tab for Customer, Provider, and Admin.
 */
function HelpSupportTab({ role = "customer" }) {
  if (role === "customer") {
    return (
      <LinkCard
        to="/customer/support"
        icon="🆘"
        title="Help & Support"
        description="Raise a complaint, browse FAQs, or view your support history"
      />
    );
  }

  if (role === "provider") {
    return (
      <SectionCard title="Help & Support">
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
          Need assistance with a booking dispute, payout issue, or account verification? Our provider support team is available 7 days a week.
        </p>
        <a href="mailto:support@fixitlocal.example" className="btn btn-primary">
          Email Provider Support
        </a>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Help & Support">
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
        Platform engineering and administrative support contact for system-level issues.
      </p>
      <a href="mailto:platform-support@fixitlocal.example" className="btn btn-primary">
        Contact Platform Operations
      </a>
    </SectionCard>
  );
}

export default HelpSupportTab;
