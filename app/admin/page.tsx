'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import Papa from 'papaparse'

const fetchAdminData = async () => {
  const [{ data: us }, { data: cy }, { data: sh }, { data: au }] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('cycles').select('*').limit(1).single(),
    supabase.from('goal_sheets').select('*, goals(*), users!goal_sheets_employee_id_fkey(full_name, department)'),
    supabase.from('goal_audit').select('*').order('changed_at', { ascending: false }).limit(20),
  ])
  return { users: us || [], cycle: cy, sheets: sh || [], audit: au || [] }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slowLoad, setSlowLoad] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
  }, [])

  const revalidate = async () => {
    if (!user) return
    setIsLoading(true)
    setSlowLoad(false)
    setError(null)
    try {
      const next = await fetchAdminData()
      setData(next)
    } catch (e: any) {
      setError(e?.message || 'Failed to load data')
    } finally {
      setIsLoading(false)
      setSlowLoad(false)
    }
  }

  useEffect(() => {
    if (!user) return
    revalidate()
  }, [user])

  useEffect(() => {
    if (!isLoading) return
    const t = setTimeout(() => setSlowLoad(true), 3000)
    return () => clearTimeout(t)
  }, [isLoading])

  const users = data?.users ?? []
  const cycle = data?.cycle ?? null
  const sheets = data?.sheets ?? []
  const audit = data?.audit ?? []

  const toggleWindow = async (field: string) => {
    if (!cycle) return
    const { error } = await supabase.from('cycles').update({ [field]: !cycle[field] }).eq('id', cycle.id)
    if (error) return toast.error(error.message)
    toast.success('Cycle updated')
    revalidate()
  }

  const unlockSheet = async (sheetId: string) => {
    const { error } = await supabase.from('goal_sheets').update({ status: 'pending' }).eq('id', sheetId)
    if (error) return toast.error(error.message)
    toast.success('Sheet unlocked for editing')
    revalidate()
  }

  const exportCSV = () => {
    const rows: any[] = []
    sheets.forEach((s: any) => {
      s.goals.forEach((g: any) => {
        rows.push({
          Employee: s.users.full_name,
          Department: s.users.department,
          Thrust_Area: g.thrust_area,
          Goal: g.title,
          UoM: g.uom,
          Target: g.target,
          Weightage: g.weightage,
          Status: s.status,
        })
      })
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'achievement_report.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user || isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500">Loading...</p>
        {slowLoad && <p className="text-slate-400 text-sm mt-2">Database is waking up, please wait...</p>}
      </div>
    </div>
  )

  if (error || !cycle) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-red-500">Failed to load data. <button className="underline" onClick={() => revalidate()}>Retry</button></p>
    </div>
  )

  const completion = sheets.length > 0 ? Math.round((sheets.filter((s: any) => s.status === 'approved').length / sheets.length) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-slate-600">Welcome, {user.name}</p>
          </div>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4"><div className="text-xs text-slate-500">Total Users</div><div className="text-2xl font-bold">{users.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-slate-500">Goal Sheets</div><div className="text-2xl font-bold">{sheets.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-slate-500">Approval Rate</div><div className="text-2xl font-bold">{completion}%</div></Card>
          <Card className="p-4 flex items-center"><Button onClick={exportCSV} className="w-full">Export Report</Button></Card>
        </div>

        <Tabs defaultValue="cycle">
          <TabsList>
            <TabsTrigger value="cycle">Cycle</TabsTrigger>
            <TabsTrigger value="sheets">Goal Sheets</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="cycle" className="mt-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">{cycle.name} — Window Controls</h3>
              <div className="grid grid-cols-5 gap-3">
                {['goal_setting_open','q1_open','q2_open','q3_open','q4_open'].map(f => (
                  <Button key={f} variant={cycle[f] ? 'default' : 'outline'} onClick={() => toggleWindow(f)}>
                    {f.replace('_open','').toUpperCase().replace('_',' ')} {cycle[f] ? '✓' : '✗'}
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sheets" className="mt-4 space-y-3">
            {sheets.map((s: any) => (
              <Card key={s.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{s.users.full_name} <span className="text-xs text-slate-500">({s.users.department})</span></p>
                  <p className="text-xs text-slate-500">{s.goals.length} goals</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge>{s.status}</Badge>
                  {s.status === 'approved' && <Button size="sm" variant="outline" onClick={() => unlockSheet(s.id)}>Unlock</Button>}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="users" className="mt-4 space-y-2">
            {users.map((u: any) => (
              <Card key={u.id} className="p-3 flex justify-between">
                <div><span className="font-medium">{u.full_name}</span> <span className="text-xs text-slate-500">· {u.department}</span></div>
                <Badge variant="secondary">{u.role}</Badge>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            {audit.length === 0 ? <Card className="p-6 text-center text-slate-500">No changes logged yet.</Card> : (
              <div className="space-y-2">
                {audit.map((a: any) => (
                  <Card key={a.id} className="p-3">
                    <div className="flex justify-between text-sm">
                      <span><span className="font-medium">{a.field_name}</span>: <span className="text-red-500 line-through">{a.old_value}</span> → <span className="text-green-600">{a.new_value}</span></span>
                      <span className="text-xs text-slate-400">{a.changed_at?.split('T')[0]}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
