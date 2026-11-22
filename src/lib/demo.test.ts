import { describe, expect, it } from 'vitest'
import { createDemoState, isDemoMode } from './demo'

describe('demo mode', () => {
  it('没有浏览器 window 时不启用', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('提供自洽的示例任务与图片', () => {
    const demo = createDemoState()
    expect(demo.taskOrder).toHaveLength(4)
    expect(Object.keys(demo.tasks)).toHaveLength(4)
    expect(Object.keys(demo.images)).toHaveLength(6)

    for (const taskId of demo.taskOrder) {
      const task = demo.tasks[taskId]
      expect(task).toBeTruthy()
      expect(['completed', 'running']).toContain(task.status)
      for (const imageId of task.imageIds) {
        const image = demo.images[imageId]
        expect(image?.taskId).toBe(taskId)
        expect(image?.blob?.type).toBe('image/svg+xml')
        expect(image?.thumbBlob?.type).toBe('image/svg+xml')
      }
    }
  })
})
