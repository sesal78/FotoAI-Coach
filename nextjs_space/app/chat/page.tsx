'use client'

import ChatInterface from '@/components/sections/chat-interface'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { Lightbulb } from 'lucide-react'

export default function ChatPage() {
  const [syncing, setSyncing] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const handleSyncChallenge = async () => {
    setSyncing(true)
    
    try {
      // Show instruction to user
      const challengeData = prompt(
        '📋 SYNC CHALLENGE TO DASHBOARD\n\n' +
        'Copy the CHALLENGE_SYNC_DATA JSON from the chat above and paste it here.\n\n' +
        'Look for the JSON block that starts with:\n' +
        'CHALLENGE_SYNC_DATA\n' +
        '{\n' +
        '  "challengeText": "...",\n' +
        '  ...\n' +
        '}\n\n' +
        'Paste ONLY the JSON part (starting with { and ending with }):'
      )

      if (!challengeData) {
        toast.info('Sync cancelled')
        setSyncing(false)
        return
      }

      // Parse JSON
      let parsedData
      try {
        parsedData = JSON.parse(challengeData.trim())
      } catch (e) {
        toast.error('❌ Invalid JSON format. Please copy the exact JSON block from the chat.')
        setSyncing(false)
        return
      }

      // Validate required fields
      if (!parsedData.challengeText || !parsedData.category) {
        toast.error('❌ Missing required fields (challengeText, category)')
        setSyncing(false)
        return
      }

      // Add userId
      const payload = {
        userId: '1',
        ...parsedData
      }

      console.log('[Manual Sync] Sending payload:', payload)

      // Send to API
      const response = await fetch('/api/challenges/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[Manual Sync] Success:', result)
        toast.success('✅ Challenge synced to dashboard! Check /dashboard to see it.')
      } else {
        const error = await response.text()
        console.error('[Manual Sync] Error:', error)
        toast.error(`❌ Failed to sync: ${error}`)
      }
    } catch (error) {
      console.error('[Manual Sync] Network error:', error)
      toast.error('❌ Network error while syncing challenge')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="relative">
      {/* Instructions Banner */}
      {showInstructions && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  How to Sync Challenges
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Ask the chatbot for a photography challenge</li>
                  <li>Look for the CHALLENGE_SYNC_DATA JSON block in the response</li>
                  <li>Copy the JSON (everything between the curly braces {'{ }'} )</li>
                  <li>Click the "Sync Challenge" button below</li>
                  <li>Paste the JSON when prompted</li>
                  <li>Check your dashboard to see the synced challenge!</li>
                </ol>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Got it, close this
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="min-h-screen pt-16">
        <ChatInterface />
      </div>
      
      {/* Floating Sync Button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        {/* Help Button */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full p-2 shadow-md transition-colors"
          title="Show sync instructions"
        >
          <Lightbulb className="w-5 h-5" />
        </button>

        {/* Sync Button */}
        <Button
          onClick={handleSyncChallenge}
          disabled={syncing}
          size="lg"
          className="shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white font-semibold"
        >
          {syncing ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Syncing...
            </>
          ) : (
            <>
              <span className="mr-2">📸</span>
              Sync Challenge to Dashboard
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
