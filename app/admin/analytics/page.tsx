'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#64748b']

const UOM_LABELS: Record<string, string> = {
  numeric_min: 'Numeric ↑',
  numeric_max: 'Numeric ↓',
  percent_min: 'Percent ↑',
  percent_max: 'Percent ↓',
  timeline: 'Timeline',
  zero: 'Zero-based',
}

function computeProgress(goal: any, achievement: any): number | null {
  if (!achievement?.actual_value || !goal?.target) return null
  const t = Number(goal.target)
  const act = Number(achievement.actual_value)
  if (t === 0 || act === 0) return null
  switch (goal.uom) {
    case 'numeric_min':
    case 'percent_min': return Math.min((act / t) * 100, 150)
    case 'numeric_max':
    case 'percent_max': return Math.min((t / act) * 100, 150)
    case 'zero': return act === 0 ? 100 : 0
    default: return null
  }
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0
}

function heatColor(val: number | null) {
  if (val === null) return 'bg-slate-100 text-slate-400'
  if (val >= 90) return 'bg-green-500 text-white'
  if (val >= 70) return 'bg-green-200 text-green-900'
  if (val >= 50) return 'bg-amber-200 text-amber-900'
  if (val >= 25) return 'bg-orange-200 text-orange-900'
  return 'bg-red-200 text-red-900'
}

