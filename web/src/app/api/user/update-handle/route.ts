import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { headers } from "next/headers"

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await req.json()

    if (!handle) {
      return Response.json({ error: 'Handle is required' }, { status: 400 })
    }

    // Check if handle is already taken
    const existing = await prisma.user.findUnique({
      where: { handle },
    })

    if (existing && existing.id !== session.user.id) {
      return Response.json({ error: 'Handle already taken' }, { status: 400 })
    }

    // Update user with handle
    await prisma.user.update({
      where: { id: session.user.id },
      data: { handle },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Update handle error:', error)
    return Response.json({ error: 'Failed to update handle' }, { status: 500 })
  }
}