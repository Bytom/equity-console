//external imports
import * as React from 'react'
import { strToHexCharCode } from '../contracts/util'
import { BTM_ASSET_ID } from '../contracts/constants'

import {
  Input,
  ComplexInput,
  InputType,
  InputMap,
  PrimaryInputType,
  InputContext,
  HashInput,
  ProgramInput,
  PublicKeyInput,
  GenerateStringInput,
  GenerateHashInput,
  ParameterInput,
  ProvideHashInput,
  KeyMap,
  isHash,
  ClauseParameterType,
  ClauseParameterHash, // clause parameters are a superset of contract parameters
  AssetInput
} from './types'

let Promise = require('prfun')

import * as crypto from 'crypto'

import {
  client
} from '../core'

import {
  sha3_256
} from 'js-sha3'

import { MIN_TIMESTAMP, MAX_NUMBER, MIN_NUMBER, MAX_UINT32, MAX_UINT16 } from './constants'
import templates from '../templates'

export function sha256(buf: Buffer): Buffer {
  return crypto.createHash('sha256').update(buf).digest()
}

export const computeDataForInput = (id: string, inputMap: InputMap): string => {
  let data = getData(id, inputMap)
  if (typeof data === "number") throw "should not get data for a number"
  return data.toString('hex')
}

export function getData(inputId: string, inputsById: { [s: string]: Input }): Buffer | number {
  let input = inputsById[inputId]
  if (!validateInput(input)) throw "invalid input: " + input.name
  switch (input.type) {
    case "timeInput":
    case "parameterInput":
    case "stringInput":
    case "hashInput":
    case "signatureInput":
      return getData(getChild(input), inputsById)
    case "programInput":
    case "publicKeyInput": {
      if (input.computedData === undefined) throw "input.computedData unexpectedly undefined"
      return Buffer.from(input.computedData, 'hex')
    }
    case "provideStringInput":
    case "providePublicKeyInput":
    case "provideHashInput":
    case "provideSignatureInput":
      return Buffer.from(input.value, 'hex')
    case "assetInput": {
      return Buffer.from(input.computedData, 'hex')
    }
    case "numberInput":
    case "amountInput": {
      return parseInt(input.value, 10)
    }
    case "booleanInput": {
      return (input.value === "true") ? 0 : 1
    }
    case "timestampTimeInput": {
      return Date.parse(input.value)
    }
    case "generateStringInput": {
      let generated = getGenerateStringInputValue(input)
      return Buffer.from(generated, 'hex')
    }
    case "provideOriginInput": {
      return Buffer.from(strToHexCharCode(input.value), "hex")
    }
    case "generateHashInput": {
      let childData = getData(getChild(input), inputsById)
      if (typeof childData === "number") throw "should not generate hash of a number"
      switch (input.hashType.hashFunction) {
        case "sha256": return sha256(childData)
        case "sha3": return Buffer.from(sha3_256(childData), "hex")
        default: throw "unexpected hash function"
      }
    }
    default:
      throw "should not call getData with " + input.type
  }
}

export const getInputNameContext = (name: string) => {
  return name.split(".")[0] as InputContext
}

export const getInputContext = (input: Input): InputContext => {
  return getInputNameContext(input.name)
}

export const getParameterIdentifier = (input: ParameterInput): string => {
  switch (getInputContext(input)) {
    case "contractParameters":
    case "contractValue": return input.name.split(".")[1]
    case "clauseParameters": return input.name.split(".")[2]
    case "clauseValue": return input.name.split(".")[2]
    default:
      throw "unexpected input for getParameterIdentifier: " + input.name
  }
}

export const getChild = (input: ComplexInput): string => {
  return input.name + "." + input.value
}

export const isPrimaryInputType = (str: string): str is PrimaryInputType => {
  switch (str) {
    case "hashInput":
    case "numberInput":
    case "booleanInput":
    case "stringInput":
    case "publicKeyInput":
    case "timeInput":
    case "signatureInput":
    case "valueInput":
    case "programInput":
    case "assetInput":
    case "amountInput":
    case "provideOriginInput":
      return true
    default:
      return false
  }
}

