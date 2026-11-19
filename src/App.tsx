import { useEffect, useRef, useState } from 'react'

const EMOJIS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁']
const PREVIEW_MS = 3000
const MISMATCH_MS = 1000

type Card = { id: number; emoji: string; matched: boolean }
type Phase = 'preview' | 'playing' | 'won'

function createDeck(): Card[] {
  const deck = [...EMOJIS, ...EMOJIS].map((emoji) => ({ emoji, matched: false }))
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.map((c, id) => ({ ...c, id }))
}

export default function App() {
  const [cards, setCards] = useState<Card[]>(createDeck)
  const [phase, setPhase] = useState<Phase>('preview')
  const [selected, setSelected] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const timer = useRef<number>()

  // Preview: show all cards for 3 seconds, then hide
  useEffect(() => {
    if (phase !== 'preview') return
    const t = window.setTimeout(() => setPhase('playing'), PREVIEW_MS)
    return () => clearTimeout(t)
  }, [phase, cards])

  useEffect(() => () => clearTimeout(timer.current), [])

  const flip = (id: number) => {
    if (phase !== 'playing' || locked) return
    const card = cards[id]
    if (card.matched || selected.includes(id)) return

    const next = [...selected, id]
    setSelected(next)
    if (next.length < 2) return

    setMoves((m) => m + 1)
    const [a, b] = next
    if (cards[a].emoji === cards[b].emoji) {
      const updated = cards.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c))
      setCards(updated)
      setSelected([])
      if (updated.every((c) => c.matched)) setPhase('won')
    } else {
      setLocked(true)
      timer.current = window.setTimeout(() => {
        setSelected([])
        setLocked(false)
      }, MISMATCH_MS)
    }
  }

  const restart = () => {
    clearTimeout(timer.current)
    setCards(createDeck())
    setSelected([])
    setMoves(0)
    setLocked(false)
    setPhase('preview')
  }

  return (
    <main className="app">
      <h1>เกมจับคู่การ์ด</h1>
      <p className="status">
        {phase === 'preview' ? 'จำตำแหน่งการ์ดให้ดี! กำลังจะคว่ำใน 3 วินาที...' : `จำนวนครั้งที่เปิด: ${moves}`}
      </p>

      <div className="grid">
        {cards.map((c) => {
          const faceUp = phase === 'preview' || c.matched || selected.includes(c.id)
          return (
            <button
              key={c.id}
              className={`card${faceUp ? ' up' : ''}${c.matched ? ' matched' : ''}`}
              onClick={() => flip(c.id)}
              aria-label={faceUp ? c.emoji : 'การ์ดที่คว่ำอยู่'}
            >
              {faceUp ? c.emoji : '❓'}
            </button>
          )
        })}
      </div>

      {phase === 'won' && (
        <div className="win">
          <p>🎉 ยินดีด้วย! คุณจับคู่ครบทุกคู่แล้ว ใช้ทั้งหมด {moves} ครั้ง</p>
          <button className="restart" onClick={restart}>เล่นใหม่</button>
        </div>
      )}
    </main>
  )
}
