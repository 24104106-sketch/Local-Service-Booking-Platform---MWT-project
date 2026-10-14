import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import { ThemeProvider } from "./context/ThemeContext";
import { PersonalizationProvider } from "./context/PersonalizationContext";
import { BookingProvider } from "./context/BookingContext";
import { ServiceProvider } from "./context/ServiceContext";
import { AvailabilityProvider } from "./context/AvailabilityContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";
import { WalletProvider } from "./context/WalletContext";
import { ComplaintProvider } from "./context/ComplaintContext";
import { ReviewProvider } from "./context/ReviewContext";
import { ChatProvider } from "./context/ChatContext";
import ToastViewport from "./components/ToastViewport";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteFallback from "./components/RouteFallback";
import FixItAssistant from "./components/chatbot/FixItAssistant";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

const CustomerDashboard = lazy(() => import("./pages/customer/Dashboard"));
const BrowseServices = lazy(() => import("./pages/customer/BrowseServices"));
const ServiceDetails = lazy(() => import("./pages/customer/ServiceDetails"));
const CustomerProviderProfile = lazy(() => import("./pages/customer/ProviderProfile"));
const BookService = lazy(() => import("./pages/customer/BookService"));
const BookingHistory = lazy(() => import("./pages/customer/BookingHistory"));
const TrackProvider = lazy(() => import("./pages/customer/TrackProvider"));
const Invoice = lazy(() => import("./pages/customer/Invoice"));
const Wallet = lazy(() => import("./pages/customer/Wallet"));
const Support = lazy(() => import("./pages/customer/Support"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const CustomerProfile = lazy(() => import("./pages/customer/Profile"));
const Settings = lazy(() => import("./pages/customer/Settings"));
const Personalization = lazy(() => import("./pages/customer/Personalization"));

const ProviderDashboard = lazy(() => import("./pages/provider/Dashboard"));
const ManageServices = lazy(() => import("./pages/provider/ManageServices"));
const ProviderAvailability = lazy(() => import("./pages/provider/Availability"));
const ProviderEarnings = lazy(() => import("./pages/provider/Earnings"));
const ProviderReviews = lazy(() => import("./pages/provider/Reviews"));
const ProviderProfile = lazy(() => import("./pages/provider/Profile"));
const ProviderSettings = lazy(() => import("./pages/provider/Settings"));

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ManageUsers = lazy(() => import("./pages/admin/ManageUsers"));
const AllBookings = lazy(() => import("./pages/admin/AllBookings"));
const ProviderApprovals = lazy(() => import("./pages/admin/ProviderApprovals"));
const ManageCategories = lazy(() => import("./pages/admin/ManageCategories"));
const ManageCommunities = lazy(() => import("./pages/admin/ManageCommunities"));
const Complaints = lazy(() => import("./pages/admin/Complaints"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const SystemLogs = lazy(() => import("./pages/admin/SystemLogs"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminProfile = lazy(() => import("./pages/admin/Profile"));

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PersonalizationProvider>
          <UserProvider>
            <ServiceProvider>
              <AvailabilityProvider>
                <NotificationProvider>
                  <ToastProvider>
                    <WalletProvider>
                      <ComplaintProvider>
                        <ReviewProvider>
                          <ChatProvider>
                            <BookingProvider>
                              <BrowserRouter>
                                <Suspense fallback={<RouteFallback />}>
                                  <Routes>
                                    <Route path="/" element={<Landing />} />
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/register" element={<Register />} />

                                    {/* Customer */}
                                    <Route path="/customer/dashboard" element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>} />
                                    <Route path="/customer/services" element={<ProtectedRoute role="customer"><BrowseServices /></ProtectedRoute>} />
                                    <Route path="/customer/services/:id" element={<ProtectedRoute role="customer"><ServiceDetails /></ProtectedRoute>} />
                                    <Route path="/customer/providers/:name" element={<ProtectedRoute role="customer"><CustomerProviderProfile /></ProtectedRoute>} />
                                    <Route path="/customer/book" element={<ProtectedRoute role="customer"><BookService /></ProtectedRoute>} />
                                    <Route path="/customer/booking-history" element={<ProtectedRoute role="customer"><BookingHistory /></ProtectedRoute>} />
                                    <Route path="/customer/track/:bookingId" element={<ProtectedRoute role="customer"><TrackProvider /></ProtectedRoute>} />
                                    <Route path="/customer/invoice/:bookingId" element={<ProtectedRoute role="customer"><Invoice /></ProtectedRoute>} />
                                    <Route path="/customer/wallet" element={<ProtectedRoute role="customer"><Wallet /></ProtectedRoute>} />
                                    <Route path="/customer/support" element={<ProtectedRoute role="customer"><Support /></ProtectedRoute>} />
                                    <Route path="/customer/notifications" element={<ProtectedRoute role="customer"><Notifications /></ProtectedRoute>} />
                                    <Route path="/customer/messages" element={<ProtectedRoute role="customer"><Messages /></ProtectedRoute>} />
                                    <Route path="/customer/profile" element={<ProtectedRoute role="customer"><CustomerProfile /></ProtectedRoute>} />
                                    <Route path="/customer/settings" element={<ProtectedRoute role="customer"><Settings /></ProtectedRoute>} />
                                    <Route path="/customer/personalization" element={<Navigate to="/customer/settings" replace />} />

                                    {/* Provider */}
                                    <Route path="/provider/dashboard" element={<ProtectedRoute role="provider"><ProviderDashboard /></ProtectedRoute>} />
                                    <Route path="/provider/services" element={<ProtectedRoute role="provider"><ManageServices /></ProtectedRoute>} />
                                    <Route path="/provider/availability" element={<ProtectedRoute role="provider"><ProviderAvailability /></ProtectedRoute>} />
                                    <Route path="/provider/earnings" element={<ProtectedRoute role="provider"><ProviderEarnings /></ProtectedRoute>} />
                                    <Route path="/provider/reviews" element={<ProtectedRoute role="provider"><ProviderReviews /></ProtectedRoute>} />
                                    <Route path="/provider/notifications" element={<ProtectedRoute role="provider"><Notifications /></ProtectedRoute>} />
                                    <Route path="/provider/messages" element={<ProtectedRoute role="provider"><Messages /></ProtectedRoute>} />
                                    <Route path="/provider/profile" element={<ProtectedRoute role="provider"><ProviderProfile /></ProtectedRoute>} />
                                    <Route path="/provider/settings" element={<ProtectedRoute role="provider"><ProviderSettings /></ProtectedRoute>} />

                                    {/* Admin */}
                                    <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
                                    <Route path="/admin/users" element={<ProtectedRoute role="admin"><ManageUsers /></ProtectedRoute>} />
                                    <Route path="/admin/bookings" element={<ProtectedRoute role="admin"><AllBookings /></ProtectedRoute>} />
                                    <Route path="/admin/provider-approvals" element={<ProtectedRoute role="admin"><ProviderApprovals /></ProtectedRoute>} />
                                    <Route path="/admin/categories" element={<ProtectedRoute role="admin"><ManageCategories /></ProtectedRoute>} />
                                    <Route path="/admin/communities" element={<ProtectedRoute role="admin"><ManageCommunities /></ProtectedRoute>} />
                                    <Route path="/admin/complaints" element={<ProtectedRoute role="admin"><Complaints /></ProtectedRoute>} />
                                    <Route path="/admin/reports" element={<ProtectedRoute role="admin"><Reports /></ProtectedRoute>} />
                                    <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminPayments /></ProtectedRoute>} />
                                    <Route path="/admin/system-logs" element={<ProtectedRoute role="admin"><SystemLogs /></ProtectedRoute>} />
                                    <Route path="/admin/notifications" element={<ProtectedRoute role="admin"><Notifications /></ProtectedRoute>} />
                                    <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />
                                    <Route path="/admin/profile" element={<ProtectedRoute role="admin"><AdminProfile /></ProtectedRoute>} />

                                    <Route path="*" element={<Navigate to="/login" replace />} />
                                  </Routes>
                                </Suspense>

                                {/* Universal FixIt Assistant AI Chatbot */}
                                <FixItAssistant />
                              </BrowserRouter>
                            </BookingProvider>
                          </ChatProvider>
                        </ReviewProvider>
                      </ComplaintProvider>
                    </WalletProvider>
                    <ToastViewport />
                  </ToastProvider>
                </NotificationProvider>
              </AvailabilityProvider>
            </ServiceProvider>
          </UserProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
