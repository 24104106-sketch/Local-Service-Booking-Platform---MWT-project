import { useContext, useState, useCallback } from "react";
import { ComplaintContext, normalizeComplaint } from "../context/ComplaintContext";
import { useNotifications } from "./useNotifications";
import { useToast } from "./useToast";
import apiClient from "../api/apiClient";

const ADMIN_RECIPIENT = "Admin User";

/**
 * Custom hook — the single entry point for complaints.
 */
export function useComplaints() {
  const { complaints, dispatch, hydrated } = useContext(ComplaintContext);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useNotifications();
  const { showToast } = useToast();

  const raiseComplaint = useCallback(
    async (data) => {
      setActionLoading(true);
      setError("");
      try {
        let created;
        try {
          const res = await apiClient.post("/complaints", {
            subject: data.subject || data.type || "Service Complaint",
            description: data.description || data.issue || "",
            category: data.category || (data.type ? data.type.toLowerCase().replace(/\s+/g, "_") : "service_quality"),
            bookingId: data.bookingDbId || data.bookingId,
            priority: data.priority || "medium"
          });
          const raw = res?.data?.data || res?.data || data;
          created = normalizeComplaint({
            ...raw,
            raisedBy: data.raisedBy,
            against: data.against,
            type: data.type
          });
        } catch {
          created = normalizeComplaint({
            id: `TKT-${Date.now()}`,
            ...data,
            status: "Pending",
            createdAt: new Date().toISOString()
          });
        }
        dispatch({ type: "CREATE", payload: created });
        notify(ADMIN_RECIPIENT, "New Complaint Raised", `${data.raisedBy || "User"} raised a complaint against ${data.against || "Provider"}: ${data.type || data.subject}.`);
        showToast("Complaint submitted — our team will review it shortly.", "success");
        return created;
      } catch (err) {
        setError(err.message || "Could not submit complaint.");
        showToast(err.message || "Could not submit complaint.", "error");
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [dispatch, notify, showToast]
  );

  const markInReview = useCallback(
    async (id) => {
      const complaint = complaints.find((c) => c.id === id || c.dbId === id);
      try {
        if (complaint?.dbId) {
          await apiClient.put(`/complaints/${complaint.dbId}/status`, { status: "in_review" });
        }
      } catch {
        // silent
      }
      dispatch({ type: "UPDATE_STATUS", id, status: "In Review" });
      if (complaint) notify(complaint.raisedBy, "Complaint Under Review", `Your complaint about "${complaint.type}" is now being reviewed by our team.`);
      showToast("Marked as in review", "info");
    },
    [dispatch, complaints, notify, showToast]
  );

  const resolveComplaint = useCallback(
    async (id) => {
      const complaint = complaints.find((c) => c.id === id || c.dbId === id);
      try {
        if (complaint?.dbId) {
          await apiClient.put(`/complaints/${complaint.dbId}/status`, { status: "resolved" });
        }
      } catch {
        // silent
      }
      dispatch({ type: "UPDATE_STATUS", id, status: "Resolved" });
      if (complaint) notify(complaint.raisedBy, "Complaint Resolved", `Your complaint about "${complaint.type}" has been resolved.`);
      showToast("Complaint marked resolved", "success");
    },
    [dispatch, complaints, notify, showToast]
  );

  return { complaints, loading: !hydrated, actionLoading, error, raiseComplaint, markInReview, resolveComplaint };
}
