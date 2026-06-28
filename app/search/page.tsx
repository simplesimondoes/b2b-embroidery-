import { Suspense } from "react"
import SearchResults from "@/components/search-results"

export const dynamic = "force-dynamic"

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  )
}
