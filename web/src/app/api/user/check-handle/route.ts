import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { handle: true },
    })

    return Response.json({ hasHandle: !!user?.handle })
  } catch (error) {
    console.error('Check handle error:', error)
    return Response.json({ error: 'Failed to check handle' }, { status: 500 })
  }
}