// types
export interface SearchResult {
  origen: string
  codigo: string
  nombre: string
  tipoCod: string | null
  x: number
  y: number
  searchText: string
}

export interface SearchResponse {
  results: SearchResult[]
  count: number
}
