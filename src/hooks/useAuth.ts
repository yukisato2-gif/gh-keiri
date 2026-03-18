// @ts-nocheck
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import type { Employee, Location } from '@/types/database'

export function useAuth() {
  const { setEmployee, setLoading, setSession } = useAuthStore()
  const { setAuthorizedLocations, setSelectedLocation, selectedLocation } = useLocationStore()

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchEmployeeProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchEmployeeProfile(session.user.id)
      } else {
        setEmployee(null)
        setAuthorizedLocations([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchEmployeeProfile(authUserId: string) {
    if (!supabase) return

    try {
      // Use SECURITY DEFINER function to handle first-login linking
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? ''

      const { data: employee, error } = await supabase
        .rpc('link_employee_on_first_login', { p_email: email })

      if (error) {
        console.error('link_employee_on_first_login error:', error)
        setEmployee(null)
        setLoading(false)
        return
      }

      if (!employee) {
        // No matching employee found
        setEmployee(null)
        setLoading(false)
        return
      }

      setEmployee(employee as Employee)
      await fetchLocations(employee as Employee)
    } catch (err) {
      console.error('Failed to fetch employee profile:', err)
      setEmployee(null)
      setLoading(false)
    }
  }

  async function fetchLocations(employee: Employee) {
    if (!supabase) return

    try {
      let locations: Location[] = []

      if (employee.role === 'hq_admin' || employee.role === 'section_chief') {
        // Admin/Chief can access all locations
        const { data } = await supabase
          .from('locations')
          .select('*')
          .eq('is_active', true)
          .order('code')
        locations = (data as Location[]) ?? []
      } else {
        // Fetch authorized locations
        const { data: authorities } = await supabase
          .from('employee_location_authority')
          .select('location_id')
          .eq('employee_id', employee.id)
          .eq('can_read', true)

        if (authorities && authorities.length > 0) {
          const locationIds = authorities.map((a) => a.location_id)
          const { data } = await supabase
            .from('locations')
            .select('*')
            .in('id', locationIds)
            .eq('is_active', true)
            .order('code')
          locations = (data as Location[]) ?? []
        }

        // Always include primary location
        if (employee.primary_location_id) {
          const hasPrimary = locations.some((l) => l.id === employee.primary_location_id)
          if (!hasPrimary) {
            const { data } = await supabase
              .from('locations')
              .select('*')
              .eq('id', employee.primary_location_id)
              .single()
            if (data) locations.unshift(data as Location)
          }
        }
      }

      setAuthorizedLocations(locations)

      // Set default selected location
      if (!selectedLocation && locations.length > 0) {
        const primary = locations.find((l) => l.id === employee.primary_location_id)
        setSelectedLocation(primary ?? locations[0])
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err)
    } finally {
      setLoading(false)
    }
  }
}

export async function signInWithGoogle() {
  if (!supabase) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
