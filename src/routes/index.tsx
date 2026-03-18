import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/components/auth/LoginPage'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// Lazy-loaded pages for code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage').then(m => ({ default: m.TransactionsPage })))
const NewTransactionPage = lazy(() => import('@/pages/NewTransactionPage').then(m => ({ default: m.NewTransactionPage })))
const TransactionDetailPage = lazy(() => import('@/pages/TransactionDetailPage').then(m => ({ default: m.TransactionDetailPage })))
const EditTransactionPage = lazy(() => import('@/pages/EditTransactionPage').then(m => ({ default: m.EditTransactionPage })))
const CashCheckPage = lazy(() => import('@/pages/CashCheckPage').then(m => ({ default: m.CashCheckPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })))
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const AdvancePaymentsPage = lazy(() => import('@/pages/AdvancePaymentsPage').then(m => ({ default: m.AdvancePaymentsPage })))
const BillingListPage = lazy(() => import('@/pages/BillingListPage').then(m => ({ default: m.BillingListPage })))
const BillingCreatePage = lazy(() => import('@/pages/BillingCreatePage').then(m => ({ default: m.BillingCreatePage })))
const BillingDetailPage = lazy(() => import('@/pages/BillingDetailPage').then(m => ({ default: m.BillingDetailPage })))
const MonthlyClosePage = lazy(() => import('@/pages/MonthlyClosePage').then(m => ({ default: m.MonthlyClosePage })))
const PaymentPage = lazy(() => import('@/pages/PaymentPage').then(m => ({ default: m.PaymentPage })))
const OutstandingPage = lazy(() => import('@/pages/OutstandingPage').then(m => ({ default: m.OutstandingPage })))
const SettlementPage = lazy(() => import('@/pages/SettlementPage').then(m => ({ default: m.SettlementPage })))
const SettlementDetailPage = lazy(() => import('@/pages/SettlementDetailPage').then(m => ({ default: m.SettlementDetailPage })))

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>}>
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: 'transactions', element: <LazyPage><TransactionsPage /></LazyPage> },
      { path: 'transactions/new', element: <LazyPage><NewTransactionPage /></LazyPage> },
      { path: 'transactions/:id', element: <LazyPage><TransactionDetailPage /></LazyPage> },
      { path: 'transactions/:id/edit', element: <LazyPage><EditTransactionPage /></LazyPage> },
      { path: 'cash-check', element: <LazyPage><CashCheckPage /></LazyPage> },
      { path: 'reports', element: <LazyPage><ReportsPage /></LazyPage> },
      { path: 'admin', element: <LazyPage><AdminPage /></LazyPage> },
      { path: 'advance-payments', element: <LazyPage><AdvancePaymentsPage /></LazyPage> },
      { path: 'billing', element: <LazyPage><BillingListPage /></LazyPage> },
      { path: 'billing/create', element: <LazyPage><BillingCreatePage /></LazyPage> },
      { path: 'billing/outstanding', element: <LazyPage><OutstandingPage /></LazyPage> },
      { path: 'billing/:id', element: <LazyPage><BillingDetailPage /></LazyPage> },
      { path: 'billing/:id/payment', element: <LazyPage><PaymentPage /></LazyPage> },
      { path: 'settlement', element: <LazyPage><SettlementPage /></LazyPage> },
      { path: 'settlement/:locationId/:month', element: <LazyPage><SettlementDetailPage /></LazyPage> },
      { path: 'monthly-close', element: <LazyPage><MonthlyClosePage /></LazyPage> },
      { path: 'audit-log', element: <LazyPage><AuditLogPage /></LazyPage> },
    ],
  },
])
