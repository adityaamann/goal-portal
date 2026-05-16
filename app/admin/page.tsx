'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast, Toaster } from 'sonner'
import Papa from 'papaparse'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [cycle, setCycle] = useState<any>(null)
  const [sheets, setSheets] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    setUser(JSON.parse(u))
    loadAll()
  }, [])

  const loadAll = async () => {
    const { data: us } = await supabase.from('users').select('*')
    const { data: cy } = await supabase.from('cycles').select('*').limit(1).single()
    const { data: sh } = await supabase.from('goal_sheets').select('*, goals(*), users!goal_sheets_employee_id_fkey(full_name, department)')
    const { data: au } = await supabase.from('goal_audit').select('*').order('changed_at', { ascending: false }).limit(20)
    setUsers(us || [])
    setCycle(cy)
    setSheets(sh || [])
    setAudit(au || [])
  }

  const toggleWindow = async (field: string) => {
    const { error } = await supabase.from('cycles').update({ [field]: !cycle[field] }).eq('id', cycle.id)
    if (error) return toast.error(error.message)
    toast.success('Cycle updated')
    loadAll()
  }

  const unlockSheet = async (sheetId: string) => {
    const { error } = await supabase.from('goal_sheets').update({ status: 'pending' }).eq('id', sheetId)
    if (error) return toast.error(error.message)
    toast.success('Sheet unlocked for editing')
    loadAll()
  }

  const exportCSV = () => {
    const rows: any[] = []
    sheets.forEach(s => {
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
    toast.success('Report downloaded')
  }

  const logout = () => { localStorage.removeItem('user'); router.push('/') }

  if (!user || !cycle) return null

  const completion = sheets.length > 0 ? Math.round((sheets.filter(s => s.status === 'approved').length / sheets.length) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Toaster position="top-right" />
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
            {sheets.map(s => (
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
            {users.map(u => (
              <Card key={u.id} className="p-3 flex justify-between">
                <div><span className="font-medium">{u.full_name}</span> <span className="text-xs text-slate-500">· {u.department}</span></div>
                <Badge variant="secondary">{u.role}</Badge>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            {audit.length === 0 ? <Card className="p-6 text-center text-slate-500">No changes logged yet.</Card> : (
              <div className="space-y-2">
                {audit.map(a => (
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