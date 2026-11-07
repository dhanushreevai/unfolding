import { useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import css from './studio.css?inline'

/*
  Renders its children inside a shadow root with the studio stylesheet, so the studio keeps its
  own look and none of its styles (or the site's) leak across. The children run in their own
  React root, which is re-rendered with the latest children on every render of this component.
*/
export default function ShadowMount({ children, className }) {
  const hostRef = useRef(null)
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = css
    const mount = document.createElement('div')
    mount.className = 'studio-root'
    shadow.append(style, mount)
    const root = createRoot(mount)
    rootRef.current = root
    return () => {
      rootRef.current = null
      // unmount after React finishes the current commit
      setTimeout(() => { root.unmount(); style.remove(); mount.remove() })
    }
  }, [])

  useLayoutEffect(() => {
    rootRef.current?.render(children)
  })

  return <div ref={hostRef} className={className} />
}
