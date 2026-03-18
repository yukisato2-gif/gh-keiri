import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentEmployee, useAddResident, useEditResident, useEditEmployee, useEditLocation, useUpdateLocationAuthority } from '@/hooks/useAppData'
import { supabase } from '@/lib/supabase'
import { useDemoStore } from '@/stores/demoStore'
import { useAuthStore } from '@/stores/authStore'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ROLE_LABELS } from '@/lib/constants'
import type { Employee, Location, Resident, EmployeeLocationAuthority, UserRole } from '@/types/database'
import { Users, MapPin, Shield, ShieldCheck, ShieldAlert, UserCheck, Plus, Pencil, X, Trash2, Building2 } from 'lucide-react'

type Tab = 'employees' | 'locations' | 'residents'

const isSupabaseMode = () => {
  const session = useAuthStore.getState().session
  return !!supabase && !!session
}

const ROLE_ICON: Record<string, typeof Shield> = {
  hq_admin: ShieldAlert,
  section_chief: ShieldCheck,
  supervisor: Shield,
  home_manager: Users,
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'hq_admin', label: '本社管理者' },
  { value: 'section_chief', label: '課長' },
  { value: 'supervisor', label: '主任' },
  { value: 'home_manager', label: 'ホーム長' },
]

interface AuthEdit {
  id?: string
  location_id: string
  can_read: boolean
  can_write: boolean
  can_approve: boolean
}

