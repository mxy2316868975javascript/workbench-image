/** Blob 图片渲染：自动管理 object URL 生命周期（漫画项目里的图都存 Blob） */
import { useEffect, useState } from 'react'

export function BlobImage({ blob, className, alt }: { blob?: Blob; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  if (!url) return null
  return <img src={url} className={className} alt={alt} />
}
