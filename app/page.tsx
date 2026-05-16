'use client'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const personas = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Anita Sharma', role: 'admin', dept: 'HR' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Rohit Verma', role: 'manager', dept: 'Engineering' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Priya Patel', role: 'employee', dept: 'Engineering' },
]

export default function Login() {
  const router = useRouter()

  const loginAs = (user: typeof personas[0]) => {
    localStorage.setItem('user', JSON.stringify(user))
    router.push(`/${user.role}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8">
        <h1 className="text-2xl font-bold mb-2">Goal Setting Portal</h1>
        <p className="text-slate-600 mb-6">Switch persona to demo</p>
        <div className="space-y-3">
          {personas.map(p => (
            <Button
              key={p.id}
              onClick={() => loginAs(p)}
              variant="outline"
              className="w-full justify-start h-auto py-3"
            >
              <div className="text-left">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500 capitalize">{p.role} • {p.dept}</div>
              </div>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}