export function AdminPage() {
  const navigate = useNavigate()
  const currentEmployee = useCurrentEmployee()
  const addResidentFn = useAddResident()
  const editResidentFn = useEditResident()
  const editEmployeeFn = useEditEmployee()
  const editLocationFn = useEditLocation()
  const { upsert: upsertAuth, remove: removeAuth } = useUpdateLocationAuthority()

  const [tab, setTab] = useState<Tab>('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Location modal state
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [locationForm, setLocationForm] = useState({
    bank_name: '', bank_branch: '', account_type: '' as string, account_number: '', account_holder: '',
  })

  // Resident modal state
  const [residentLocationFilter, setResidentLocationFilter] = useState('')
  const [showResidentModal, setShowResidentModal] = useState(false)
  const [editingResident, setEditingResident] = useState<Resident | null>(null)
  const [residentForm, setResidentForm] = useState({
    name: '', location_id: '', is_active: true,
    billing_name: '', billing_address: '', billing_postal_code: '', billing_contact: '', billing_notes: '',
  })

  // Employee modal state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeForm, setEmployeeForm] = useState({
    name: '', role: 'home_manager' as UserRole, primary_location_id: '' as string | null, is_active: true,
  })
  const [editAuthorities, setEditAuthorities] = useState<AuthEdit[]>([])
  const [originalAuthIds, setOriginalAuthIds] = useState<string[]>([])
  const [addAuthLocationId, setAddAuthLocationId] = useState('')

  const demoLocations = useDemoStore((s) => s.locations)

  const isAdmin = currentEmployee?.role === 'hq_admin' || currentEmployee?.role === 'section_chief'

  const fetchData = useCallback(async () => {
    setIsLoading(true)

    if (!isSupabaseMode()) {
      const store = useDemoStore.getState()
      setLocations(demoLocations)
      setEmployees(store.employees)
      setResidents(store.residents)
      setIsLoading(false)
      return
    }

    const [empRes, locRes, resRes] = await Promise.all([
      supabase!.from('employees').select('*, primary_location:locations(*)').order('employee_code'),
      supabase!.from('locations').select('*, area:areas(*)').order('code'),
      supabase!.from('residents').select('*').order('name'),
    ])

    if (empRes.data) setEmployees(empRes.data as Employee[])
    if (locRes.data) setLocations(locRes.data as Location[])
    if (resRes.data) setResidents(resRes.data as Resident[])
    setIsLoading(false)
  }, [demoLocations])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set default location filter
  useEffect(() => {
    if (locations.length > 0 && !residentLocationFilter) {
      setResidentLocationFilter(locations[0].id)
    }
  }, [locations, residentLocationFilter])

  const filteredResidents = residentLocationFilter
    ? residents.filter((r) => r.location_id === residentLocationFilter)
    : residents

  // --- Resident handlers ---
  // --- Location handlers ---
  const openEditLocation = (loc: Location) => {
    setEditingLocation(loc)
    setLocationForm({
      bank_name: loc.bank_name ?? '',
      bank_branch: loc.bank_branch ?? '',
      account_type: loc.account_type ?? '',
      account_number: loc.account_number ?? '',
      account_holder: loc.account_holder ?? '',
    })
    setShowLocationModal(true)
  }

  const handleLocationSave = async () => {
    if (!editingLocation) return
    setIsSaving(true)
    const { error } = await editLocationFn(editingLocation.id, {
      bank_name: locationForm.bank_name || null,
      bank_branch: locationForm.bank_branch || null,
      account_type: locationForm.account_type || null,
      account_number: locationForm.account_number || null,
      account_holder: locationForm.account_holder || null,
    })
    if (error) console.error('Failed to update location:', error)
    setIsSaving(false)
    setShowLocationModal(false)
    fetchData()
  }

  // --- Resident handlers ---
  const openAddResident = () => {
    setEditingResident(null)
    setResidentForm({
      name: '', location_id: residentLocationFilter || locations[0]?.id || '', is_active: true,
      billing_name: '', billing_address: '', billing_postal_code: '', billing_contact: '', billing_notes: '',
    })
    setShowResidentModal(true)
  }

  const openEditResident = (resident: Resident) => {
    setEditingResident(resident)
    setResidentForm({
      name: resident.name, location_id: resident.location_id, is_active: resident.is_active,
      billing_name: resident.billing_name ?? '',
      billing_address: resident.billing_address ?? '',
      billing_postal_code: resident.billing_postal_code ?? '',
      billing_contact: resident.billing_contact ?? '',
      billing_notes: resident.billing_notes ?? '',
    })
    setShowResidentModal(true)
  }

  const handleResidentSave = async () => {
    if (!residentForm.name.trim() || !residentForm.location_id) return
    setIsSaving(true)

    const residentData = {
      name: residentForm.name.trim(),
      location_id: residentForm.location_id,
      is_active: residentForm.is_active,
      billing_name: residentForm.billing_name || null,
      billing_address: residentForm.billing_address || null,
      billing_postal_code: residentForm.billing_postal_code || null,
      billing_contact: residentForm.billing_contact || null,
      billing_notes: residentForm.billing_notes || null,
    }

    if (editingResident) {
      const { error } = await editResidentFn(editingResident.id, residentData)
      if (error) console.error('Failed to update resident:', error)
    } else {
      const { error } = await addResidentFn(residentData)
      if (error) console.error('Failed to add resident:', error)
    }

    setIsSaving(false)
    setShowResidentModal(false)
    fetchData()
  }

  // --- Employee handlers ---
  const openEditEmployee = async (emp: Employee) => {
    setEditingEmployee(emp)
    setEmployeeForm({
      name: emp.name,
      role: emp.role,
      primary_location_id: emp.primary_location_id,
      is_active: emp.is_active,
    })

    // Fetch authorities for this employee
    let auths: AuthEdit[] = []
    if (!isSupabaseMode()) {
      const store = useDemoStore.getState()
      auths = store.authorities
        .filter((a) => a.employee_id === emp.id)
        .map((a) => ({ id: a.id, location_id: a.location_id, can_read: a.can_read, can_write: a.can_write, can_approve: a.can_approve }))
    } else {
      const { data } = await supabase!
        .from('employee_location_authority')
        .select('*')
        .eq('employee_id', emp.id)
      auths = (data ?? []).map((a: EmployeeLocationAuthority) => ({
        id: a.id, location_id: a.location_id, can_read: a.can_read, can_write: a.can_write, can_approve: a.can_approve,
      }))
    }

    setEditAuthorities(auths)
    setOriginalAuthIds(auths.filter((a) => a.id).map((a) => a.id!))
    setAddAuthLocationId('')
    setShowEmployeeModal(true)
  }

  const handleEmployeeSave = async () => {
    if (!editingEmployee || !employeeForm.name.trim()) return
    setIsSaving(true)

    // Update employee
    const { error } = await editEmployeeFn(editingEmployee.id, {
      name: employeeForm.name.trim(),
      role: employeeForm.role,
      primary_location_id: employeeForm.primary_location_id || null,
      is_active: employeeForm.is_active,
    })
    if (error) {
      console.error('Failed to update employee:', error)
      setIsSaving(false)
      return
    }

    // Upsert authorities
    for (const auth of editAuthorities) {
      await upsertAuth({
        employee_id: editingEmployee.id,
        location_id: auth.location_id,
        can_read: auth.can_read,
        can_write: auth.can_write,
        can_approve: auth.can_approve,
        granted_by: currentEmployee?.id ?? null,
      })
    }

    // Delete removed authorities
    const currentLocationIds = new Set(editAuthorities.map((a) => a.location_id))
    for (const origId of originalAuthIds) {
      const origAuth = editAuthorities.find((a) => a.id === origId)
      if (!origAuth) {
        // Find original location_id from the store/supabase. Since we have the IDs, just delete by ID.
        await removeAuth(origId)
      }
    }
    // Also delete any that were in original but whose location is no longer in editAuthorities
    // The above handles it via origAuth check

    setIsSaving(false)
    setShowEmployeeModal(false)
    fetchData()
  }

  const handleAddAuthority = () => {
    if (!addAuthLocationId || editAuthorities.some((a) => a.location_id === addAuthLocationId)) return
    setEditAuthorities((prev) => [...prev, {
      location_id: addAuthLocationId, can_read: true, can_write: false, can_approve: false,
    }])
    setAddAuthLocationId('')
  }

  const handleRemoveAuthority = (locationId: string) => {
    setEditAuthorities((prev) => prev.filter((a) => a.location_id !== locationId))
  }

  const handleToggleAuth = (locationId: string, field: 'can_read' | 'can_write' | 'can_approve') => {
    setEditAuthorities((prev) =>
      prev.map((a) => a.location_id === locationId ? { ...a, [field]: !a[field] } : a)
    )
  }

  // Available locations for adding authority (not already in editAuthorities)
  const availableAuthLocations = locations.filter(
    (loc) => !editAuthorities.some((a) => a.location_id === loc.id)
  )

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">管理者権限が必要です</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">戻る</button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">管理設定</h2>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        <TabButton active={tab === 'employees'} onClick={() => setTab('employees')} icon={<Users className="h-4 w-4" />} label="従業員" />
        <TabButton active={tab === 'locations'} onClick={() => setTab('locations')} icon={<MapPin className="h-4 w-4" />} label="拠点" />
        <TabButton active={tab === 'residents'} onClick={() => setTab('residents')} icon={<UserCheck className="h-4 w-4" />} label="利用者" />
      </div>

      {/* Employees Tab */}
      {tab === 'employees' && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">従業員一覧（{employees.length}名）</h3>
          </div>
          <div className="divide-y divide-border">
            {employees.map((emp) => {
              const RoleIcon = ROLE_ICON[emp.role] ?? Users
              return (
                <div key={emp.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${emp.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <RoleIcon className={`h-4 w-4 ${emp.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{emp.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{ROLE_LABELS[emp.role] ?? emp.role}</span>
                      {!emp.is_active && <span className="rounded bg-expense/10 px-1.5 py-0.5 text-xs text-expense">無効</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{emp.employee_code}</span>
                      <span>{emp.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {emp.primary_location?.name ?? '-'}
                    </span>
                    <button
                      onClick={() => openEditEmployee(emp)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locations Tab */}
      {tab === 'locations' && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">拠点一覧（{locations.length}拠点）</h3>
          </div>
          <div className="divide-y divide-border">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${loc.is_active ? 'bg-income/10' : 'bg-muted'}`}>
                  <MapPin className={`h-4 w-4 ${loc.is_active ? 'text-income' : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{loc.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{loc.code}</span>
                    {!loc.is_active && <span className="rounded bg-expense/10 px-1.5 py-0.5 text-xs text-expense">無効</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {loc.area?.name && <span>{loc.area.name}</span>}
                    {loc.address && <span>{loc.address}</span>}
                  </div>
                  {loc.bank_name && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{loc.bank_name} {loc.bank_branch} {loc.account_number}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openEditLocation(loc)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Residents Tab */}
      {tab === 'residents' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={residentLocationFilter}
              onChange={(e) => setResidentLocationFilter(e.target.value)}
              className="flex-1 rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <button
              onClick={openAddResident}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              追加
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-medium">利用者一覧（{filteredResidents.length}名）</h3>
            </div>
            {filteredResidents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                この拠点に登録された利用者はいません
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredResidents.map((resident) => (
                  <div key={resident.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${resident.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                      <UserCheck className={`h-4 w-4 ${resident.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{resident.name}</span>
                        {resident.is_active ? (
                          <span className="rounded bg-income/10 px-1.5 py-0.5 text-xs text-income">有効</span>
                        ) : (
                          <span className="rounded bg-expense/10 px-1.5 py-0.5 text-xs text-expense">無効</span>
                        )}
                      </div>
                      {resident.billing_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">請求先: {resident.billing_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => openEditResident(resident)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resident Add/Edit Modal */}
      {showResidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowResidentModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingResident ? '利用者を編集' : '利用者を追加'}</h3>
              <button onClick={() => setShowResidentModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">名前</label>
                <input
                  type="text"
                  value={residentForm.name}
                  onChange={(e) => setResidentForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例: 利用者A"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">拠点</label>
                <select
                  value={residentForm.location_id}
                  onChange={(e) => setResidentForm((f) => ({ ...f, location_id: e.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <ToggleField
                label="有効"
                value={residentForm.is_active}
                onChange={() => setResidentForm((f) => ({ ...f, is_active: !f.is_active }))}
              />

              {/* Billing Info */}
              <div className="border-t border-border pt-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">請求先情報（任意）</h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">請求先名</label>
                    <input
                      type="text"
                      value={residentForm.billing_name}
                      onChange={(e) => setResidentForm((f) => ({ ...f, billing_name: e.target.value }))}
                      placeholder="例: 利用者A 保護者"
                      className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="mb-1 block text-xs text-muted-foreground">郵便番号</label>
                      <input
                        type="text"
                        value={residentForm.billing_postal_code}
                        onChange={(e) => setResidentForm((f) => ({ ...f, billing_postal_code: e.target.value }))}
                        placeholder="123-4567"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">住所</label>
                      <input
                        type="text"
                        value={residentForm.billing_address}
                        onChange={(e) => setResidentForm((f) => ({ ...f, billing_address: e.target.value }))}
                        placeholder="東京都..."
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">連絡先</label>
                    <input
                      type="text"
                      value={residentForm.billing_contact}
                      onChange={(e) => setResidentForm((f) => ({ ...f, billing_contact: e.target.value }))}
                      placeholder="電話番号 or メール"
                      className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">備考</label>
                    <input
                      type="text"
                      value={residentForm.billing_notes}
                      onChange={(e) => setResidentForm((f) => ({ ...f, billing_notes: e.target.value }))}
                      className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowResidentModal(false)} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
                  キャンセル
                </button>
                <button
                  onClick={handleResidentSave}
                  disabled={!residentForm.name.trim() || isSaving}
                  className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Edit Modal */}
      {showLocationModal && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLocationModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingLocation.name} - 口座情報</h3>
              <button onClick={() => setShowLocationModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">銀行名</label>
                  <input
                    type="text"
                    value={locationForm.bank_name}
                    onChange={(e) => setLocationForm((f) => ({ ...f, bank_name: e.target.value }))}
                    placeholder="例: みずほ銀行"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">支店名</label>
                  <input
                    type="text"
                    value={locationForm.bank_branch}
                    onChange={(e) => setLocationForm((f) => ({ ...f, bank_branch: e.target.value }))}
                    placeholder="例: 新宿支店"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">口座種別</label>
                  <select
                    value={locationForm.account_type}
                    onChange={(e) => setLocationForm((f) => ({ ...f, account_type: e.target.value }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">未設定</option>
                    <option value="ordinary">普通</option>
                    <option value="checking">当座</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">口座番号</label>
                  <input
                    type="text"
                    value={locationForm.account_number}
                    onChange={(e) => setLocationForm((f) => ({ ...f, account_number: e.target.value }))}
                    placeholder="1234567"
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">口座名義</label>
                <input
                  type="text"
                  value={locationForm.account_holder}
                  onChange={(e) => setLocationForm((f) => ({ ...f, account_holder: e.target.value }))}
                  placeholder="カ）ナマエ"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowLocationModal(false)} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
                  キャンセル
                </button>
                <button
                  onClick={handleLocationSave}
                  disabled={isSaving}
                  className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Edit Modal */}
      {showEmployeeModal && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12" onClick={() => setShowEmployeeModal(false)}>
          <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">従業員を編集</h3>
              <button onClick={() => setShowEmployeeModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">名前</label>
                <input
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Role */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">ロール</label>
                <select
                  value={employeeForm.role}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Primary Location */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">主要拠点</label>
                <select
                  value={employeeForm.primary_location_id ?? ''}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, primary_location_id: e.target.value || null }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">なし</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <ToggleField
                label="有効"
                value={employeeForm.is_active}
                onChange={() => setEmployeeForm((f) => ({ ...f, is_active: !f.is_active }))}
              />

              {/* Location Authorities */}
              <div>
                <label className="mb-2 block text-sm font-medium">拠点別アクセス権限</label>
                {editAuthorities.length === 0 ? (
                  <p className="text-xs text-muted-foreground mb-2">権限が設定されていません</p>
                ) : (
                  <div className="mb-3 space-y-2">
                    {editAuthorities.map((auth) => {
                      const loc = locations.find((l) => l.id === auth.location_id)
                      return (
                        <div key={auth.location_id} className="rounded-md border border-border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium">{loc?.name ?? auth.location_id}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAuthority(auth.location_id)}
                              className="rounded p-1 text-muted-foreground hover:bg-expense/10 hover:text-expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={auth.can_read}
                                onChange={() => handleToggleAuth(auth.location_id, 'can_read')}
                                className="rounded border-input"
                              />
                              閲覧
                            </label>
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={auth.can_write}
                                onChange={() => handleToggleAuth(auth.location_id, 'can_write')}
                                className="rounded border-input"
                              />
                              書込
                            </label>
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={auth.can_approve}
                                onChange={() => handleToggleAuth(auth.location_id, 'can_approve')}
                                className="rounded border-input"
                              />
                              承認
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add location authority */}
                {availableAuthLocations.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={addAuthLocationId}
                      onChange={(e) => setAddAuthLocationId(e.target.value)}
                      className="flex-1 rounded-md border border-input px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">拠点を追加...</option>
                      {availableAuthLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddAuthority}
                      disabled={!addAuthLocationId}
                      className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      追加
                    </button>
                  </div>
                )}
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEmployeeModal(false)} className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
                  キャンセル
                </button>
                <button
                  onClick={handleEmployeeSave}
                  disabled={!employeeForm.name.trim() || isSaving}
                  className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
