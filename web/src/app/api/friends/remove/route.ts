import { auth } from "@/lib/auth"
import { PrismaClient } from "@prisma/client"
import { headers } from "next/headers"

const prisma = new PrismaClient()

export async function DELETE(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { friendId } = await req.json()

    // Delete both sides of the friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: session.user.id, friendId: friendId },
          { userId: friendId, friendId: session.user.id },
        ],
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Remove friend error:', error)
    return Response.json({ error: 'Failed to remove friend' }, { status: 500 })
  }
}