const fetchAll = async () => {
  const [{ data: users }, { data: sheets }, { data: goals }, { data: achievements }] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('goal_sheets').select('*'),
    supabase.from('goals').select('*'),
    supabase.from('achievements').select('*'),
  ])
  return {
    users: users || [],
    sheets: sheets || [],
    goals: goals || [],
    achievements: achievements || [],
  }
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [raw, setRaw] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return router.push('/')
    const parsed = JSON.parse(u)
    if (parsed.role !== 'admin') { router.push(`/${parsed.role}`); return }
    setUser(parsed)
  }, [])

  useEffect(() => {
    if (!user) return
    setIsLoading(true)
    fetchAll().then(d => { setRaw(d); setIsLoading(false) })
  }, [user])

  if (!user || isLoading || !raw) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Loading analytics...</p>
    </div>
  )

  const { users, sheets, goals, achievements } = raw

  // ── index maps ─────────────────────────────────────────────────────────────
  const goalById: Record<string, any> = Object.fromEntries(goals.map((g: any) => [g.id, g]))
  const sheetById: Record<string, any> = Object.fromEntries(sheets.map((s: any) => [s.id, s]))
  const userById: Record<string, any> = Object.fromEntries(users.map((u: any) => [u.id, u]))

  // ── summary ────────────────────────────────────────────────────────────────
  const totalGoals = goals.length
  const approvedSheets = sheets.filter((s: any) => s.status === 'approved').length
  const totalSheets = sheets.length
  const approvalRate = totalSheets ? Math.round((approvedSheets / totalSheets) * 100) : 0
  const departments = [...new Set(users.map((u: any) => u.department).filter(Boolean))] as string[]

  // ── Q-on-Q trends ──────────────────────────────────────────────────────────
  const quarterTrends = QUARTERS.map(q => {
    const achInQ = achievements.filter((a: any) => a.quarter === q)
    const progresses = achInQ
      .map((a: any) => computeProgress(goalById[a.goal_id], a))
      .filter((p: number | null): p is number => p !== null)
    return {
      quarter: q,
      avgAchievement: avg(progresses),
      checkins: achInQ.length,
      completed: achInQ.filter((a: any) => a.status === 'completed').length,
      onTrack: achInQ.filter((a: any) => a.status === 'on_track').length,
    }
  })

  // ── department heatmap ─────────────────────────────────────────────────────
  const deptHeatmap = departments.map(dept => {
    const deptUserIds = new Set(users.filter((u: any) => u.department === dept).map((u: any) => u.id))
    const deptSheetIds = new Set(sheets.filter((s: any) => deptUserIds.has(s.employee_id)).map((s: any) => s.id))
    const deptGoalIds = new Set(goals.filter((g: any) => deptSheetIds.has(g.sheet_id)).map((g: any) => g.id))
    const row: Record<string, any> = { department: dept }
    QUARTERS.forEach(q => {
      const achInQ = achievements.filter((a: any) => deptGoalIds.has(a.goal_id) && a.quarter === q)
      const progresses = achInQ
        .map((a: any) => computeProgress(goalById[a.goal_id], a))
        .filter((p: number | null): p is number => p !== null)
      row[q] = progresses.length ? avg(progresses) : null
    })
    return row
  })

  // ── goal distribution ──────────────────────────────────────────────────────
  const countBy = (arr: any[], key: (x: any) => string) =>
    Object.entries(arr.reduce((acc: any, x) => { const k = key(x); acc[k] = (acc[k] || 0) + 1; return acc }, {}))
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)

  const thrustAreaData = countBy(goals, (g: any) => g.thrust_area || 'Unspecified')
  const uomData = countBy(goals, (g: any) => UOM_LABELS[g.uom] || g.uom).map(d => ({ ...d, value: d.count }))
  const statusData = countBy(sheets, (s: any) => s.status)

  // ── manager effectiveness ──────────────────────────────────────────────────
  const managers = users.filter((u: any) => u.role === 'manager')
  const managerStats = managers.map((m: any) => {
    const teamIds = new Set(users.filter((u: any) => u.manager_id === m.id).map((u: any) => u.id))
    const teamSheets = sheets.filter((s: any) => teamIds.has(s.employee_id))
    const teamSheetIds = new Set(teamSheets.map((s: any) => s.id))
    const teamGoals = goals.filter((g: any) => teamSheetIds.has(g.sheet_id))
    const teamGoalIds = new Set(teamGoals.map((g: any) => g.id))
    const teamAch = achievements.filter((a: any) => teamGoalIds.has(a.goal_id))

    const approved = teamSheets.filter((s: any) => s.status === 'approved').length
    const returned = teamSheets.filter((s: any) => s.status === 'returned').length
    const progresses = teamAch
      .map((a: any) => computeProgress(goalById[a.goal_id], a))
      .filter((p: number | null): p is number => p !== null)

    return {
      name: m.full_name.split(' ')[0],
      fullName: m.full_name,
      teamSize: teamIds.size,
      totalSheets: teamSheets.length,
      approved,
      returned,
      approvalRate: teamSheets.length ? Math.round((approved / teamSheets.length) * 100) : 0,
      avgAchievement: avg(progresses),
      completedGoals: teamAch.filter((a: any) => a.status === 'completed').length,
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-slate-500 text-sm">Organisation-wide performance insights</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>← Back</Button>
        </div>

        {/* summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">Total Goals</div>
            <div className="text-3xl font-bold">{totalGoals}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">Sheets Approved</div>
            <div className="text-3xl font-bold">{approvedSheets}<span className="text-lg text-slate-400">/{totalSheets}</span></div>
            <div className="text-xs text-slate-500">{approvalRate}% approval rate</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">Check-ins Logged</div>
            <div className="text-3xl font-bold">{achievements.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">Departments</div>
            <div className="text-3xl font-bold">{departments.length}</div>
          </Card>
        </div>

        {/* main tabs */}
        <Tabs defaultValue="trends">
          <TabsList className="mb-4">
            <TabsTrigger value="trends">Q-on-Q Trends</TabsTrigger>
            <TabsTrigger value="heatmap">Department Heatmap</TabsTrigger>
            <TabsTrigger value="distribution">Goal Distribution</TabsTrigger>
            <TabsTrigger value="managers">Manager Effectiveness</TabsTrigger>
          </TabsList>

          {/* ── Q-on-Q Trends ── */}
          <TabsContent value="trends" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Average Achievement % by Quarter</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={quarterTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" />
                  <YAxis unit="%" domain={[0, 110]} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Avg Achievement']} />
                  <Line
                    type="monotone"
                    dataKey="avgAchievement"
                    name="Avg Achievement %"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#3b82f6' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Check-ins per Quarter</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={quarterTrends} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="checkins" name="Check-ins" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Completed Goals per Quarter</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={quarterTrends} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-4">On-Track Goals per Quarter</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={quarterTrends} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="quarter" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="onTrack" name="On Track" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* ── Department Heatmap ── */}
          <TabsContent value="heatmap">
            <Card className="p-6">
              <h3 className="font-semibold mb-1">Average Achievement % by Department & Quarter</h3>
              <p className="text-xs text-slate-500 mb-5">Only includes employees with approved goal sheets and logged check-ins.</p>
              {deptHeatmap.length === 0 ? (
                <p className="text-center text-slate-400 py-12">No data available yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-1">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-slate-500 w-48">Department</th>
                          {QUARTERS.map(q => (
                            <th key={q} className="text-center py-2 px-3 font-medium text-slate-500 w-32">{q}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deptHeatmap.map((row: any) => (
                          <tr key={row.department}>
                            <td className="py-2 px-3 font-medium text-slate-700">{row.department}</td>
                            {QUARTERS.map(q => {
                              const val = row[q] as number | null
                              return (
                                <td key={q} className="p-1">
                                  <div className={`rounded-md text-center py-3 font-semibold text-sm ${heatColor(val)}`}>
                                    {val !== null ? `${val}%` : '—'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-4 mt-5 text-xs text-slate-500 flex-wrap">
                    <span className="font-medium">Legend:</span>
                    {[
                      { label: '≥ 90%', cls: 'bg-green-500' },
                      { label: '70 – 89%', cls: 'bg-green-200' },
                      { label: '50 – 69%', cls: 'bg-amber-200' },
                      { label: '25 – 49%', cls: 'bg-orange-200' },
                      { label: '< 25%', cls: 'bg-red-200' },
                      { label: 'No data', cls: 'bg-slate-100' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded ${l.cls}`} />
                        <span>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* ── Goal Distribution ── */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Goals by Thrust Area</h3>
                {thrustAreaData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-8">No data.</p>
                  : (
                    <ResponsiveContainer width="100%" height={Math.max(220, thrustAreaData.length * 36)}>
                      <BarChart data={thrustAreaData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Goals" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4">Goals by Unit of Measure</h3>
                {uomData.length === 0
                  ? <p className="text-slate-400 text-sm text-center py-8">No data.</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={uomData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          innerRadius={45}
                        >
                          {uomData.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [v, n]} />
                        <Legend iconType="circle" iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Goal Sheet Status Distribution</h3>
              <div className="flex gap-8 justify-center">
                {statusData.map((s: any, i: number) => (
                  <div key={s.name} className="text-center">
                    <div className="text-4xl font-bold mb-1" style={{ color: COLORS[i % COLORS.length] }}>{s.count}</div>
                    <div className="text-sm text-slate-500 capitalize">{s.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {totalSheets ? Math.round((s.count / totalSheets) * 100) : 0}% of total
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ── Manager Effectiveness ── */}
          <TabsContent value="managers" className="space-y-4">
            {managerStats.length === 0 ? (
              <Card className="p-8 text-center text-slate-400">No manager data available.</Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Approval Rate by Manager</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={managerStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" domain={[0, 100]} />
                        <Tooltip formatter={(v: any) => [`${v}%`, 'Approval Rate']} />
                        <Bar dataKey="approvalRate" name="Approval Rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Avg Team Achievement % by Manager</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={managerStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" domain={[0, 110]} />
                        <Tooltip formatter={(v: any) => [`${v}%`, 'Avg Achievement']} />
                        <Bar dataKey="avgAchievement" name="Avg Achievement" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <div className="space-y-3">
                  {managerStats.map((m: any) => (
                    <Card key={m.fullName} className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{m.fullName}</p>
                          <p className="text-sm text-slate-500">
                            {m.teamSize} direct {m.teamSize === 1 ? 'report' : 'reports'} · {m.totalSheets} {m.totalSheets === 1 ? 'sheet' : 'sheets'} submitted
                          </p>
                        </div>
                        <div className="flex gap-6 text-center">
                          <div>
                            <div className="text-xl font-bold text-green-600">{m.approved}</div>
                            <div className="text-xs text-slate-400">Approved</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-red-500">{m.returned}</div>
                            <div className="text-xs text-slate-400">Returned</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-blue-600">{m.avgAchievement}%</div>
                            <div className="text-xs text-slate-400">Avg Achievement</div>
                          </div>
                          <div>
                            <div className="text-xl font-bold text-purple-600">{m.completedGoals}</div>
                            <div className="text-xs text-slate-400">Goals Completed</div>
                          </div>
                        </div>
                      </div>

                      {m.totalSheets > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Approval progress</span>
                            <span>{m.approvalRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${m.approvalRate}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