export const isComplexType = (inputType: InputType) => {
  switch (inputType) {
    case "parameterInput":
    case "generateHashInput":
    case "hashInput":
    case "stringInput":
    case "publicKeyInput":
    case "timeInput":
    case "generatePublicKeyInput":
    case "generateSignatureInput":
    case "signatureInput":
    case "programInput":
      return true
    default:
      return false
  }
}

export const isComplexInput = (input: Input): input is ComplexInput => {
  return isComplexType(input.type)
}

export const getInputType = (type: ClauseParameterType): PrimaryInputType => {
  if (isHash(type)) return "hashInput"
  switch (type) {
    case "Integer": return "numberInput"
    case "Boolean": return "booleanInput"
    case "Hash":
    case "String": return "stringInput"
    case "OriginString": return "provideOriginInput"
    case "PublicKey": return "publicKeyInput"
    case "Time": return "timeInput"
    case "Signature": return "signatureInput"
    case "Value": return "valueInput"
    case "Program": return "programInput"
    case "Asset": return "assetInput"
    case "Amount": return "amountInput"
    default:
      throw "can't yet get input type for " + type
  }
}

export const isValidInput = (id: string, inputMap: InputMap): boolean => {
  const input = inputMap[id]
  switch (input.type) {
    case "parameterInput":
    case "stringInput":
    case "hashInput":
    case "generateHashInput":
    case "publicKeyInput":
    case "timeInput":
    case "signatureInput":
    case "programInput":
    case "signatureInput":
      return isValidInput(getChild(input), inputMap)
    case "valueInput":
      return isValidInput(input.name + ".accountInput", inputMap) &&
        isValidInput(input.name + ".assetInput", inputMap) &&
        isValidInput(input.name + ".amountInput", inputMap) &&
        isValidInput(input.name + ".passwordInput", inputMap) &&
        isValidInput(input.name + ".gasInput", inputMap)
    default: return validateInput(input)
  }
}

const validateHex = (str: string): boolean => {
  return (/^([a-f0-9][a-f0-9])*$/.test(str))
}

