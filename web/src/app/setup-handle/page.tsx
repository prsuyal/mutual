'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from '@/lib/auth-client'

export default function SetupHandlePage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (checkingSession && session) {
      setCheckingSession(false)
      
      if (session.user) {
        fetch('/api/user/check-handle')
          .then(res => res.json())
          .then(data => {
            if (data.hasHandle) {
              router.push('/dashboard')
            }
          })
      }
    } else if (!session && !checkingSession) {
      router.push('/signup')
    }
  }, [session, checkingSession, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (handle.length < 3) {
      setError('Handle must be at least 3 characters long')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/user/update-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to set handle')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err: any) {
      console.error('Handle setup error:', err)
      setError(err?.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose Your Handle</CardTitle>
          <CardDescription>
            Pick a unique username for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor="handle">Handle</FieldLabel>
              <Input
                id="handle"
                type="text"
                placeholder="johndoe"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                autoFocus
              />
              <FieldDescription>
                Your unique username. Only lowercase letters, numbers, and underscores.
              </FieldDescription>
            </Field>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="mt-4 w-full">
              {loading ? 'Setting up...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}