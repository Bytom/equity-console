// external imports
import { push } from 'react-router-redux'
import React from 'react'

import { getItemMap } from '../assets/selectors';
import { getItem } from '../accounts/selectors';
import { fetch } from '../accounts/actions';
import {
  setSource,
  updateLockMessage,
  showLockInputMessages
} from '../templates/actions'
import {
  areInputsValid,
  getSource,
  getSourceMap,
  getContractValue,
  getInputMap,
  getContractArgs
} from '../templates/selectors'

import { getUtxoId } from './selectors'

import {
  Action,
  ControlWithAddress,
  ControlWithReceiver,
  DataWitness,
  KeyId,
  Receiver,
  SignatureWitness,
  SpendUnspentOutput,
  WitnessComponent
} from '../core/types'

import { getPromisedInputMap } from '../inputs/data'

import { client, prefixRoute, createLockingTx } from '../core'

export const UPDATE_IS_CALLING = 'contracts/UPDATE_IS_CALLING'

export const updateIsCalling = (isCalling: boolean) => {
  const type = UPDATE_IS_CALLING
  return { type, isCalling }
}

export const CREATE_CONTRACT = 'contracts/CREATE_CONTRACT'

export const create = () => {
  return (dispatch, getState) => {
    dispatch(updateIsCalling(true))
    const state = getState()
    if (!areInputsValid(state)) {
      dispatch(updateIsCalling(false))
      dispatch(showLockInputMessages(true))
      return dispatch(updateLockMessage({_error: 'One or more arguments to the contract are invalid.'}))
    }

    const inputMap = getInputMap(state)
    if (inputMap === undefined) throw "create should not have been called when inputMap is undefined"

    const source = getSource(state)
    const spendFromAccount = getContractValue(state)
    if (spendFromAccount === undefined) throw "spendFromAccount should not be undefined here"
    const assetId = spendFromAccount.assetId
    const amount = spendFromAccount.amount
    const password = spendFromAccount.password

    const promisedInputMap = getPromisedInputMap(inputMap)
    const promisedTemplate = promisedInputMap.then((inputMap) => {
      const args = getContractArgs(state, inputMap).map(param => {
        if (param instanceof Buffer) {
          return { "string": param.toString('hex') }
        }

        if (typeof param === 'string') {
          return { "string": param }
        }

        if (typeof param === 'number') {
          return { "integer": param }
        }

        if (typeof param === 'boolean') {
          return { 'boolean': param }
        }
        throw 'unsupported argument type ' + (typeof param)
      })
      return client.compile(source, args)
    })
    const promisedUtxo = promisedTemplate.then(resp => {
      if(resp.status === 'fail'){
        throw resp.data
      }
      const template = resp.data
      const receiver: Receiver = {
        controlProgram: template.program,
      }
      const controlWithReceiver: ControlWithReceiver = {
        type: "controlWithReceiver",
        receiver,
        assetId,
        amount
      }
      const gas = {
        accountId: spendFromAccount.accountId,
        amount: 20000000,
        type: 'spendFromAccount',
        assetId: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      }
      const actions: Action[] = [spendFromAccount, controlWithReceiver, gas]
      return createLockingTx(actions, password) // TODO: implement createLockingTx
    })

    Promise.all([promisedInputMap, promisedTemplate, promisedUtxo]).then(([inputMap, template, utxo]) => {
      // dispatch({
      //   type: CREATE_CONTRACT,
      //   controlProgram: template.program,
      //   source,
      //   template,
      //   inputMap,
      //   utxo
      // })
      // dispatch(fetch())
      dispatch(setSource(source))
      dispatch(updateIsCalling(false))
      dispatch(updateLockMessage(
        {_success: [
            "transactions has been submited successfully.",
            <a key='transactionID' href={"/dashboard/transactions/"+ utxo.transactionId} target="_blank"> {utxo.transactionId}</a>
          ]
        }))
      dispatch(showLockInputMessages(true))
      // dispatch(push(prefixRoute('/unlock')))
    }).catch(err => {
      console.log(err)
      dispatch(updateIsCalling(false))
      dispatch(updateLockMessage({_error: err}))
      dispatch(showLockInputMessages(true))
    })
  }
}

export const SET_UTXO_ID = 'contracts/SET_UTXO_ID'

export const setUtxoID = (utxoId: string) => {
  return (dispath, getState) => {
    dispath({
      type: SET_UTXO_ID,
      id: utxoId
    })
  }
}

export const SET_CONTRACT_NAME = 'contracts/SET_CONTRACT_NAME'

export const setContractName = (templateName: string) => {
  return (dispath, getState) => {
    const sourceMap = getSourceMap(getState())
    dispath({
      type: SET_CONTRACT_NAME,
      name: templateName
    })
  }
}

export const SET_UTXO_INFO = 'contracts/SET_UTXO_INFO'

export const fetchUtxoInfo = () => {
  return (dispatch, getState) => {
    const state = getState()
    const utxoId = getUtxoId(state)

    client.listUpspentUtxos({
      id: utxoId,
      smart_contract: true
    }).then(data => {
      dispatch({
        type: SET_UTXO_INFO,
        info: data
      })
      dispatch(push(prefixRoute('/unlock/'+ utxoId)))
    })
  }
}

export const UPDATE_INPUT = 'contracts/UPDATE_INPUT'

export const updateInput = (name: string, newValue: string) => {
  return (dispatch, getState) => {
    dispatch({
      type: UPDATE_INPUT,
      name: name,
      newValue: newValue
    })
  }
}
