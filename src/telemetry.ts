/** Local console logging only. No remote analytics or crash reporting. */
import type { Event, ExceptionMetadata } from './telemetry_event'

export function sendException(e: unknown, meta: ExceptionMetadata) {
    console.error(`exception [${meta.exceptionSource}]:`, e, meta.additionalMetadata ?? {})
}

export function sendEvent(e: Event) {
    console.debug('event:', e)
}

/** No-op: nothing is buffered, so there is nothing to flush. */
export async function flush(): Promise<void> {}
