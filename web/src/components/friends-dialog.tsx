"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, UserMinus, UserPlus, Check, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

type Friend = {
  friendshipId: string
  user: {
    id: string
    handle: string
    name: string
    image: string | null
  }
  since: string
}

type FriendRequest = {
  id: string
  sender?: {
    id: string
    handle: string
    name: string
    image: string | null
  }
  receiver?: {
    id: string
    handle: string
    name: string
    image: string | null
  }
  createdAt: string
}

export function FriendsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = useState("friends")
  const [loading, setLoading] = useState(true)
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  
  // Search states
  const [friendSearch, setFriendSearch] = useState("")
  const [newFriendHandle, setNewFriendHandle] = useState("")
  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestMessage, setRequestMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (open) {
      fetchFriendsData()
    }
  }, [open])

  async function fetchFriendsData() {
    setLoading(true)
    try {
      const res = await fetch('/api/friends')
      const data = await res.json()
      if (res.ok) {
        setFriends(data.friends || [])
        setPendingRequests(data.pendingRequests || [])
        setSentRequests(data.sentRequests || [])
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error)
    } finally {
      setLoading(false)
    }
  }

  async function removeFriend(friendId: string) {
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      })
      if (res.ok) {
        await fetchFriendsData()
      }
    } catch (error) {
      console.error('Failed to remove friend:', error)
    }
  }

  async function sendFriendRequest() {
    if (!newFriendHandle.trim()) return
    
    setSendingRequest(true)
    setRequestMessage(null)
    
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverHandle: newFriendHandle.trim() }),
      })
      const data = await res.json()
      
      if (res.ok) {
        setRequestMessage({ type: 'success', text: 'Friend request sent!' })
        setNewFriendHandle("")
        await fetchFriendsData()
      } else {
        setRequestMessage({ type: 'error', text: data.error || 'Failed to send request' })
      }
    } catch (error) {
      setRequestMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSendingRequest(false)
    }
  }

  async function acceptRequest(requestId: string) {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      if (res.ok) {
        await fetchFriendsData()
      }
    } catch (error) {
      console.error('Failed to accept request:', error)
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      const res = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      if (res.ok) {
        await fetchFriendsData()
      }
    } catch (error) {
      console.error('Failed to reject request:', error)
    }
  }

  const filteredFriends = friends.filter(f => 
    f.user?.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.user?.handle.toLowerCase().includes(friendSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends">My Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="requests">
              Requests ({pendingRequests.length + sentRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            {/* Search friends */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search friends by name or handle..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Friends list */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {friendSearch ? 'No friends found' : 'No friends yet'}
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <Card key={friend.friendshipId}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          {friend.user?.image ? (
                            <img src={friend.user.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-purple-600 font-medium">
                              {friend.user?.name?.[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{friend.user?.name}</div>
                          <div className="text-sm text-muted-foreground">@{friend.user?.handle}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFriend(friend.user.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {/* Send new friend request */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Add a friend</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter handle (e.g. johndoe)"
                  value={newFriendHandle}
                  onChange={(e) => setNewFriendHandle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
                />
                <Button
                  onClick={sendFriendRequest}
                  disabled={sendingRequest || !newFriendHandle.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {sendingRequest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {requestMessage && (
                <div className={`text-sm ${requestMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {requestMessage.text}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              {/* Incoming requests */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Incoming Requests</div>
                  {pendingRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            {request.sender?.image ? (
                              <img src={request.sender.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <span className="text-purple-600 font-medium">
                                {request.sender?.name?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{request.sender?.name}</div>
                            <div className="text-sm text-muted-foreground">@{request.sender?.handle}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => acceptRequest(request.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => rejectRequest(request.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Outgoing requests */}
              {sentRequests.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Sent Requests</div>
                  {sentRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            {request.receiver?.image ? (
                              <img src={request.receiver.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <span className="text-purple-600 font-medium">
                                {request.receiver?.name?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{request.receiver?.name}</div>
                            <div className="text-sm text-muted-foreground">@{request.receiver?.handle}</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : pendingRequests.length === 0 && sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending requests
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}