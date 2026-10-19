import { create } from 'zustand'

import {
  getSelectedFuckbuffModel,
  persistFuckbuffModelPick,
} from './fuckbuff-model-store'
import { useFuckbuffSessionStore } from './fuckbuff-session-store'

import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'

export type ChatAdmission = {
  phase: 'requested' | 'confirm' | 'starting' | 'failed'
  model: string
  message?: string
  previousSession?: FuckbuffSessionResponse | null
  metadataChecked?: boolean
}

/** Choosing a model is a preference. Only submitting a message admits it. */
export const useFuckbuffChatStore = create<{
  pickerOpen: boolean
  pickerInitialView: 'model' | 'reasoning'
  nextModel: string | null
  admission: ChatAdmission | null
}>(() => ({
  pickerOpen: false,
  pickerInitialView: 'model',
  nextModel: null,
  admission: null,
}))

function openFuckbuffPicker(initialView: 'model' | 'reasoning') {
  if (useFuckbuffChatStore.getState().admission) return
  useFuckbuffChatStore.setState({
    pickerOpen: true,
    pickerInitialView: initialView,
  })
}

export function openFuckbuffModelPicker() {
  openFuckbuffPicker('model')
}

export function openFuckbuffReasoningPicker() {
  openFuckbuffPicker('reasoning')
}

export function selectFuckbuffChatModel(model: string) {
  if (useFuckbuffChatStore.getState().admission) return
  persistFuckbuffModelPick(model)
  useFuckbuffChatStore.setState({ nextModel: model, pickerOpen: false })
}

export function fuckbuffChatModel() {
  return useFuckbuffChatStore.getState().nextModel ?? getSelectedFuckbuffModel()
}

export function fuckbuffChatNeedsAdmission() {
  const { session } = useFuckbuffSessionStore.getState()
  return (
    session?.status !== 'active' ||
    (session?.status === 'active' && session.model !== fuckbuffChatModel())
  )
}

export function requestFuckbuffChatAdmission() {
  const { admission } = useFuckbuffChatStore.getState()
  if (admission && admission.phase !== 'failed') return
  useFuckbuffChatStore.setState({
    admission: { phase: 'requested', model: fuckbuffChatModel() },
  })
}
