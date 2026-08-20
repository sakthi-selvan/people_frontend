import { useEffect, useRef, useState } from 'react'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

type FaceApi = typeof import('@vladmandic/face-api')

let modelsReady: Promise<FaceApi> | null = null

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

export function FaceCapture({
  onCapture,
  label = 'Capture face',
}: {
  onCapture: (descriptor: number[], photo: string) => void
  label?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Camera or face model failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function capture() {
    const video = videoRef.current
    if (!video) return
    setBusy(true)
    setError('')
    try {
      const faceapi = await loadModels()
      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!result) {
        setError('No face found. Face the camera and try again.')
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
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-line bg-ink/10 aspect-[4/5] sm:aspect-video">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      </div>
      {loading ? <p className="text-sm text-muted">Starting camera…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        onClick={() => void capture()}
        disabled={loading || busy}
        className="w-full rounded-2xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60"
      >
        {busy ? 'Reading face…' : label}
      </button>
    </div>
  )
}
