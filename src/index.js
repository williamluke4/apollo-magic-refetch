// @flow

import { ApolloClient } from 'apollo-client'
import getSchemaTypes from './getSchemaTypes'
import type { Types } from './getSchemaTypes'
import doesQueryContain from './doesQueryContain'
export { default as typesQuery } from './typesQuery'

function normalizePredicate(
  predicate: any,
  idField: string
): (data: any) => boolean {
  if (typeof predicate === 'function') return predicate
  let ids = predicate
  if (Array.isArray(ids)) ids = new Set(ids)
  else if (!(ids instanceof Set)) ids = new Set([ids])
  return data => ids.has(data[idField])
}

type Term = [string, any, ?string] | [string, any] | [string]

function every<T>(
  array: $ReadOnlyArray<T>,
  predicate: (elem: T) => boolean
): boolean {
  for (let elem of array) {
    if (!predicate(elem)) return false
  }
  return true
}

export default async function refetch(
  client: mixed,
  typenameOrTerms: string | $ReadOnlyArray<Term>,
  predicate?: ?any,
  idField?: string
): Promise<any> {
  if (!(client instanceof ApolloClient))
    throw new Error(
      `client must be an ApolloClient, instead got: ${String(client)}`
    )

  const types: Types = await getSchemaTypes(client)

  let terms
  if (typeof typenameOrTerms === 'string') {
    terms = [[typenameOrTerms, predicate, idField]]
  } else if (Array.isArray(typenameOrTerms)) {
    terms = typenameOrTerms
  } else {
    throw new Error(`invalid typename or terms: ${typenameOrTerms}`)
  }

  const {
    queryManager: { queries },
  } = client
  let promises = []
  for (let query of queries.values()) {
    const { document, observableQuery } = query
    if (!observableQuery) continue
    let data
    const currentResult = observableQuery.currentResult()
    if (currentResult) data = currentResult.data

    if (
      every(terms, ([typename, predicate, idField]: any) =>
        doesQueryContain(
          document,
          types,
          typename,
          data,
          predicate != null
            ? normalizePredicate(predicate, idField || 'id')
            : null
        )
      )
    ) {
      promises.push(observableQuery.refetch())
    }
  }
  await promises
}