function validateJson(str: string) {
  try {
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}


export const validateInput = (input: Input): boolean => {
  // validates that an individual
  // does not validate child inputs
  let numberValue
  switch (input.type) {
    case "parameterInput":
    case "generateHashInput":
      return isPrimaryInputType(input.value)
    case "stringInput":
      return (input.value === "generateStringInput" ||
        input.value === "provideStringInput")
    case "hashInput":
      return (input.value === "generateHashInput" ||
        input.value === "provideHashInput")
    case "publicKeyInput":
    case "programInput":
      return (input.value === "accountInput" || input.value === "provideStringInput")
    case "generatePublicKeyInput":
      return (input.value === "generatePrivateKeyInput" ||
        input.value === "providePrivateKeyInput")
    case "timeInput":
      return (input.value === "timestampTimeInput")
    case "generatePublicKeyInput":
      return input.value === "accountInput"
    case "generateSignatureInput":
      return (input.value === "providePrivateKeyInput")
    case "provideStringInput":
      return validateHex(input.value)
    case "provideHashInput":
      if (!validateHex(input.value)) return false
      switch (input.hashFunction) {
        case "sha256":
        case "sha3":
          return input.value.length === 64
        default:
          throw 'unsupported hash function: ' + input.hashFunction
      }
    case "generateStringInput": {
      let length = parseInt(input.value, 10)
      if (isNaN(length) || length < 0 || length > 520) return false
      return (input.seed.length == 1040)
    }
    case "booleanInput":
      return (input.value === "true" ||
        input.value === "false")
    case "numberInput":
      numberValue = parseInt(input.value, 10)
      if (isNaN(numberValue)) return false
      return (numberValue >= MIN_NUMBER && numberValue <= MAX_NUMBER)
    case "timestampTimeInput":
      return !Number.isNaN(Date.parse(input.value))
    case "amountInput":
      numberValue = parseInt(input.value, 10)
      if (isNaN(numberValue)) return false
      if (numberValue < 0) return false
      return true
    case "accountInput":
    case "xpubInput":
    case "pathInput":
    case "assetInput":
    case "passwordInput":
    case "gasInput":
    case "btmUnitInput":
    case "signatureInput":
    case "assetAliasWithBTMInput":
    case "provideOriginInput":
      return (input.value !== "")
    case "assetAliasInput": {
      return input.value !== "" && input.value !== BTM_ASSET_ID
    }
    case "valueInput":
      // TODO(dan)
      return true
    case "choosePublicKeyInput":
      return input.keyMap != undefined
    // return (input.keyMap !== undefined) && (input.keyMap[input.value] !== undefined)
    default:
      throw 'input type not valid ' + input.type
  }
}

export const getGenerateStringInputValue = (input: GenerateStringInput) => {
  let length = parseInt(input.value, 10)
  if (isNaN(length) || length < 0 || length > 520)
    throw "invalid length value for generateStringInput: " + input.value
  return input.seed.slice(0, length * 2) // dumb, for now
}

function addHashInputs(inputs: Input[], type: ClauseParameterHash, parentName: string) {
  let name = parentName + ".generateHashInput"
  let value = getInputType("OriginString")
  let generateHashInput: GenerateHashInput = {
    type: "generateHashInput",
    hashType: type,
    value: value,
    name: name
  }
  inputs.push(generateHashInput)
  addInputForType(inputs, "OriginString", name)

  let hashType = generateHashInput.hashType.inputType

  let provideHashInput: ProvideHashInput = {
    type: "provideHashInput",
    hashFunction: type.hashFunction,
    value: "",
    name: parentName + ".provideHashInput"
  }
  inputs.push(provideHashInput)
}

function addHashInput(inputs: Input[], type: ClauseParameterHash, parentName: string) {
  let name = parentName + ".hashInput"
  let hashInput: HashInput = {
    type: "hashInput",
    hashType: type,
    value: "generateHashInput",
    name: name
  }
  inputs.push(hashInput)
  addHashInputs(inputs, type, name)
}



export function getDefaultContractParameterValue(inputType: InputType, inputContext: InputContext): string {
  switch (inputType) {
    case "parameterInput":
    case "generateHashInput":
    case "booleanInput":
      return "false"
    case "generateStringInput":
      return "32"
    case "numberInput":
    case "timestampTimeInput":
      return ""
    case "provideStringInput":
    case "provideHashInput":
    case "providePublicKeyInput":
    case "providePrivateKeyInput":
    case "provideSignatureInput":
      return ""
    case "stringInput":
      return "generateStringInput"
    case "hashInput":
      return "generateHashInput"
    case "generatePublicKeyInput":
      return "generatePrivateKeyInput"
    case "publicKeyInput":
      return "accountInput"
    // return "generatePublicKeyInput"
    // return "generateSignatureInput"
    case "generateSignatureInput":
      return "providePrivateKeyInput"
    case "programInput":
      return "accountInput"
    case "booleanInput":
      return "false"
    case "timeInput":
      return "timestampTimeInput"
    case "assetInput":
      if (inputContext === "contractValue") {
        return "assetAliasInput"
      }
      return "assetAliasWithBTMInput"
    case "provideOriginInput":
    case "accountInput":
    case "assetAliasInput":
    case "xpubInput":
    case "pathInput":
    case "valueInput":
    case "assetInput":
    case "amountInput":
    case "passwordInput":
    case "gasInput":
    case "btmUnitInput":
      return ""
    case "signatureInput":
    case "choosePublicKeyInput":
    case "generatePrivateKeyInput":
      throw inputType + ' should not be allowed'
  }
}

export function getDefaultUnlockValue(inputType: InputType, inputContext: InputContext): string {
  switch (inputType) {
    case "programInput":
      return "generateProgramInput"
    default: // fall back for now
      return getDefaultContractParameterValue(inputType, inputContext)
  }
}

export function getDefaultClauseParameterValue(inputType: InputType): string {
  switch (inputType) {
    case "parameterInput":
    case "generateHashInput":
      throw "getDefaultClauseParameterValue should not be called on " + inputType
    case "booleanInput":
      return "false"
    case "generateStringInput":
      return "32"
    case "numberInput":
    case "timestampTimeInput":
      return ""
    case "provideStringInput":
    case "provideHashInput":
    case "providePublicKeyInput":
    case "providePrivateKeyInput":
    case "provideSignatureInput":
      return ""
    case "stringInput":
      return "provideStringInput"
    case "hashInput":
      return "provideHashInput"
    case "publicKeyInput":
      return "accountInput"
    case "assetInput":
      return "assetAliasInput"
    case "signatureInput":
      return "accountInput"
    case "generatePublicKeyInput":
    case "generateSignatureInput":
      return "providePrivateKeyInput"
    case "booleanInput":
      return "false"
    case "timeInput":
      return "blockheightTimeInput"
    case "programInput":
      return "accountInput"
    case "accountInput":
    case "xpubInput":
    case "pathInput":
    case "assetInput":
    case "valueInput":
    case "assetAliasInput":
    case "amountInput":
    case "passwordInput":
    case "gasInput":
    case "btmUnitInput":
    case "choosePublicKeyInput":
      return ""
    case "generatePrivateKeyInput":
      throw inputType + " should not be allowed"
  }
}


export function getPromisedInputMap(inputsById: { [s: string]: Input }): Promise<{ [s: string]: Input }> {
  let newInputsById = {}
  for (let id in inputsById) {
    let input = inputsById[id]
    if (input.type === "publicKeyInput" || input.type === "programInput" || input.type === "assetInput") {
      newInputsById[id] = getPromiseData(id, inputsById)
    } else {
      newInputsById[id] = input
    }
  }
  return Promise.props(newInputsById)
}

export function getPromiseCompiled(source) {
  return Promise.props(client.compile(source));
}

export function getPromiseData(inputId: string, inputsById: { [s: string]: Input }): Promise<Input> {
  let input = inputsById[inputId]
  switch (input.type) {
    case "assetInput": {
      let inputValue = inputsById[input.name + "." + input.value].value
      let assetInput: AssetInput = {
        ...input as AssetInput,
        computedData: inputValue
      }
      return new Promise((resolve) => resolve(assetInput))
    }
    case "programInput": {
      let inputValue = inputsById[input.name + "." + input.value].value
      if (input.value === "provideStringInput") {
        let programInput: ProgramInput = {
          ...input as ProgramInput,
          computedData: inputValue
        }
        return new Promise((resolve) => resolve(programInput))
      }
      return client.listReceiver(inputValue).then((receiver) => {
        let programInput: ProgramInput = {
          ...input as ProgramInput,
          computedData: receiver.control_program
        }
        return programInput
      })
    }
    case "publicKeyInput": {
      let inputValue = inputsById[input.name + "." + input.value].value
      if (input.value === "provideStringInput") {
        let publicKeyInput: PublicKeyInput = {
          ...input as PublicKeyInput,
          computedData: inputValue
        }
        return new Promise((resolve) => {
          resolve(publicKeyInput)
        })
      }
      return client.createAccountPubkey(inputValue).then((publicKey) => {
        let publicKeyInput: PublicKeyInput = {
          ...input as PublicKeyInput,
          computedData: publicKey.pubkey_infos[0].pubkey,
          keyData: {
            rootXpub: publicKey.root_xpub,
            pubkeyDerivationPath: publicKey.pubkey_infos[0].pubkey_derivation_path
          }
        }
        return publicKeyInput
      })
    }
    default: throw "cannot call getPromiseData with " + input.type
  }
}

export function getDefaultValue(inputType, name): string {
  const inputContext = getInputNameContext(name)
  switch (inputContext) {
    case "clauseParameters": return getDefaultClauseParameterValue(inputType)
    case "contractParameters": return getDefaultContractParameterValue(inputType, inputContext)
    case "contractValue": return getDefaultContractParameterValue(inputType, inputContext)
    case "clauseValue": return getDefaultClauseParameterValue(inputType)
    case "unlockValue": return getDefaultUnlockValue(inputType, inputContext)
  }
}

export function addDefaultInput(inputs: Input[], inputType: InputType, parentName) {
  let name = parentName + "." + inputType
  let inputContext = parentName.split(".").shift() as InputContext
  let value = getDefaultValue(inputType, name)
  switch (inputType) {
    case "generateStringInput": {
      let seed = crypto.randomBytes(520).toString('hex')
      inputs.push({
        type: "generateStringInput",
        value: value as any,
        seed: seed,
        name: name
      })
      break
    }
    case "btmUnitInput":{
      inputs.push({
        type: "btmUnitInput",
        value: 'btm',
        name: name
      })
      break
    }
    default:
      inputs.push({
        type: inputType as any,
        value: value,
        name: name
      })
  }
  switch (inputType) {
    case "stringInput": {
      addDefaultInput(inputs, "generateStringInput", name)
      addDefaultInput(inputs, "provideStringInput", name)
      return
    }
    case "publicKeyInput": {
      addDefaultInput(inputs, "accountInput", name)
      addDefaultInput(inputs, "provideStringInput", name)
      return
    }
    case "generatePublicKeyInput": {
      addDefaultInput(inputs, "generatePrivateKeyInput", name)
      addDefaultInput(inputs, "providePrivateKeyInput", name)
    }
    case "timeInput": {
      addDefaultInput(inputs, "timestampTimeInput", name)
      return
    }
    case "signatureInput": {
      addDefaultInput(inputs, "accountInput", name)
      return
    }
    case "generateSignatureInput": {
      addDefaultInput(inputs, "providePrivateKeyInput", name)
      return
    }
    case "valueInput": {
      addDefaultInput(inputs, "accountInput", name)
      addDefaultInput(inputs, "assetInput", name)
      addDefaultInput(inputs, "amountInput", name)
      addDefaultInput(inputs, "passwordInput", name)
      addDefaultInput(inputs, "gasInput", name)
      return
    }
    case "programInput": {
      addDefaultInput(inputs, "accountInput", name)
      addDefaultInput(inputs, "provideStringInput", name)
      return
    }
    case "assetInput": {
      if (inputContext === "contractValue" || inputContext === "clauseParameters") {
        addDefaultInput(inputs, "assetAliasInput", name)
      } else {
        addDefaultInput(inputs, "assetAliasWithBTMInput", name)
      }
      addDefaultInput(inputs, "provideStringInput", name)
      return
    }
    case "gasInput": {
      addDefaultInput(inputs, "btmUnitInput", name)
     }
    default:
      return
  }
}

function addInputForType(inputs: Input[], parameterType: ClauseParameterType, parentName: string) {
  if (isHash(parameterType)) {
    addHashInput(inputs, parameterType, parentName)
  } else {
    addDefaultInput(inputs, getInputType(parameterType), parentName)
  }
}

export function addParameterInput(inputs: Input[], valueType: ClauseParameterType, name: string) {
  let inputType = getInputType(valueType)
  let parameterInput: ParameterInput = {
    type: "parameterInput",
    value: inputType,
    valueType: valueType,
    name: name
  }
  inputs.push(parameterInput)
  addInputForType(inputs, valueType, name)
}

export function getPublicKeys(inputsById: { [s: string]: Input }) {
  let mapping: KeyMap = {}
  for (let id in inputsById) {
    let input = inputsById[id]
    if (input.type === "publicKeyInput") {
      if (input.computedData === undefined) throw 'input.computedData unexpectedly undefined'
      if (input.keyData === undefined) throw 'input.keyData unexpectedly undefined'
      mapping[input.computedData] = input.keyData
    }
  }
  return mapping
}

