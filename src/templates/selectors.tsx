// external imports
import { createSelector } from 'reselect'

// ivy imports
import { AppState } from '../app/types'
import { Input, InputMap } from '../inputs/types'
import { parseError } from '../core'
import { SpendFromAccount } from '../core/types'
import { isValidInput, getData } from '../inputs/data'

// internal imports
import { TemplateState, SourceMap } from './types'
import { INITIAL_ID_LIST } from './constants'

export const getTemplateState = (state: AppState): TemplateState => state.templates

export const getLockError = createSelector(
  getTemplateState,
  (state: TemplateState) => {
    const error = state.error
    if (typeof error === 'string') {
      return error
    }
    return parseError(error)
  }
)


export const getSourceMap = createSelector(
  getTemplateState,
  (state: TemplateState): SourceMap => state.sourceMap
)

export const getSource = createSelector(
  getTemplateState,
  (state: TemplateState): string => state.source
)

export const getProtectedIdList = createSelector(
  getTemplateState,
  (state: TemplateState): string[] => state.protectedIdList
)

export const getTemplateIds = createSelector(
  getTemplateState,
  state => state.idList
)

export const getTemplate = (id: string) => {
  return createSelector(
    getSourceMap,
    sourceMap => sourceMap[id]
  )
}

export const getInputMap = createSelector(
  getTemplateState,
  templateState => templateState.inputMap
)

export const getInputList = createSelector(
  getInputMap,
  (inputMap) => {
    if (inputMap === undefined) return undefined
    let inputList: Input[] = []
    for (const id in inputMap) {
      inputList.push(inputMap[id])
    }
    return inputList
  }
)

export const getContractValue = createSelector(
  getInputMap,
  getInputList,
  (inputMap: InputMap, inputList: Input[]): SpendFromAccount|undefined => {
    let sources: SpendFromAccount[] = []
    inputList.forEach(input => {
      if (input.type === "valueInput") {
        let inputName = input.name
        let accountId = inputMap[inputName + ".accountInput"].value
        let assetId = inputMap[inputName + ".assetInput"].value
        let amount = parseInt(inputMap[inputName + ".amountInput"].value, 10)
        let password = inputMap[inputName + ".passwordInput"].value
        if (isNaN(amount) || amount < 0 || !accountId || !assetId) {
          return []
        }
        sources.push({
          type: "spendFromAccount",
          accountId: accountId,
          assetId: assetId,
          amount: amount,
          password: password
        } as SpendFromAccount)
      }
    })
    if (sources.length !== 1) return undefined
    return sources[0]
  }
)

export const getCompiled = createSelector(
  getTemplateState,
  (state) => state.compiled
)

export const hasSourceChanged = (source) => {
  return createSelector(
    getSourceMap,
    (sourceMap) => {
      for (const key in sourceMap) {
        if (sourceMap[key] === source) {
          return false
        }
      }
      return true
    }
  )
}

export const getShowLockInputErrors = createSelector(
  getTemplateState,
  (state: TemplateState): boolean => (state as any).showLockInputErrors
)

export const getContractParameters = createSelector(
  getCompiled,
  (compiled) => {
    if (compiled === undefined) {
      return compiled
    }
    return compiled.params
  }
)

export const getOpcodes = createSelector(
  getCompiled,
  (compiled) => {
    if (compiled === undefined) {
      return compiled
    }
    return compiled.opcodes
  }
)

export const getParameterIds = createSelector(
  getContractParameters,
  (contractParameters) => {
    return contractParameters && contractParameters
      .map(param => "contractParameters." + param.name)
  }
)

export const getContractValueId = createSelector(
  getCompiled,
  (compiled) => compiled && ("contractValue." + compiled.value)
)

export const areInputsValid = createSelector(
  getInputMap,
  getParameterIds,
  getContractValueId,
  (inputMap, parameterIds, contractValueId) => {
    if (inputMap === undefined || parameterIds === undefined || contractValueId === undefined) {
      return false
    }
    const invalid = [...parameterIds, contractValueId].filter(id => {
      return !isValidInput(id, inputMap)
    })
    return invalid.length === 0
  }
)

export const getContractArgs = (state, inputMap) => {
  let parameterIds = getParameterIds(state)
  if (parameterIds === undefined) throw "parameter IDs should not be undefined when getParameterData is called"
  try {
    let contractArgs: (number|Buffer)[] = []
    for (let id of parameterIds) {
      contractArgs.push(getData(id, inputMap))
    }
    return contractArgs
  } catch (e) {
    console.log(e)
    return []
  }
}

export const getSelectedTemplate = createSelector(
  getCompiled,
  getSourceMap,
  (compiled, sourceMap) => {
    if (compiled === undefined ||
        sourceMap[compiled.name] === undefined) {
      return ""
    } else {
      return compiled.name
    }
  }
)