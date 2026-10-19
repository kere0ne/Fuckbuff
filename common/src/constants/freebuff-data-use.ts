// Project profiles and local agent access added to both documents.
const POLICY_EFFECTIVE_DATE = 'November 12, 2026'

export const FUCKBUFF_POLICY_METADATA = {
  version: '2026-11-12',
  effectiveDate: POLICY_EFFECTIVE_DATE,
  lastUpdated: 'October 13, 2026',
  privacyPolicyLastUpdated: 'October 18, 2026',
} as const

export const FUCKBUFF_PRIVACY_POLICY_URL = 'https://freebuff.com/privacy-policy'

export const FUCKBUFF_AI_TRAINING_NOTICE = 'May use data for AI training'

export type FuckbuffModelDataUse = 'service' | 'training'

/**
 * Canonical short-form public copy derived from the Privacy Policy.
 * Product surfaces should import these answers instead of restating data-use
 * promises. Static Markdown/MDX copies are protected by the drift test in
 * `fuckbuff-public-data-use-copy.test.ts`.
 */
export const FUCKBUFF_PUBLIC_DATA_USE_COPY = {
  collectionQuestion: 'Does Fuckbuff collect my data?',
  collectionAnswer:
    'Fuckbuff collects prompts, messages, code, files, repository data, and agent traces when you use features that need them. Depending on the model or feature, AI model providers may also process that data. See the Privacy Policy for the uses and limits that apply.',
  trainingQuestion: 'Is my data used to train AI?',
  trainingAnswer:
    'Only when a model or feature says data may be used for AI training. Fuckbuff or the provider may then keep submissions to develop, train, test, evaluate, fine-tune, and improve AI models or products, and Fuckbuff may share or sell them to third parties. Separately, Fuckbuff may use your data to train the models that choose and measure ads.',
  storageQuestion: 'How is my data used and stored?',
  storageAnswer: `Fuckbuff uses your messages, agent traces, and files to run the service and respond to your requests. We may analyze this data, and how you use the app, to personalize ads and train ad models. We do not give separately uploaded files, project files, or connected repositories to advertising providers. Restricted partners may evaluate repositories you connect to Fuckbuff Cloud, but cannot otherwise use, broadly share, or train on them. See the Privacy Policy for details.`,
  compactTrainingSummary: `Models or features labeled “${FUCKBUFF_AI_TRAINING_NOTICE}” may keep submissions to develop, train, test, evaluate, fine-tune, and improve AI models or products, and Fuckbuff may share or sell them.`,
  compactPrivacySummary: `Messages, agent traces, files, and app usage may be analyzed to personalize ads and train ad models. Separately uploaded files, project files, and connected repositories are not provided to advertising providers. Restricted partners may evaluate connected Cloud repositories, but cannot otherwise use, broadly share, or train on them. Models or features labeled “${FUCKBUFF_AI_TRAINING_NOTICE}” may separately use submissions for AI training.`,
  localExecutionSummary:
    'Fuckbuff edits files locally but sends relevant prompts, code, files, and repository context to its servers and model providers. See the Privacy Policy for details.',
  compactLocalExecutionSummary:
    'Edits run locally, but relevant prompts, code, files, and repository context are sent to Fuckbuff and model providers.',
} as const

export const FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK = {
  start: '<!-- BEGIN GENERATED FUCKBUFF DATA USE -->',
  end: '<!-- END GENERATED FUCKBUFF DATA USE -->',
} as const

export const FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK = {
  start: '{/* BEGIN GENERATED FUCKBUFF DATA USE */}',
  end: '{/* END GENERATED FUCKBUFF DATA USE */}',
} as const

export function renderFuckbuffDataUseFaqMarkdown(): string {
  return `${FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK.start}

**${FUCKBUFF_PUBLIC_DATA_USE_COPY.trainingQuestion}** ${FUCKBUFF_PUBLIC_DATA_USE_COPY.trainingAnswer}

**${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageQuestion}** ${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageAnswer}

See the [Privacy Policy](${FUCKBUFF_PRIVACY_POLICY_URL}) for complete details.

${FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK.end}`
}

export function renderFuckbuffDataUseFaqMdx(): string {
  return `${FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK.start}

## ${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageQuestion}

${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageAnswer}

## ${FUCKBUFF_PUBLIC_DATA_USE_COPY.trainingQuestion}

${FUCKBUFF_PUBLIC_DATA_USE_COPY.trainingAnswer}

See the [Privacy Policy](${FUCKBUFF_PRIVACY_POLICY_URL}) for complete details.

${FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK.end}`
}
