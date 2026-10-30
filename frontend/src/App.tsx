import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { applyDocumentTitle } from '@/lib/document-title'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { RoleGate } from '@/components/auth/RoleGate'
import { RequireOnboarding } from '@/components/auth/RequireOnboarding'
import { DashboardHomePage, useDashboardUser } from '@/pages/DashboardHomePage'
import { BookingsPage } from '@/pages/BookingsPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { UpgradePage } from '@/pages/UpgradePage'
import { SubscriptionPage } from '@/pages/SubscriptionPage'
import { ManageVendorsPage } from '@/pages/admin/ManageVendorsPage'
import { VendorCreatePage } from '@/pages/admin/VendorCreatePage'
import { VendorDetailPage } from '@/pages/admin/VendorDetailPage'
import { VendorEditPage } from '@/pages/admin/VendorEditPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminReportPage } from '@/pages/admin/AdminReportPage'
import { AdminSettingPage } from '@/pages/admin/AdminSettingPage'
import { PlanConfigPage } from '@/pages/admin/PlanConfigPage'
import { BookingCreateRoute } from '@/pages/routes/BookingCreateRoute'
import { BookingDetailRoute, BookingEditRoute } from '@/pages/routes/BookingDetailRoutes'
import { InvoiceDetailRoute } from '@/pages/routes/InvoiceDetailRoute'
import { PublicInvoiceRoute } from '@/pages/routes/PublicInvoiceRoute'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { PublicScheduleRoute } from '@/pages/routes/PublicScheduleRoute'
import { InvoiceCreateRoute } from '@/pages/routes/InvoiceCreateRoute'
import { VendorProfileRoute } from '@/pages/routes/VendorProfileRoute'
import { CheckoutRoute } from '@/pages/routes/CheckoutRoute'
import { SubscriptionSuccessPage } from '@/pages/SubscriptionSuccessPage'
import { RequireWriteAccess } from '@/components/auth/RequireWriteAccess'
import { PackagesPage } from '@/pages/PackagesPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { AccountProfilePage } from '@/pages/AccountProfilePage'
import { PromoLayout } from '@/components/promo/PromoLayout'
import { PromoHomePage } from '@/pages/promo/PromoHomePage'

/**
 * Peta route aplikasi.
 *
 * `/` belum diisi landing page (fase akuisisi), jadi untuk sekarang langsung
 * diarahkan ke dashboard. Dua halaman publik (jadwal & invoice) memakai route
 * terpisah tanpa layout dashboard saat task-nya dikerjakan. `/admin` memakai
 * layout sendiri (panel admin terpisah dari dashboard vendor).
 */
export function App() {
  const location = useLocation()

  /*
   * Judul dokumen dipasang di level aplikasi, bukan di masing-masing layout.
   * Alasannya: route publik (`/login`, `/invoice/:token`, `/jadwal/:slug`,
   * `/subscription/success`) TIDAK memakai DashboardLayout maupun AdminLayout,
   * jadi kalau dipasang di layout, halaman-halaman itu tetap memakai judul
   * default dari `index.html`.
   */
  useEffect(() => {
    applyDocumentTitle(location.pathname)
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={<PromoLayout />}>
        <Route index element={<PromoHomePage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      {/*
        Pendaftaran publik: di luar RoleGate karena dipakai calon vendor yang
        belum punya akun sama sekali.
      */}
      <Route path="/daftar" element={<RegisterPage />} />
      <Route path="/invoice/:token" element={<PublicInvoiceRoute />} />
      <Route path="/jadwal/:slug" element={<PublicScheduleRoute />} />
      {/*
        Onboarding sengaja di luar `<RoleGate role="vendor">`: halaman ini tidak
        memakai `DashboardLayout`, karena vendor yang belum lengkap belum boleh
        melihat menu penuh. Polanya sama dengan `/login` dan `/invoice/:token`.
      */}
      <Route
        path="/onboarding"
        element={
          <RoleGate role="vendor">
            <OnboardingPage />
          </RoleGate>
        }
      />
      {/* Tujuan redirect Duitku setelah pembayaran (DUITKU_RETURN_URL). */}
      <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />

      <Route
        path="/"
        element={
          <RoleGate role="vendor">
            <RequireOnboarding>
              <DashboardLayout />
            </RequireOnboarding>
          </RoleGate>
        }
      >
        <Route path="dashboard" element={<DashboardHomePage />} />
        <Route path="bookings" element={<BookingsRoute />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route
          path="bookings/new"
          element={
            <RequireWriteAccess>
              <BookingCreateRoute />
            </RequireWriteAccess>
          }
        />
        <Route path="bookings/:bookingId" element={<BookingDetailRoute />} />
        <Route path="bookings/:bookingId/edit" element={<BookingEditRoute />} />
        <Route
          path="bookings/:bookingId/invoice/new"
          element={
            <RequireWriteAccess>
              <InvoiceCreateRoute />
            </RequireWriteAccess>
          }
        />
        <Route path="invoices" element={<InvoicesRoute />} />
        <Route path="invoices/:invoiceId" element={<InvoiceDetailRoute />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="settings" element={<VendorProfileRoute />} />
        <Route path="settings/akun" element={<AccountProfilePage />} />
        <Route path="langganan" element={<SubscriptionPage />} />
        <Route path="upgrade" element={<UpgradeRoute />} />
        <Route path="upgrade/checkout/:ref" element={<CheckoutRoute />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RoleGate role="admin">
            <AdminLayout />
          </RoleGate>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="vendors" element={<ManageVendorsPage />} />
        <Route path="vendors/new" element={<VendorCreatePage />} />
        <Route path="vendors/:vendorId" element={<VendorDetailPage />} />
        <Route path="vendors/:vendorId/edit" element={<VendorEditPage />} />
        <Route path="plans" element={<PlanConfigPage />} />
        <Route path="reports" element={<AdminReportPage />} />
        <Route path="settings" element={<AdminSettingPage />} />
        <Route path="akun" element={<AccountProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function BookingsRoute() {
  const user = useDashboardUser()
  return <BookingsPage subscription={user.subscription} />
}

function UpgradeRoute() {
  return <UpgradePage />
}

function InvoicesRoute() {
  const user = useDashboardUser()
  return <InvoicesPage subscription={user.subscription} />
}
