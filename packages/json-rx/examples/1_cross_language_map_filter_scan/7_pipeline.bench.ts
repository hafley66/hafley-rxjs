import { Subject } from 'rxjs'
import { bench, describe } from 'vitest'
import type { NumberInput, Total } from './0_models'
import { runningTotal } from './4_pipeline.auto'
import { runningTotalHandwritten } from './6_handwritten'

const inputSizes = [1_000, 10_000, 100_000]
type Pipeline = (inputs: { value: Subject<NumberInput> }) => ReturnType<typeof runningTotal>

function runPipeline(pipeline: Pipeline, inputSize: number): Total | undefined {
  const value = new Subject<NumberInput>()
  let total: Total | undefined
  const subscription = pipeline({ value }).subscribe((next) => {
    total = next
  })

  for (let index = 0; index < inputSize; index++) value.next(index)

  subscription.unsubscribe()
  return total
}

describe('map-filter-scan baseline', () => {
  for (const inputSize of inputSizes) {
    bench(`generated/${inputSize}`, () => runPipeline(runningTotal, inputSize))
    bench(`handwritten/${inputSize}`, () => runPipeline(runningTotalHandwritten, inputSize))
  }
})
