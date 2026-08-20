import { useEffect, useRef, useState } from 'react'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
const LOTTIE_EMBED = 'https://lottie.host/embed/80e0f8f8-cf3b-4823-8df0-4ff1ceb91ef8/JL1caE3p9n.lottie'

type FaceApi = typeof import('@vladmandic/face-api')

let modelsReady: Promise<FaceApi> | null = null

function cameraAvailable() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia)
}

function loadModels() {
  if (!modelsReady) {
    modelsReady = import('@vladmandic/face-api').then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      return faceapi
    })
  }
  return modelsReady
}

function demoDescriptor(key: string) {
  const text = key.trim().toLowerCase() || 'people-demo'
  const out: number[] = []
  let seed = 2166136261
  for (let i = 0; i < 128; i += 1) {
    let n = seed
    for (let j = 0; j < text.length; j += 1) n = Math.imul(n ^ (text.charCodeAt(j) + i * 17), 16777619)
    seed = n
    out.push(((n >>> 0) % 2000) / 1000 - 1)
  }
  return out
}

function demoPhoto(label: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 300
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/jpeg', 0.72)
  ctx.fillStyle = '#0b2a4a'
  ctx.fillRect(0, 0, 240, 300)
  ctx.fillStyle = '#7eb3c9'
  ctx.beginPath()
  ctx.arc(120, 118, 52, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a3d55'
  ctx.beginPath()
  ctx.ellipse(120, 250, 78, 70, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b2a4a'
  ctx.beginPath()
  ctx.arc(102, 110, 6, 0, Math.PI * 2)
  ctx.arc(138, 110, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#042018'
  ctx.fillRect(0, 248, 240, 52)
  ctx.fillStyle = '#f4fffb'
  ctx.font = '13px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label.slice(0, 28), 120, 270)
  ctx.fillStyle = '#93a3b5'
  ctx.font = '11px sans-serif'
  ctx.fillText('MVP scan', 120, 288)
  return canvas.toDataURL('image/jpeg', 0.72)
}

export function FaceCapture({
  onCapture,
  onError,
  label = 'Capture face',
  scanKey = '',
  compact = false,
}: {
  onCapture: (descriptor: number[], photo: string) => void
  onError?: (message: string) => void
  label?: string
  scanKey?: string
  compact?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(!cameraAvailable())
  const [identity, setIdentity] = useState('')

  function fail(message: string) {
    setError(message)
    onError?.(message)
  }

  useEffect(() => {
    if (demo) {
      setLoading(false)
      return
    }
    let stream: MediaStream | null = null
    let cancelled = false
    ;(async () => {
      try {
        await loadModels()
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        if (!cancelled) setDemo(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [demo])

  async function capture() {
    setBusy(true)
    setError('')
    try {
      if (demo) {
        const key = (scanKey || identity).trim()
        if (!key) {
          fail('Enter work email to scan on HTTP.')
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1200))
        onCapture(demoDescriptor(key), demoPhoto(key))
        return
      }
      const video = videoRef.current
      if (!video) return
      const faceapi = await loadModels()
      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!result) {
        fail('No face found. Face the camera and try again.')
        return
      }
      const canvas = document.createElement('canvas')
      const width = 240
      const height = Math.max(180, Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width))
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height)
      onCapture(Array.from(result.descriptor), canvas.toDataURL('image/jpeg', 0.72))
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div
        className={`relative overflow-hidden rounded-3xl border border-line bg-ink/10 ${
          compact ? 'aspect-video max-h-44' : 'aspect-[4/5] sm:aspect-video'
        }`}
      >
        {demo ? (
          <iframe src={LOTTIE_EMBED} title="Face scan" className="h-full w-full border-0" allow="autoplay" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}
      </div>
      {demo && !compact ? (
        <p className="text-sm text-muted">Camera needs HTTPS. Using a face-scan animation for this MVP.</p>
      ) : null}
      {demo && !scanKey ? (
        <input
          placeholder="Work email"
          autoComplete="username"
          className={`w-full rounded-2xl border border-line bg-surface px-4 ${compact ? 'py-2.5' : 'py-3'}`}
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
        />
      ) : null}
      {loading ? <p className="text-sm text-muted">{demo ? 'Loading scan…' : 'Starting camera…'}</p> : null}
      {!onError && error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={() => void capture()}
        disabled={loading || busy}
        className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60"
      >
        {busy ? 'Scanning face…' : label}
      </button>
    </div>
  )
}
