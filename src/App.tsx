import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { is本社管理者 } from '@/stores/authStore'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionFormPage } from '@/pages/TransactionFormPage'
import { TransactionListPage } from '@/pages/TransactionListPage'
import { TransactionDetailPage } from '@/pages/TransactionDetailPage'
import { CashCheckPage } from '@/pages/CashCheckPage'
import { CashCheckFormPage } from '@/pages/CashCheckFormPage'
import { SVClosingPage } from '@/pages/SVClosingPage'
import { CorrectionListPage } from '@/pages/CorrectionListPage'
import { LocationSelectPage } from '@/pages/LocationSelectPage'
import { AdminPage } from '@/pages/AdminPage'
import { NotificationListPage } from '@/pages/NotificationListPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { UserListPage } from '@/pages/UserListPage'
import { DifferenceListPage } from '@/pages/DifferenceListPage'
import { MOUListPage } from '@/pages/MOUListPage'
import { AllLocationLedgerPage } from '@/pages/AllLocationLedgerPage'
import { AccessInfoPage } from '@/pages/AccessInfoPage'
import { BalanceSummaryPage } from '@/pages/BalanceSummaryPage'
import { SVMenuPage } from '@/pages/SVMenuPage'
import { HomeMenuPage } from '@/pages/HomeMenuPage'
import { EmployeeMenuPage } from '@/pages/EmployeeMenuPage'
import { AdminBillingMenuPage } from '@/pages/AdminBillingMenuPage'
import { AdminMainMenuPage } from '@/pages/AdminMainMenuPage'
// === 経理拡張画面 ===
import { MonthlyClosePage } from '@/pages/MonthlyClosePage'
import { AdvancePaymentsPage } from '@/pages/AdvancePaymentsPage'
import { BillingListPage } from '@/pages/BillingListPage'
import { BillingCreatePage } from '@/pages/BillingCreatePage'
import { BillingDetailPage } from '@/pages/BillingDetailPage'

export default function App() {
  const { user, employee, loading, initialize } = useAuthStore()
  const { loadLocations } = useLocationStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (user?.email && employee) {
      loadLocations(user.email, is本社管理者(employee))
    }
  }, [user, employee, loadLocations])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionListPage />} />
        <Route path="/transactions/new" element={<TransactionFormPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route path="/transactions/:id/edit" element={<TransactionFormPage />} />
        <Route path="/cash-check" element={<CashCheckPage />} />
        <Route path="/cash-check/new" element={<CashCheckFormPage />} />
        <Route path="/sv-closing" element={<SVClosingPage />} />
        <Route path="/corrections" element={<CorrectionListPage />} />
        <Route path="/location-select" element={<LocationSelectPage />} />
        <Route path="/notifications" element={<NotificationListPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/users" element={<UserListPage />} />
        <Route path="/differences" element={<DifferenceListPage />} />
        <Route path="/mous" element={<MOUListPage />} />
        <Route path="/all-ledger" element={<AllLocationLedgerPage />} />
        <Route path="/access-info" element={<AccessInfoPage />} />
        <Route path="/balance" element={<BalanceSummaryPage />} />
        <Route path="/sv-menu" element={<SVMenuPage />} />
        <Route path="/home-menu" element={<HomeMenuPage />} />
        <Route path="/employee-menu" element={<EmployeeMenuPage />} />
        <Route path="/admin-billing" element={<AdminBillingMenuPage />} />
        <Route path="/admin-main" element={<AdminMainMenuPage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* === 経理拡張ルート === */}
        <Route path="/monthly-close" element={<MonthlyClosePage />} />
        <Route path="/advance-payments" element={<AdvancePaymentsPage />} />
        <Route path="/billing" element={<BillingListPage />} />
        <Route path="/billing/create" element={<BillingCreatePage />} />
        <Route path="/billing/:id" element={<BillingDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}
